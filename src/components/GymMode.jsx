import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { callAI } from '../utils/api';
import { K, ls, lsSave, todayKey } from '../utils/storage';
import { calcTDEE, getDayMacros, calcMacros, calcBurned, fmt } from '../utils/calculations';
import { FOODS, FOOD_CATS } from '../constants/foods';
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES } from '../constants/workouts';
import { DEFAULT_SUPPLEMENTS } from '../constants/supplements';
import { getDailyQuote } from '../constants/quotes';
import { DAY_TYPES } from '../constants/dayTypes';

function GymMode({ workouts, setWorkouts, onClose, onSendToCoach, profile, th }) {
  const key = todayKey();
  const [phase, setPhase] = useState('pick'); // pick | setup | active | rest | summary
  const [selGroup, setSelGroup] = useState('piept');
  const [selEx, setSelEx] = useState(null);
  const [currentKg, setCurrentKg] = useState('');
  const [currentReps, setCurrentReps] = useState('');
  const [targetSets, setTargetSets] = useState(3);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [completedSets, setCompletedSets] = useState([]);
  const [restDuration, setRestDuration] = useState(90);
  const [restTimer, setRestTimer] = useState(0);
  const [setTimer, setSetTimer] = useState(0);
  const [totalTimer, setTotalTimer] = useState(0);
  const [sessionLog, setSessionLog] = useState([]);
  const [tempoPhase, setTempoPhase] = useState(null);
  const [repCount, setRepCount] = useState(0);
  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const intervalRef = useRef(null);
  const tempoRef = useRef(null);
  const totalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const audioCtxRef = useRef(null);
  const currentKgRef = useRef('');
  const currentRepsRef = useRef('');
  const currentSetIdxRef = useRef(0);
  const completedSetsRef = useRef([]);
  const targetSetsRef = useRef(3);
  const restDurationRef = useRef(90);
  const selExRef = useRef(null);
  const selGroupRef = useRef('piept');
  const setTimerRef = useRef(0);
  const doStopSetRef = useRef(null);
  const w = parseFloat(profile?.weight) || 80;

  useEffect(() => { currentKgRef.current = currentKg; }, [currentKg]);
  useEffect(() => { currentRepsRef.current = currentReps; }, [currentReps]);
  useEffect(() => { currentSetIdxRef.current = currentSetIdx; }, [currentSetIdx]);
  useEffect(() => { completedSetsRef.current = completedSets; }, [completedSets]);
  useEffect(() => { targetSetsRef.current = targetSets; }, [targetSets]);
  useEffect(() => { restDurationRef.current = restDuration; }, [restDuration]);
  useEffect(() => { selExRef.current = selEx; }, [selEx]);
  useEffect(() => { selGroupRef.current = selGroup; }, [selGroup]);

  // Wake lock
  useEffect(() => {
    const req = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {} };
    req();
    return () => {
      wakeLockRef.current?.release?.();
      clearInterval(intervalRef.current);
      clearInterval(totalRef.current);
      clearInterval(tempoRef.current);
    };
  }, []);

  // Audio
  const beep = (freq = 440, dur = 0.15, vol = 0.3) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch {}
  };
  const beepUp = () => beep(880, 0.12, 0.3);
  const beepHold = () => beep(660, 0.08, 0.15);
  const beepDown = () => beep(440, 0.2, 0.25);
  const beepDone = () => { beep(660, 0.15, 0.3); setTimeout(() => beep(880, 0.25, 0.4), 180); };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const keywords = ['Start', 'Pause', 'Stop', 'Done', 'Rest'];
    if (!keywords.some(k => text === k)) return;
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 1; u.volume = 1;
      window.speechSynthesis.speak(u);
    };
    if (window.speechSynthesis.getVoices().length > 0) doSpeak();
    else setTimeout(doSpeak, 100);
  };

  const fmtT = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const startTempo = (reps, onDone) => {
    clearInterval(tempoRef.current);
    setTempoPhase(null); setRepCount(0);
    if (!tempoEnabled) {
      let e = 0; const total = reps * 5;
      tempoRef.current = setInterval(() => { e++; if (e >= total) { clearInterval(tempoRef.current); beepDone(); setTimeout(() => onDone?.(), 400); } }, 1000);
      return;
    }
    const STEPS = [{l:'UP',b:beepUp},{l:'HOLD',b:beepHold},{l:'DOWN',b:beepDown},{l:'DOWN',b:null},{l:'DOWN',b:null}];
    const totalSteps = reps * 5; let step = 0;
    const tick = () => {
      if (step >= totalSteps) { clearInterval(tempoRef.current); setTempoPhase('DONE'); beepDone(); setTimeout(() => { setTempoPhase(null); onDone?.(); }, 400); return; }
      const s = STEPS[step % 5];
      setTempoPhase(s.l); if (s.b) s.b();
      if (step % 5 === 0) setRepCount(Math.floor(step/5)+1);
      step++;
    };
    tick(); tempoRef.current = setInterval(tick, 1000);
  };
  const stopTempo = () => { clearInterval(tempoRef.current); setTempoPhase(null); };

  const doStopSet = () => {
    const kg = parseFloat(currentKgRef.current) || 0;
    const reps = parseInt(currentRepsRef.current) || 0;
    const newSet = { kg: String(kg), reps: String(reps), duration: setTimerRef.current };
    const idx = currentSetIdxRef.current;
    const nextIdx = idx + 1;
    const newCompleted = [...completedSetsRef.current, newSet];
    completedSetsRef.current = newCompleted;
    setCompletedSets(newCompleted);
    setCurrentSetIdx(nextIdx); currentSetIdxRef.current = nextIdx;
    if (nextIdx >= targetSetsRef.current) {
      speak('Done');
      setTimeout(() => autoFinishExercise(newCompleted), 500);
    } else {
      speak('Pause');
      setPhase('rest'); setRestTimer(restDurationRef.current);
    }
  };
  doStopSetRef.current = doStopSet;

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (phase === 'active') {
      setTimerRef.current = 0;
      intervalRef.current = setInterval(() => { setSetTimer(t => { const nt = t+1; setTimerRef.current = nt; return nt; }); }, 1000);
    } else if (phase === 'rest' && restTimer > 0) {
      intervalRef.current = setInterval(() => setRestTimer(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          if (navigator.vibrate) navigator.vibrate([300,100,300]);
          const reps = parseInt(currentRepsRef.current) || 5;
          speak('Start');
          setPhase('active'); setSetTimer(0); setRepCount(0); setTimerRef.current = 0;
          setTimeout(() => startTempo(reps, () => doStopSetRef.current()), 700);
          return 0;
        }
        if (t === 3) beepDown(); if (t === 2) beepDown(); if (t === 1) beepDown();
        return t - 1;
      }), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [phase, restTimer, tempoEnabled]);

  const getPR = (exId) => {
    const all = Object.values(workouts.days || {}).flatMap(d => (d.exercises || []).filter(e => e.id === exId).flatMap(e => e.sets || []));
    if (!all.length) return null;
    return Math.max(...all.map(s => parseFloat(s.kg) || 0));
  };

  const startExercise = (exId) => {
    const ex = EXERCISES[selGroup].find(e => e.id === exId);
    setSelEx(exId); selExRef.current = exId;
    setCompletedSets([]); completedSetsRef.current = [];
    setCurrentSetIdx(0); currentSetIdxRef.current = 0;
    setCurrentKg(''); setCurrentReps('');
    setPhase('setup');
  };

  const beginSets = () => {
    if (!currentKg || !currentReps) return;
    const reps = parseInt(currentReps);
    setCurrentSetIdx(0); currentSetIdxRef.current = 0;
    setCompletedSets([]); completedSetsRef.current = [];
    setPhase('active'); setSetTimer(0); setRepCount(0); setTimerRef.current = 0;
    if (!totalRef.current) { setTotalTimer(0); totalRef.current = setInterval(() => setTotalTimer(t => t+1), 1000); }
    speak('Start');
    setTimeout(() => startTempo(reps, () => doStopSetRef.current()), 700);
  };

  const manualStop = () => { stopTempo(); doStopSetRef.current(); };

  const skipRest = () => {
    clearInterval(intervalRef.current);
    const reps = parseInt(currentRepsRef.current) || 5;
    setPhase('active'); setSetTimer(0); setRepCount(0); setRestTimer(0); setTimerRef.current = 0;
    speak('Start');
    setTimeout(() => startTempo(reps, () => doStopSetRef.current()), 700);
  };

  const autoFinishExercise = (sets) => {
    if (!sets?.length) return;
    const exId = selExRef.current; const grp = selGroupRef.current;
    const ex = EXERCISES[grp]?.find(e => e.id === exId); if (!ex) return;
    const vol = sets.reduce((a, s) => a + parseFloat(s.kg) * parseInt(s.reps), 0);
    const entry = { id: exId, name: ex.name, group: grp, sets, volume: Math.round(vol), time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], exercises: [...(nw.days[key].exercises||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    });
    setSessionLog(l => [...l, entry]);
    onSendToCoach(`Forță: ${ex.name} — ${sets.map(s => `${s.kg}kg×${s.reps}`).join(', ')}`);
    setCompletedSets([]); completedSetsRef.current = [];
    setCurrentKg(''); setCurrentReps('');
    setSelEx(null); selExRef.current = null;
    setPhase('pick');
  };

  const finishWorkout = () => {
    clearInterval(totalRef.current); totalRef.current = null;
    setPhase('summary');
  };

  const restPct = restDuration > 0 ? Math.round((restTimer / restDuration) * 100) : 0;
  const restColor = restTimer <= 10 ? '#ef4444' : restTimer <= 30 ? '#f59e0b' : '#10b981';
  const pr = selEx ? getPR(selEx) : null;
  const tempoColors = { UP: '#4ade80', HOLD: '#fbbf24', DOWN: '#60a5fa', DONE: '#ec4899' };
  const tempoLabels = { UP: '↑ SUS', HOLD: '⏸', DOWN: '↓ JOS', DONE: '✓' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#060810', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* HEADER */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: '#060810' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '18px', background: 'linear-gradient(90deg,#f97316,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.08em' }}>💪 GYM</div>
          <div style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: '15px', color: '#f97316' }}>⏱ {fmtT(totalTimer)}</div>
          {sessionLog.length > 0 && <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 700 }}>{sessionLog.length} ex.</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setShowSettings(s => !s)} style={{ padding: '5px 10px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', color: '#8b5cf6', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>⚙️</button>
          <button onClick={() => { wakeLockRef.current?.release?.(); clearInterval(totalRef.current); stopTempo(); onClose(); }} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>✕</button>
        </div>
      </div>

      {/* SETTINGS */}
      {showSettings && (
        <div style={{ background: 'rgba(10,13,24,0.98)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 700 }}>TEMPO GHIDAT ↑1s ⏸1s ↓3s</div>
            <button onClick={() => setTempoEnabled(t => !t)} style={{ padding: '5px 14px', borderRadius: '8px', border: `1px solid ${tempoEnabled ? '#4ade80' : 'rgba(255,255,255,0.1)'}`, background: tempoEnabled ? 'rgba(74,222,128,0.12)' : 'transparent', color: tempoEnabled ? '#4ade80' : 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{tempoEnabled ? 'ON' : 'OFF'}</button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>🔊 Beep-uri audio active · "Start"/"Done"/"Pause" în EN</div>
          </div>
        </div>
      )}

      {/* PHASE: ACTIVE */}
      {phase === 'active' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '20px', fontWeight: 900, color: '#f97316' }}>
            {EXERCISES[selGroup].find(e => e.id === selEx)?.name}
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
            SET {currentSetIdx+1} / {targetSets} · {currentKg}kg × {currentReps} rep
          </div>

          {/* SET PROGRESS */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: targetSets }).map((_, i) => (
              <div key={i} style={{ width: '32px', height: '6px', borderRadius: '3px', background: i < currentSetIdx ? '#4ade80' : i === currentSetIdx ? '#f97316' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }}/>
            ))}
          </div>

          {/* REP DOTS */}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Rep {repCount} / {currentReps}</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '280px' }}>
            {Array.from({ length: parseInt(currentReps) || 0 }).map((_, i) => (
              <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: i < repCount ? '#4ade80' : 'rgba(255,255,255,0.08)', border: `1.5px solid ${i < repCount ? '#4ade80' : i === repCount ? '#f97316' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s' }}/>
            ))}
          </div>

          {/* TEMPO */}
          {tempoPhase && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '80px', fontWeight: 900, color: tempoColors[tempoPhase] || '#f97316', fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1, transition: 'color 0.1s' }}>
                {tempoLabels[tempoPhase] || tempoPhase}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>⏱ {fmtT(setTimer)}</div>
            </div>
          )}
          {!tempoPhase && (
            <div style={{ fontSize: '80px', fontWeight: 900, color: '#f97316', fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{fmtT(setTimer)}</div>
          )}

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            {tempoEnabled ? '↑1s ⏸1s ↓3s · oprire automată' : 'Cronometru liber · oprire automată'}
          </div>

          <button onClick={manualStop} style={{ padding: '12px 36px', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.25)', borderRadius: '14px', color: '#ef4444', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
            ⏹ STOP MANUAL
          </button>
        </div>
      )}

      {/* PHASE: REST */}
      {phase === 'rest' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '20px' }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '20px', fontWeight: 900, color: '#f97316' }}>
            {EXERCISES[selGroup].find(e => e.id === selEx)?.name}
          </div>
          <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700 }}>✓ SET {currentSetIdx} / {targetSets} COMPLET</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: targetSets }).map((_, i) => (
              <div key={i} style={{ width: '32px', height: '6px', borderRadius: '3px', background: i < currentSetIdx ? '#4ade80' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }}/>
            ))}
          </div>
          <div style={{ position: 'relative', width: '200px', height: '200px' }}>
            <svg viewBox="0 0 200 200" style={{ width: '200px', height: '200px', transform: 'rotate(-90deg)' }}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="12"/>
              <circle cx="100" cy="100" r="88" fill="none" stroke={restColor} strokeWidth="12"
                strokeDasharray={`${2*Math.PI*88}`} strokeDashoffset={`${2*Math.PI*88*(1-restPct/100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear,stroke 0.3s' }}/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '72px', fontWeight: 900, color: restColor, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{restTimer}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>sec</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[60,90,120,180].map(s => (
              <button key={s} onClick={() => { setRestDuration(s); restDurationRef.current = s; setRestTimer(s); }}
                style={{ padding: '8px 12px', borderRadius: '100px', border: `1px solid ${restDuration===s?'#10b981':'rgba(16,185,129,0.15)'}`, background: restDuration===s?'rgba(16,185,129,0.12)':'transparent', color: restDuration===s?'#10b981':'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{s}s</button>
            ))}
          </div>
          <button onClick={skipRest} style={{ padding: '12px 32px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '12px', color: '#f97316', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>SKIP ▶▶</button>
        </div>
      )}

      {/* PHASE: SETUP */}
      {phase === 'setup' && selEx && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '22px', fontWeight: 900, color: '#f97316' }}>{EXERCISES[selGroup].find(e => e.id === selEx)?.name}</div>
            {pr && <div style={{ fontSize: '12px', color: 'rgba(249,115,22,0.5)', marginTop: '4px' }}>Record personal: {pr}kg</div>}
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em', textAlign: 'center' }}>GREUTATE (kg)</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '8px' }}>
              {[5,10,15,20,25,30,40,50,60,70,80,100].map(w2 => (
                <button key={w2} onClick={() => setCurrentKg(String(w2))} style={{ padding: '7px 10px', borderRadius: '8px', border: `1.5px solid ${currentKg===String(w2)?'#f97316':'rgba(255,255,255,0.1)'}`, background: currentKg===String(w2)?'rgba(249,115,22,0.15)':'rgba(255,255,255,0.04)', color: currentKg===String(w2)?'#f97316':'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{w2}</button>
              ))}
            </div>
            <input type="number" value={currentKg} onChange={e => setCurrentKg(e.target.value)} placeholder="sau scrie..." inputMode="decimal" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${currentKg?'rgba(249,115,22,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '12px', color: '#f0ece4', fontSize: '22px', textAlign: 'center', outline: 'none', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}/>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em', textAlign: 'center' }}>REPETĂRI / SET</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '8px' }}>
              {[5,6,8,10,12,15,20].map(r => (
                <button key={r} onClick={() => setCurrentReps(String(r))} style={{ padding: '7px 14px', borderRadius: '8px', border: `1.5px solid ${currentReps===String(r)?'#4ade80':'rgba(255,255,255,0.1)'}`, background: currentReps===String(r)?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.04)', color: currentReps===String(r)?'#4ade80':'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
            <input type="number" value={currentReps} onChange={e => setCurrentReps(e.target.value)} placeholder="sau scrie..." inputMode="numeric" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${currentReps?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '12px', color: '#f0ece4', fontSize: '22px', textAlign: 'center', outline: 'none', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}/>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em', textAlign: 'center' }}>NUMĂR DE SETURI</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {[1,2,3,4,5,6].map(n => (
                <button key={n} onClick={() => setTargetSets(n)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `2px solid ${targetSets===n?'#8b5cf6':'rgba(255,255,255,0.1)'}`, background: targetSets===n?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.04)', color: targetSets===n?'#8b5cf6':'rgba(255,255,255,0.3)', fontSize: '20px', fontWeight: 900, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.1em', textAlign: 'center' }}>PAUZĂ ÎNTRE SETURI</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {[60,90,120,180].map(s => (
                <button key={s} onClick={() => { setRestDuration(s); restDurationRef.current = s; }} style={{ flex: 1, padding: '9px', borderRadius: '10px', border: `1.5px solid ${restDuration===s?'#10b981':'rgba(255,255,255,0.1)'}`, background: restDuration===s?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.04)', color: restDuration===s?'#10b981':'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{s}s</button>
              ))}
            </div>
          </div>
          {currentKg && currentReps && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#8b5cf6', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {targetSets} × {currentReps} rep × {currentKg}kg = <span style={{ color: '#f0ece4' }}>{(parseInt(currentReps)*parseFloat(currentKg)*targetSets).toFixed(0)}kg volum</span>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button onClick={() => { setSelEx(null); setPhase('pick'); }} style={{ padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: 'rgba(255,255,255,0.4)', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>← ÎNAPOI</button>
            <button onClick={beginSets} disabled={!currentKg || !currentReps} style={{ padding: '14px', background: currentKg&&currentReps?'linear-gradient(135deg,#f97316,#ef4444)':'rgba(255,255,255,0.05)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '16px', fontWeight: 900, cursor: currentKg&&currentReps?'pointer':'not-allowed', fontFamily: "'Barlow Condensed',sans-serif", boxShadow: currentKg&&currentReps?'0 4px 16px rgba(249,115,22,0.35)':'none' }}>▶ START</button>
          </div>
        </div>
      )}

      {/* PHASE: PICK */}
      {phase === 'pick' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MUSCLE_GROUPS.map(g => (
              <button key={g.id} onClick={() => { setSelGroup(g.id); selGroupRef.current = g.id; }}
                style={{ padding: '8px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: `1.5px solid ${selGroup===g.id?g.color:'rgba(255,255,255,0.1)'}`, background: selGroup===g.id?`${g.color}18`:'rgba(255,255,255,0.04)', color: selGroup===g.id?g.color:'rgba(255,255,255,0.4)' }}>
                {g.icon} {g.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {EXERCISES[selGroup].map(ex => {
              const done = sessionLog.some(l => l.id === ex.id) || (workouts.days?.[key]?.exercises || []).some(e => e.id === ex.id);
              const exPr = getPR(ex.id);
              return (
                <button key={ex.id} onClick={() => startExercise(ex.id)}
                  style={{ padding: '14px 12px', borderRadius: '12px', border: `1.5px solid ${done?'rgba(74,222,128,0.25)':'rgba(255,255,255,0.08)'}`, background: done?'rgba(74,222,128,0.05)':'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: done?'#4ade80':'#f0ece4', marginBottom: '4px' }}>{done?'✓ ':''}{ex.name}</div>
                  {exPr && <div style={{ fontSize: '11px', color: 'rgba(249,115,22,0.4)' }}>PR: {exPr}kg</div>}
                </button>
              );
            })}
          </div>
          {sessionLog.length > 0 && (
            <>
              <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)', borderRadius: '14px', padding: '12px' }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '12px', color: '#4ade80', letterSpacing: '0.08em', marginBottom: '8px' }}>✅ COMPLETATE ({sessionLog.length})</div>
                {sessionLog.map((log, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(74,222,128,0.06)' }}>
                    <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>{log.name}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{log.sets?.length}×set</span>
                  </div>
                ))}
              </div>
              <button onClick={finishWorkout} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '16px', fontWeight: 900, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.05em', boxShadow: '0 6px 20px rgba(249,115,22,0.35)' }}>
                🏁 TERMINĂ · {fmtT(totalTimer)}
              </button>
            </>
          )}
          <div style={{ height: '20px' }}/>
        </div>
      )}

      {/* PHASE: SUMMARY */}
      {phase === 'summary' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '8px' }}>🏆</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '26px', fontWeight: 900, background: 'linear-gradient(90deg,#f97316,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANTRENAMENT COMPLET!</div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: '#f97316', fontFamily: "'Barlow Condensed',sans-serif", marginTop: '6px' }}>⏱ {fmtT(totalTimer)}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{sessionLog.length} exerciții · {sessionLog.reduce((a,l) => a+(l.sets?.length||0),0)} seturi</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '14px' }}>
            {sessionLog.map((log, i) => (
              <div key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f0ece4' }}>{log.name}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>vol: {log.volume}kg</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(log.sets||[]).map((s,j) => <span key={j} style={{ padding: '3px 8px', background: 'rgba(249,115,22,0.1)', borderRadius: '6px', fontSize: '12px', color: '#f97316', fontWeight: 600 }}>{s.kg}kg×{s.reps}</span>)}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { wakeLockRef.current?.release?.(); onClose(); }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '16px', fontWeight: 900, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", boxShadow: '0 6px 20px rgba(249,115,22,0.35)' }}>
            ◆ ÎNAPOI LA APLICAȚIE
          </button>
          <div style={{ height: '20px' }}/>
        </div>
      )}
    </div>
  );
}

export default GymMode;
