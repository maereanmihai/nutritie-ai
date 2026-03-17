import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { callAI } from '../utils/api';
import { safeParseJson } from '../utils/json';
import { calcMacros } from '../utils/calculations';
import { getCachedSearch, setCachedSearch } from '../utils/searchCache';
import { saveMealSignal, getMealPredictions } from '../utils/mealSignals';
import { getMealComboPredictions, saveMealCombo } from '../utils/mealCombos';

// ─── History helpers ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'ha_food_history_v1';
const FREQ_KEY    = 'ha_food_freq_v1';

export function slugId(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
}
export function addToHistory(food) {
  try {
    const id = (food.id && !food.id.startsWith('search_')) ? food.id : slugId(food.name);
    const entry = { ...food, id, f: food.f || food.fat || 0 };
    const hist = safeParseJson(localStorage.getItem(HISTORY_KEY), []);
    const filtered = hist.filter(h => h.id !== id).slice(0, 29);
    filtered.unshift({ ...entry, usedAt: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    const freq = safeParseJson(localStorage.getItem(FREQ_KEY), {});
    freq[id] = (freq[id] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(freq));
  } catch {}
}
export function getHistory() { return safeParseJson(localStorage.getItem(HISTORY_KEY), []); }
export function getFrequent(allFoods, n = 8) {
  try {
    const freq = safeParseJson(localStorage.getItem(FREQ_KEY), {});
    const hist = safeParseJson(localStorage.getItem(HISTORY_KEY), []);
    const scored = Object.entries(freq).map(([id, count]) => ({ id, count }));
    hist.forEach(h => { if (!freq[h.id]) scored.push({ id: h.id, count: 1 }); });
    return scored.sort((a, b) => b.count - a.count).slice(0, n)
      .map(({ id }) => allFoods.find(f => f.id === id) || hist.find(h => h.id === id))
      .filter(Boolean);
  } catch { return []; }
}

// ─── Photo analysis ───────────────────────────────────────────────────────────
async function analyzeFoodPhoto(base64, mimeType) {
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      system: `Expert nutriționist. Analizezi poze cu mâncare și returnezi DOAR JSON valid.
Format: {"descriere":"ce vezi","alimente":[{"name":"Piept pui","emoji":"🍗","qty_g":150,"kcal_total":248,"p_total":46,"c_total":0,"fat_total":5,"fiber_total":0}],"total":{"kcal":248,"p":46,"c":0,"fat":5,"fiber":0}}
Estimează gramajele vizual. DOAR JSON.`,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Analizează această masă.' }
      ]}]
    })
  });
  const d = await res.json();
  return safeParseJson(d.content?.[0]?.text || '');
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────
async function lookupBarcode(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,brands`);
  const d = await res.json();
  if (d.status !== 1) throw new Error('not found');
  const p = d.product; const n = p.nutriments || {};
  return {
    name: (p.product_name || 'Produs') + (p.brands ? ` (${p.brands.split(',')[0].trim()})` : ''),
    emoji: '🏷', kcal: Math.round(n['energy-kcal_100g'] || 0),
    p: Math.round((n['proteins_100g'] || 0) * 10) / 10,
    c: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat: Math.round((n['fat_100g'] || 0) * 10) / 10,
    f: Math.round((n['fat_100g'] || 0) * 10) / 10,
    fiber: Math.round((n['fiber_100g'] || 0) * 10) / 10,
    cat: 'diverse', barcode, unit: 'g', unitG: 1,
  };
}

// ─── USDA search ──────────────────────────────────────────────────────────────
const usdaMemCache = {};
async function searchUSDA(query, signal) {
  const key = query.toLowerCase().trim();
  if (usdaMemCache[key]) return usdaMemCache[key];
  const apiKey = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&dataType=Foundation,SR%20Legacy&api_key=${apiKey}`, { signal });
  if (!res.ok) throw new Error('USDA error');
  const d = await res.json();
  const results = (d.foods || []).slice(0, 15).map(f => {
    const nuts = f.foodNutrients || [];
    const get = n => Math.round((nuts.find(x => x.nutrientName === n)?.value || 0) * 10) / 10;
    const name = f.description.replace(/,\s*(raw|cooked|boiled|roasted|grilled|frozen|canned)/gi, '').replace(/\s+/g, ' ').trim();
    const lc = name.toLowerCase();
    const cat = /chicken|beef|fish|salmon|tuna|pork|turkey|egg|shrimp/.test(lc) ? 'proteine'
      : /rice|pasta|bread|oat|potato|corn|wheat/.test(lc) ? 'carbs'
      : /broccoli|spinach|carrot|tomato|lettuce|pepper|cucumber/.test(lc) ? 'legume'
      : /apple|banana|orange|berry|grape|mango|strawberry/.test(lc) ? 'fructe'
      : /oil|butter|nuts|almond|avocado|cheese/.test(lc) ? 'grasimi' : 'diverse';
    return { id: `usda_${slugId(name)}`, name, emoji: '🍽', kcal: Math.round(get('Energy')), p: get('Protein'), c: get('Carbohydrate, by difference'), fat: get('Total lipid (fat)'), f: get('Total lipid (fat)'), fiber: get('Fiber, total dietary'), cat, unit: 'g', unitG: 1, source: 'usda' };
  }).filter(f => f.kcal > 0);
  const seen = new Set();
  const deduped = results.filter(f => { const k = f.name.toLowerCase().slice(0, 20); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
  usdaMemCache[key] = deduped;
  return deduped;
}

// ─── Meal types ───────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { id: 'mic_dejun', label: 'Mic dejun', icon: '🌅', color: '#f59e0b' },
  { id: 'pranz',     label: 'Prânz',     icon: '☀️', color: '#f97316' },
  { id: 'cina',      label: 'Cină',      icon: '🌙', color: '#8b5cf6' },
  { id: 'gustare',   label: 'Gustare',   icon: '🍎', color: '#10b981' },
];

