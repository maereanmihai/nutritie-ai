import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function AziTab({ th, profile, dayType, setDayType, currentDay, dayMacros, todayStats, todayMeals, todayWorkout, streak, todaySupl, suplTakenToday, onToggleSupl, messages, input, setInput, loading, onSend, messagesEndRef, darkMode, setDarkMode, onOpenFoodPicker, onDeleteMeal }) {
  const [showChat, setShowChat] = useState(false);
  const [steps, setSteps] = useState(() => {
    try { return parseInt(localStorage.getItem('ha_steps_' + todayKey()) || '0'); } catch { return 0; }
  });
  const [stepsInput, setStepsInput] = useState('');
  const [showStepsInput, setShowStepsInput] = useState(false);
  const quote = getDailyQuote();
  const calPct = dayMacros?.kcal ? Math.min(100, Math.round((todayStats.calories || 0) / dayMacros.kcal * 100)) : 0;

  const saveSteps = (val) => {
    const n = parseInt(val) || 0;
    setSteps(n);
    try { localStorage.setItem('ha_steps_' + todayKey(), String(n)); } catch {}
    setShowStepsInput(false);
    setStepsInput('');
  };

  // Calorii arse din pași (aprox 0.04 kcal/pas pentru 80kg)
  const stepsKcal = Math.round(steps * 0.04);
  const stepsKm = (steps * 0.0008).toFixed(1);

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '15px', fontWeight: 700, color: th.text, margin: '12px 0 6px' }}>{line.replace('## ', '')}</div>;
      if (line.startsWith('### ')) return <div key={i} style={{ fontSize: '14px', fontWeight: 600, color: th.text, margin: '8px 0 4px' }}>{line.replace('### ', '')}</div>;
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const raw = line.replace(/^[*-] /, '');
        const parts = raw.split(/\*\*(.*?)\*\*/g);
        return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'flex-start' }}><span style={{ color: th.accent, flexShrink: 0, marginTop: '2px' }}>◆</span><span style={{ fontSize: '14px', lineHeight: 1.5, color: th.text2 }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</span></div>;
      }
      if (line.match(/^\d+\./)) {
        const raw = line.replace(/^\d+\.\s?/, '');
        const parts = raw.split(/\*\*(.*?)\*\*/g);
        return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'flex-start' }}><span style={{ color: th.accent, flexShrink: 0, fontSize: '12px', marginTop: '3px', fontWeight: 700 }}>{line.match(/^\d+/)?.[0]}.</span><span style={{ fontSize: '14px', lineHeight: 1.5, color: th.text2 }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</span></div>;
      }
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} style={{ fontSize: '14px', lineHeight: 1.6, color: th.text2, marginBottom: '4px' }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</p>;
      }
      if (line.trim() === '' || line.trim() === '---') return <div key={i} style={{ height: '6px' }}/>;
      if (line.startsWith('{')) return null;
      return <p key={i} style={{ fontSize: '14px', lineHeight: 1.6, color: th.text2, marginBottom: '3px' }}>{line}</p>;
    });
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER DARK ── */}
      <div style={{ background: darkMode ? 'linear-gradient(160deg,#0f1535 0%,#070a12 100%)' : 'linear-gradient(160deg,#1e3a8a 0%,#1e40af 100%)', padding: '14px 18px 18px', flexShrink: 0 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>
              {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              {profile?.name ? `Bună, ${profile.name}! 👋` : 'Health Agent 💪'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: '10px', padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '13px' }}>🔥</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{streak}</span>
              </div>
            )}
            <button onClick={() => setDarkMode(d => !d)} style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* CITAT */}
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '12px', padding: '10px 13px', marginBottom: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>CITATUL ZILEI</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, fontStyle: 'italic' }}>"{quote.text}"</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>— {quote.author}</div>
        </div>

        {/* TIP ZI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '13px' }}>
          {DAY_TYPES.map(d => (
            <button key={d.val} onClick={() => setDayType(d.val)} className="btn-tap"
              style={{ borderRadius: '12px', padding: '10px 6px', border: dayType === d.val ? 'none' : '1px solid rgba(255,255,255,0.1)', background: dayType === d.val ? d.bg : 'rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: dayType === d.val ? `0 4px 16px ${d.glow}` : 'none' }}>
              <div style={{ fontSize: '17px', marginBottom: '2px' }}>{d.icon}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{d.short}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{getDayMacros(profile, d.val)?.kcal || 0} kcal</div>
            </button>
          ))}
        </div>

        {/* START / STOP ZI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={() => { setShowChat(true); onSend('Start zi'); }} className="btn-tap"
            style={{ padding: '12px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 3px 12px rgba(16,185,129,0.4)' }}>
            🌅 START ZI
          </button>
          <button onClick={() => { setShowChat(true); onSend('Stop zi — sinteză completă cu pro/contra și recomandări pentru mâine'); }} className="btn-tap"
            style={{ padding: '12px', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 3px 12px rgba(139,92,246,0.4)' }}>
            🌙 STOP ZI
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px' }}>

        {/* ── AI COACH CHAT ── */}
        <div style={{ background: th.bg2, borderRadius: '16px', border: `1px solid ${th.border}`, overflow: 'hidden' }}>
          <button onClick={() => setShowChat(c => !c)} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: th.text }}>AI Coach</span>
              {messages.length > 0 && <span style={{ fontSize: '11px', background: `${th.accent}20`, color: th.accent, padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>{messages.length}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[{ label: '📊 Total', cmd: 'Total zi' }, { label: '📈 Săpt.', cmd: 'Analiză săptămână' }].map(q => (
                <button key={q.cmd} onClick={e => { e.stopPropagation(); setShowChat(true); onSend(q.cmd); }} style={{ padding: '4px 8px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '8px', color: th.text2, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{q.label}</button>
              ))}
              <span style={{ fontSize: '12px', color: th.text3 }}>{showChat ? '▲' : '▼'}</span>
            </div>
          </button>

          {showChat && (
            <>
              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `1px solid ${th.border}` }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>
                    Apasă <strong style={{ color: '#10b981' }}>🌅 START ZI</strong> pentru a începe ziua structurat.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '3px', marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', color: th.text3, fontWeight: 700, letterSpacing: '0.08em' }}>
                      {m.role === 'user' ? '◆ TU' : '⚡ AI COACH'}
                    </div>
                    <div style={{ maxWidth: '90%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? (currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)') : th.card2, border: m.role === 'user' ? 'none' : `1px solid ${th.border}` }}>
                      {m.role === 'user'
                        ? <span style={{ fontSize: '14px', color: '#fff' }}>{m.display || m.content}</span>
                        : <div>{renderMarkdown(m.content)}</div>
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', gap: '4px', padding: '6px 2px', marginTop: '6px' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: th.accent, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>
              <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${th.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea value={input} onChange={e => { setInput(e.target.value); e.target.style.height = '38px'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input); } }}
                  placeholder="Scrie liber..." disabled={loading} rows={1}
                  style={{ flex: 1, background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '9px 12px', color: th.text, fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', height: '38px', minHeight: '38px', lineHeight: 1.4 }}/>
                <button onClick={() => onSend(input)} disabled={loading || !input.trim()} className="btn-tap"
                  style={{ width: '38px', height: '38px', background: input.trim() ? (currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)') : th.card2, border: 'none', borderRadius: '10px', color: input.trim() ? '#fff' : th.text3, cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>↑</button>
              </div>
            </>
          )}
        </div>

        {/* ── ADAUGĂ MASĂ ── */}
        <button onClick={onOpenFoodPicker} className="btn-tap"
          style={{ width: '100%', background: currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '13px', cursor: 'pointer', boxShadow: `0 4px 16px ${currentDay?.glow || 'rgba(249,115,22,0.3)'}` }}>
          <div style={{ width: '38px', height: '38px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>+</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Adaugă masă</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Scanner · AI Search · Alimente · Template</div>
          </div>
        </button>

        {/* ── MACRO PROGRESS ── */}
        {dayMacros && (
          <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>📊 Macro azi</span>
              <span style={{ fontSize: '12px', color: calPct >= 100 ? '#ef4444' : th.accent, fontWeight: 700 }}>{todayStats.calories || 0} / {dayMacros.kcal} kcal · {calPct}%</span>
            </div>
            {/* Calorii bar */}
            <div style={{ height: '8px', background: th.card2, borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ width: `${calPct}%`, height: '100%', background: calPct > 100 ? '#ef4444' : currentDay?.bg || 'linear-gradient(90deg,#f97316,#ef4444)', borderRadius: '4px', transition: 'width 0.5s ease' }}/>
            </div>
            {/* Macro 3 cols */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Proteine', cur: todayStats.protein || 0, target: dayMacros.protein, color: '#10b981', bg: darkMode ? 'rgba(16,185,129,0.1)' : '#EAF3DE', tc: '#3B6D11' },
                { label: 'Carbs',    cur: todayStats.carbs || 0,   target: dayMacros.carbs,   color: '#3b82f6', bg: darkMode ? 'rgba(59,130,246,0.1)' : '#E6F1FB', tc: '#185FA5' },
                { label: 'Grăsimi', cur: todayStats.fat || 0,     target: dayMacros.fat,     color: '#f59e0b', bg: darkMode ? 'rgba(245,158,11,0.1)' : '#FAEEDA', tc: '#854F0B' },
              ].map(m => {
                const pct = m.target ? Math.min(100, Math.round(m.cur / m.target * 100)) : 0;
                return (
                  <div key={m.label} style={{ background: m.bg, borderRadius: '10px', padding: '9px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? m.color : m.tc }}>{Math.round(m.cur)}g</div>
                    <div style={{ fontSize: '10px', color: darkMode ? m.color : m.tc, opacity: 0.7, marginBottom: '5px' }}>{m.label}</div>
                    <div style={{ height: '4px', background: darkMode ? `${m.color}25` : `${m.color}30`, borderRadius: '2px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: '2px', transition: 'width 0.4s' }}/>
                    </div>
                    <div style={{ fontSize: '9px', color: darkMode ? m.color : m.tc, opacity: 0.55, marginTop: '3px' }}>{Math.round(m.cur)}/{m.target}g</div>
                  </div>
                );
              })}
            </div>
            {/* Fibre */}
            {todayStats.fiber > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: th.text3 }}>🌿 Fibre: {todayStats.fiber}g</span>
                <div style={{ flex: 1, height: '4px', background: th.card2, borderRadius: '2px' }}>
                  <div style={{ width: `${Math.min(100, (todayStats.fiber/30)*100)}%`, height: '100%', background: '#8b5cf6', borderRadius: '2px' }}/>
                </div>
                <span style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 700 }}>{Math.round((todayStats.fiber/30)*100)}% / 30g</span>
              </div>
            )}
          </div>
        )}

        {/* ── PAȘI ── */}
        <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: steps > 0 ? '10px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🦶</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>Pași azi</div>
                {steps > 0 && <div style={{ fontSize: '11px', color: th.text3 }}>{steps.toLocaleString('ro-RO')} pași · {stepsKm} km · ~{stepsKcal} kcal</div>}
              </div>
            </div>
            <button onClick={() => setShowStepsInput(s => !s)} style={{ padding: '6px 12px', background: `${th.accent}15`, border: `1px solid ${th.accent}35`, borderRadius: '10px', color: th.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {steps > 0 ? '✏️ Edit' : '+ Adaugă'}
            </button>
          </div>

          {showStepsInput && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                {[3000,5000,7500,10000,12000,15000].map(n => (
                  <button key={n} onClick={() => saveSteps(n)} style={{ padding: '6px 10px', borderRadius: '8px', border: `1.5px solid ${th.border}`, background: th.card2, color: th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{(n/1000).toFixed(0)}k</button>
                ))}
              </div>
            </div>
          )}
          {showStepsInput && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input type="number" value={stepsInput} onChange={e => setStepsInput(e.target.value)}
                placeholder="ex: 8500" inputMode="numeric"
                style={{ flex: 1, background: th.card2, border: `1.5px solid ${th.accent}40`, borderRadius: '10px', padding: '9px 12px', color: th.text, fontSize: '15px', outline: 'none', fontFamily: 'inherit' }}/>
              <button onClick={() => saveSteps(stepsInput)} style={{ padding: '9px 16px', background: currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>✓</button>
            </div>
          )}

          {steps > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ height: '8px', background: th.card2, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (steps/10000)*100)}%`, height: '100%', background: 'linear-gradient(90deg,#10b981,#3b82f6)', borderRadius: '4px', transition: 'width 0.5s' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: th.text3 }}>
                <span>0</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{Math.round((steps/10000)*100)}% din 10.000</span>
                <span>10k</span>
              </div>
            </div>
          )}
        </div>

        {/* ── MESELE ZILEI ── */}
        {todayMeals.length > 0 && (
          <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>🍽 Mesele de azi</div>
            {todayMeals.map(meal => (
              <div key={meal.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${th.border}` }}>
                <span style={{ fontSize: '20px' }}>{meal.emoji || '🍽'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meal.name}</div>
                  <div style={{ fontSize: '11px', color: th.text3 }}>{meal.kcal}kcal · P:{meal.p}g · C:{meal.c}g · G:{meal.fat||0}g</div>
                </div>
                <span style={{ fontSize: '10px', color: th.text3, flexShrink: 0 }}>{meal.time}</span>
                <button onClick={() => onDeleteMeal(meal.id)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '4px 7px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* ── SUPLIMENTE ── */}
        {todaySupl.length > 0 && (
          <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>💊 Suplimente azi</span>
              <span style={{ background: todaySupl.filter(s => suplTakenToday[s.id]).length === todaySupl.length ? '#EAF3DE' : th.card2, color: todaySupl.filter(s => suplTakenToday[s.id]).length === todaySupl.length ? '#3B6D11' : th.text3, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px' }}>
                {todaySupl.filter(s => suplTakenToday[s.id]).length}/{todaySupl.length}
              </span>
            </div>
            {Object.entries(todaySupl.reduce((acc, s) => { const t = s.time.substring(0,5); if (!acc[t]) acc[t] = []; acc[t].push(s); return acc; }, {})).sort().map(([time, supl]) => (
              <div key={time} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '4px' }}>{time}</div>
                {supl.map(s => (
                  <div key={s.id} onClick={() => onToggleSupl(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: suplTakenToday[s.id] ? '#10b981' : 'transparent', border: `2px solid ${suplTakenToday[s.id] ? '#10b981' : th.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {suplTakenToday[s.id] && <span style={{ fontSize: '10px', color: '#fff' }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '13px', color: suplTakenToday[s.id] ? th.text3 : th.text, textDecoration: suplTakenToday[s.id] ? 'line-through' : 'none', flex: 1 }}>{s.emoji} {s.name}</span>
                    <span style={{ fontSize: '10px', color: th.text3 }}>{s.time}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: '10px' }}/>
      </div>
    </div>
  );
}

export default AziTab;
