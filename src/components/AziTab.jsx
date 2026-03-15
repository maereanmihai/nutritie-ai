import { useState, useRef, useEffect } from 'react';
import { getDayMacros } from '../utils/calculations';
import { todayKey } from '../utils/storage';
import { DAY_TYPES } from '../constants/dayTypes';
import { getDailyQuote } from '../constants/quotes';
import { SuggestieAI } from './SetariTab';

function AziTab({ th, profile, dayType, setDayType, currentDay, dayMacros, todayStats, todayMeals, todayWorkout, streak, todaySupl, suplTakenToday, onToggleSupl, messages, input, setInput, loading, onSend, messagesEndRef, darkMode, setDarkMode, onOpenFoodPicker, onDeleteMeal, stats, workouts }) {
  const [activeView, setActiveView] = useState('azi'); // azi | calendar
  const [steps, setSteps] = useState(() => {
    try { return parseInt(localStorage.getItem('ha_steps_' + todayKey()) || '0'); } catch { return 0; }
  });
  const [stepsInput, setStepsInput] = useState('');
  const [showStepsInput, setShowStepsInput] = useState(false);
  const [startZiSent, setStartZiSent] = useState(false);
  const [stopZiSent, setStopZiSent] = useState(false);
  const chatEndRef = useRef(null);
  const quote = getDailyQuote();
  const calPct = dayMacros?.kcal ? Math.min(100, Math.round((todayStats.calories || 0) / dayMacros.kcal * 100)) : 0;

  // Auto scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const saveSteps = (val) => {
    const n = parseInt(val) || 0;
    setSteps(n);
    try { localStorage.setItem('ha_steps_' + todayKey(), String(n)); } catch {}
    setShowStepsInput(false);
    setStepsInput('');
  };

  const handleStartZi = () => {
    if (loading) return;
    if (navigator.vibrate) navigator.vibrate(15);
    setStartZiSent(true);
    onSend('Start zi');
  };

  const handleStopZi = () => {
    if (loading) return;
    if (navigator.vibrate) navigator.vibrate(15);
    setStopZiSent(true);
    onSend('Stop zi — sinteză completă cu pro/contra și recomandări pentru mâine');
  };

  const stepsKcal = Math.round(steps * 0.04);
  const stepsKm   = (steps * 0.0008).toFixed(1);

  // ── Markdown renderer ──────────────────────────────────────────────────────
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '14px', fontWeight: 700, color: th.text, margin: '10px 0 5px' }}>{line.replace('## ', '')}</div>;
      if (line.startsWith('### ')) return <div key={i} style={{ fontSize: '13px', fontWeight: 600, color: th.text, margin: '7px 0 3px' }}>{line.replace('### ', '')}</div>;
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const raw = line.replace(/^[*-] /, '');
        const parts = raw.split(/\*\*(.*?)\*\*/g);
        return <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '3px', alignItems: 'flex-start' }}><span style={{ color: th.accent, flexShrink: 0, fontSize: '10px', marginTop: '4px' }}>◆</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: th.text2 }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</span></div>;
      }
      if (line.match(/^\d+\./)) {
        const raw = line.replace(/^\d+\.\s?/, '');
        const parts = raw.split(/\*\*(.*?)\*\*/g);
        return <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '3px', alignItems: 'flex-start' }}><span style={{ color: th.accent, flexShrink: 0, fontSize: '11px', marginTop: '2px', fontWeight: 700 }}>{line.match(/^\d+/)?.[0]}.</span><span style={{ fontSize: '13px', lineHeight: 1.5, color: th.text2 }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</span></div>;
      }
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} style={{ fontSize: '13px', lineHeight: 1.5, color: th.text2, marginBottom: '3px' }}>{parts.map((p, j) => j%2===1 ? <strong key={j} style={{ color: th.text }}>{p}</strong> : p)}</p>;
      }
      if (line.trim() === '' || line.trim() === '---') return <div key={i} style={{ height: '5px' }}/>;
      if (line.startsWith('{')) return null;
      return <p key={i} style={{ fontSize: '13px', lineHeight: 1.5, color: th.text2, marginBottom: '2px' }}>{line}</p>;
    });
  };

  // ── Calendar data ──────────────────────────────────────────────────────────
  const calendarDays = (() => {
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const daily = stats?.daily?.[key] || {};
      const workout = workouts?.days?.[key] || {};
      const hasEx = (workout.exercises?.length || 0) > 0;
      const hasCardio = (workout.cardio?.length || 0) > 0;
      const kcal = daily.calories || 0;
      const protein = daily.protein || 0;
      const isToday = i === 0;
      days.push({ key, date: d.getDate(), month: d.getMonth(), dow: d.getDay(), kcal, protein, hasEx, hasCardio, isToday });
    }
    return days;
  })();

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ── */}
      <div style={{ background: darkMode ? 'linear-gradient(160deg,#0f1535 0%,#070a12 100%)' : 'linear-gradient(160deg,#1e3a8a 0%,#1e40af 100%)', padding: '12px 16px 16px', flexShrink: 0 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1px' }}>
              {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              {profile?.name ? `Bună, ${profile.name}! 👋` : 'Health Agent 💪'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: '10px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '12px' }}>🔥</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{streak}</span>
              </div>
            )}
            <button onClick={() => setActiveView(v => v === 'calendar' ? 'azi' : 'calendar')}
              style={{ padding: '5px 10px', background: activeView === 'calendar' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
              📅
            </button>
            <button onClick={() => setDarkMode(d => !d)}
              style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* CITAT */}
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '9px 12px', marginBottom: '11px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, fontStyle: 'italic' }}>"{quote.text}"</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>— {quote.author}</div>
        </div>

        {/* TIP ZI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginBottom: '11px' }}>
          {DAY_TYPES.map(d => (
            <button key={d.val} onClick={() => setDayType(d.val)} className="btn-tap"
              style={{ borderRadius: '11px', padding: '9px 6px', border: dayType === d.val ? 'none' : '1px solid rgba(255,255,255,0.1)', background: dayType === d.val ? d.bg : 'rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: dayType === d.val ? `0 3px 12px ${d.glow}` : 'none' }}>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>{d.icon}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{d.short}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>{getDayMacros(profile, d.val)?.kcal || 0} kcal</div>
            </button>
          ))}
        </div>

        {/* START / STOP ZI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={handleStartZi} disabled={loading} className="btn-tap"
            style={{ padding: '11px', background: loading && !stopZiSent ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '11px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: loading ? 0.8 : 1 }}>
            {loading && startZiSent && !stopZiSent ? (
              <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> AI gândește...</>
            ) : startZiSent && !loading ? (
              <><span>✓</span> Ziua a început</>
            ) : '🌅 START ZI'}
          </button>
          <button onClick={handleStopZi} disabled={loading} className="btn-tap"
            style={{ padding: '11px', background: loading && stopZiSent ? 'linear-gradient(135deg,#6d28d9,#4c1d95)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: '11px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: loading ? 0.8 : 1 }}>
            {loading && stopZiSent ? (
              <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> AI gândește...</>
            ) : stopZiSent && !loading ? (
              <><span>✓</span> Sinteză gata</>
            ) : '🌙 STOP ZI'}
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px' }}>

        {/* ══ CALENDAR VIEW ══ */}
        {activeView === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: th.text }}>📅 Ultimele 30 zile</div>

            {/* Calendar grid */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '8px' }}>
                {['D','L','M','M','J','V','S'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: th.text3, fontWeight: 700, padding: '2px 0' }}>{d}</div>
                ))}
              </div>

              {/* Fill empty cells before first day */}
              {(() => {
                const firstDow = calendarDays[0]?.dow || 0;
                const cells = [];
                for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`}/>);
                calendarDays.forEach(day => {
                  const hasActivity = day.hasEx || day.hasCardio;
                  const hasNutrition = day.kcal > 0;
                  cells.push(
                    <div key={day.key}
                      style={{ aspectRatio: '1', borderRadius: '8px', border: day.isToday ? `2px solid ${th.accent}` : `1px solid ${th.border}`, background: day.isToday ? `${th.accent}15` : hasActivity ? 'rgba(249,115,22,0.12)' : hasNutrition ? 'rgba(16,185,129,0.08)' : th.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', cursor: 'default', position: 'relative' }}>
                      <span style={{ fontSize: '11px', fontWeight: day.isToday ? 800 : 500, color: day.isToday ? th.accent : th.text2 }}>{day.date}</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {hasActivity && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f97316' }}/>}
                        {hasNutrition && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }}/>}
                      </div>
                    </div>
                  );
                });
                return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>{cells}</div>;
              })()}

              {/* Legend */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: th.text3 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}/> Sport
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: th.text3 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}/> Nutriție
                </div>
              </div>
            </div>

            {/* Last 7 days detail */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>📊 Ultimele 7 zile</div>
              {calendarDays.slice(-7).reverse().map(day => (
                <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${th.border}` }}>
                  <div style={{ minWidth: '32px', textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: day.isToday ? 800 : 600, color: day.isToday ? th.accent : th.text }}>{day.date}</div>
                    <div style={{ fontSize: '9px', color: th.text3 }}>{'DLMMJVS'[day.dow]}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {day.kcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>🔥 {day.kcal} kcal</span>}
                      {day.protein > 0 && <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>💪 {Math.round(day.protein)}g prot</span>}
                      {day.hasEx && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>🏋 sală</span>}
                      {day.hasCardio && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.08)', color: '#f97316', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>🏃 cardio</span>}
                      {!day.kcal && !day.hasEx && !day.hasCardio && <span style={{ fontSize: '11px', color: th.text3 }}>—</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: '8px' }}/>
          </div>
        )}

        {/* ══ AZI VIEW ══ */}
        {activeView === 'azi' && (
          <>
            {/* ── AI CHAT — MEREU VIZIBIL ── */}
            <div style={{ background: th.bg2, borderRadius: '16px', border: `1px solid ${th.border}`, overflow: 'hidden' }}>
              {/* Chat header */}
              <div style={{ padding: '11px 14px', borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: loading ? '#f59e0b' : '#10b981', animation: loading ? 'pulse 1s infinite' : 'none' }}/>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>🤖 AI Coach</span>
                  {messages.length > 0 && <span style={{ fontSize: '10px', background: `${th.accent}20`, color: th.accent, padding: '1px 6px', borderRadius: '5px', fontWeight: 700 }}>{messages.length}</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ label: '📊 Total zi', cmd: 'Total zi' }, { label: '📈 Săptămână', cmd: 'Analiză săptămână' }].map(q => (
                    <button key={q.cmd} onClick={() => onSend(q.cmd)} disabled={loading}
                      style={{ padding: '4px 8px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '7px', color: th.text2, fontSize: '11px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div style={{ maxHeight: '320px', minHeight: messages.length === 0 ? '80px' : '120px', overflowY: 'auto', padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.length === 0 && !loading && (
                  <div style={{ textAlign: 'center', padding: '14px 0', color: th.text3, fontSize: '13px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
                    Apasă <strong style={{ color: '#10b981' }}>START ZI</strong> pentru a primi planul tău zilnic personalizat
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '3px' }}>
                    <div style={{ fontSize: '9px', color: th.text3, fontWeight: 700, letterSpacing: '0.08em' }}>
                      {m.role === 'user' ? '◆ TU' : '⚡ AI COACH'}
                    </div>
                    <div style={{ maxWidth: '88%', padding: '9px 12px', borderRadius: m.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', background: m.role === 'user' ? (currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)') : th.card2, border: m.role === 'user' ? 'none' : `1px solid ${th.border}` }}>
                      {m.role === 'user'
                        ? <span style={{ fontSize: '13px', color: '#fff' }}>{m.display || m.content}</span>
                        : <div>{renderMarkdown(m.content)}</div>
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 2px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: th.accent, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}
                    </div>
                    <span style={{ fontSize: '12px', color: th.text3 }}>AI Coach gândește...</span>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>

              {/* Input */}
              <div style={{ padding: '8px 12px 11px', borderTop: `1px solid ${th.border}`, display: 'flex', gap: '7px', alignItems: 'flex-end' }}>
                <textarea value={input} onChange={e => { setInput(e.target.value); e.target.style.height='36px'; e.target.style.height=Math.min(e.target.scrollHeight,90)+'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if(input.trim()) onSend(input); } }}
                  placeholder="Scrie orice... ce ai mâncat, cum te simți, întrebări..."
                  disabled={loading} rows={1}
                  style={{ flex: 1, background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '9px 12px', color: th.text, fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit', height: '36px', minHeight: '36px', lineHeight: 1.4 }}/>
                <button onClick={() => { if(input.trim()) { if(navigator.vibrate) navigator.vibrate(8); onSend(input); } }} disabled={loading || !input.trim()} className="btn-tap"
                  style={{ width: '36px', height: '36px', background: input.trim() ? (currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)') : th.card2, border: 'none', borderRadius: '10px', color: input.trim() ? '#fff' : th.text3, cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>↑</button>
              </div>
            </div>

            {/* ── ADAUGĂ MASĂ ── */}
            <button onClick={() => { if(navigator.vibrate) navigator.vibrate(12); onOpenFoodPicker(); }} className="btn-tap"
              style={{ width: '100%', background: currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: `0 4px 16px ${currentDay?.glow || 'rgba(249,115,22,0.3)'}` }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>+</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Adaugă masă</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>📷 Poză · 🔲 Barcode · 📋 Listă · 🤖 AI</div>
              </div>
            </button>

            {/* ── SUGESTIE AI ── */}
            <SuggestieAI
              th={th} profile={profile} todayStats={todayStats}
              dayMacros={dayMacros} todayMeals={todayMeals}
              dayType={dayType} currentDay={currentDay}
            />

            {/* ── MACRO RING ── */}
            {dayMacros && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                  {/* Ring */}
                  <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                    <svg viewBox="0 0 84 84" style={{ width: '84px', height: '84px', transform: 'rotate(-90deg)' }}>
                      <circle cx="42" cy="42" r="34" fill="none" stroke={th.card2} strokeWidth="8"/>
                      <circle cx="42" cy="42" r="34" fill="none"
                        stroke={calPct > 100 ? '#ef4444' : (currentDay?.color || '#f97316')}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - Math.min(calPct, 100) / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '17px', fontWeight: 900, color: calPct > 100 ? '#ef4444' : (currentDay?.color || '#f97316'), lineHeight: 1 }}>{calPct}%</span>
                      <span style={{ fontSize: '9px', color: th.text3 }}>kcal</span>
                    </div>
                  </div>
                  {/* Right */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: th.text, lineHeight: 1 }}>{todayStats.calories || 0}</div>
                    <div style={{ fontSize: '11px', color: th.text3, marginBottom: '4px' }}>din {dayMacros.kcal} kcal</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: calPct >= 100 ? '#ef4444' : '#10b981' }}>
                      {Math.max(0, dayMacros.kcal - (todayStats.calories || 0))} kcal rămase
                    </div>
                  </div>
                </div>
                {/* Macro bars */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
                  {[
                    { label:'Proteine', cur: todayStats.protein||0, target: dayMacros.protein, color:'#10b981', bg: darkMode?'rgba(16,185,129,0.1)':'#EAF3DE', tc:'#3B6D11' },
                    { label:'Carbs',    cur: todayStats.carbs||0,   target: dayMacros.carbs,   color:'#3b82f6', bg: darkMode?'rgba(59,130,246,0.1)':'#E6F1FB', tc:'#185FA5' },
                    { label:'Grăsimi', cur: todayStats.fat||0,     target: dayMacros.fat,     color:'#f59e0b', bg: darkMode?'rgba(245,158,11,0.1)':'#FAEEDA', tc:'#854F0B' },
                  ].map(m => {
                    const pct = m.target ? Math.min(100, Math.round(m.cur/m.target*100)) : 0;
                    return (
                      <div key={m.label} style={{ background: m.bg, borderRadius: '10px', padding: '8px 7px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: darkMode?m.color:m.tc }}>{Math.round(m.cur)}g</div>
                        <div style={{ fontSize: '9px', color: darkMode?m.color:m.tc, opacity:0.7, marginBottom:'4px' }}>{m.label}</div>
                        <div style={{ height:'3px', background: darkMode?`${m.color}25`:`${m.color}30`, borderRadius:'2px' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:m.color, borderRadius:'2px', transition:'width 0.4s' }}/>
                        </div>
                        <div style={{ fontSize:'9px', color: darkMode?m.color:m.tc, opacity:0.5, marginTop:'2px' }}>{Math.round(m.cur)}/{m.target}g</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PAȘI ── */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '13px', border: `1px solid ${th.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: steps > 0 ? '9px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontSize: '18px' }}>🦶</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>Pași azi</div>
                    {steps > 0 && <div style={{ fontSize: '11px', color: th.text3 }}>{steps.toLocaleString('ro-RO')} · {stepsKm} km · ~{stepsKcal} kcal</div>}
                  </div>
                </div>
                <button onClick={() => setShowStepsInput(s => !s)} style={{ padding: '5px 10px', background: `${th.accent}15`, border: `1px solid ${th.accent}30`, borderRadius: '9px', color: th.accent, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {steps > 0 ? '✏️' : '+ Adaugă'}
                </button>
              </div>
              {showStepsInput && (
                <>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '7px' }}>
                    {[3000,5000,7500,10000,12000,15000].map(n => (
                      <button key={n} onClick={() => saveSteps(n)} style={{ padding: '5px 9px', borderRadius: '7px', border: `1px solid ${th.border}`, background: th.card2, color: th.text2, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{(n/1000).toFixed(n===7500?1:0)}k</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '7px' }}>
                    <input type="number" value={stepsInput} onChange={e => setStepsInput(e.target.value)} placeholder="sau scrie..." inputMode="numeric"
                      style={{ flex:1, background:th.card2, border:`1.5px solid ${th.accent}40`, borderRadius:'9px', padding:'8px 11px', color:th.text, fontSize:'14px', outline:'none', fontFamily:'inherit' }}/>
                    <button onClick={() => saveSteps(stepsInput)} style={{ padding:'8px 14px', background: currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)', border:'none', borderRadius:'9px', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>✓</button>
                  </div>
                </>
              )}
              {steps > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ height:'7px', background:th.card2, borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(100,(steps/10000)*100)}%`, height:'100%', background:'linear-gradient(90deg,#10b981,#3b82f6)', borderRadius:'4px', transition:'width 0.5s' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'10px', color:th.text3 }}>
                    <span>0</span>
                    <span style={{ color:'#10b981', fontWeight:700 }}>{Math.round((steps/10000)*100)}% din 10k</span>
                    <span>10k</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── MESELE ZILEI ── */}
            {todayMeals.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '13px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '9px' }}>🍽 Mesele de azi</div>
                {todayMeals.map(meal => (
                  <div key={meal.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 0', borderBottom: `1px solid ${th.border}` }}>
                    <span style={{ fontSize: '18px' }}>{meal.emoji || '🍽'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meal.name}</div>
                      <div style={{ fontSize: '10px', color: th.text3 }}>{meal.kcal}kcal · P:{meal.p}g · C:{meal.c}g · G:{meal.fat||0}g</div>
                    </div>
                    <span style={{ fontSize: '10px', color: th.text3 }}>{meal.time}</span>
                    <button onClick={() => onDeleteMeal(meal.id)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 6px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── SUPLIMENTE ── */}
            {todaySupl.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '13px', border: `1px solid ${th.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>💊 Suplimente azi</span>
                  <span style={{ background: todaySupl.filter(s=>suplTakenToday[s.id]).length===todaySupl.length?'#EAF3DE':th.card2, color: todaySupl.filter(s=>suplTakenToday[s.id]).length===todaySupl.length?'#3B6D11':th.text3, fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'7px' }}>
                    {todaySupl.filter(s=>suplTakenToday[s.id]).length}/{todaySupl.length}
                  </span>
                </div>
                {Object.entries(todaySupl.reduce((acc,s) => { const t=s.time.substring(0,5); if(!acc[t])acc[t]=[]; acc[t].push(s); return acc; },{})).sort().map(([time,supl]) => (
                  <div key={time} style={{ marginBottom: '7px' }}>
                    <div style={{ fontSize: '10px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '3px' }}>{time}</div>
                    {supl.map(s => (
                      <div key={s.id} onClick={() => onToggleSupl(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0', cursor: 'pointer' }}>
                        <div style={{ width: '19px', height: '19px', borderRadius: '50%', background: suplTakenToday[s.id]?'#10b981':'transparent', border: `2px solid ${suplTakenToday[s.id]?'#10b981':th.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                          {suplTakenToday[s.id] && <span style={{ fontSize: '9px', color: '#fff' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: suplTakenToday[s.id]?th.text3:th.text, textDecoration: suplTakenToday[s.id]?'line-through':'none', flex: 1 }}>{s.emoji} {s.name}</span>
                        <span style={{ fontSize: '10px', color: th.text3 }}>{s.time}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div style={{ height: '8px' }}/>
          </>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default AziTab;
