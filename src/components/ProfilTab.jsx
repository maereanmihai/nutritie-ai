import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function ProfilTab({ th, profile, saveProfile, supplements, setSupplements, sendMessage }) {
  const [form, setForm] = useState({ ...profile });
  const [activeSection, setActiveSection] = useState('date');
  const [newSupl, setNewSupl] = useState({ name: '', emoji: '💊', time: '08:00', note: '' });
  const [analyzingSupl, setAnalyzingSupl] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const macros = calcTDEE(form);

  const inp = { background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '10px 14px', color: th.text, fontSize: '15px', outline: 'none', fontFamily: 'inherit', width: '100%' };

  const analyzeAndAddSupl = async () => {
    if (!newSupl.name.trim()) return;
    setAnalyzingSupl(true);
    try {
      const reply = await callAI(
        [{ role: 'user', content: `Analizează suplimentul: ${newSupl.name}. Spune-mi: 1) La ce oră optimă se ia (format HH:MM), 2) Cu sau fără mâncare, 3) Beneficii principale (maxim 8 cuvinte), 4) Interacțiuni cu: ${supplements.map(s=>s.name).join(', ')}. Răspunde în format JSON: {"time":"HH:MM","note":"descriere scurta","safe":true/false,"warning":"null sau avertisment"}` }],
        'Expert farmacie și nutriție. Răspunde DOAR cu JSON valid, fără text extra.',
        500
      );
      const clean = reply.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(clean);
      const newS = {
        id: `custom_${Date.now()}`,
        name: newSupl.name,
        emoji: newSupl.emoji,
        time: analysis.time || newSupl.time,
        note: analysis.note || newSupl.note,
        days: [1,2,3,4,5,6,7],
        custom: true,
      };
      setSupplements([...supplements, newS]);
      setNewSupl({ name: '', emoji: '💊', time: '08:00', note: '' });
      if (analysis.warning && analysis.warning !== 'null') {
        sendMessage(`Am adăugat ${newSupl.name}. AI a detectat: ${analysis.warning}`);
      }
    } catch {
      const newS = { id: `custom_${Date.now()}`, name: newSupl.name, emoji: newSupl.emoji, time: newSupl.time, note: newSupl.note || 'Cu masă', days: [1,2,3,4,5,6,7], custom: true };
      setSupplements([...supplements, newS]);
      setNewSupl({ name: '', emoji: '💊', time: '08:00', note: '' });
    }
    setAnalyzingSupl(false);
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '12px' }}>👤 Profil</div>
        <div style={{ display: 'flex', gap: '6px', paddingBottom: '12px' }}>
          {[{id:'date',label:'📋 Date'},{id:'suplimente',label:'💊 Suplimente'},{id:'obiective',label:'🎯 Obiective'}].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id?'#8b5cf6':th.border}`, background: activeSection===s.id?'rgba(139,92,246,0.1)':'transparent', color: activeSection===s.id?'#8b5cf6':th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeSection === 'date' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>👤 DATE PERSONALE</div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>NUME</div>
                <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Numele tău" style={inp}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[{k:'age',l:'VÂRSTĂ',p:'ani'},{k:'height',l:'ÎNĂLȚIME',p:'cm'},{k:'weight',l:'GREUTATE',p:'kg'}].map(({k,l,p}) => (
                  <div key={k}>
                    <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>{l}</div>
                    <input type="number" value={form[k]} onChange={e => upd(k, e.target.value)} placeholder={p} style={{ ...inp, padding: '10px 8px', textAlign: 'center' }}/>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>GREUTATE DORITĂ</div>
                  <input type="number" value={form.targetWeight} onChange={e => upd('targetWeight', e.target.value)} placeholder="kg" style={{ ...inp, borderColor: form.targetWeight ? 'rgba(16,185,129,0.4)' : th.border }}/>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>SEX</div>
                  <select value={form.sex} onChange={e => upd('sex', e.target.value)} style={inp}>
                    <option value="male">Masculin</option>
                    <option value="female">Feminin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TDEE PREVIEW */}
            {macros && (
              <div style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.08),rgba(239,68,68,0.08))', borderRadius: '16px', padding: '14px', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#f97316', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>⚡ CALCULAT MIFFLIN-ST JEOR</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                  {[{l:'BMR',v:macros.bmr,unit:'kcal'},{l:'TDEE',v:macros.tdee,unit:'kcal'},{l:'TARGET',v:macros.base,unit:'kcal'},{l:'PROT MIN',v:macros.protein,unit:'g'}].map(x => (
                    <div key={x.l} style={{ textAlign: 'center', background: 'rgba(249,115,22,0.08)', borderRadius: '10px', padding: '8px 4px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#f97316' }}>{x.v}</div>
                      <div style={{ fontSize: '9px', color: '#f97316', opacity: 0.6 }}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TIP CORP + OBIECTIV */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>🏃 TIP CORP & OBIECTIV</div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>TIP DE CORP</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[{v:'ectomorf',l:'Ectomorf',d:'Slab natural, metabolism rapid',i:'🦴'},{v:'mezomorf',l:'Mezomorf',d:'Atletico, răspunde bine la antrenament',i:'💪'},{v:'endomorf',l:'Endomorf',d:'Tinde să acumuleze grăsime',i:'🔥'}].map(bt => (
                    <button key={bt.v} onClick={() => upd('bodyType', bt.v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: `2px solid ${form.bodyType===bt.v?'#8b5cf6':th.border}`, background: form.bodyType===bt.v?'rgba(139,92,246,0.08)':th.card, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: '20px' }}>{bt.i}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 700, color: form.bodyType===bt.v?'#8b5cf6':th.text }}>{bt.l}</div><div style={{ fontSize: '11px', color: th.text3 }}>{bt.d}</div></div>
                      {form.bodyType === bt.v && <span style={{ color: '#8b5cf6' }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>OBIECTIV</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[{v:'slabit',l:'Slăbit',i:'🔻',d:'Pierdere grăsime'},{v:'recompozitie',l:'Recompozitie',i:'⚡',d:'Slăbit + masă'},{v:'masa',l:'Masă',i:'📈',d:'Creștere musculară'},{v:'mentinere',l:'Menținere',i:'⚖️',d:'Greutate stabilă'}].map(g => (
                    <button key={g.v} onClick={() => upd('goal', g.v)}
                      style={{ padding: '12px', borderRadius: '12px', border: `2px solid ${form.goal===g.v?'#10b981':th.border}`, background: form.goal===g.v?'rgba(16,185,129,0.08)':th.card, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: '22px', marginBottom: '4px' }}>{g.i}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: form.goal===g.v?'#10b981':th.text }}>{g.l}</div>
                      <div style={{ fontSize: '11px', color: th.text3 }}>{g.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>NIVEL ACTIVITATE</div>
                {[{v:'sedentar',l:'Sedentar',d:'Birou, fără sport'},{v:'usor',l:'Ușor activ',d:'1-3 zile/săpt'},{v:'moderat',l:'Moderat',d:'3-5 zile/săpt'},{v:'activ',l:'Activ',d:'6-7 zile/săpt'},{v:'foarte_activ',l:'Extrem activ',d:'2x/zi'}].map(a => (
                  <button key={a.v} onClick={() => upd('activity', a.v)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '9px 12px', borderRadius: '10px', border: `1.5px solid ${form.activity===a.v?'#f59e0b':th.border}`, background: form.activity===a.v?'rgba(245,158,11,0.08)':th.card, cursor: 'pointer', marginBottom: '6px', textAlign: 'left' }}>
                    <div><span style={{ fontSize: '13px', fontWeight: 700, color: form.activity===a.v?'#f59e0b':th.text }}>{a.l}</span><span style={{ fontSize: '12px', color: th.text3, marginLeft: '8px' }}>{a.d}</span></div>
                    {form.activity === a.v && <span style={{ color: '#f59e0b' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => saveProfile(form)}
              style={{ padding: '16px', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '16px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
              ◆ SALVEAZĂ PROFILUL
            </button>
            <div style={{ height: '10px' }}/>
          </div>
        )}

        {activeSection === 'suplimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ADD NEW */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6', marginBottom: '10px' }}>➕ ADAUGĂ SUPLIMENT</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={newSupl.emoji} onChange={e => setNewSupl(s => ({...s, emoji: e.target.value}))} style={{ ...inp, width: '52px', textAlign: 'center', fontSize: '20px', padding: '8px' }}/>
                <input value={newSupl.name} onChange={e => setNewSupl(s => ({...s, name: e.target.value}))} placeholder="Nume supliment..." style={{ ...inp, flex: 1 }}/>
              </div>
              <button onClick={analyzeAndAddSupl} disabled={!newSupl.name.trim() || analyzingSupl}
                style={{ width: '100%', padding: '11px', background: newSupl.name.trim() ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : th.card2, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: newSupl.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {analyzingSupl ? '🤖 AI analizează timing & interacțiuni...' : '🤖 Analizează cu AI & Adaugă'}
              </button>
            </div>

            {/* SUPPLEMENTS LIST */}
            {Object.entries(supplements.reduce((acc, s) => { const t = s.time.substring(0,5); if (!acc[t]) acc[t] = []; acc[t].push(s); return acc; }, {})).sort().map(([time, supls]) => (
              <div key={time}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', paddingLeft: '4px' }}>{time}</div>
                {supls.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '12px', marginBottom: '6px', border: `1px solid ${s.custom ? 'rgba(139,92,246,0.2)' : th.border}` }}>
                    <span style={{ fontSize: '20px' }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{s.name}</div>
                      {s.note && <div style={{ fontSize: '11px', color: th.text3 }}>{s.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: th.text3 }}>{s.time}</span>
                      {s.custom && <button onClick={() => setSupplements(supplements.filter(x => x.id !== s.id))} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeSection === 'obiective' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {macros && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '12px' }}>🎯 Macro-uri calculate</div>
                {[
                  { label: 'Zi antrenament', macros: getDayMacros(profile, 'antrenament'), color: '#f97316', icon: '⚡' },
                  { label: 'Zi intensă', macros: getDayMacros(profile, 'intens'), color: '#3b82f6', icon: '🔥' },
                  { label: 'Repaus', macros: getDayMacros(profile, 'repaus'), color: '#8b5cf6', icon: '🌙' },
                ].map(d => d.macros && (
                  <div key={d.label} style={{ marginBottom: '10px', padding: '12px', background: `${d.color}08`, borderRadius: '12px', border: `1px solid ${d.color}25` }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: d.color, marginBottom: '6px' }}>{d.icon} {d.label}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: th.text2 }}>
                      <span>🔥 {d.macros.kcal}kcal</span>
                      <span>P: {d.macros.protein}g</span>
                      <span>C: {d.macros.carbs}g</span>
                      <span>G: {d.macros.fat}g</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ height: '20px' }}/>
      </div>
    </div>
  );
}

// ─── FOOD PICKER MODAL ────────────────────────────────────────────────────────

export default ProfilTab;