// ─── QuantitySetter ───────────────────────────────────────────────────────────
function QuantitySetter({ food, th, onConfirm, onBack, mealType }) {
  const [qty, setQty] = useState(food.unit === 'buc' ? '1' : '100');
  const isUnit = food.unit === 'buc';
  const presets = isUnit ? [1, 2, 3, 4] : [30, 50, 100, 150, 200, 300];
  const divisor = isUnit ? (food.unitG || 100) : 100;
  const qNum = parseFloat(qty || 0);
  const f = qNum / divisor;
  const kcalF = Math.round((food.kcal || 0) * f);
  const pF = Math.round(((food.p || 0) * f) * 10) / 10;
  const cF = Math.round(((food.c || 0) * f) * 10) / 10;
  const fatF = Math.round(((food.f || food.fat || 0) * f) * 10) / 10;
  const mt = MEAL_TYPES.find(m => m.id === mealType);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Food hero */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `1px solid ${th.border}` }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `${th.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', flexShrink: 0 }}>
          {food.emoji || '🍽'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: th.text, marginBottom: '2px' }}>{food.name}</div>
          <div style={{ fontSize: '12px', color: th.text3 }}>{food.kcal} kcal · P:{food.p}g · C:{food.c}g · G:{food.f || food.fat || 0}g per 100g</div>
          {mt && <div style={{ marginTop: '4px', fontSize: '11px', color: mt.color, fontWeight: 700 }}>{mt.icon} {mt.label}</div>}
        </div>
      </div>

      <div style={{ padding: '16px', flex: 1 }}>
        <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>{isUnit ? 'NUMĂR BUCĂȚI' : 'CANTITATE (g)'}</div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {presets.map(n => (
            <button key={n} onClick={() => setQty(String(n))}
              style={{ padding: '10px 18px', borderRadius: '10px', border: `2px solid ${qty === String(n) ? th.accent : th.border}`, background: qty === String(n) ? `${th.accent}15` : th.card2, color: qty === String(n) ? th.accent : th.text2, fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              {n}{isUnit ? '' : 'g'}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal"
            style={{ flex: 1, background: th.card2, border: `2px solid ${th.accent}60`, borderRadius: '12px', padding: '14px 16px', color: th.text, fontSize: '26px', fontWeight: 800, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
          <span style={{ fontSize: '16px', fontWeight: 700, color: th.text3 }}>{food.unit || 'g'}</span>
        </div>

        {/* Live macro */}
        {qNum > 0 && (
          <div style={{ background: `${th.accent}08`, border: `1px solid ${th.accent}20`, borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: th.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>PENTRU {qty}{isUnit ? ' buc' : 'g'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[{l:'Kcal',v:kcalF,c:'#f97316'},{l:'Prot',v:`${pF}g`,c:'#10b981'},{l:'Carbs',v:`${cF}g`,c:'#3b82f6'},{l:'Grăs',v:`${fatF}g`,c:'#f59e0b'}].map(x => (
                <div key={x.l} style={{ textAlign: 'center', background: `${x.c}15`, borderRadius: '10px', padding: '10px 4px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: x.c }}>{x.v}</div>
                  <div style={{ fontSize: '10px', color: x.c, opacity: 0.7 }}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
        <button onClick={onBack} style={{ padding: '15px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Înapoi</button>
        <button onClick={() => onConfirm(food, qNum || 100)} disabled={qNum <= 0}
          style={{ padding: '15px', background: qNum > 0 ? 'linear-gradient(135deg,#f97316,#ef4444)' : th.card2, border: 'none', borderRadius: '14px', color: qNum > 0 ? '#fff' : th.text3, fontSize: '15px', fontWeight: 800, cursor: qNum > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: qNum > 0 ? '0 4px 16px rgba(249,115,22,0.35)' : 'none' }}>
          ✓ Adaugă
        </button>
      </div>
    </div>
  );
}

// ─── FoodItem row ─────────────────────────────────────────────────────────────
function FoodRow({ food, th, onSelect, rightAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${th.border}`, cursor: 'pointer' }} onClick={() => onSelect(food)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
        <div style={{ fontSize: '12px', color: th.text3, marginTop: '2px' }}>
          {food.kcal} cal · {food.qty ? `${food.qty}${food.unit||'g'}` : `1,0 100${food.unit||'g'}`}
        </div>
      </div>
      {rightAction || (
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${th.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '12px' }}>
          <span style={{ fontSize: '18px', color: th.accent, lineHeight: 1, marginTop: '-1px' }}>+</span>
        </div>
      )}
    </div>
  );
}

