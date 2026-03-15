import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function ProgresTab({ th, stats, setStats, workouts, profile }) {
  const [activeChart, setActiveChart] = useState('greutate');
  const [newWeight, setNewWeight] = useState('');
  const key = todayKey();

  const weightEntries = Object.entries(stats.weight || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-30);
  const calEntries = Object.entries(stats.daily || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const currentWeight = stats.weight?.[key] || stats.weight?.[Object.keys(stats.weight||{}).sort().pop()] || null;
  const startWeight = parseFloat(profile?.weight) || null;
  const targetWeight = parseFloat(profile?.targetWeight) || null;
  const lostKg = startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : null;

  const saveWeight = () => {
    if (!newWeight || parseFloat(newWeight) <= 0) return;
    const val = parseFloat(newWeight);
    setStats(prev => {
      const ns = { ...prev, weight: { ...(prev.weight||{}), [key]: val } };
      lsSave(K.stats, ns);
      return ns;
    });
    setNewWeight('');
  };

  const mini = (entries, key2, color, max) => {
    if (entries.length < 2) return null;
    const vals = entries.map(([, v]) => v[key2] || 0);
    const mn = Math.min(...vals) * 0.98, mx = max || Math.max(...vals) * 1.02;
    const pts = entries.map(([, v], i) => {
      const x = (i / (entries.length-1)) * 100;
      const y = 100 - ((( v[key2] || 0) - mn) / (mx - mn)) * 100;
      return `${x},${Math.max(0, Math.min(100, y))}`;
    });
    return (
      <svg viewBox="0 0 100 50" style={{ width: '100%', height: '60px' }} preserveAspectRatio="none">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '16px' }}>📊 Progres</div>

      {/* WEIGHT QUICK INPUT */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', marginBottom: '12px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>⚖️ Greutate azi</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={currentWeight ? `${currentWeight} kg` : 'ex: 95.8'} style={{ flex: 1, background: th.card2, border: `1.5px solid ${newWeight?'#f97316':th.border}`, borderRadius: '10px', padding: '10px 14px', color: th.text, fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}/>
          <button onClick={saveWeight} style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>SALVEAZĂ</button>
        </div>
        {lostKg !== null && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1, background: lostKg > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: lostKg > 0 ? '#10b981' : '#ef4444' }}>{lostKg > 0 ? '-' : '+'}{Math.abs(lostKg)}kg</div>
              <div style={{ fontSize: '10px', color: th.text3 }}>față de start</div>
            </div>
            {targetWeight && currentWeight && (
              <div style={{ flex: 1, background: 'rgba(139,92,246,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6' }}>{Math.abs(Math.round((currentWeight - targetWeight)*10)/10)}kg</div>
                <div style={{ fontSize: '10px', color: th.text3 }}>până la țintă</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[{id:'greutate',label:'⚖️ Greutate'},{id:'calorii',label:'🔥 Calorii'},{id:'proteine',label:'💪 Proteine'}].map(c => (
          <button key={c.id} onClick={() => setActiveChart(c.id)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `1.5px solid ${activeChart===c.id?'#f97316':th.border}`, background: activeChart===c.id?'rgba(249,115,22,0.1)':'transparent', color: activeChart===c.id?'#f97316':th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{c.label}</button>
        ))}
      </div>

      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', marginBottom: '12px', border: `1px solid ${th.border}` }}>
        {activeChart === 'greutate' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Greutate (ultimele 30 zile)</div>
            {weightEntries.length > 1 ? (
              <>
                <svg viewBox="0 0 300 80" style={{ width: '100%', height: '80px' }} preserveAspectRatio="none">
                  {(() => {
                    const vals = weightEntries.map(([, v]) => v);
                    const mn = Math.min(...vals) - 0.5, mx = Math.max(...vals) + 0.5;
                    const pts = weightEntries.map(([, v], i) => `${(i/(weightEntries.length-1))*300},${80-((v-mn)/(mx-mn))*70}`);
                    return <>
                      <polyline points={pts.join(' ')} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      {weightEntries.map(([, v], i) => <circle key={i} cx={(i/(weightEntries.length-1))*300} cy={80-((v-mn)/(mx-mn))*70} r="4" fill="#f97316"/>)}
                    </>;
                  })()}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: th.text3 }}>
                  <span>{weightEntries[0]?.[0]?.slice(5)}</span>
                  <span style={{ fontWeight: 700, color: '#f97316' }}>{weightEntries[weightEntries.length-1]?.[1]} kg</span>
                  <span>{weightEntries[weightEntries.length-1]?.[0]?.slice(5)}</span>
                </div>
              </>
            ) : <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Înregistrează greutatea zilnic pentru a vedea graficul.</div>}
          </>
        )}
        {activeChart === 'calorii' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Calorii (ultimele 14 zile)</div>
            {mini(calEntries, 'calories', '#ef4444')}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {calEntries.slice(-7).map(([date, d]) => (
                <div key={date} style={{ textAlign: 'center', flex: 1, minWidth: '36px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{d.calories || 0}</div>
                  <div style={{ fontSize: '10px', color: th.text3 }}>{date.slice(8)}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {activeChart === 'proteine' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Proteine (ultimele 14 zile)</div>
            {mini(calEntries, 'protein', '#10b981')}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {calEntries.slice(-7).map(([date, d]) => (
                <div key={date} style={{ textAlign: 'center', flex: 1, minWidth: '36px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{d.protein || 0}g</div>
                  <div style={{ fontSize: '10px', color: th.text3 }}>{date.slice(8)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* SPORT HISTORY */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>📅 Activitate sportivă (7 zile)</div>
        {Object.entries(workouts.days || {}).sort((a,b) => b[0].localeCompare(a[0])).slice(0,7).map(([date, day]) => {
          const exCount = day.exercises?.length || 0;
          const cardioKcal = (day.cardio||[]).reduce((a,c) => a+c.kcal, 0);
          const workKcal = (day.work||[]).reduce((a,w) => a+w.kcal, 0);
          if (!exCount && !cardioKcal && !workKcal) return null;
          return (
            <div key={date} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
              <div style={{ fontSize: '12px', color: th.text3, minWidth: '40px' }}>{date.slice(5)}</div>
              <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {exCount > 0 && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🏋 {exCount} ex.</span>}
                {cardioKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🏃 {cardioKcal}kcal</span>}
                {workKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🔧 {workKcal}kcal</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: '20px' }}/>
    </div>
  );
}

// ─── PROFIL TAB ───────────────────────────────────────────────────────────────

export default ProgresTab;
