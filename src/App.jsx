import { useState, useRef, useEffect, useCallback } from 'react';
import { K, ls, lsSave, todayKey } from './utils/storage';
import { calcTDEE, getDayMacros, buildSystemPrompt, calcStreak } from './utils/calculations';
import { callAI } from './utils/api';
import { DAY_TYPES } from './constants/dayTypes';
import { DEFAULT_SUPPLEMENTS } from './constants/supplements';
import AziTab from './components/AziTab';
import AlimenteTab from './components/AlimenteTab';
import AntrenamentTab from './components/AntrenamentTab';
import ProgresTab from './components/ProgresTab';
import ProfilTab from './components/ProfilTab';
import FoodPickerModal from './components/FoodPickerModal';
import GymMode from './components/GymMode';

// ─── Profile helpers ──────────────────────────────────────────────────────────
const defaultProfile = () => ({
  name: '', age: '', height: '', weight: '', targetWeight: '',
  sex: 'male', bodyType: 'mezomorf', goal: 'recompozitie', activity: 'moderat',
  supplements: '', notes: ''
});

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab]             = useState('azi');
  const [darkMode, setDarkMode]   = useState(() => ls(K.theme, true));
  const [profile, setProfile]     = useState(() => ls(K.profile, defaultProfile()));
  const [dayType, setDayType]     = useState('antrenament');
  const [stats, setStats]         = useState(() => ls(K.stats, { weight: {}, daily: {}, hrv: {} }));
  const [workouts, setWorkouts]   = useState(() => ls(K.workouts, { days: {} }));
  const [meals, setMeals]         = useState(() => ls(K.meals, {}));
  const [customFoods, setCustomFoods] = useState(() => ls(K.customFoods, []));
  const [suplTaken, setSuplTaken] = useState(() => ls(K.suplTaken, {}));
  const [supplements, setSupplements] = useState(() => ls('ha_supl_list_v1', DEFAULT_SUPPLEMENTS));
  const [messages, setMessages]   = useState(() => { const s = ls(K.session, null); return s?.date === todayKey() ? s.messages : []; });
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [gymMode, setGymMode]     = useState(false);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [toast, setToast]         = useState(null);
  const messagesEndRef = useRef(null);
  const messagesRef    = useRef(messages);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { lsSave(K.theme, darkMode); }, [darkMode]);
  useEffect(() => { lsSave(K.session, { date: todayKey(), messages }); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (msg, dur = 2500) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  const saveProfile = useCallback((p) => {
    setProfile(p); lsSave(K.profile, p); showToast('✓ Profil salvat!');
  }, []);

  const saveStats = useCallback((updater) => {
    setStats(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; lsSave(K.stats, next); return next; });
  }, []);

  const saveWorkouts = useCallback((updater) => {
    setWorkouts(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; lsSave(K.workouts, next); return next; });
  }, []);

  const saveMeals = useCallback((updater) => {
    setMeals(prev => { const next = typeof updater === 'function' ? updater(prev) : updater; lsSave(K.meals, next); return next; });
  }, []);

  // ── extractAndSave ─────────────────────────────────────────────────────────
  const extractAndSave = useCallback((reply) => {
    try {
      const lines = reply.trim().split('\n');
      const last = lines[lines.length - 1]?.trim();
      if (!last?.startsWith('{') || !last?.includes('"_data"')) return;
      const d = JSON.parse(last)._data;
      const key = todayKey();
      setStats(prev => {
        const ns = { ...prev };
        if (d.type === 'weight' && d.value) ns.weight = { ...ns.weight, [key]: d.value };
        if (d.type === 'daily') {
          if (!ns.daily) ns.daily = {};
          if (!ns.daily[key]) ns.daily[key] = {};
          if (d.calories != null) ns.daily[key].calories = d.calories;
          if (d.protein  != null) ns.daily[key].protein  = d.protein;
          if (d.carbs    != null) ns.daily[key].carbs    = d.carbs;
          if (d.fat      != null) ns.daily[key].fat      = d.fat;
        }
        lsSave(K.stats, ns);
        return ns;
      });
    } catch {}
  }, []);

  // ── addMeal ────────────────────────────────────────────────────────────────
  const addMeal = useCallback((mealData) => {
    const key = todayKey();
    setMeals(prev => {
      const nm = { ...prev };
      if (!nm[key]) nm[key] = [];
      nm[key] = [...nm[key], { ...mealData, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }), id: Date.now() }];
      lsSave(K.meals, nm);
      return nm;
    });
    setStats(prev => {
      const ns = { ...prev };
      if (!ns.daily) ns.daily = {};
      if (!ns.daily[key]) ns.daily[key] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      ns.daily[key].calories = (ns.daily[key].calories || 0) + mealData.kcal;
      ns.daily[key].protein  = Math.round(((ns.daily[key].protein  || 0) + mealData.p)    * 10) / 10;
      ns.daily[key].carbs    = Math.round(((ns.daily[key].carbs    || 0) + mealData.c)    * 10) / 10;
      ns.daily[key].fat      = Math.round(((ns.daily[key].fat      || 0) + mealData.fat)  * 10) / 10;
      ns.daily[key].fiber    = Math.round(((ns.daily[key].fiber    || 0) + (mealData.fiber || 0)) * 10) / 10;
      lsSave(K.stats, ns);
      return ns;
    });
    showToast(`✓ ${mealData.name} adăugat!`);
  }, []);

  // ── buildStartZiPrompt ─────────────────────────────────────────────────────
  const buildStartZiPrompt = useCallback(() => {
    const dayTargets = getDayMacros(profile, dayType);
    const day = DAY_TYPES.find(d => d.val === dayType);
    const isWorkout = dayType === 'antrenament';
    const todayDow = new Date().getDay() || 7;
    const supl = supplements.filter(s => s.days.includes(todayDow));
    const suplList = supl.map(s => `${s.emoji} ${s.name} (${s.time}) — ${s.note}`).join('\n');
    return `START ZI — ${day?.label || dayType}

PROFIL: ${profile?.name || 'Utilizator'}, ${profile?.age} ani, ${profile?.weight}kg, obiectiv: ${profile?.goal}
${dayTargets ? `TARGET: ${dayTargets.kcal} kcal | P:${dayTargets.protein}g | C:${dayTargets.carbs}g | G:${dayTargets.fat}g` : ''}

SUPLIMENTELE MELE:
${suplList}

Structurează răspunsul:
## 🎯 TARGET ZILNIC
## 💊 SUPLIMENTE PE STOMACUL GOL (acum)
## 🍳 MICUL DEJUN — aștept să introduc
${isWorkout ? `## 🏋 PRE-WORKOUT\n## ⚡ POST-WORKOUT — fereastra anabolică` : ''}
## 🍽 CINĂ — aștept
## 📊 STOP ZI — sinteză la final

Începe ACUM cu TARGET și SUPLIMENTE PE STOMACUL GOL.`;
  }, [profile, dayType, supplements]);

  // ── sendMessage ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const isStartZi = text.trim() === 'Start zi';
    const actualText = isStartZi ? buildStartZiPrompt() : text;
    const userMsg = { role: 'user', content: actualText, display: isStartZi ? '🌅 Start zi' : text };
    const snapshot = [...messagesRef.current, userMsg];
    setMessages(snapshot);
    setInput('');
    setLoading(true);
    if (tab !== 'azi') setTab('azi');
    try {
      const apiMsgs = snapshot.map(m => ({ role: m.role, content: m.content }));
      const reply = await callAI(apiMsgs, buildSystemPrompt(profile, dayType), 2000);
      extractAndSave(reply);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Eroare de conexiune.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading, tab, profile, dayType, buildStartZiPrompt, extractAndSave]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const th = darkMode ? {
    bg: '#070a12', bg2: '#0c1020', bg3: '#111827',
    card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.15)',
    text: '#f1f5f9', text2: '#94a3b8', text3: '#475569', accent: '#f97316',
  } : {
    bg: '#f8fafc', bg2: '#ffffff', bg3: '#f1f5f9',
    card: 'rgba(0,0,0,0.03)', card2: 'rgba(0,0,0,0.06)',
    border: 'rgba(0,0,0,0.08)', border2: 'rgba(0,0,0,0.15)',
    text: '#0f172a', text2: '#475569', text3: '#94a3b8', accent: '#ea580c',
  };

  const key           = todayKey();
  const todayMeals    = meals[key] || [];
  const todayStats    = stats.daily?.[key] || {};
  const todayWorkout  = workouts.days?.[key] || { exercises: [], cardio: [], work: [] };
  const dayMacros     = getDayMacros(profile, dayType);
  const streak        = calcStreak(stats);
  const currentDay    = DAY_TYPES.find(d => d.val === dayType);
  const todayDow      = new Date().getDay() || 7;
  const todaySupl     = supplements.filter(s => s.days.includes(todayDow));
  const suplTakenToday = suplTaken[key] || {};

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: th.bg, color: th.text, fontFamily: "'Inter','SF Pro',-apple-system,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .tab-content{animation:fadeUp 0.25s ease}
        .btn-tap{transition:transform 0.1s,opacity 0.1s}
        .btn-tap:active{transform:scale(0.95);opacity:0.85}
      `}</style>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'azi' && (
          <AziTab
            th={th} darkMode={darkMode} setDarkMode={setDarkMode}
            profile={profile} dayType={dayType} setDayType={setDayType}
            currentDay={currentDay} dayMacros={dayMacros}
            todayStats={todayStats} todayMeals={todayMeals} todayWorkout={todayWorkout}
            streak={streak} todaySupl={todaySupl} suplTakenToday={suplTakenToday}
            onToggleSupl={(id) => {
              setSuplTaken(prev => {
                const ns = { ...prev, [key]: { ...(prev[key] || {}), [id]: !prev[key]?.[id] } };
                lsSave(K.suplTaken, ns); return ns;
              });
            }}
            messages={messages} input={input} setInput={setInput}
            loading={loading} onSend={sendMessage} messagesEndRef={messagesEndRef}
            onOpenFoodPicker={() => setShowFoodPicker(true)}
            onDeleteMeal={(id) => {
              const meal = todayMeals.find(m => m.id === id);
              if (!meal) return;
              setMeals(prev => {
                const nm = { ...prev, [key]: (prev[key] || []).filter(m => m.id !== id) };
                lsSave(K.meals, nm); return nm;
              });
              setStats(prev => {
                const ns = { ...prev };
                if (ns.daily?.[key]) {
                  ns.daily[key] = {
                    ...ns.daily[key],
                    calories: Math.max(0, (ns.daily[key].calories || 0) - (meal.kcal || 0)),
                    protein:  Math.max(0, Math.round(((ns.daily[key].protein  || 0) - (meal.p    || 0)) * 10) / 10),
                    carbs:    Math.max(0, Math.round(((ns.daily[key].carbs    || 0) - (meal.c    || 0)) * 10) / 10),
                    fat:      Math.max(0, Math.round(((ns.daily[key].fat      || 0) - (meal.fat  || 0)) * 10) / 10),
                    fiber:    Math.max(0, Math.round(((ns.daily[key].fiber    || 0) - (meal.fiber|| 0)) * 10) / 10),
                  };
                }
                lsSave(K.stats, ns); return ns;
              });
              showToast('✓ Masă ștearsă');
            }}
          />
        )}
        {tab === 'alimente' && (
          <AlimenteTab th={th}
            customFoods={customFoods}
            setCustomFoods={(cf) => { setCustomFoods(cf); lsSave(K.customFoods, cf); }}
            onAddMeal={addMeal}
          />
        )}
        {tab === 'antrenament' && (
          <AntrenamentTab th={th} workouts={workouts} setWorkouts={setWorkouts}
            profile={profile} onSendToCoach={sendMessage} onOpenGymMode={() => setGymMode(true)}
          />
        )}
        {tab === 'progres' && (
          <ProgresTab th={th} stats={stats} setStats={setStats}
            workouts={workouts} profile={profile}
          />
        )}
        {tab === 'profil' && (
          <ProfilTab th={th} profile={profile} saveProfile={saveProfile}
            supplements={supplements}
            setSupplements={(s) => { setSupplements(s); lsSave('ha_supl_list_v1', s); }}
            sendMessage={sendMessage}
          />
        )}
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <div style={{ background: darkMode ? 'rgba(7,10,18,0.97)' : 'rgba(255,255,255,0.97)', borderTop: `1px solid ${th.border}`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 max(8px,env(safe-area-inset-bottom))', flexShrink: 0, backdropFilter: 'blur(20px)', zIndex: 10 }}>
        {[
          { id: 'azi',          icon: '🏠', label: 'Azi'      },
          { id: 'alimente',     icon: '🍽', label: 'Alimente' },
          { id: 'antrenament',  icon: '💪', label: 'Sport'    },
          { id: 'progres',      icon: '📊', label: 'Progres'  },
          { id: 'profil',       icon: '👤', label: 'Profil'   },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn-tap"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', minWidth: '52px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: tab === t.id ? (currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', transition: 'all 0.2s' }}>
              {t.icon}
            </div>
            <span style={{ fontSize: '10px', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? th.accent : th.text3, transition: 'all 0.2s' }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERLAYS ── */}
      {gymMode && (
        <GymMode workouts={workouts} setWorkouts={setWorkouts}
          onClose={() => setGymMode(false)} onSendToCoach={sendMessage}
          profile={profile} th={th}
        />
      )}
      {showFoodPicker && (
        <FoodPickerModal th={th} darkMode={darkMode}
          customFoods={customFoods}
          setCustomFoods={(cf) => { setCustomFoods(cf); lsSave(K.customFoods, cf); }}
          onAddMeal={addMeal} onClose={() => setShowFoodPicker(false)}
          onSendToCoach={sendMessage}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: darkMode ? '#1e293b' : '#fff', color: th.text, fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '100px', border: `1px solid ${th.border}`, zIndex: 100, whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', animation: 'fadeUp 0.3s ease' }}>{toast}</div>
      )}
    </div>
  );
}