// ─── Main FoodSearch ──────────────────────────────────────────────────────────
function FoodSearch({ th, darkMode, customFoods, setCustomFoods, onAddMeal, onClose, dayType, todayStats, dayMacros }) {
  const [mealType, setMealType]         = useState(() => {
    const h = new Date().getHours();
    if (h < 10) return 'mic_dejun';
    if (h < 14) return 'pranz';
    if (h < 18) return 'gustare';
    return 'cina';
  });
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [activeTab, setActiveTab]       = useState('all'); // all | recent | meals | retete | my_foods
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [source, setSource]             = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [history, setHistory]           = useState(() => getHistory());

  // Photo
  const [photoState, setPhotoState]     = useState('idle');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoResult, setPhotoResult]   = useState(null);
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  // Barcode
  const [barcodeState, setBarcodeState]   = useState('idle');
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeQty, setBarcodeQty]       = useState('100');
  const [manualBarcode, setManualBarcode] = useState('');
  const videoRef = useRef(null);
  const barcodeReaderRef = useRef(null);

  // List (My Foods)
  const [quantities, setQuantities]     = useState({});

  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const fuseRef  = useRef(null);

  const allFoods = useMemo(() => [...FOODS, ...(customFoods || [])].map(f => ({ ...f, f: f.f || f.fat || 0 })), [customFoods]);
  const foodMap  = useMemo(() => { const m = new Map(); allFoods.forEach(f => m.set(f.id, f)); return m; }, [allFoods]);
  const frequent = useMemo(() => getFrequent(allFoods, 10), [allFoods]);
  const remaining = useMemo(() => {
    if (!dayMacros) return null;
    return { p: Math.max(0,(dayMacros.protein||0)-(todayStats?.protein||0)), c: Math.max(0,(dayMacros.carbs||0)-(todayStats?.carbs||0)), fat: Math.max(0,(dayMacros.fat||0)-(todayStats?.fat||0)) };
  }, [dayMacros, todayStats]);
  const predictedFoods   = useMemo(() => getMealPredictions(allFoods, dayType), [allFoods, dayType, history]);
  const comboPredictions = useMemo(() => getMealComboPredictions(foodMap, dayType, remaining), [foodMap, dayType, remaining, history]);
  const templates        = useMemo(() => safeParseJson(localStorage.getItem('ha_tpl_v1'), []), []);

  const currentMealType = MEAL_TYPES.find(m => m.id === mealType);

  // Init Fuse
  useEffect(() => {
    import('fuse.js').then(m => { fuseRef.current = new m.default(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 }); })
    .catch(() => { const init = () => { fuseRef.current = new window.Fuse(allFoods, { keys: ['name'], threshold: 0.35, distance: 100, minMatchCharLength: 2 }); }; if (window.Fuse) init(); else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js'; s.onload = init; document.head.appendChild(s); } });
  }, [allFoods]);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

  // Barcode scanner
  useEffect(() => {
    if (activeTab !== 'barcode' || barcodeState !== 'scanning') { barcodeReaderRef.current?.reset?.(); return; }
    let stopped = false;
    const load = async () => {
      try {
        if (!window.ZXing) { await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://unpkg.com/@zxing/library@latest/umd/index.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);}); }
        if (stopped) return;
        const hints = new Map();
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS,[window.ZXing.BarcodeFormat.EAN_13,window.ZXing.BarcodeFormat.EAN_8,window.ZXing.BarcodeFormat.UPC_A,window.ZXing.BarcodeFormat.CODE_128]);
        const reader = new window.ZXing.BrowserMultiFormatReader(hints);
        barcodeReaderRef.current = reader;
        await reader.decodeFromVideoDevice(null, videoRef.current, async (result) => {
          if (result && !stopped) { stopped = true; setBarcodeState('loading'); try { const r = await lookupBarcode(result.getText()); setBarcodeResult(r); setBarcodeState('found'); } catch { setBarcodeState('error'); } }
        });
      } catch(e) { console.warn('ZXing:', e); }
    };
    load();
    return () => { stopped = true; barcodeReaderRef.current?.reset?.(); };
  }, [activeTab, barcodeState]);

  // Search
  const doSearch = useCallback(async (q) => {
    if (!q) { setResults([]); setSource(''); setSearching(false); return; }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;

    // Cache instant
    const cached = getCachedSearch(q);
    if (cached?.results?.length) { setResults(cached.results); setSource(`${cached.source}-cache`); setSearching(false); searchUSDA(q, ctrl.signal).then(usda => { if (!ctrl.signal.aborted && usda.length > 0) setCachedSearch(q, usda, 'usda'); }).catch(()=>{}); return; }

    // Local instant
    if (fuseRef.current) {
      const hits = fuseRef.current.search(q, { limit: 8 }).map(r => ({ ...r.item, source: 'local' }));
      if (hits.length > 0 && !ctrl.signal.aborted) { setResults(hits); setSource('local'); }
    }
    setSearching(true);

    // USDA background
    try {
      const usda = await searchUSDA(q, ctrl.signal);
      if (!ctrl.signal.aborted && usda.length > 0) {
        const local = fuseRef.current?.search(q, { limit: 4 }).map(r => ({ ...r.item, source: 'local' })) || [];
        const combined = [...local, ...usda.filter(u => !local.some(l => l.name.toLowerCase() === u.name.toLowerCase()))].slice(0, 10);
        setResults(combined); setSource(local.length > 0 ? 'local+usda' : 'usda');
        setCachedSearch(q, usda, 'usda'); setSearching(false); return;
      }
    } catch(e) { if (e.name === 'AbortError') { setSearching(false); return; } }

    // AI fallback
    const localCount = fuseRef.current?.search(q, { limit: 3 }).length || 0;
    if (localCount < 2) {
      try {
        const reply = await callAI([{ role: 'user', content: q }], `Expert nutritie. Returneaza DOAR JSON array:\n[{"name":"Nume","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]\nValori la 100g. DOAR JSON.`, 400);
        const data = safeParseJson(reply, []);
        if (!ctrl.signal.aborted && Array.isArray(data) && data.length) {
          const norm = data.map(x => ({ ...x, f: x.fat, source: 'ai', unit: 'g', unitG: 1 }));
          setResults(prev => { const ex = prev.filter(p => p.source === 'local'); return [...ex, ...norm.filter(n => !ex.some(e => e.name.toLowerCase() === n.name.toLowerCase()))].slice(0, 10); });
          setSource('ai'); setCachedSearch(q, norm, 'ai');
        }
      } catch {}
    }
    if (!ctrl.signal.aborted) setSearching(false);
  }, [allFoods]);

  const onType = (val) => { setQuery(val); clearTimeout(timerRef.current); if (!val) { setResults([]); setSource(''); return; } timerRef.current = setTimeout(() => doSearch(val), 200); };

  const confirmAdd = (food, qty) => {
    const divisor = food.unit === 'buc' ? (food.unitG || 100) : 100; const f = qty / divisor;
    onAddMeal({ name: food.name, emoji: food.emoji || '🍽', mealType, kcal: Math.round((food.kcal||0)*f), p: Math.round(((food.p||0)*f)*10)/10, c: Math.round(((food.c||0)*f)*10)/10, fat: Math.round(((food.f||food.fat||0)*f)*10)/10, fiber: Math.round(((food.fiber||0)*f)*10)/10 });
    saveMealSignal({ foodId: food.id, qty, dayType }); addToHistory(food); setHistory(getHistory()); onClose();
  };

  const handleFile = (file) => { if (!file?.type.startsWith('image/')) return; const r = new FileReader(); r.onload = e => { setPhotoPreview(e.target.result); setPhotoState('preview'); setPhotoResult(null); }; r.readAsDataURL(file); };
  const analyzePhoto = async () => { if (!photoPreview) return; setPhotoState('analyzing'); try { const b64 = photoPreview.split(',')[1]; const mime = photoPreview.match(/data:(image\/[^;]+);/)?.[1] || 'image/jpeg'; setPhotoResult(await analyzeFoodPhoto(b64, mime)); setPhotoState('done'); } catch { setPhotoState('error'); } };
  const addPhotoMeal = () => { if (!photoResult?.total) return; const t = photoResult.total; onAddMeal({ name: photoResult.descriere || 'Masă fotografiată', emoji: '📷', mealType, kcal: t.kcal, p: t.p, c: t.c, fat: t.fat, fiber: t.fiber || 0 }); setPhotoState('idle'); setPhotoPreview(null); setPhotoResult(null); onClose(); };
  const addBarcodeToLog = () => { if (!barcodeResult) return; const qty = parseFloat(barcodeQty) || 100; const f = qty / 100; onAddMeal({ name: barcodeResult.name, emoji: '🏷', mealType, kcal: Math.round(barcodeResult.kcal*f), p: Math.round(barcodeResult.p*f*10)/10, c: Math.round(barcodeResult.c*f*10)/10, fat: Math.round(barcodeResult.fat*f*10)/10, fiber: Math.round((barcodeResult.fiber||0)*f*10)/10 }); addToHistory({ id: `bc_${barcodeResult.barcode||Date.now()}`, ...barcodeResult }); onClose(); };

  const TABS = [
    { id: 'all',      label: 'Toate'    },
    { id: 'recent',   label: 'Recente'  },
    { id: 'meals',    label: 'Mese'     },
    { id: 'barcode',  label: 'Barcode'  },
    { id: 'photo',    label: 'Poză AI'  },
    { id: 'my_foods', label: 'Al mele'  },
  ];

  const bg   = darkMode ? '#0a0d1a' : '#f1f5f9';
  const card = darkMode ? '#111827' : '#ffffff';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: bg }}>

      {/* ── HEADER ── */}
      <div style={{ background: card, flexShrink: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: 'max(12px,env(safe-area-inset-top)) 14px 10px' }}>
          <button onClick={onClose} style={{ width:'36px',height:'36px',borderRadius:'50%',background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:th.text3,display:'flex',alignItems:'center',justifyContent:'center' }}>←</button>

          {/* Meal type selector — MFP style */}
          <button onClick={() => setShowMealPicker(p => !p)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>
            <span style={{ fontSize:'16px', fontWeight:800, color: currentMealType?.color || th.accent }}>{currentMealType?.icon} {currentMealType?.label}</span>
            <span style={{ fontSize:'12px', color: th.text3 }}>▾</span>
          </button>

          <div style={{ width: '36px' }}/>
        </div>

        {/* Meal type dropdown */}
        {showMealPicker && (
          <div style={{ position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)', background: card, borderRadius:'14px', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', zIndex:10, overflow:'hidden', minWidth:'200px', border:`1px solid ${th.border}` }}>
            {MEAL_TYPES.map(m => (
              <button key={m.id} onClick={() => { setMealType(m.id); setShowMealPicker(false); }}
                style={{ width:'100%', padding:'16px 20px', background: mealType===m.id?`${m.color}12`:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', fontFamily:'inherit' }}>
                <span style={{ fontSize:'20px' }}>{m.icon}</span>
                <span style={{ fontSize:'16px', fontWeight: mealType===m.id?800:500, color: mealType===m.id?m.color:th.text }}>{m.label}</span>
                {mealType===m.id && <span style={{ marginLeft:'auto', color:m.color, fontSize:'16px' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div style={{ padding:'0 14px 10px', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', background: darkMode?'rgba(255,255,255,0.06)':'#f8fafc', border:`1.5px solid ${query?th.accent+'80':th.border}`, borderRadius:'100px', padding:'10px 16px', gap:'8px' }}>
            <span style={{ fontSize:'16px', color:th.text3 }}>🔍</span>
            <input ref={inputRef} value={query} onChange={e=>onType(e.target.value)} placeholder="Caută un aliment" autoComplete="off"
              style={{ flex:1, background:'none', border:'none', outline:'none', color:th.text, fontSize:'15px', fontFamily:'inherit' }}/>
            {searching && <span style={{ fontSize:'14px', color:th.accent }}>⟳</span>}
            {query && !searching && <button onClick={()=>onType('')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'16px',color:th.text3,padding:'0',display:'flex' }}>✕</button>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', overflowX:'auto', paddingBottom:'0', borderBottom:`2px solid ${th.border}` }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedFood(null); if(tab.id==='all'||tab.id==='recent') setTimeout(()=>inputRef.current?.focus(),100); }}
              style={{ padding:'10px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:'13px', fontWeight: activeTab===tab.id?800:500, color: activeTab===tab.id?th.accent:th.text3, borderBottom:`2px solid ${activeTab===tab.id?th.accent:'transparent'}`, whiteSpace:'nowrap', marginBottom:'-2px', transition:'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── QUANTITY SETTER ── */}
      {selectedFood && <QuantitySetter food={selectedFood} th={th} onConfirm={confirmAdd} onBack={()=>setSelectedFood(null)} mealType={mealType}/>}

      {/* ── CONTENT ── */}
      {!selectedFood && (
        <div style={{ flex:1, overflowY:'auto' }} onClick={() => setShowMealPicker(false)}>

          {/* ══ ALL / SEARCH ══ */}
          {(activeTab==='all' || activeTab==='recent') && (
            <>
              {/* Quick actions */}
              {!query && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', padding:'14px' }}>
                  <button onClick={()=>setActiveTab('barcode')} style={{ display:'flex',alignItems:'center',gap:'10px',padding:'14px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                    <span style={{ fontSize:'24px' }}>🔲</span>
                    <span style={{ fontSize:'13px',fontWeight:700,color:th.text }}>Scan Barcode</span>
                  </button>
                  <button onClick={()=>setActiveTab('photo')} style={{ display:'flex',alignItems:'center',gap:'10px',padding:'14px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                    <span style={{ fontSize:'24px' }}>📷</span>
                    <span style={{ fontSize:'13px',fontWeight:700,color:th.text }}>Poză AI</span>
                  </button>
                </div>
              )}

              {/* Meal combos */}
              {!query && comboPredictions.length>0 && (
                <div style={{ padding:'0 0 8px' }}>
                  <div style={{ padding:'10px 16px 6px', fontSize:'12px', fontWeight:700, color:th.text3, letterSpacing:'0.08em' }}>MESE RECOMANDATE</div>
                  {comboPredictions.map((combo,i) => (
                    <div key={i} style={{ display:'flex',alignItems:'center',padding:'13px 16px',borderBottom:`1px solid ${th.border}`,cursor:'pointer' }}
                      onClick={()=>{combo.foods.forEach(item=>{const food=foodMap.get(item.foodId);if(!food)return;const d=food.unit==='buc'?(food.unitG||100):100;const f=item.qty/d;onAddMeal({name:food.name,emoji:food.emoji||'🍽',mealType,kcal:Math.round((food.kcal||0)*f),p:Math.round(((food.p||0)*f)*10)/10,c:Math.round(((food.c||0)*f)*10)/10,fat:Math.round(((food.f||food.fat||0)*f)*10)/10,fiber:Math.round(((food.fiber||0)*f)*10)/10});});onClose();}}>
                      <span style={{ fontSize:'24px',marginRight:'12px' }}>🍽</span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:'15px',fontWeight:600,color:th.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{combo.title}</div>
                        <div style={{ fontSize:'12px',color:th.text3,marginTop:'2px' }}>{combo.kcal} cal</div>
                      </div>
                      <div style={{ width:'32px',height:'32px',borderRadius:'50%',border:`2px solid ${th.accent}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        <span style={{ fontSize:'18px',color:th.accent,lineHeight:1,marginTop:'-1px' }}>+</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions label */}
              {!query && (
                <div style={{ padding:'8px 16px 4px', fontSize:'12px', fontWeight:700, color:th.text3, letterSpacing:'0.08em' }}>
                  {predictedFoods.length > 0 ? 'SUGESTII' : (history.length > 0 ? 'RECENTE' : 'FRECVENTE')}
                </div>
              )}
              {query && results.length > 0 && source && (
                <div style={{ padding:'8px 16px 4px', display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'11px',fontWeight:700,color:'#3b82f6',background:'rgba(59,130,246,0.1)',padding:'2px 8px',borderRadius:'6px' }}>
                    {source.includes('cache')?'⚡':source.includes('usda')?'🇺🇸':source==='ai'?'🤖':'📱'} {source.replace('-cache',' cache')}
                  </span>
                  <span style={{ fontSize:'11px',color:th.text3 }}>{results.length} rezultate</span>
                </div>
              )}

              {/* List */}
              {(query ? results : (predictedFoods.length>0 && !query ? predictedFoods : (history.length>0 ? history.slice(0,15) : frequent))).map((food,i) => (
                <FoodRow key={food.id||i} food={food} th={th} onSelect={f=>{navigator.vibrate?.(8);setSelectedFood(f);}}/>
              ))}

              {query && !searching && results.length===0 && (
                <div style={{ textAlign:'center',padding:'48px 20px',color:th.text3 }}>
                  <div style={{ fontSize:'40px',marginBottom:'12px' }}>😕</div>
                  <div style={{ fontSize:'16px',fontWeight:700,color:th.text2 }}>Niciun rezultat pentru "{query}"</div>
                  <div style={{ fontSize:'13px',marginTop:'8px' }}>Încearcă în engleză sau mai specific</div>
                </div>
              )}
            </>
          )}

          {/* ══ MY MEALS (templates) ══ */}
          {activeTab==='meals' && (
            <div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'14px' }}>
                <button style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'20px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                  <span style={{ fontSize:'28px' }}>🍽</span>
                  <span style={{ fontSize:'13px',fontWeight:700,color:th.accent }}>Crează masă</span>
                </button>
                <button style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'20px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                  <span style={{ fontSize:'28px' }}>📋</span>
                  <span style={{ fontSize:'13px',fontWeight:700,color:th.accent }}>Copiază ziua</span>
                </button>
              </div>
              {templates.length === 0 ? (
                <div style={{ textAlign:'center',padding:'48px 20px',color:th.text3 }}>
                  <div style={{ fontSize:'48px',marginBottom:'12px' }}>🍜</div>
                  <div style={{ fontSize:'16px',fontWeight:800,color:th.text2,marginBottom:'8px' }}>Mesele tale salvate apar aici</div>
                  <div style={{ fontSize:'13px' }}>Salvează combinații favorite pentru log rapid.</div>
                </div>
              ) : templates.map(tpl => (
                <FoodRow key={tpl.id} food={{...tpl, kcal: tpl.kcal}} th={th} onSelect={()=>{onAddMeal({name:tpl.name,emoji:'📋',mealType,kcal:tpl.kcal,p:tpl.p,c:tpl.c,fat:tpl.fat,fiber:tpl.fiber||0});onClose();}}/>
              ))}
            </div>
          )}

          {/* ══ BARCODE ══ */}
          {activeTab==='barcode' && (
            <div style={{ padding:'16px',display:'flex',flexDirection:'column',gap:'12px' }}>
              {barcodeState==='idle' && (<>
                <div style={{ background:card,borderRadius:'18px',padding:'28px 20px',border:`2px dashed ${th.border}`,textAlign:'center' }}>
                  <div style={{ fontSize:'56px',marginBottom:'12px' }}>🔲</div>
                  <div style={{ fontSize:'17px',fontWeight:800,color:th.text,marginBottom:'6px' }}>Scanează codul de bare</div>
                  <div style={{ fontSize:'13px',color:th.text3 }}>EAN-13 · EAN-8 · UPC · Open Food Facts</div>
                </div>
                <button onClick={()=>setBarcodeState('scanning')} style={{ padding:'16px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'16px',fontWeight:800,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 16px rgba(59,130,246,0.35)' }}>📷 Pornește camera</button>
                <div style={{ display:'flex',gap:'8px' }}>
                  <input value={manualBarcode} onChange={e=>setManualBarcode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&manualBarcode){setBarcodeState('loading');lookupBarcode(manualBarcode).then(r=>{setBarcodeResult(r);setBarcodeState('found');}).catch(()=>setBarcodeState('error'));}}} placeholder="Introdu cod manual..."
                    style={{ flex:1,background:card,border:`1.5px solid ${th.border}`,borderRadius:'12px',padding:'13px 14px',color:th.text,fontSize:'14px',outline:'none',fontFamily:'inherit' }}/>
                  <button onClick={()=>{if(!manualBarcode)return;setBarcodeState('loading');lookupBarcode(manualBarcode).then(r=>{setBarcodeResult(r);setBarcodeState('found');}).catch(()=>setBarcodeState('error'));}} style={{ padding:'13px 18px',background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'12px',color:'#3b82f6',fontSize:'16px',fontWeight:700,cursor:'pointer' }}>→</button>
                </div>
              </>)}
              {barcodeState==='scanning' && (<>
                <div style={{ borderRadius:'16px',overflow:'hidden',border:'2px solid #3b82f6',position:'relative',background:'#000' }}>
                  <video ref={videoRef} style={{ width:'100%',maxHeight:'300px',display:'block',objectFit:'cover' }} autoPlay playsInline muted/>
                  <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
                    <div style={{ width:'240px',height:'90px',border:'3px solid #3b82f6',borderRadius:'12px',boxShadow:'0 0 0 2000px rgba(0,0,0,0.5)' }}/>
                  </div>
                  <div style={{ position:'absolute',bottom:'14px',left:0,right:0,textAlign:'center',color:'#fff',fontSize:'13px',fontWeight:700 }}>Pointează spre codul de bare</div>
                </div>
                <button onClick={()=>setBarcodeState('idle')} style={{ padding:'14px',background:card,border:`1.5px solid ${th.border}`,borderRadius:'14px',color:th.text2,fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>✕ Anulează</button>
              </>)}
              {barcodeState==='loading' && (
                <div style={{ background:card,borderRadius:'16px',padding:'36px',textAlign:'center',border:`1px solid ${th.border}` }}>
                  <div style={{ display:'flex',gap:'8px',justifyContent:'center',marginBottom:'12px' }}>{[0,1,2].map(i=><div key={i} style={{ width:'12px',height:'12px',borderRadius:'50%',background:'#3b82f6',animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}</div>
                  <div style={{ fontSize:'14px',color:th.text2 }}>Caut produsul în baza de date...</div>
                </div>
              )}
              {barcodeState==='found' && barcodeResult && (<>
                <div style={{ background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'16px',padding:'16px' }}>
                  <div style={{ fontSize:'11px',color:'#3b82f6',fontWeight:700,letterSpacing:'0.12em',marginBottom:'8px' }}>🔲 PRODUS GĂSIT</div>
                  <div style={{ fontSize:'17px',fontWeight:800,color:th.text,marginBottom:'4px' }}>🏷 {barcodeResult.name}</div>
                  <div style={{ fontSize:'12px',color:th.text3 }}>{barcodeResult.kcal}kcal · P:{barcodeResult.p}g · C:{barcodeResult.c}g · G:{barcodeResult.fat}g / 100g</div>
                </div>
                <div>
                  <div style={{ fontSize:'11px',color:th.text3,fontWeight:700,marginBottom:'8px',letterSpacing:'0.1em' }}>CANTITATE (g)</div>
                  <div style={{ display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'10px' }}>
                    {[30,50,100,150,200,300].map(n=>(
                      <button key={n} onClick={()=>setBarcodeQty(String(n))} style={{ padding:'8px 14px',borderRadius:'9px',border:`1.5px solid ${barcodeQty===String(n)?'#3b82f6':th.border}`,background:barcodeQty===String(n)?'rgba(59,130,246,0.12)':card,color:barcodeQty===String(n)?'#3b82f6':th.text2,fontSize:'14px',fontWeight:700,cursor:'pointer' }}>{n}</button>
                    ))}
                  </div>
                  <input type="number" value={barcodeQty} onChange={e=>setBarcodeQty(e.target.value)} style={{ width:'100%',background:card,border:`1.5px solid ${th.border}`,borderRadius:'10px',padding:'12px',color:th.text,fontSize:'18px',outline:'none',fontFamily:'inherit',textAlign:'center',boxSizing:'border-box' }}/>
                  {parseFloat(barcodeQty)>0 && <div style={{ marginTop:'6px',fontSize:'14px',color:'#3b82f6',fontWeight:700,textAlign:'center' }}>= {Math.round(barcodeResult.kcal*parseFloat(barcodeQty)/100)} kcal · P:{Math.round(barcodeResult.p*parseFloat(barcodeQty)/100*10)/10}g</div>}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px' }}>
                  <button onClick={()=>{setBarcodeState('idle');setBarcodeResult(null);setBarcodeQty('100');setManualBarcode('');}} style={{ padding:'14px',background:card,border:`1.5px solid ${th.border}`,borderRadius:'14px',color:th.text2,fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>🔲 Alt produs</button>
                  <button onClick={addBarcodeToLog} style={{ padding:'14px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 3px 12px rgba(59,130,246,0.35)' }}>✓ Adaugă</button>
                </div>
              </>)}
              {barcodeState==='error' && (<>
                <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'14px',padding:'24px',textAlign:'center' }}>
                  <div style={{ fontSize:'36px',marginBottom:'10px' }}>❌</div>
                  <div style={{ fontSize:'14px',fontWeight:600,color:'#ef4444' }}>Produsul nu a fost găsit în baza de date</div>
                </div>
                <button onClick={()=>{setBarcodeState('idle');setManualBarcode('');}} style={{ padding:'14px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>🔲 Încearcă din nou</button>
              </>)}
            </div>
          )}

          {/* ══ PHOTO AI ══ */}
          {activeTab==='photo' && (
            <div style={{ padding:'16px',display:'flex',flexDirection:'column',gap:'12px' }}>
              {photoState==='idle' && (<>
                <div style={{ background:card,borderRadius:'18px',padding:'32px 20px',border:`2px dashed ${th.border}`,textAlign:'center' }}>
                  <div style={{ fontSize:'56px',marginBottom:'12px' }}>📷</div>
                  <div style={{ fontSize:'17px',fontWeight:800,color:th.text,marginBottom:'6px' }}>Fotografiază farfuria</div>
                  <div style={{ fontSize:'13px',color:th.text3,lineHeight:1.6 }}>AI identifică alimentele și estimează<br/>gramajele și macro-urile automat</div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px' }}>
                  <button onClick={()=>cameraInputRef.current?.click()} style={{ padding:'20px 10px',background:'linear-gradient(135deg,#10b981,#059669)',border:'none',borderRadius:'16px',color:'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',fontFamily:'inherit',fontWeight:800,fontSize:'14px',boxShadow:'0 4px 16px rgba(16,185,129,0.35)' }}>
                    <span style={{ fontSize:'28px' }}>📸</span>Fă poză acum
                  </button>
                  <button onClick={()=>fileInputRef.current?.click()} style={{ padding:'20px 10px',background:card,border:`2px solid ${th.border}`,borderRadius:'16px',color:th.text,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',fontFamily:'inherit',fontWeight:700,fontSize:'14px' }}>
                    <span style={{ fontSize:'28px' }}>🖼</span>Din galerie
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e=>handleFile(e.target.files?.[0])} style={{ display:'none' }}/>
                <input ref={fileInputRef}   type="file" accept="image/*" onChange={e=>handleFile(e.target.files?.[0])} style={{ display:'none' }}/>
              </>)}
              {(photoState==='preview'||photoState==='analyzing') && photoPreview && (<>
                <div style={{ borderRadius:'18px',overflow:'hidden',border:`2px solid ${photoState==='analyzing'?'#10b981':th.border}`,position:'relative' }}>
                  <img src={photoPreview} alt="" style={{ width:'100%',maxHeight:'300px',objectFit:'cover',display:'block' }}/>
                  {photoState==='analyzing' && (
                    <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px' }}>
                      <div style={{ display:'flex',gap:'8px' }}>{[0,1,2].map(i=><div key={i} style={{ width:'12px',height:'12px',borderRadius:'50%',background:'#10b981',animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}</div>
                      <div style={{ color:'#fff',fontSize:'16px',fontWeight:700 }}>AI analizează farfuria...</div>
                    </div>
                  )}
                </div>
                {photoState==='preview' && (
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px' }}>
                    <button onClick={()=>{setPhotoState('idle');setPhotoPreview(null);}} style={{ padding:'14px',background:card,border:`1.5px solid ${th.border}`,borderRadius:'14px',color:th.text2,fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>✕ Altă poză</button>
                    <button onClick={analyzePhoto} style={{ padding:'14px',background:'linear-gradient(135deg,#10b981,#059669)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>🤖 Analizează</button>
                  </div>
                )}
              </>)}
              {photoState==='done' && photoResult && (<>
                <img src={photoPreview} alt="" style={{ width:'100%',maxHeight:'180px',objectFit:'cover',borderRadius:'14px',border:'2px solid rgba(16,185,129,0.3)' }}/>
                <div style={{ background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'12px',padding:'12px 14px' }}>
                  <div style={{ fontSize:'11px',color:'#10b981',fontWeight:700,letterSpacing:'0.12em',marginBottom:'4px' }}>🤖 IDENTIFICAT</div>
                  <div style={{ fontSize:'15px',color:th.text,fontWeight:600 }}>{photoResult.descriere}</div>
                </div>
                {photoResult.alimente?.map((item,i)=>(
                  <div key={i} style={{ display:'flex',alignItems:'center',gap:'10px',padding:'10px 13px',background:card,borderRadius:'12px',border:`1px solid ${th.border}` }}>
                    <span style={{ fontSize:'24px' }}>{item.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'14px',fontWeight:600,color:th.text }}>{item.name}</div>
                      <div style={{ fontSize:'12px',color:th.text3 }}>~{item.qty_g}g · {item.kcal_total} kcal · P:{item.p_total}g</div>
                    </div>
                  </div>
                ))}
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px' }}>
                  <button onClick={()=>{setPhotoState('idle');setPhotoPreview(null);setPhotoResult(null);}} style={{ padding:'14px',background:card,border:`1.5px solid ${th.border}`,borderRadius:'14px',color:th.text2,fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>📷 Altă poză</button>
                  <button onClick={addPhotoMeal} style={{ padding:'14px',background:'linear-gradient(135deg,#10b981,#059669)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>✓ Adaugă</button>
                </div>
              </>)}
              {photoState==='error' && (<>
                <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'14px',padding:'24px',textAlign:'center' }}>
                  <div style={{ fontSize:'36px',marginBottom:'10px' }}>❌</div>
                  <div style={{ fontSize:'14px',fontWeight:600,color:'#ef4444' }}>Analiza a eșuat. Încearcă o poză mai clară, cu lumină bună.</div>
                </div>
                <button onClick={()=>setPhotoState('idle')} style={{ padding:'14px',background:'linear-gradient(135deg,#10b981,#059669)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:'inherit' }}>📷 Încearcă din nou</button>
              </>)}
            </div>
          )}

          {/* ══ MY FOODS (all foods list) ══ */}
          {activeTab==='my_foods' && (
            <div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'14px' }}>
                <button style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'20px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                  <span style={{ fontSize:'28px' }}>🍽</span>
                  <span style={{ fontSize:'13px',fontWeight:700,color:th.accent }}>Adaugă aliment</span>
                </button>
                <button style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'20px',background:card,border:`1px solid ${th.border}`,borderRadius:'14px',cursor:'pointer',fontFamily:'inherit' }}>
                  <span style={{ fontSize:'28px' }}>⚡</span>
                  <span style={{ fontSize:'13px',fontWeight:700,color:th.accent }}>Adaugă rapid</span>
                </button>
              </div>
              {FOODS.map(food => (
                <FoodRow key={food.id} food={food} th={th} onSelect={f=>{navigator.vibrate?.(8);setSelectedFood(f);}}/>
              ))}
            </div>
          )}

          <div style={{ height: '24px' }}/>
        </div>
      )}
    </div>
  );
}

export default FoodSearch;
