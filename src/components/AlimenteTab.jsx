import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { callAI } from '../utils/api';
import { calcMacros } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { K, ls, lsSave } from '../utils/storage';

// ─── Photo analysis ───────────────────────────────────────────────────────────
async function analyzeFoodPhoto(base64, mimeType) {
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      system: `Expert nutriționist. Analizezi poze cu mâncare și returnezi DOAR JSON valid, fără text extra.
Format:
{"descriere":"ce vezi","alimente":[{"name":"Piept pui","emoji":"🍗","qty_g":150,"kcal_total":248,"p_total":46,"c_total":0,"fat_total":5,"fiber_total":0}],"total":{"kcal":248,"p":46,"c":0,"fat":5,"fiber":0}}
Estimează gramajele vizual. DOAR JSON.`,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Analizează această masă.' }
      ]}]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return JSON.parse((d.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
}

// ─── Barcode lookup via Open Food Facts ──────────────────────────────────────
async function lookupBarcode(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,serving_size,brands`);
  if (!res.ok) throw new Error('not found');
  const d = await res.json();
  if (d.status !== 1) throw new Error('not found');
  const p = d.product;
  const n = p.nutriments || {};
  const name = p.product_name || 'Produs scanat';
  const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
  return {
    name: name + brand,
    emoji: '🏷',
    kcal: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
    p:    Math.round((n['proteins_100g'] || 0) * 10) / 10,
    c:    Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat:  Math.round((n['fat_100g'] || 0) * 10) / 10,
    fiber: Math.round((n['fiber_100g'] || 0) * 10) / 10,
    cat:  'diverse',
    barcode,
  };
}

// ─── ZXing barcode scanner (loaded from CDN) ──────────────────────────────────
function useBarcodeScanner(videoRef, onDetect, active) {
  const readerRef = useRef(null);
  useEffect(() => {
    if (!active) { readerRef.current?.reset?.(); return; }
    let stopped = false;
    const load = async () => {
      try {
        // Load ZXing from CDN if not already loaded
        if (!window.ZXing) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/@zxing/library@latest/umd/index.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        if (stopped) return;
        const hints = new Map();
        const formats = [
          window.ZXing.BarcodeFormat.EAN_13,
          window.ZXing.BarcodeFormat.EAN_8,
          window.ZXing.BarcodeFormat.UPC_A,
          window.ZXing.BarcodeFormat.UPC_E,
          window.ZXing.BarcodeFormat.CODE_128,
        ];
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        const reader = new window.ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = reader;
        await reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result && !stopped) { stopped = true; onDetect(result.getText()); }
        });
      } catch (e) { console.warn('ZXing error', e); }
    };
    load();
    return () => { stopped = true; readerRef.current?.reset?.(); };
  }, [active]);
}

function AlimenteTab({ th, customFoods, setCustomFoods, onAddMeal }) {
  const [cat, setCat]                   = useState('all');
  const [quantities, setQuantities]     = useState({});
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [searchDone, setSearchDone]     = useState(false);
  const [activeSection, setActiveSection] = useState('alimente');
  const [templates, setTemplates]       = useState(() => ls(K.templates, []));
  const searchTimer = useRef(null);

  // Photo
  const [photoState, setPhotoState]     = useState('idle');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoResult, setPhotoResult]   = useState(null);
  const [photoError, setPhotoError]     = useState('');
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  // Barcode
  const [barcodeState, setBarcodeState] = useState('idle'); // idle|scanning|loading|found|error|manual
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeError, setBarcodeError]   = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [barcodeQty, setBarcodeQty]       = useState('100');
  const videoRef = useRef(null);

  // Template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName]         = useState('');

  // ── useMemo ─────────────────────────────────────────────────────────────────
  const allFoods = useMemo(
    () => [...FOODS, ...customFoods].sort((a, b) => a.name.localeCompare(b.name, 'ro')),
    [customFoods]
  );
  const filtered = useMemo(
    () => cat === 'all' ? allFoods : allFoods.filter(f => f.cat === cat),
    [allFoods, cat]
  );
  const totals = useMemo(() =>
    Object.entries(quantities).reduce((acc, [id, qty]) => {
      if (!qty || isNaN(qty) || parseFloat(qty) <= 0) return acc;
      const food = allFoods.find(f => f.id === id);
      if (!food) return acc;
      const m = calcMacros(food, parseFloat(qty));
      return { kcal: acc.kcal+m.kcal, p: Math.round((acc.p+m.p)*10)/10, c: Math.round((acc.c+m.c)*10)/10, fat: Math.round((acc.fat+m.fat)*10)/10, fiber: Math.round((acc.fiber+m.fiber)*10)/10 };
    }, { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0 }),
    [quantities, allFoods]
  );
  const hasItems = useMemo(() => Object.values(quantities).some(q => q && parseFloat(q) > 0), [quantities]);

  const setQty = useCallback((id, val) => setQuantities(q => ({ ...q, [id]: val })), []);

  // ── Barcode scanner ─────────────────────────────────────────────────────────
  useBarcodeScanner(videoRef, async (code) => {
    setBarcodeState('loading');
    try {
      const result = await lookupBarcode(code);
      setBarcodeResult(result); setBarcodeState('found');
    } catch {
      // Fallback: ask AI
      try {
        const reply = await callAI(
          [{ role: 'user', content: `Barcode: ${code}. Ce produs alimentar are acest cod de bare? Returnează DOAR JSON:
{"name":"Nume produs","emoji":"🏷","kcal":0,"p":0,"c":0,"fat":0,"fiber":0,"cat":"diverse"}
Valori la 100g. DOAR JSON.` }],
          'Expert nutritie. Returneaza DOAR JSON valid.', 400
        );
        const result = JSON.parse(reply.replace(/```json|```/g, '').trim());
        result.barcode = code;
        setBarcodeResult(result); setBarcodeState('found');
      } catch {
        setBarcodeError(`Produsul cu codul ${code} nu a fost găsit.`);
        setBarcodeState('error');
      }
    }
  }, barcodeState === 'scanning');

  const lookupManual = async () => {
    if (!manualBarcode.trim()) return;
    setBarcodeState('loading');
    try {
      const result = await lookupBarcode(manualBarcode.trim());
      setBarcodeResult(result); setBarcodeState('found');
    } catch {
      setBarcodeError(`Codul ${manualBarcode} nu a fost găsit.`);
      setBarcodeState('error');
    }
  };

  const addBarcodeToLog = () => {
    if (!barcodeResult) return;
    const qty = parseFloat(barcodeQty) || 100;
    const f = qty / 100;
    onAddMeal({
      name: barcodeResult.name,
      emoji: barcodeResult.emoji || '🏷',
      kcal: Math.round(barcodeResult.kcal * f),
      p:    Math.round(barcodeResult.p * f * 10) / 10,
      c:    Math.round(barcodeResult.c * f * 10) / 10,
      fat:  Math.round(barcodeResult.fat * f * 10) / 10,
      fiber: Math.round((barcodeResult.fiber || 0) * f * 10) / 10,
    });
    setBarcodeState('idle'); setBarcodeResult(null); setBarcodeQty('100');
  };

  const saveBarcodeFood = () => {
    if (!barcodeResult) return;
    if (customFoods.some(f => f.name === barcodeResult.name)) return;
    const nf = { id: `barcode_${Date.now()}`, ...barcodeResult, unit: 'g', unitG: 1, f: barcodeResult.fat };
    const upd = [...customFoods, nf].sort((a,b) => a.name.localeCompare(b.name,'ro'));
    setCustomFoods(upd); lsSave(K.customFoods, upd);
  };

  const resetBarcode = () => { setBarcodeState('idle'); setBarcodeResult(null); setBarcodeError(''); setManualBarcode(''); setBarcodeQty('100'); };

  // ── Photo handlers ──────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => { setPhotoPreview(e.target.result); setPhotoState('preview'); setPhotoResult(null); setPhotoError(''); };
    reader.readAsDataURL(file);
  }, []);

  const analyzePhoto = useCallback(async () => {
    if (!photoPreview) return;
    setPhotoState('analyzing');
    try {
      const base64 = photoPreview.split(',')[1];
      const mimeType = photoPreview.match(/data:(image\/[^;]+);/)?.[1] || 'image/jpeg';
      setPhotoResult(await analyzeFoodPhoto(base64, mimeType));
      setPhotoState('done');
    } catch { setPhotoError('Nu am putut analiza poza. Încearcă una mai clară.'); setPhotoState('error'); }
  }, [photoPreview]);

  const addPhotoMeal = useCallback(() => {
    if (!photoResult?.total) return;
    const t = photoResult.total;
    onAddMeal({ name: photoResult.descriere || 'Masă fotografiată', emoji: '📷', kcal: t.kcal, p: t.p, c: t.c, fat: t.fat, fiber: t.fiber || 0 });
    setPhotoState('idle'); setPhotoPreview(null); setPhotoResult(null);
  }, [photoResult, onAddMeal]);

  const resetPhoto = () => { setPhotoState('idle'); setPhotoPreview(null); setPhotoResult(null); setPhotoError(''); };

  // ── Templates ───────────────────────────────────────────────────────────────
  const saveTemplate = () => {
    if (!templateName.trim() || !hasItems) return;
    const items = Object.entries(quantities)
      .filter(([, q]) => q && parseFloat(q) > 0)
      .map(([id, qty]) => ({ id, qty: parseFloat(qty) }));
    const tpl = { id: `tpl_${Date.now()}`, name: templateName.trim(), items, ...totals, emoji: '📋', createdAt: Date.now() };
    const upd = [...templates, tpl];
    setTemplates(upd); lsSave(K.templates, upd);
    setTemplateName(''); setShowSaveTemplate(false);
  };

  const applyTemplate = (tpl) => {
    const newQty = {};
    tpl.items.forEach(({ id, qty }) => { newQty[id] = String(qty); });
    setQuantities(newQty);
    setActiveSection('alimente');
  };

  const addTemplateToLog = (tpl) => {
    onAddMeal({ name: tpl.name, emoji: tpl.emoji || '📋', kcal: tpl.kcal, p: tpl.p, c: tpl.c, fat: tpl.fat, fiber: tpl.fiber || 0 });
  };

  const deleteTemplate = (id) => {
    const upd = templates.filter(t => t.id !== id);
    setTemplates(upd); lsSave(K.templates, upd);
  };

  // ── AI search ───────────────────────────────────────────────────────────────
  const searchFood = async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); setSearchDone(false); return; }
    setSearching(true); setSearchDone(false);
    try {
      const reply = await callAI([{ role: 'user', content: query }],
        `Expert nutritie. Returneaza DOAR JSON array cu 1-4 variante:
[{"name":"Nume","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]
Valori la 100g. cat=proteine|carbs|legume|fructe|grasimi|diverse. DOAR JSON.`, 600);
      const results = JSON.parse(reply.replace(/```json|```/g, '').trim());
      setSearchResults(Array.isArray(results) ? results : []); setSearchDone(true);
    } catch { setSearchResults([]); setSearchDone(true); }
    finally { setSearching(false); }
  };

  const saveCustomFood = (food) => {
    if (customFoods.some(f => f.name.toLowerCase() === food.name.toLowerCase())) return;
    const nf = { id: `custom_${Date.now()}`, name: food.name, emoji: food.emoji||'🍽', unit: 'g', unitG: 1, kcal: food.kcal, p: food.p, c: food.c, f: food.fat, fiber: food.fiber||0, cat: food.cat||'diverse' };
    setCustomFoods([...customFoods, nf].sort((a,b) => a.name.localeCompare(b.name,'ro')));
  };

  const addToLog = () => {
    const items = Object.entries(quantities).filter(([, q]) => q && parseFloat(q) > 0);
    if (!items.length) return;
    let total = { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0, name: '', emoji: '🍽' };
    const names = [];
    items.forEach(([id, qty]) => {
      const food = allFoods.find(f => f.id === id); if (!food) return;
      const m = calcMacros(food, parseFloat(qty));
      total.kcal += m.kcal; total.p = Math.round((total.p+m.p)*10)/10;
      total.c = Math.round((total.c+m.c)*10)/10; total.fat = Math.round((total.fat+m.fat)*10)/10;
      total.fiber = Math.round((total.fiber+m.fiber)*10)/10;
      names.push(`${food.name} ${qty}${food.unit}`);
    });
    total.name = names.slice(0,2).join(', ') + (names.length > 2 ? ` +${names.length-2}` : '');
    onAddMeal(total); setQuantities({});
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inp = { background: th.card2, border: `1.5px solid ${th.border}`, borderRadius: '10px', padding: '8px 6px', color: th.text, fontSize: '14px', textAlign: 'center', outline: 'none', fontFamily: 'inherit', width: '68px' };
  const btnGreen = { background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '14px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, boxShadow: '0 4px 16px rgba(16,185,129,0.35)' };
  const macroRow = [
    {l:'Kcal',c:'#f97316'},{l:'Prot',c:'#10b981'},{l:'Carbs',c:'#3b82f6'},{l:'Grăs',c:'#f59e0b'},{l:'Fibre',c:'#8b5cf6'}
  ];

  const MacroBadges = ({ data }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px' }}>
      {macroRow.map((x,i) => {
        const vals = [data.kcal, `${data.p}g`, `${data.c}g`, `${data.fat}g`, `${data.fiber||0}g`];
        return (
          <div key={x.l} style={{ textAlign: 'center', background: `${x.c}12`, border: `1px solid ${x.c}25`, borderRadius: '10px', padding: '7px 3px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: x.c }}>{vals[i]}</div>
            <div style={{ fontSize: '9px', color: x.c, opacity: 0.7 }}>{x.l}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ padding: '14px 14px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '10px' }}>🍽 Alimente</div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px' }}>
          {[
            {id:'poza',      label:'📷 Poză',      activeColor:'#10b981'},
            {id:'barcode',   label:'🔲 Barcode',   activeColor:'#3b82f6'},
            {id:'templates', label:'⭐ Template',  activeColor:'#f59e0b'},
            {id:'alimente',  label:'📋 Listă',     activeColor: null},
            {id:'search',    label:'🤖 AI Search', activeColor: null},
          ].map(s => {
            const color = s.activeColor || th.accent;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                style={{ padding: '7px 12px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id?color:th.border}`, background: activeSection===s.id?`${color}15`:'transparent', color: activeSection===s.id?color:th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {s.label}
              </button>
            );
          })}
        </div>
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '10px' }}>
            {FOOD_CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{ padding: '5px 10px', borderRadius: '100px', border: `1.5px solid ${cat===c.id?c.color:th.border}`, background: cat===c.id?`${c.color}18`:'transparent', color: cat===c.id?c.color:th.text2, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

        {/* ══ POZĂ ══ */}
        {activeSection === 'poza' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {photoState === 'idle' && (
              <>
                <div style={{ background: th.bg2, borderRadius: '18px', padding: '26px 20px', border: '2px dashed rgba(16,185,129,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '52px', marginBottom: '12px' }}>📷</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: th.text, marginBottom: '6px' }}>Fotografiază farfuria</div>
                  <div style={{ fontSize: '13px', color: th.text3, lineHeight: 1.6 }}>AI identifică alimentele și estimează macro-urile automat</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => cameraInputRef.current?.click()} className="btn-tap"
                    style={{ ...btnGreen, padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '28px' }}>📸</span>
                    <span style={{ fontSize: '13px' }}>Fă poză</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn-tap"
                    style={{ padding: '16px 10px', background: th.bg2, border: `2px solid ${th.border}`, borderRadius: '14px', color: th.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: '28px' }}>🖼</span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>Din galerie</span>
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }}/>
                <input ref={fileInputRef}   type="file" accept="image/*"                       onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }}/>
              </>
            )}
            {(photoState === 'preview' || photoState === 'analyzing') && photoPreview && (
              <>
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: `2px solid ${photoState==='analyzing'?'#10b981':th.border}`, position: 'relative' }}>
                  <img src={photoPreview} alt="preview" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }}/>
                  {photoState === 'analyzing' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '7px' }}>{[0,1,2].map(i => <div key={i} style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981', animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}</div>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>AI analizează farfuria...</div>
                    </div>
                  )}
                </div>
                {photoState === 'preview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={resetPhoto} style={{ padding: '13px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Anulează</button>
                    <button onClick={analyzePhoto} className="btn-tap" style={{ ...btnGreen, padding: '13px', fontSize: '14px' }}>🤖 Analizează</button>
                  </div>
                )}
              </>
            )}
            {photoState === 'done' && photoResult && (
              <>
                <img src={photoPreview} alt="analizat" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '14px', border: '2px solid rgba(16,185,129,0.35)' }}/>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '11px 13px' }}>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '3px' }}>🤖 AI IDENTIFICAT</div>
                  <div style={{ fontSize: '14px', color: th.text, fontWeight: 600 }}>{photoResult.descriere}</div>
                </div>
                {photoResult.alimente?.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: th.bg2, borderRadius: '12px', border: `1px solid ${th.border}` }}>
                    <span style={{ fontSize: '22px' }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: th.text3 }}>~{item.qty_g}g · {item.kcal_total}kcal · P:{item.p_total}g · C:{item.c_total}g · G:{item.fat_total}g</div>
                    </div>
                  </div>
                ))}
                {photoResult.total && <MacroBadges data={photoResult.total}/>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={resetPhoto} style={{ padding: '13px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📷 Altă poză</button>
                  <button onClick={addPhotoMeal} className="btn-tap" style={{ ...btnGreen, padding: '13px', fontSize: '14px' }}>✓ Adaugă</button>
                </div>
              </>
            )}
            {photoState === 'error' && (
              <>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '22px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>❌</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>{photoError}</div>
                </div>
                <button onClick={resetPhoto} className="btn-tap" style={{ ...btnGreen, padding: '13px', width: '100%', fontSize: '14px' }}>📷 Încearcă din nou</button>
              </>
            )}
          </div>
        )}

        {/* ══ BARCODE ══ */}
        {activeSection === 'barcode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {barcodeState === 'idle' && (
              <>
                <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: '2px dashed rgba(59,130,246,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔲</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: th.text, marginBottom: '6px' }}>Scanează codul de bare</div>
                  <div style={{ fontSize: '12px', color: th.text3, lineHeight: 1.6 }}>Pointează camera spre codul EAN al produsului · Open Food Facts + AI</div>
                </div>
                <button onClick={() => setBarcodeState('scanning')} className="btn-tap"
                  style={{ padding: '16px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
                  📷 Pornește camera
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={manualBarcode} onChange={e => setManualBarcode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupManual()}
                    placeholder="sau introdu codul manual..."
                    style={{ flex: 1, background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '12px', padding: '11px 14px', color: th.text, fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}/>
                  <button onClick={lookupManual} style={{ padding: '11px 16px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', color: '#3b82f6', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>→</button>
                </div>
              </>
            )}

            {barcodeState === 'scanning' && (
              <>
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #3b82f6', position: 'relative', background: '#000' }}>
                  <video ref={videoRef} style={{ width: '100%', maxHeight: '280px', display: 'block', objectFit: 'cover' }} autoPlay playsInline muted/>
                  {/* Crosshair overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '220px', height: '80px', border: '2px solid #3b82f6', borderRadius: '8px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }}/>
                  </div>
                  <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>Pointează spre codul de bare</div>
                </div>
                <button onClick={resetBarcode} style={{ padding: '12px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Anulează</button>
              </>
            )}

            {barcodeState === 'loading' && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '30px', textAlign: 'center', border: `1px solid ${th.border}` }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>{[0,1,2].map(i => <div key={i} style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}</div>
                <div style={{ fontSize: '14px', color: th.text2, fontWeight: 600 }}>Caut produsul în baza de date...</div>
              </div>
            )}

            {barcodeState === 'found' && barcodeResult && (
              <>
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '6px' }}>🔲 PRODUS GĂSIT</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: th.text, marginBottom: '3px' }}>{barcodeResult.emoji} {barcodeResult.name}</div>
                  <div style={{ fontSize: '12px', color: th.text3 }}>Valori la 100g</div>
                </div>
                <MacroBadges data={{ kcal: barcodeResult.kcal, p: barcodeResult.p, c: barcodeResult.c, fat: barcodeResult.fat, fiber: barcodeResult.fiber||0 }}/>
                <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                  <div style={{ fontSize: '12px', color: th.text2, fontWeight: 600, marginBottom: '8px' }}>Cantitate (g)</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {[30,50,100,125,150,200].map(n => (
                      <button key={n} onClick={() => setBarcodeQty(String(n))}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${barcodeQty===String(n)?'#3b82f6':th.border}`, background: barcodeQty===String(n)?'rgba(59,130,246,0.12)':th.card2, color: barcodeQty===String(n)?'#3b82f6':th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                    ))}
                  </div>
                  <input type="number" value={barcodeQty} onChange={e => setBarcodeQty(e.target.value)} placeholder="g"
                    style={{ width: '100%', background: th.card2, border: `1.5px solid ${th.border}`, borderRadius: '10px', padding: '10px 14px', color: th.text, fontSize: '16px', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }}/>
                  {barcodeQty && parseFloat(barcodeQty) > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#3b82f6', fontWeight: 700, textAlign: 'center' }}>
                      = {Math.round(barcodeResult.kcal * parseFloat(barcodeQty)/100)} kcal · P:{Math.round(barcodeResult.p * parseFloat(barcodeQty)/100 * 10)/10}g
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={saveBarcodeFood} style={{ padding: '12px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Salvează</button>
                  <button onClick={addBarcodeToLog} className="btn-tap"
                    style={{ padding: '12px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(59,130,246,0.35)' }}>✓ Adaugă</button>
                </div>
                <button onClick={resetBarcode} style={{ padding: '11px', background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '12px', color: th.text3, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🔲 Alt produs</button>
              </>
            )}

            {barcodeState === 'error' && (
              <>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>❌</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>{barcodeError}</div>
                  <div style={{ fontSize: '12px', color: th.text3 }}>Produsul nu există în Open Food Facts sau AI nu îl cunoaște.</div>
                </div>
                <button onClick={resetBarcode} className="btn-tap"
                  style={{ padding: '13px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🔲 Încearcă din nou</button>
              </>
            )}
          </div>
        )}

        {/* ══ TEMPLATES ══ */}
        {activeSection === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: th.text2, lineHeight: 1.5 }}>
              ⭐ Salvează combinații frecvente de alimente. Le adaugi la jurnal cu un singur click.
            </div>
            {templates.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: th.text3 }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2, marginBottom: '6px' }}>Niciun template salvat</div>
                <div style={{ fontSize: '12px', lineHeight: 1.5 }}>Du-te la Listă, selectează cantitățile și apasă „Salvează template"</div>
              </div>
            )}
            {templates.map(tpl => (
              <div key={tpl.id} style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: th.text }}>{tpl.emoji} {tpl.name}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => applyTemplate(tpl)} style={{ padding: '5px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#f59e0b', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>✏️ Editează</button>
                    <button onClick={() => deleteTemplate(tpl.id)} style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                  </div>
                </div>
                <MacroBadges data={tpl}/>
                <button onClick={() => addTemplateToLog(tpl)} className="btn-tap"
                  style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'linear-gradient(135deg,#f59e0b,#f97316)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(245,158,11,0.3)' }}>
                  ⚡ Adaugă la jurnal
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ══ LISTĂ ══ */}
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(food => (
              <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${quantities[food.id]?th.accent+'40':th.border}` }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{food.emoji||'🍽'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{food.name}</div>
                  <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f||0}g / 100{food.unit}</div>
                </div>
                <input type="number" value={quantities[food.id]||''} onChange={e => setQty(food.id, e.target.value)} placeholder={food.unit} inputMode="decimal" style={inp}/>
              </div>
            ))}
          </div>
        )}

        {/* ══ AI SEARCH ══ */}
        {activeSection === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => searchFood(e.target.value), 700); }}
                placeholder="Caută: calamari, ciocolată Milka, supă de pui..."
                style={{ width: '100%', background: th.bg2, border: `2px solid ${searching?th.accent:th.border}`, borderRadius: '14px', padding: '12px 40px 12px 16px', color: th.text, fontSize: '14px', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}/>
              {searching && <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: th.accent, fontWeight: 700, animation: 'pulse 1s infinite' }}>AI⟳</div>}
            </div>
            {searchResults.map((r, i) => {
              const saved = customFoods.some(f => f.name === r.name);
              return (
                <div key={i} style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${saved?'#10b98140':th.border}`, display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '24px' }}>{r.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: th.text, marginBottom: '2px' }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: th.text3 }}>🔥{r.kcal}kcal · P:{r.p}g · C:{r.c}g · G:{r.fat??r.f??0}g{r.fiber?` · F:${r.fiber}g`:''}</div>
                    <div style={{ fontSize: '10px', color: FOOD_CATS.find(c=>c.id===r.cat)?.color||th.accent, fontWeight: 600 }}>{FOOD_CATS.find(c=>c.id===r.cat)?.label||r.cat}</div>
                  </div>
                  {saved ? <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓</span>
                    : <button onClick={() => saveCustomFood(r)} style={{ padding: '6px 11px', background: `${th.accent}15`, border: `1px solid ${th.accent}40`, borderRadius: '10px', color: th.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Salvează</button>}
                </div>
              );
            })}
            {searchDone && !searchResults.length && <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Încearcă mai specific</div>}
            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2 }}>Caută orice aliment în română</div>
                <div style={{ fontSize: '12px', color: th.text3, marginTop: '5px' }}>AI estimează macro-urile și îl salvează automat</div>
              </div>
            )}
            {customFoods.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginTop: '6px' }}>SALVATE ({customFoods.length})</div>
                {customFoods.map(food => (
                  <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${th.border}` }}>
                    <span style={{ fontSize: '20px' }}>{food.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{food.name}</div>
                      <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f||0}g / 100g</div>
                    </div>
                    <button onClick={() => setCustomFoods(customFoods.filter(f => f.id !== food.id))} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', color: '#ef4444', padding: '5px 8px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ height: '90px' }}/>
      </div>

      {/* FOOTER - add to log + save template */}
      {hasItems && activeSection === 'alimente' && (
        <div style={{ padding: '10px 14px 12px', background: th.bg2, borderTop: `1px solid ${th.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {macroRow.map((x, i) => {
              const vals = [totals.kcal, `${totals.p}g`, `${totals.c}g`, `${totals.fat}g`, `${totals.fiber}g`];
              return (
                <div key={x.l} style={{ flex: 1, textAlign: 'center', background: `${x.c}12`, border: `1px solid ${x.c}25`, borderRadius: '9px', padding: '5px 3px', minWidth: '44px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: x.c }}>{vals[i]}</div>
                  <div style={{ fontSize: '9px', color: x.c, opacity: 0.7 }}>{x.l}</div>
                </div>
              );
            })}
          </div>

          {showSaveTemplate ? (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={templateName} onChange={e => setTemplateName(e.target.value)}
                placeholder="Nume template (ex: Mic dejun standard)..."
                onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                style={{ flex: 1, background: th.card2, border: `1.5px solid #f59e0b`, borderRadius: '10px', padding: '9px 12px', color: th.text, fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}/>
              <button onClick={saveTemplate} style={{ padding: '9px 14px', background: 'linear-gradient(135deg,#f59e0b,#f97316)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>✓</button>
              <button onClick={() => setShowSaveTemplate(false)} style={{ padding: '9px 10px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', color: th.text3, cursor: 'pointer', fontSize: '13px' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
              <button onClick={() => setShowSaveTemplate(true)}
                style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', color: '#f59e0b', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⭐ Template
              </button>
              <button onClick={addToLog} className="btn-tap"
                style={{ padding: '12px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(249,115,22,0.3)' }}>
                ◆ ADAUGĂ LA JURNAL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AlimenteTab;
