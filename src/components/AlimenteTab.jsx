import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function AlimenteTab({ th, customFoods, setCustomFoods, onAddMeal }) {
  const [cat, setCat] = useState('all');
  const [quantities, setQuantities] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeSection, setActiveSection] = useState('alimente'); // alimente | search | templates
  const searchTimer = useRef(null);
  const allFoods = [...FOODS, ...customFoods].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const filtered = cat === 'all' ? allFoods : allFoods.filter(f => f.cat === cat);
  const setQty = (id, val) => setQuantities(q => ({ ...q, [id]: val }));

  const totals = Object.entries(quantities).reduce((acc, [id, qty]) => {
    if (!qty || isNaN(qty) || parseFloat(qty) <= 0) return acc;
    const food = allFoods.find(f => f.id === id);
    if (!food) return acc;
    const m = calcMacros(food, parseFloat(qty));
    return { kcal: acc.kcal + m.kcal, p: Math.round((acc.p + m.p)*10)/10, c: Math.round((acc.c + m.c)*10)/10, fat: Math.round((acc.fat + m.fat)*10)/10, fiber: Math.round((acc.fiber + m.fiber)*10)/10 };
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
      total.kcal += m.kcal;
      total.p = Math.round((total.p + m.p)*10)/10;
      total.c = Math.round((total.c + m.c)*10)/10;
      total.fat = Math.round((total.fat + m.fat)*10)/10;
      total.fiber = Math.round((total.fiber + m.fiber)*10)/10;
      names.push(`${food.name} ${qty}${food.unit}`);
    });
    total.name = names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length-2}` : '');
    onAddMeal(total);
    setQuantities({});
  };

  const searchFood = async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); setSearchDone(false); return; }
    setSearching(true); setSearchDone(false);
    try {
      const reply = await callAI(
        [{ role: 'user', content: query }],
        `Expert nutritie. Returneaza DOAR JSON array cu 1-4 variante ale alimentului cerut. Format strict:
[{"name":"Nume aliment","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]
Valori la 100g. cat = proteine|carbs|legume|fructe|grasimi|diverse. DOAR JSON, nimic altceva.`,
        600
      );
      const clean = reply.replace(/```json|```/g, '').trim();
      const results = JSON.parse(clean);
      setSearchResults(Array.isArray(results) ? results : []);
      setSearchDone(true);
    } catch { setSearchResults([]); setSearchDone(true); }
    finally { setSearching(false); }
  };

  const saveCustomFood = (food) => {
    const alreadyExists = customFoods.some(f => f.name.toLowerCase() === food.name.toLowerCase());
    if (alreadyExists) return;
    const newFood = { id: `custom_${Date.now()}`, name: food.name, emoji: food.emoji||'🍽', unit: 'g', unitG: 1, kcal: food.kcal, p: food.p, c: food.c, f: food.fat, fiber: food.fiber||0, cat: food.cat||'diverse' };
    const upd = [...customFoods, newFood].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    setCustomFoods(upd);
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '12px' }}>🍽 Alimente</div>
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[{id:'alimente',label:'📋 Lista'},{id:'search',label:'🤖 AI Search'},{id:'recent',label:'⏱ Recente'}].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id ? th.accent : th.border}`, background: activeSection===s.id ? `${th.accent}15` : 'transparent', color: activeSection===s.id ? th.accent : th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.label}</button>
          ))}
        </div>
        {/* Category filter - only for lista */}
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '12px' }}>
            {FOOD_CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{ padding: '6px 12px', borderRadius: '100px', border: `1.5px solid ${cat===c.id ? c.color : th.border}`, background: cat===c.id ? `${c.color}18` : 'transparent', color: cat===c.id ? c.color : th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(food => (
              <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${quantities[food.id] ? th.accent + '40' : th.border}` }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{food.emoji || '🍽'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: th.text }}>{food.name}</div>
                  <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f||0}g / 100{food.unit}</div>
                </div>
                <input type="number" value={quantities[food.id] || ''} onChange={e => setQty(food.id, e.target.value)}
                  placeholder={food.unit} inputMode="decimal"
                  style={{ width: '68px', background: quantities[food.id] ? `${th.accent}10` : th.card2, border: `1.5px solid ${quantities[food.id] ? th.accent : th.border}`, borderRadius: '10px', padding: '8px 6px', color: th.text, fontSize: '14px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}/>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => searchFood(e.target.value), 700); }}
                placeholder="🤖 Caută orice: calamari, ciocolată Milka, supă de pui..."
                style={{ width: '100%', background: th.bg2, border: `2px solid ${searching ? th.accent : th.border}`, borderRadius: '14px', padding: '12px 16px', color: th.text, fontSize: '14px', outline: 'none', fontFamily: 'inherit', paddingRight: '40px', transition: 'border-color 0.2s' }}/>
              {searching && <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: th.accent, fontWeight: 700, animation: 'pulse 1s infinite' }}>AI⟳</div>}
            </div>

            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em' }}>🤖 REZULTATE AI (la 100g)</div>
                {searchResults.map((r, i) => {
                  const saved = customFoods.some(f => f.name === r.name);
                  return (
                    <div key={i} style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${saved ? '#10b98140' : th.border}`, display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '24px' }}>{r.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: th.text, marginBottom: '3px' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: th.text3 }}>🔥{r.kcal}kcal · P:{r.p}g · C:{r.c}g · G:{r.fat ?? r.f ?? 0}g{r.fiber ? ` · F:${r.fiber}g` : ''}</div>
                        <div style={{ fontSize: '10px', color: th.text3, marginTop: '2px' }}>
                          Categorie: <span style={{ color: FOOD_CATS.find(c => c.id === r.cat)?.color || th.accent }}>{FOOD_CATS.find(c => c.id === r.cat)?.label || r.cat}</span>
                        </div>
                      </div>
                      {saved
                        ? <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ Salvat</span>
                        : <button onClick={() => saveCustomFood(r)} style={{ padding: '7px 12px', background: `${th.accent}15`, border: `1px solid ${th.accent}40`, borderRadius: '10px', color: th.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Salvează</button>
                      }
                    </div>
                  );
                })}
              </div>
            )}
            {searchDone && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Încearcă mai specific: "piept pui fiert", "orez brun"</div>
            )}
            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2 }}>Caută orice aliment în română</div>
                <div style={{ fontSize: '12px', color: th.text3, marginTop: '6px' }}>AI-ul estimează macro-urile și îl salvează în categoria corectă automat</div>
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
                      <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f}g / 100g</div>
                    </div>
                    <button onClick={() => setCustomFoods(customFoods.filter(f => f.id !== food.id))} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', color: '#ef4444', padding: '5px 8px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeSection === 'recent' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: th.text3, fontSize: '13px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏱</div>
            Istoricul alimentelor recent folosite va apărea aici.
          </div>
        )}
        <div style={{ height: '80px' }}/>
      </div>

      {/* FOOTER - add to log */}
      {hasItems && (
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
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 4px 15px rgba(249,115,22,0.35)' }}>
            ◆ ADAUGĂ LA JURNAL
          </button>
        </div>
      )}
    </div>
  );
}
// ─── ANTRENAMENT TAB ──────────────────────────────────────────────────────────

export default AlimenteTab;
