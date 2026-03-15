import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function AntrenamentTab({ th, workouts, setWorkouts, profile, onSendToCoach, onOpenGymMode }) {
  const [mode, setMode] = useState('gym');
  const [selGroup, setSelGroup] = useState('piept');
  const [selEx, setSelEx] = useState(null);
  const [sets, setSets] = useState([]);
  const [cardioType, setCardioType] = useState('mers');
  const [cardioDur, setCardioDur] = useState('');
  const [cardioInt, setCardioInt] = useState('moderată');
  const [workType, setWorkType] = useState('munca_usoara');
  const [workDur, setWorkDur] = useState('');
  const key = todayKey();
  const todayW = workouts.days?.[key] || { exercises: [], cardio: [], work: [] };
  const w = parseFloat(profile?.weight) || 80;

  const addSet = () => setSets(s => [...s, { kg: '', reps: '' }]);
  const updSet = (i, f, v) => setSets(s => s.map((set, idx) => idx === i ? { ...set, [f]: v } : set));
  const rmSet = i => setSets(s => s.filter((_, idx) => idx !== i));

  const getPR = (exId) => {
    const all = Object.values(workouts.days || {}).flatMap(d => (d.exercises || []).filter(e => e.id === exId).flatMap(e => e.sets || []));
    if (!all.length) return null;
    return Math.max(...all.map(s => parseFloat(s.kg) || 0));
  };

  const saveEx = () => {
    if (!selEx || !sets.length) return;
    const valid = sets.filter(s => s.kg && s.reps && parseFloat(s.kg) > 0 && parseInt(s.reps) > 0);
    if (!valid.length) return;
    const ex = EXERCISES[selGroup].find(e => e.id === selEx);
    const vol = valid.reduce((a, s) => a + parseFloat(s.kg) * parseInt(s.reps), 0);
    const entry = { id: selEx, name: ex.name, group: selGroup, sets: valid, volume: Math.round(vol), time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], exercises: [...(nw.days[key].exercises||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setSets([]); setSelEx(null);
    onSendToCoach(`Forță: ${ex.name} — ${valid.map(s => `${s.kg}kg×${s.reps}`).join(', ')}`);
  };

  const saveCardio = () => {
    if (!cardioDur || parseInt(cardioDur) <= 0) return;
    const ct = CARDIO_TYPES.find(c => c.id === cardioType) || CARDIO_TYPES[0];
    const kcal = calcBurned(ct.met, parseInt(cardioDur), w);
    const entry = { id: cardioType, name: ct.name, icon: ct.icon, duration: parseInt(cardioDur), intensity: cardioInt, kcal, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], cardio: [...(nw.days[key].cardio||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setCardioDur('');
    onSendToCoach(`Cardio: ${ct.name} ${cardioDur}min (${cardioInt}) — ${kcal} kcal`);
  };

  const saveWork = () => {
    if (!workDur || parseInt(workDur) <= 0) return;
    const wt = WORK_TYPES.find(t => t.id === workType) || WORK_TYPES[0];
    const kcal = calcBurned(wt.met, parseInt(workDur), w);
    const entry = { id: workType, name: wt.name, icon: wt.icon, duration: parseInt(workDur), kcal, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], work: [...(nw.days[key].work||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setWorkDur('');
    onSendToCoach(`Muncă fizică: ${wt.name} ${workDur}min — ${kcal} kcal arse`);
  };

  const delEx = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],exercises:(nw.days[key].exercises||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };
  const delCardio = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],cardio:(nw.days[key].cardio||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };
  const delWork = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],work:(nw.days[key].work||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };

  const inp = { background: th.card2, border: `1.5px solid ${th.border}`, borderRadius: '10px', padding: '10px', color: th.text, fontSize: '15px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: th.text }}>💪 Antrenament</div>
          <button onClick={onOpenGymMode} className="btn-tap"
            style={{ padding: '9px 16px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 3px 12px rgba(249,115,22,0.4)' }}>
            💪 GYM MODE
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px' }}>
          {[{id:'gym',label:'🏋 Sală'},{id:'cardio',label:'🏃 Cardio'},{id:'munca',label:'🔧 Muncă'}].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: `2px solid ${mode===m.id?'#f97316':th.border}`, background: mode===m.id ? 'rgba(249,115,22,0.1)' : 'transparent', color: mode===m.id ? '#f97316' : th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* GYM */}
        {mode === 'gym' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MUSCLE_GROUPS.map(g => (
                <button key={g.id} onClick={() => { setSelGroup(g.id); setSelEx(null); setSets([]); }}
                  style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${selGroup===g.id?g.color:th.border}`, background: selGroup===g.id?`${g.color}15`:'transparent', color: selGroup===g.id?g.color:th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${th.border}` }}>
              <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>ALEGE EXERCIȚIU</div>
              {EXERCISES[selGroup].map(ex => {
                const pr = getPR(ex.id);
                return (
                  <button key={ex.id} onClick={() => { setSelEx(ex.id); if (!sets.length) setSets([{kg:'',reps:''}]); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1.5px solid ${selEx===ex.id?'rgba(249,115,22,0.4)':th.border}`, background: selEx===ex.id?'rgba(249,115,22,0.08)':'transparent', cursor: 'pointer', marginBottom: '6px', textAlign: 'left' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: selEx===ex.id?'#f97316':th.text }}>{ex.name}</span>
                    {pr && <span style={{ fontSize: '11px', color: th.text3, background: th.card2, padding: '2px 8px', borderRadius: '6px' }}>PR: {pr}kg</span>}
                  </button>
                );
              })}
            </div>
            {selEx && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f97316', marginBottom: '12px' }}>{EXERCISES[selGroup].find(e=>e.id===selEx)?.name}</div>
                {sets.map((set, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="number" value={set.kg} onChange={e => updSet(i,'kg',e.target.value)} placeholder="kg" style={inp}/>
                    <input type="number" value={set.reps} onChange={e => updSet(i,'reps',e.target.value)} placeholder="reps" style={inp}/>
                    <button onClick={() => rmSet(i)} style={{ width: '36px', height: '42px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <button onClick={addSet} style={{ padding: '10px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', color: th.text2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>+ Set</button>
                  <button onClick={saveEx} style={{ padding: '10px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(249,115,22,0.3)' }}>SALVEAZĂ ◆</button>
                </div>
              </div>
            )}
            {todayW.exercises?.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 SESIUNE AZI</div>
                {todayW.exercises.map((ex, i) => {
                  const mg = MUSCLE_GROUPS.find(g => g.id === ex.group);
                  return (
                    <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: th.card, borderRadius: '10px', borderLeft: `3px solid ${mg?.color||'#f97316'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: th.text }}>{ex.name}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: th.text3 }}>{ex.time}</span>
                          <button onClick={() => delEx(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '2px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {ex.sets.map((s, j) => <span key={j} style={{ fontSize: '12px', color: th.text2, background: th.card2, padding: '3px 8px', borderRadius: '6px' }}>{s.kg}kg×{s.reps}</span>)}
                        <span style={{ fontSize: '11px', color: th.text3, marginLeft: 'auto' }}>Vol: {ex.volume}kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CARDIO */}
        {mode === 'cardio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CARDIO_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setCardioType(ct.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '100px', border: `1.5px solid ${cardioType===ct.id?ct.color:th.border}`, background: cardioType===ct.id?`${ct.color}15`:'transparent', color: cardioType===ct.id?ct.color:th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  <span>{ct.icon}</span>{ct.name}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>DURATĂ (min)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[15,20,30,45,60,90].map(min => (
                    <button key={min} onClick={() => setCardioDur(String(min))}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${cardioDur===String(min)?'#10b981':th.border}`, background: cardioDur===String(min)?'rgba(16,185,129,0.12)':th.card2, color: cardioDur===String(min)?'#10b981':th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{min}</button>
                  ))}
                </div>
                <input type="number" value={cardioDur} onChange={e => setCardioDur(e.target.value)} placeholder="sau scrie manual..." style={{ width: '100%', ...inp, textAlign: 'left', padding: '10px 14px' }}/>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>INTENSITATE</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['ușoară','moderată','intensă'].map(int => (
                    <button key={int} onClick={() => setCardioInt(int)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1.5px solid ${cardioInt===int?'#10b981':th.border}`, background: cardioInt===int?'rgba(16,185,129,0.12)':th.card2, color: cardioInt===int?'#10b981':th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{int}</button>
                  ))}
                </div>
              </div>
              {cardioDur && parseInt(cardioDur) > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px', fontWeight: 700 }}>ESTIMAT ARS</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', fontFamily: "'Barlow Condensed',sans-serif" }}>{calcBurned(CARDIO_TYPES.find(ct2 => ct2.id === cardioType)?.met || 3.5, parseInt(cardioDur), w)} kcal</div>
                </div>
              )}
              <button onClick={saveCardio} disabled={!cardioDur||parseInt(cardioDur)<=0}
                style={{ padding: '14px', background: cardioDur&&parseInt(cardioDur)>0?'linear-gradient(135deg,#10b981,#059669)':th.card2, border: 'none', borderRadius: '12px', color: cardioDur&&parseInt(cardioDur)>0?'#fff':th.text3, fontSize: '15px', fontWeight: 800, cursor: cardioDur&&parseInt(cardioDur)>0?'pointer':'not-allowed', fontFamily: 'inherit' }}>◆ SALVEAZĂ CARDIO</button>
            </div>
            {todayW.cardio?.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 CARDIO AZI</div>
                {todayW.cardio.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{c.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{c.name}</div><div style={{ fontSize: '11px', color: th.text3 }}>{c.duration}min · {c.intensity}</div></div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{c.kcal} kcal</span>
                    <button onClick={() => delCardio(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MUNCA FIZICA */}
        {mode === 'munca' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: th.text2 }}>
              💡 Muncă fizică = activitate zilnică suplimentară (nu sport). Contribuie la totalul caloric ars.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {WORK_TYPES.map(wt => (
                <button key={wt.id} onClick={() => setWorkType(wt.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', border: `2px solid ${workType===wt.id?'#f97316':th.border}`, background: workType===wt.id?'rgba(249,115,22,0.08)':'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '24px' }}>{wt.icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: workType===wt.id?'#f97316':th.text }}>{wt.name}</div>
                    <div style={{ fontSize: '12px', color: th.text3 }}>{wt.desc} · MET {wt.met}</div>
                  </div>
                  {workType === wt.id && <span style={{ marginLeft: 'auto', color: '#f97316', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>DURATĂ (minute)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[30,60,90,120,180,240].map(min => (
                    <button key={min} onClick={() => setWorkDur(String(min))}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${workDur===String(min)?'#f97316':th.border}`, background: workDur===String(min)?'rgba(249,115,22,0.12)':th.card2, color: workDur===String(min)?'#f97316':th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{min}</button>
                  ))}
                </div>
                <input type="number" value={workDur} onChange={e => setWorkDur(e.target.value)} placeholder="sau scrie manual..." style={{ width: '100%', ...inp, textAlign: 'left', padding: '10px 14px' }}/>
              </div>
              {workDur && parseInt(workDur) > 0 && (
                <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#f97316', marginBottom: '4px', fontWeight: 700 }}>ESTIMAT ARS</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#f97316', fontFamily: "'Barlow Condensed',sans-serif" }}>{calcBurned(WORK_TYPES.find(t => t.id === workType)?.met || 2.5, parseInt(workDur), w)} kcal</div>
                </div>
              )}
              <button onClick={saveWork} disabled={!workDur||parseInt(workDur)<=0}
                style={{ padding: '14px', background: workDur&&parseInt(workDur)>0?'linear-gradient(135deg,#f97316,#ef4444)':th.card2, border: 'none', borderRadius: '12px', color: workDur&&parseInt(workDur)>0?'#fff':th.text3, fontSize: '15px', fontWeight: 800, cursor: workDur&&parseInt(workDur)>0?'pointer':'not-allowed', fontFamily: 'inherit' }}>◆ SALVEAZĂ ACTIVITATE</button>
            </div>
            {(todayW.work||[]).length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 ACTIVITATE AZI</div>
                {(todayW.work||[]).map((w2, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{w2.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{w2.name}</div><div style={{ fontSize: '11px', color: th.text3 }}>{w2.duration}min</div></div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#f97316' }}>{w2.kcal} kcal</span>
                    <button onClick={() => delWork(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
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

// ─── PROGRES TAB ──────────────────────────────────────────────────────────────

export default AntrenamentTab;
