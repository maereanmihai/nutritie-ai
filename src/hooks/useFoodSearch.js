import { useState, useRef, useCallback } from 'react';
import { callAI } from '../utils/api';
import { safeParseJson } from '../utils/json';
import { getCachedSearch, setCachedSearch } from '../utils/searchCache';

// ─── USDA search (module-level cache) ────────────────────────────────────────
let usdaCache = {};

function slugId(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

async function searchUSDA(query, signal) {
  const cacheKey = query.toLowerCase().trim();
  if (usdaCache[cacheKey]) return usdaCache[cacheKey];

  const apiKey = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&dataType=Foundation,SR%20Legacy&api_key=${apiKey}`,
    { signal }
  );
  if (!res.ok) throw new Error('USDA error');
  const d = await res.json();

  const results = (d.foods || []).slice(0, 15).map(f => {
    const nuts = f.foodNutrients || [];
    const get = n => Math.round((nuts.find(x => x.nutrientName === n)?.value || 0) * 10) / 10;
    const cleanName = f.description
      .replace(/,\s*(raw|cooked|boiled|roasted|grilled|frozen|canned)/gi, '')
      .replace(/\s+/g, ' ').trim();
    const lc = cleanName.toLowerCase();
    const cat = /chicken|beef|fish|salmon|tuna|pork|turkey|egg|shrimp/.test(lc) ? 'proteine'
      : /rice|pasta|bread|oat|potato|corn|wheat/.test(lc) ? 'carbs'
      : /broccoli|spinach|carrot|tomato|lettuce|pepper|cucumber/.test(lc) ? 'legume'
      : /apple|banana|orange|berry|grape|mango|strawberry/.test(lc) ? 'fructe'
      : /oil|butter|nuts|almond|avocado|cheese/.test(lc) ? 'grasimi' : 'diverse';
    return {
      id: `usda_${slugId(cleanName)}`, name: cleanName, emoji: '🍽',
      kcal: Math.round(get('Energy')), p: get('Protein'),
      c: get('Carbohydrate, by difference'),
      fat: get('Total lipid (fat)'), f: get('Total lipid (fat)'),
      fiber: get('Fiber, total dietary'), cat, unit: 'g', unitG: 1, source: 'usda',
    };
  }).filter(f => f.kcal > 0);

  // Deduplicate
  const seen = new Set();
  const deduped = results.filter(f => {
    const k = f.name.toLowerCase().slice(0, 20);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 6);

  usdaCache[cacheKey] = deduped;
  return deduped;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useFoodSearch(allFoods, fuseRef) {
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [source, setSource]     = useState('');
  const abortRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setSource(''); return; }

    // 0. localStorage cache (USDA + AI only — local e instant)
    const cached = getCachedSearch(q);
    if (cached?.results?.length) {
      setResults(cached.results);
      setSource(`${cached.source}-cache`);
      return;
    }

    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);

    // 1. Fuse.js local (instant, no cache needed)
    if (fuseRef?.current) {
      const localHits = fuseRef.current.search(q, { limit: 8 }).map(r => ({ ...r.item, source: 'local' }));
      if (!ctrl.signal.aborted && localHits.length >= 3) {
        setResults(localHits); setSource('local'); setSearching(false);
        // Background USDA for supplement
        if (localHits.length < 6) {
          searchUSDA(q, ctrl.signal).then(usda => {
            if (ctrl.signal.aborted) return;
            const combined = [
              ...localHits,
              ...usda.filter(u => !localHits.some(l => l.name.toLowerCase() === u.name.toLowerCase()))
            ].slice(0, 10);
            setResults(combined); setSource('local+usda');
            setCachedSearch(q, usda, 'usda'); // cache only USDA part
          }).catch(() => {});
        }
        return;
      }
    }

    // 2. USDA
    try {
      const usda = await searchUSDA(q, ctrl.signal);
      if (!ctrl.signal.aborted && usda.length > 0) {
        setResults(usda); setSource('usda');
        setCachedSearch(q, usda, 'usda'); // cache USDA
        setSearching(false); return;
      }
    } catch (e) {
      if (e.name === 'AbortError') { setSearching(false); return; }
    }

    // 3. AI fallback
    try {
      const reply = await callAI(
        [{ role: 'user', content: q }],
        `Expert nutritie. Returneaza DOAR JSON array:
[{"name":"Nume","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]
Valori la 100g. DOAR JSON.`, 400
      );
      const data = safeParseJson(reply, []);
      if (!ctrl.signal.aborted && Array.isArray(data) && data.length) {
        const normalized = data.map(x => ({ ...x, f: x.fat, source: 'ai', unit: 'g', unitG: 1 }));
        setResults(normalized); setSource('ai');
        setCachedSearch(q, normalized, 'ai'); // cache AI
      }
    } catch {}

    if (!ctrl.signal.aborted) setSearching(false);
  }, [allFoods, fuseRef]);

  return { results, searching, source, search };
}
