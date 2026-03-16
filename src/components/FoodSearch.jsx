import { useState, useRef, useEffect, useMemo } from 'react';
import { FOODS } from '../constants/foods';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { saveMealSignal, getMealPredictions } from '../utils/mealSignals';
import { saveMealCombo, getMealComboPredictions } from '../utils/mealCombos';
import { safeParseJson } from '../utils/json';

// ─── History helpers ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'ha_food_history_v1';
const FREQ_KEY    = 'ha_food_freq_v1';

export function slugId(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics: ș→s ț→t ă→a î→i â→a
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}

// ─── Safe JSON parser ────────────────────────────────────────────────────────

export function addToHistory(food) {
  try {
    const stableId = (food.id && !food.id.startsWith('search_')) ? food.id : slugId(food.name);
    const entry = { ...food, id: stableId, f: food.f || food.fat || 0 };
    const hist = safeParseJson(localStorage.getItem(HISTORY_KEY) || '[]', []);
    const filtered = hist.filter(h => h.id !== stableId).slice(0, 29);
    filtered.unshift({ ...entry, usedAt: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    const freq = safeParseJson(localStorage.getItem(FREQ_KEY) || '{}', {});
    freq[stableId] = (freq[stableId] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(freq));
  } catch {}
}

export function getHistory() {
  try { return safeParseJson(localStorage.getItem(HISTORY_KEY) || '[]', []); } catch { return []; }
}

export function getFrequent(allFoods, n = 8) {
  try {
    const freq = safeParseJson(localStorage.getItem(FREQ_KEY) || '{}', {});
    const hist = safeParseJson(localStorage.getItem(HISTORY_KEY) || '[]', []);
    const scored = [
      ...Object.entries(freq).map(([id, count]) => ({ id, count })),
      ...hist.filter(h => !freq[h.id]).map(h => ({ id: h.id, count: 1 })),
    ];
    return scored
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
      .map(({ id }) => {
        const local = allFoods.find(f => f.id === id);
        if (local) return local;
        return hist.find(h => h.id === id);
      })
      .filter(Boolean);
  } catch { return []; }
}

// ─── Fuse.js loader ───────────────────────────────────────────────────────────
let fuseInstance = null;
async function getFuse(foods) {
  if (fuseInstance) return fuseInstance;
  // Try npm import first, fallback to CDN
  try {
    const Fuse = (await import('fuse.js')).default;
    fuseInstance = new Fuse(foods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
    return fuseInstance;
  } catch {
    // CDN fallback
    if (!window.Fuse) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    fuseInstance = new window.Fuse(foods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
    return fuseInstance;
  }
}

// ─── Quantity Setter Modal ────────────────────────────────────────────────────
function QuantitySetter({ food, th, onConfirm, onBack }) {
  const [qty, setQty] = useState(food.unit === 'buc' ? '1' : '100');
  const isUnit = food.unit === 'buc';
  const presets = isUnit ? [1, 2, 3] : [30, 50, 100, 150, 200, 300];

  const kcalFinal = Math.round((food.kcal || 0) * parseFloat(qty || 0) / (isUnit ? food.unitG || 100 : 100));
  const pFinal    = Math.round(((food.p || 0) * parseFloat(qty || 0) / (isUnit ? food.unitG || 100 : 100)) * 10) / 10;
  const cFinal    = Math.round(((food.c || 0) * parseFloat(qty || 0) / (isUnit ? food.unitG || 100 : 100)) * 10) / 10;
  const fatFinal  = Math.round(((food.f || food.fat || 0) * parseFloat(qty || 0) / (isUnit ? food.unitG || 100 : 100)) * 10) / 10;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
      {/* Food card */}
      <div style={{ background: th.card2, borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '36px' }}>{food.emoji || '🍽'}</span>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: th.text }}>{food.name}</div>
          <div style={{ fontSize: '12px', color: th.text3, marginTop: '2px' }}>
            {food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f || food.fat || 0}g / 100g
          </div>
        </div>
      </div>

      {/* Quantity presets */}
      <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>
        {isUnit ? 'NUMĂR BUCĂȚI' : 'GRAMAJ'}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {presets.map(n => (
          <button key={n} onClick={() => setQty(String(n))}
            style={{ padding: '10px 16px', borderRadius: '10px', border: `2px solid ${qty === String(n) ? th.accent : th.border}`, background: qty === String(n) ? `${th.accent}15` : th.card2, color: qty === String(n) ? th.accent : th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            {n}{isUnit ? '' : 'g'}
          </button>
        ))}
      </div>

      {/* Manual input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <input
          type="number" value={qty} onChange={e => setQty(e.target.value)}
          inputMode="decimal"
          style={{ flex: 1, background: th.card2, border: `2px solid ${th.accent}60`, borderRadius: '12px', padding: '14px 16px', color: th.text, fontSize: '22px', fontWeight: 700, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }}
        />
        <span style={{ fontSize: '16px', fontWeight: 700, color: th.text3 }}>{food.unit || 'g'}</span>
      </div>

      {/* Live macro preview */}
      {qty && parseFloat(qty) > 0 && (
        <div style={{ background: `${th.accent}10`, border: `1px solid ${th.accent}25`, borderRadius: '14px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: th.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>
            PENTRU {qty}{isUnit ? ' buc' : 'g'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { l: 'Kcal', v: kcalFinal, c: '#f97316' },
              { l: 'Prot', v: `${pFinal}g`, c: '#10b981' },
              { l: 'Carbs', v: `${cFinal}g`, c: '#3b82f6' },
              { l: 'Grăs', v: `${fatFinal}g`, c: '#f59e0b' },
            ].map(x => (
              <div key={x.l} style={{ textAlign: 'center', background: `${x.c}15`, borderRadius: '10px', padding: '8px 4px' }}>
                <div style={{ fontSize: '16px', fontWeight: 900, color: x.c }}>{x.v}</div>
                <div style={{ fontSize: '10px', color: x.c, opacity: 0.7 }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }}/>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
        <button onClick={onBack}
          style={{ padding: '15px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Înapoi
        </button>
        <button onClick={() => onConfirm(food, parseFloat(qty) || 100)} disabled={!qty || parseFloat(qty) <= 0}
          style={{ padding: '15px', background: qty && parseFloat(qty) > 0 ? 'linear-gradient(135deg,#f97316,#ef4444)' : th.card2, border: 'none', borderRadius: '14px', color: qty && parseFloat(qty) > 0 ? '#fff' : th.text3, fontSize: '15px', fontWeight: 800, cursor: qty && parseFloat(qty) > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: qty && parseFloat(qty) > 0 ? '0 4px 16px rgba(249,115,22,0.35)' : 'none' }}>
          ✓ Adaugă la jurnal
        </button>
      </div>
    </div>
  );
}

// ─── Main FoodSearch Overlay ──────────────────────────────────────────────────
function FoodSearch({ th, darkMode, customFoods, onAddMeal, onClose, dayType, todayStats, dayMacros }) {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [history, setHistory]           = useState(() => getHistory());
  const inputRef  = useRef(null);
  const timerRef  = useRef(null);
  const fuseRef   = useRef(null); // shared Fuse instance

  const allFoods = useMemo(
    () => [...FOODS, ...customFoods].map(f => ({ ...f, f: f.f || f.fat || 0 })),
    [customFoods]
  );
  const foodMap = useMemo(() => {
    const m = new Map(); allFoods.forEach(f => m.set(f.id, f)); return m;
  }, [allFoods]);
  const frequent = useMemo(() => getFrequent(allFoods, 8), [allFoods]);

  // ── Macro rămase ──
  const remaining = useMemo(() => {
    if (!dayMacros) return null;
    return {
      p:   Math.max(0, (dayMacros.protein || 0) - (todayStats?.protein || 0)),
      c:   Math.max(0, (dayMacros.carbs   || 0) - (todayStats?.carbs   || 0)),
      fat: Math.max(0, (dayMacros.fat     || 0) - (todayStats?.fat     || 0)),
    };
  }, [dayMacros, todayStats]);

  // ── Predicții alimente ──
  const predictedFoods = useMemo(
    () => getMealPredictions(allFoods, dayType),
    [allFoods, dayType, history]
  );

  // ── Predicții mese complete cu auto-porție ──
  const comboPredictions = useMemo(
    () => getMealComboPredictions(foodMap, dayType, remaining),
    [foodMap, dayType, remaining, history]
  );

  // ── Hook: search logic + cache ──
  const { results, searching, source, search } = useFoodSearch(allFoods, fuseRef);

  // Init Fuse.js
  useEffect(() => {
    import('fuse.js').then(m => {
      fuseRef.current = new m.default(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
    }).catch(() => {
      if (!window.Fuse) {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js';
        s.onload = () => { fuseRef.current = new window.Fuse(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 }); };
        document.head.appendChild(s);
      } else {
        fuseRef.current = new window.Fuse(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
      }
    });
  }, [allFoods]);

  // Autofocus
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  // Keyboard close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Init Fuse.js
  useEffect(() => {
    import('fuse.js').then(m => {
      fuseRef.current = new m.default(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
    }).catch(() => {
      if (!window.Fuse) {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js';
        s.onload = () => { fuseRef.current = new window.Fuse(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 }); };
        document.head.appendChild(s);
      } else {
        fuseRef.current = new window.Fuse(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 });
      }
    });
  }, [allFoods]);

  // Autofocus
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  // Keyboard close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 1) {
      setResults([]); setSource('recent'); setSearching(false); return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);

    // 1. Fuse.js local (instant)
    try {
      const fuse = await getFuse(allFoods);
      const localHits = fuse.search(q, { limit: 8 }).map(r => ({ ...r.item, source: 'local' }));
      if (!ctrl.signal.aborted && localHits.length >= 3) {
        setResults(localHits); setSource('local'); setSearching(false);
        // Still fetch USDA in background for more results
        if (localHits.length < 6) {
          searchUSDA(q, ctrl.signal).then(usda => {
            if (ctrl.signal.aborted) return;
            const combined = [...localHits, ...usda.filter(u => !localHits.some(l => l.name.toLowerCase() === u.name.toLowerCase()))].slice(0, 10);
            setResults(combined); setSource('local+usda');
          }).catch(() => {});
        }
        return;
      }
    } catch {}

    // 2. USDA
    try {
      const usda = await searchUSDA(q, ctrl.signal);
      if (!ctrl.signal.aborted && usda.length > 0) {
        setResults(usda); setSource('usda'); setSearching(false); return;
      }
    } catch (e) { if (e.name === 'AbortError') { setSearching(false); return; } }

    // 3. AI fallback
    try {
      const reply = await callAI(
        [{ role: 'user', content: q }],
        `Expert nutritie. Returneaza DOAR JSON array cu 1-5 variante:
[{"name":"Nume","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]
Valori la 100g. DOAR JSON.`, 500
      );
      if (!ctrl.signal.aborted) {
        const r = safeParseJson(reply, []);
        setResults(Array.isArray(r) ? r.map(x => ({ ...x, f: x.fat, source: 'ai', unit: 'g', unitG: 1 })) : []);
        setSource('ai');
      }
    } catch {}
    if (!ctrl.signal.aborted) setSearching(false);
  }, [allFoods]);

  const onType = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    if (!val) return;
    timerRef.current = setTimeout(() => search(val), 200);
  };

  const selectFood = (food) => {
    navigator.vibrate?.(8);
    setSelectedFood(food);
  };

  const confirmAdd = (food, qty) => {
    const isUnit = food.unit === 'buc';
    const divisor = isUnit ? (food.unitG || 100) : 100;
    const f = qty / divisor;
    onAddMeal({
      name: food.name, emoji: food.emoji || '🍽',
      kcal: Math.round((food.kcal || 0) * f),
      p:    Math.round(((food.p || 0) * f) * 10) / 10,
      c:    Math.round(((food.c || 0) * f) * 10) / 10,
      fat:  Math.round(((food.f || food.fat || 0) * f) * 10) / 10,
      fiber: Math.round(((food.fiber || 0) * f) * 10) / 10,
    });
    saveMealSignal({ foodId: food.id, qty, dayType });
    addToHistory(food);
    setHistory(getHistory());
    onClose();
  };

  const sourceInfo = {
    local:        { label: '📱 Local',             color: '#10b981' },
    'local+usda': { label: '📱+🇺🇸 Local & USDA',  color: '#10b981' },
    usda:         { label: '🇺🇸 USDA 600k',         color: '#3b82f6' },
    ai:           { label: '🤖 AI',                color: '#f97316' },
    'usda-cache': { label: '⚡ USDA cache',         color: '#3b82f6' },
    'ai-cache':   { label: '⚡ AI cache',           color: '#f97316' },
    recent:       { label: '🕐 Recent',             color: '#8b5cf6' },
    frequent:     { label: '⭐ Frecvente',          color: '#f59e0b' },
  };

  const displayList = query ? results : (history.length > 0 ? history.slice(0, 12) : frequent);
  const displaySource = query ? source : (history.length > 0 ? 'recent' : 'frequent');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: darkMode ? '#070a12' : '#f8fafc' }}>

      {/* ── HEADER ── */}
      <div style={{ background: darkMode ? '#0c1020' : '#fff', borderBottom: `1px solid ${th.border}`, padding: 'max(12px, env(safe-area-inset-top)) 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => selectedFood ? setSelectedFood(null) : onClose()}
            style={{ width: '38px', height: '38px', borderRadius: '10px', background: th.card2, border: `1px solid ${th.border}`, cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ←
          </button>
          {!selectedFood && (
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => onType(e.target.value)}
                placeholder="Caută orice aliment..."
                autoComplete="off"
                style={{ width: '100%', background: th.card2, border: `2px solid ${query ? th.accent + '80' : th.border}`, borderRadius: '12px', padding: '11px 12px 11px 40px', color: th.text, fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              />
              {searching && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: th.accent, animation: 'pulse 1s infinite' }}>⟳</span>}
              {query && !searching && <button onClick={() => onType('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: th.text3 }}>✕</button>}
            </div>
          )}
          {selectedFood && (
            <div style={{ flex: 1, fontSize: '16px', fontWeight: 700, color: th.text }}>{selectedFood.name}</div>
          )}
        </div>

        {/* Source badge */}
        {displaySource && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: sourceInfo[displaySource]?.color || th.text3, background: `${sourceInfo[displaySource]?.color || th.text3}15`, padding: '2px 8px', borderRadius: '6px' }}>
              {sourceInfo[displaySource]?.label}
            </span>
            {displayList.length > 0 && <span style={{ fontSize: '11px', color: th.text3 }}>{displayList.length} rezultate</span>}
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      {selectedFood ? (
        <QuantitySetter food={selectedFood} th={th} onConfirm={confirmAdd} onBack={() => setSelectedFood(null)} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Empty state */}
          {!query && displayList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: th.text3 }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: th.text2, marginBottom: '6px' }}>Caută orice aliment</div>
              <div style={{ fontSize: '13px', lineHeight: 1.6 }}>Local · USDA 600k+ alimente · AI</div>
            </div>
          )}

          {/* ── MEAL COMBOS — mese complete cu auto-porție ── */}
          {!query && comboPredictions.length > 0 && (
            <>
              <div style={{ padding: '12px 14px 4px', fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em' }}>
                🍽 MESE RECOMANDATE ACUM
              </div>
              {comboPredictions.map((combo, i) => (
                <button key={i}
                  onClick={() => {
                    combo.foods.forEach(item => {
                      const food = foodMap.get(item.foodId);
                      if (!food) return;
                      const divisor = food.unit === 'buc' ? (food.unitG || 100) : 100;
                      const f = item.qty / divisor;
                      onAddMeal({ name: food.name, emoji: food.emoji || '🍽', kcal: Math.round((food.kcal||0)*f), p: Math.round(((food.p||0)*f)*10)/10, c: Math.round(((food.c||0)*f)*10)/10, fat: Math.round(((food.f||food.fat||0)*f)*10)/10, fiber: Math.round(((food.fiber||0)*f)*10)/10 });
                    });
                    onClose();
                  }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'none', border:'none', borderBottom:`1px solid ${th.border}`, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${th.accent}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>🍽</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:th.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{combo.title}</div>
                    <div style={{ fontSize:'12px', color:th.text3, marginTop:'2px' }}>{combo.kcal} kcal · P:{combo.p}g · C:{combo.c}g · G:{combo.fat}g</div>
                  </div>
                  <div style={{ fontSize:'11px', color:th.accent, fontWeight:700, background:`${th.accent}15`, padding:'4px 8px', borderRadius:'7px', flexShrink:0 }}>1 tap</div>
                </button>
              ))}
            </>
          )}

          {/* ── PREDICȚII ALIMENTE ── */}
          {!query && predictedFoods.length > 0 && (
            <>
              <div style={{ padding: '12px 14px 4px', fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em' }}>
                🔮 PROBABIL VREI ACUM
              </div>
              {predictedFoods.map(food => (
                <button key={food.id} onClick={() => selectFood(food)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'none', border:'none', borderBottom:`1px solid ${th.border}`, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${th.accent}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', flexShrink:0 }}>{food.emoji||'🍽'}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'14px', fontWeight:600, color:th.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{food.name}</div>
                    <div style={{ fontSize:'12px', color:th.text3, marginTop:'2px' }}>Bazat pe obiceiurile tale</div>
                  </div>
                  <div style={{ fontSize:'20px', color:th.text3 }}>›</div>
                </button>
              ))}
            </>
          )}

          {/* Section label */}
          {!query && displayList.length > 0 && (
            <div style={{ padding: '12px 14px 4px', fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em' }}>
              {history.length > 0 ? '🕐 RECENT FOLOSITE' : '⭐ FRECVENTE'}
            </div>
          )}

          {/* Results list */}
          {displayList.map((food, i) => (
            <button key={food.id || i} onClick={() => selectFood(food)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${th.border}`, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: th.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                {food.emoji || '🍽'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
                <div style={{ fontSize: '12px', color: th.text3, marginTop: '2px' }}>
                  {food.kcal} kcal · P:{food.p}g · C:{food.c}g · G:{food.f || food.fat || 0}g
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: 'rgba(150,150,150,0.5)' }}>/ 100{food.unit || 'g'}</span>
                </div>
              </div>
              <div style={{ fontSize: '20px', color: th.text3, flexShrink: 0 }}>›</div>
            </button>
          ))}

          {/* No results */}
          {query && !searching && displayList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: th.text3 }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>😕</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2 }}>Niciun rezultat pentru "{query}"</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>Încearcă în engleză sau mai specific</div>
            </div>
          )}

          <div style={{ height: '20px' }}/>
        </div>
      )}
    </div>
  );
}

export default FoodSearch;
