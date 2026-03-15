import { useState, useRef, useCallback } from 'react';
import { callAI } from '../utils/api';
import { calcMacros } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';

// ─── Photo analysis ───────────────────────────────────────────────────────────
async function analyzeFoodPhoto(base64, mimeType) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Expert nutriționist. Analizezi poze cu mâncare și returnezi DOAR JSON valid, fără text extra.
Format strict:
{
  "descriere": "ce vezi în poză",
  "alimente": [
    {"name":"Piept pui la grătar","emoji":"🍗","qty_g":150,"kcal_total":248,"p_total":46,"c_total":0,"fat_total":5,"fiber_total":0},
    {"name":"Orez fiert","emoji":"🍚","qty_g":120,"kcal_total":156,"p_total":3,"c_total":34,"fat_total":0,"fiber_total":0}
  ],
  "total": {"kcal":404,"p":49,"c":34,"fat":5,"fiber":0}
}
Estimează gramajele după dimensiunea vizuală a porțiilor. DOAR JSON, nimic altceva.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: 'Analizează această masă și returnează JSON cu macro-urile.' }
        ]
      }]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  const text = d.content?.[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function AlimenteTab({ th, customFoods, setCustomFoods, onAddMeal }) {
  const [cat, setCat]                 = useState('all');
  const [quantities, setQuantities]   = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchDone, setSearchDone]   = useState(false);
  const [activeSection, setActiveSection] = useState('alimente');
  const searchTimer   = useRef(null);
  const fileInputRef  = useRef(null);
  const cameraInputRef = useRef(null);

  // Photo state
  const [photoState, setPhotoState]   = useState('idle'); // idle|preview|analyzing|done|error
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [photoError, setPhotoError]   = useState('');

  const allFoods = [...FOODS, ...customFoods].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const filtered = cat === 'all' ? allFoods : allFoods.filter(f => f.cat === cat);
  const setQty   = (id, val) => setQuantities(q => ({ ...q, [id]: val }));

  const totals = Object.entries(quantities).reduce((acc, [id, qty]) => {
    if (!qty || isNaN(qty) || parseFloat(qty) <= 0) return acc;
    const food = allFoods.find(f => f.id === id);
    if (!food) return acc;
    const m = calcMacros(food, parseFloat(qty));
    return { kcal: acc.kcal+m.kcal, p: Math.round((acc.p+m.p)*10)/10, c: Math.round((acc.c+m.c)*10)/10, fat: Math.round((acc.fat+m.fat)*10)/10, fiber: Math.round((acc.fiber+m.fiber)*10)/10 };
  }, { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0 });

  const hasItems = Object.values(quantities).some(q => q && parseFloat(q) > 0);

  const addToLog = () => {
    const items = Object.entries(quantities).filter(([, q]) => q && parseFloat(q) > 0);
    if (!items.length) return;
    let total = { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0, name: '', emoji: '🍽' };
    const names = [];
    items.forEach(([id, qty]) => {
      const food = allFoods.find(f => f.id === id);
      if (!food) return;
      const m = calcMacros(food, parseFloat(qty));
      total.kcal += m.kcal; total.p = Math.round((total.p+m.p)*10)/10;
      total.c = Math.round((total.c+m.c)*10)/10; total.fat = Math.round((total.fat+m.fat)*10)/10;
      total.fiber = Math.round((total.fiber+m.fiber)*10)/10;
      names.push(`${food.name} ${qty}${food.unit}`);
    });
    total.name = names.slice(0,2).join(', ') + (names.length > 2 ? ` +${names.length-2}` : '');
    onAddMeal(total); setQuantities({});
  };

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
      const result = await analyzeFoodPhoto(base64, mimeType);
      setPhotoResult(result); setPhotoState('done');
    } catch {
      setPhotoError('Nu am putut analiza poza. Încearcă una mai clară, bine luminată.'); setPhotoState('error');
    }
  }, [photoPreview]);

  const addPhotoMeal = useCallback(() => {
    if (!photoResult?.total) return;
    const t = photoResult.total;
    onAddMeal({ name: photoResult.descriere || 'Masă fotografiată', emoji: '📷', kcal: t.kcal, p: t.p, c: t.c, fat: t.fat, fiber: t.fiber || 0 });
    setPhotoState('idle'); setPhotoPreview(null); setPhotoResult(null);
  }, [photoResult, onAddMeal]);

  const resetPhoto = () => { setPhotoState('idle'); setPhotoPreview(null); setPhotoResult(null); setPhotoError(''); };

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
    const newFood = { id: `custom_${Date.now()}`, name: food.name, emoji: food.emoji||'🍽', unit: 'g', unitG: 1, kcal: food.kcal, p: food.p, c: food.c, f: food.fat, fiber: food.fiber||0, cat: food.cat||'diverse' };
    setCustomFoods([...customFoods, newFood].sort((a,b) => a.name.localeCompare(b.name,'ro')));
  };

  const inp = { background: th.card2, border: `1.5px solid ${th.border}`, borderRadius: '10px', padding: '8px 6px', color: th.text, fontSize: '14px', textAlign: 'center', outline: 'none', fontFamily: 'inherit', width: '68px' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '12px' }}>🍽 Alimente</div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[{id:'poza',label:'📷 Poză'},{id:'alimente',label:'📋 Listă'},{id:'search',label:'🤖 AI Search'}].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id?(s.id==='poza'?'#10b981':th.accent):th.border}`, background: activeSection===s.id?`${s.id==='poza'?'#10b981':th.accent}15`:'transparent', color: activeSection===s.id?(s.id==='poza'?'#10b981':th.accent):th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {s.label}
            </button>
          ))}
        </div>
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '12px' }}>
            {FOOD_CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{ padding: '6px 12px', borderRadius: '100px', border: `1.5px solid ${cat===c.id?c.color:th.border}`, background: cat===c.id?`${c.color}18`:'transparent', color: cat===c.id?c.color:th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* ══ POZĂ ══ */}
        {activeSection === 'poza' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {photoState === 'idle' && (
              <>
                <div style={{ background: th.bg2, borderRadius: '18px', padding: '28px 20px', border: '2px dashed rgba(16,185,129,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '56px', marginBottom: '14px' }}>📷</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: th.text, marginBottom: '8px' }}>Fotografiază farfuria</div>
                  <div style={{ fontSize: '13px', color: th.text3, lineHeight: 1.6 }}>AI-ul identifică alimentele și<br/>estimează macro-urile automat</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => cameraInputRef.current?.click()} className="btn-tap"
                    style={{ padding: '18px 12px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '16px', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', boxShadow: '0 4px 18px rgba(16,185,129,0.35)', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: '30px' }}>📸</span>
                    <span style={{ fontSize: '14px', fontWeight: 800 }}>Fă poză</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>Camera telefonului</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn-tap"
                    style={{ padding: '18px 12px', background: th.bg2, border: `2px solid ${th.border}`, borderRadius: '16px', color: th.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: '30px' }}>🖼</span>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>Din galerie</span>
                    <span style={{ fontSize: '11px', color: th.text3 }}>Alege o poză</span>
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }}/>
                <input ref={fileInputRef}   type="file" accept="image/*"                       onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }}/>
                <div style={{ background: `${th.accent}08`, border: `1px solid ${th.accent}20`, borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: th.text2, lineHeight: 1.6 }}>
                  💡 Poza funcționează cel mai bine când farfuria e bine luminată și alimentele sunt separate și vizibile.
                </div>
              </>
            )}

            {(photoState === 'preview' || photoState === 'analyzing') && photoPreview && (
              <>
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: `2px solid ${photoState==='analyzing'?'#10b981':th.border}`, position: 'relative' }}>
                  <img src={photoPreview} alt="preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }}/>
                  {photoState === 'analyzing' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[0,1,2].map(i => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}
                      </div>
                      <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>AI analizează farfuria...</div>
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>Identifică alimente · Estimează gramaje</div>
                    </div>
                  )}
                </div>
                {photoState === 'preview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={resetPhoto} style={{ padding: '14px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Anulează</button>
                    <button onClick={analyzePhoto} className="btn-tap" style={{ padding: '14px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>🤖 Analizează</button>
                  </div>
                )}
              </>
            )}

            {photoState === 'done' && photoResult && (
              <>
                <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid rgba(16,185,129,0.35)' }}>
                  <img src={photoPreview} alt="analizat" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}/>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '4px' }}>🤖 AI A IDENTIFICAT</div>
                  <div style={{ fontSize: '14px', color: th.text, fontWeight: 600 }}>{photoResult.descriere}</div>
                </div>
                {photoResult.alimente?.length > 0 && (
                  <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                    <div style={{ fontSize: '10px', color: th.text3, fontWeight: 700, letterSpacing: '0.12em', marginBottom: '10px' }}>ALIMENTE DETECTATE</div>
                    {photoResult.alimente.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < photoResult.alimente.length-1 ? `1px solid ${th.border}` : 'none' }}>
                        <span style={{ fontSize: '22px', flexShrink: 0 }}>{item.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: th.text3 }}>~{item.qty_g}g · {item.kcal_total}kcal · P:{item.p_total}g · C:{item.c_total}g · G:{item.fat_total}g</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {photoResult.total && (
                  <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                    <div style={{ fontSize: '10px', color: th.text3, fontWeight: 700, letterSpacing: '0.12em', marginBottom: '10px' }}>TOTAL MASĂ</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px' }}>
                      {[{l:'Kcal',v:photoResult.total.kcal,c:'#f97316'},{l:'Prot',v:`${photoResult.total.p}g`,c:'#10b981'},{l:'Carbs',v:`${photoResult.total.c}g`,c:'#3b82f6'},{l:'Grăs',v:`${photoResult.total.fat}g`,c:'#f59e0b'},{l:'Fibre',v:`${photoResult.total.fiber||0}g`,c:'#8b5cf6'}].map(x => (
                        <div key={x.l} style={{ textAlign: 'center', background: `${x.c}12`, border: `1px solid ${x.c}25`, borderRadius: '10px', padding: '8px 4px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: x.c }}>{x.v}</div>
                          <div style={{ fontSize: '10px', color: x.c, opacity: 0.7 }}>{x.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={resetPhoto} style={{ padding: '14px', background: th.bg2, border: `1.5px solid ${th.border}`, borderRadius: '14px', color: th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📷 Altă poză</button>
                  <button onClick={addPhotoMeal} className="btn-tap" style={{ padding: '14px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>✓ Adaugă la jurnal</button>
                </div>
              </>
            )}

            {photoState === 'error' && (
              <>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>❌</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', marginBottom: '6px' }}>{photoError}</div>
                </div>
                <button onClick={resetPhoto} className="btn-tap" style={{ padding: '14px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>📷 Încearcă din nou</button>
              </>
            )}
          </div>
        )}

        {/* ══ LISTĂ ══ */}
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(food => (
              <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${quantities[food.id]?th.accent+'40':th.border}` }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{food.emoji||'🍽'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: th.text }}>{food.name}</div>
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
            {searchResults.length > 0 && searchResults.map((r, i) => {
              const saved = customFoods.some(f => f.name === r.name);
              return (
                <div key={i} style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${saved?'#10b98140':th.border}`, display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '24px' }}>{r.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: th.text, marginBottom: '3px' }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: th.text3 }}>🔥{r.kcal}kcal · P:{r.p}g · C:{r.c}g · G:{r.fat??r.f??0}g{r.fiber?` · F:${r.fiber}g`:''}</div>
                    <div style={{ fontSize: '10px', color: FOOD_CATS.find(c=>c.id===r.cat)?.color||th.accent, marginTop: '2px', fontWeight: 600 }}>{FOOD_CATS.find(c=>c.id===r.cat)?.label||r.cat}</div>
                  </div>
                  {saved ? <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ Salvat</span>
                    : <button onClick={() => saveCustomFood(r)} style={{ padding: '7px 12px', background: `${th.accent}15`, border: `1px solid ${th.accent}40`, borderRadius: '10px', color: th.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Salvează</button>}
                </div>
              );
            })}
            {searchDone && !searchResults.length && <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Încearcă mai specific: "piept pui fiert", "orez brun"</div>}
            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2 }}>Caută orice aliment în română</div>
                <div style={{ fontSize: '12px', color: th.text3, marginTop: '6px' }}>AI-ul estimează macro-urile și îl salvează automat</div>
              </div>
            )}
            {customFoods.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginTop: '8px' }}>SALVATE DE TINE ({customFoods.length})</div>
                {customFoods.map(food => (
                  <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${th.border}` }}>
                    <span style={{ fontSize: '22px' }}>{food.emoji}</span>
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

        <div style={{ height: '80px' }}/>
      </div>

      {/* FOOTER */}
      {hasItems && activeSection === 'alimente' && (
        <div style={{ padding: '12px 16px', background: th.bg2, borderTop: `1px solid ${th.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[{l:'Kcal',v:totals.kcal,c:'#f97316'},{l:'Prot',v:`${totals.p}g`,c:'#10b981'},{l:'Carbs',v:`${totals.c}g`,c:'#3b82f6'},{l:'Grăs',v:`${totals.fat}g`,c:'#f59e0b'},{l:'Fibre',v:`${totals.fiber}g`,c:'#8b5cf6'}].map(x => (
              <div key={x.l} style={{ flex: 1, textAlign: 'center', background: `${x.c}12`, border: `1px solid ${x.c}25`, borderRadius: '10px', padding: '5px 4px', minWidth: '48px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: x.c }}>{x.v}</div>
                <div style={{ fontSize: '10px', color: x.c, opacity: 0.7 }}>{x.l}</div>
              </div>
            ))}
          </div>
          <button onClick={addToLog} className="btn-tap"
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 15px rgba(249,115,22,0.35)' }}>
            ◆ ADAUGĂ LA JURNAL
          </button>
        </div>
      )}
    </div>
  );
}

export default AlimenteTab;
