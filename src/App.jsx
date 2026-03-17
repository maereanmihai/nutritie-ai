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
import { SetariTab } from './components/SetariTab';
import FoodSearch from './components/FoodSearch';
import { registerServiceWorker, scheduleSupplementNotifications } from './utils/notifications';
import { prefetchCommonFoods } from './utils/prefetch';

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
  const [showFoodSearch, setShowFoodSearch] = useState(false);

  const [toast, setToast]         = useState(null);
  const [tabDir, setTabDir]       = useState(1); // 1=right, -1=left
  const touchStartX = useRef(null);
  const TAB_ORDER = ['azi','progres','antrenament','profil','setari'];
  const messagesEndRef = useRef(null);
  const messagesRef    = useRef(messages);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    registerServiceWorker().then(reg => {
      if (reg && supplements?.length && Notification.permission === 'granted') {
        scheduleSupplementNotifications(supplements);
      }
    });
    // Pre-cache alimente comune în background — după 3s ca să nu blocheze UI
    setTimeout(() => prefetchCommonFoods(), 3000);
  }, []);
  useEffect(() => { lsSave(K.theme, darkMode); }, [darkMode]);
  useEffect(() => { lsSave(K.session, { date: todayKey(), messages }); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (msg, dur = 2500) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  const switchTab = (newTab) => {
    const cur = TAB_ORDER.indexOf(tab);
    const next = TAB_ORDER.indexOf(newTab);
    setTabDir(next >= cur ? 1 : -1);
    setTab(newTab);
    if (navigator.vibrate) navigator.vibrate(8);
  };

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
    if (tab !== 'azi') switchTab('azi');
    try {
      const apiMsgs = snapshot.map(m => ({ role: m.role, content: m.content }));
      const reply = await callAI(apiMsgs, buildSystemPrompt(profile, dayType), 2000);
      extractAndSave(reply);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      const errMsg = e?.message?.includes('Timeout') ? e.message : '⚠️ Eroare de conexiune. Verifică internetul și încearcă din nou.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
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
        @keyframes slideInRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}
        .tab-content{animation:fadeUp 0.25s ease}
        .tab-slide-right{animation:slideInRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)}
        .tab-slide-left{animation:slideInLeft 0.22s cubic-bezier(0.25,0.46,0.45,0.94)}
        .btn-tap{transition:transform 0.1s,opacity 0.1s}
        .btn-tap:active{transform:scale(0.95);opacity:0.85}
        *{transition:background-color 0.3s ease,border-color 0.3s ease,color 0.15s ease}
        button,input,textarea,svg,img,.no-trans{transition:none!important}
      `}</style>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(dx) < 60) return;
          const cur = TAB_ORDER.indexOf(tab);
          if (dx < 0 && cur < TAB_ORDER.length - 1) switchTab(TAB_ORDER[cur + 1]);
          if (dx > 0 && cur > 0) switchTab(TAB_ORDER[cur - 1]);
        }}>
        {tab === 'azi' && (
          <div key="azi" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <AziTab
            th={th} darkMode={darkMode} setDarkMode={setDarkMode}
            profile={profile} dayType={dayType} setDayType={setDayType}
            currentDay={currentDay} dayMacros={dayMacros}
            todayStats={todayStats} todayMeals={todayMeals} todayWorkout={todayWorkout}
            streak={streak} todaySupl={todaySupl} suplTakenToday={suplTakenToday}
            stats={stats} workouts={workouts}
            onToggleSupl={(id) => {
              setSuplTaken(prev => {
                const ns = { ...prev, [key]: { ...(prev[key] || {}), [id]: !prev[key]?.[id] } };
                lsSave(K.suplTaken, ns); return ns;
              });
            }}
            messages={messages} input={input} setInput={setInput}
            loading={loading} onSend={sendMessage} messagesEndRef={messagesEndRef}
            onOpenFoodPicker={() => setShowFoodSearch(true)}
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
          </div>
        )}
        {tab === 'alimente' && (
          <div key="alimente" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <AlimenteTab th={th}
            customFoods={customFoods}
            setCustomFoods={(cf) => { setCustomFoods(cf); lsSave(K.customFoods, cf); }}
            onAddMeal={addMeal}
          />
          </div>
        )}
        {tab === 'antrenament' && (
          <div key="antrenament" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <AntrenamentTab th={th} workouts={workouts} setWorkouts={setWorkouts}
            profile={profile} onSendToCoach={sendMessage} onOpenGymMode={() => setGymMode(true)}
          />
          </div>
        )}
        {tab === 'progres' && (
          <div key="progres" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <ProgresTab th={th} stats={stats} setStats={setStats}
            workouts={workouts} profile={profile}
          />
          </div>
        )}
        {tab === 'profil' && (
          <div key="profil" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <ProfilTab th={th} profile={profile} saveProfile={saveProfile}
            supplements={supplements}
            setSupplements={(s) => { setSupplements(s); lsSave('ha_supl_list_v1', s); }}
            sendMessage={sendMessage}
          />
          </div>
        )}
        {tab === 'setari' && (
          <div key="setari" className={`tab-slide tab-slide-${tabDir > 0 ? 'right' : 'left'}`} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <SetariTab th={th} supplements={supplements} profile={profile}
            stats={stats} meals={meals} workouts={workouts} customFoods={customFoods}
          />
          </div>
        )}
      </div>

      {/* ── BOTTOM TAB BAR — MFP style, mare ── */}
      <div style={{ background: darkMode ? 'rgba(7,10,18,0.98)' : 'rgba(255,255,255,0.98)', borderTop: `1px solid ${th.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 'max(14px,env(safe-area-inset-bottom))', paddingTop: '8px', flexShrink: 0, backdropFilter: 'blur(20px)', zIndex: 10, position: 'relative', minHeight: '76px' }}>

        {/* Azi */}
        <button onClick={() => switchTab('azi')} className="btn-tap"
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', flex:1, paddingBottom:'2px' }}>
          <div style={{ width:'34px', height:'34px', borderRadius:'12px', background: tab==='azi' ? (currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)') : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', transition:'all 0.2s' }}>🏠</div>
          <span style={{ fontSize:'11px', fontWeight: tab==='azi'?800:500, color: tab==='azi'?th.accent:th.text3, transition:'all 0.2s' }}>Azi</span>
        </button>

        {/* Progres */}
        <button onClick={() => switchTab('progres')} className="btn-tap"
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', flex:1, paddingBottom:'2px' }}>
          <div style={{ width:'34px', height:'34px', borderRadius:'12px', background: tab==='progres' ? (currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)') : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', transition:'all 0.2s' }}>📊</div>
          <span style={{ fontSize:'11px', fontWeight: tab==='progres'?800:500, color: tab==='progres'?th.accent:th.text3, transition:'all 0.2s' }}>Progres</span>
        </button>

        {/* CENTER + button */}
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
          <button onClick={() => { navigator.vibrate?.(15); setShowFoodSearch(true); }} className="btn-tap"
            style={{ width:'62px', height:'62px', borderRadius:'50%', background: currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)', border: `4px solid ${darkMode?'#070a12':'#fff'}`, boxShadow:`0 6px 24px ${currentDay?.glow||'rgba(249,115,22,0.5)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'absolute', bottom:'10px', zIndex:2, transition:'transform 0.15s' }}>
            <span style={{ fontSize:'30px', color:'#fff', lineHeight:1, marginTop:'-2px' }}>+</span>
          </button>
          <span style={{ fontSize:'11px', color:th.text3, marginTop:'38px', fontWeight:500 }}>Log</span>
        </div>

        {/* Sport */}
        <button onClick={() => switchTab('antrenament')} className="btn-tap"
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', flex:1, paddingBottom:'2px' }}>
          <div style={{ width:'34px', height:'34px', borderRadius:'12px', background: tab==='antrenament' ? (currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)') : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', transition:'all 0.2s' }}>💪</div>
          <span style={{ fontSize:'11px', fontWeight: tab==='antrenament'?800:500, color: tab==='antrenament'?th.accent:th.text3, transition:'all 0.2s' }}>Sport</span>
        </button>

        {/* Profil + Setări */}
        <button onClick={() => switchTab(tab==='profil' ? 'setari' : 'profil')} className="btn-tap"
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', flex:1, paddingBottom:'2px' }}>
          <div style={{ width:'34px', height:'34px', borderRadius:'12px', background: (tab==='profil'||tab==='setari') ? (currentDay?.bg||'linear-gradient(135deg,#f97316,#ef4444)') : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', transition:'all 0.2s' }}>
            {tab==='setari' ? '⚙️' : '👤'}
          </div>
          <span style={{ fontSize:'11px', fontWeight: (tab==='profil'||tab==='setari')?800:500, color: (tab==='profil'||tab==='setari')?th.accent:th.text3, transition:'all 0.2s' }}>
            {tab==='setari' ? 'Setări' : 'Profil'}
          </span>
        </button>
      </div>

      {/* ── OVERLAYS ── */}


      {/* ── OVERLAYS ── */}

      {/* Action Sheet — selectează metoda de log */}
      {showActionSheet && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
          onClick={() => setShowActionSheet(false)}>
          <div style={{ background:'rgba(0,0,0,0.5)', position:'absolute', inset:0 }}/>
          <div onClick={e => e.stopPropagation()}
            style={{ background: darkMode?'#0c1020':'#fff', borderRadius:'24px 24px 0 0', padding:'16px 16px max(24px,env(safe-area-inset-bottom))', position:'relative', zIndex:1 }}>
            <div style={{ width:'40px', height:'4px', background: darkMode?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.1)', borderRadius:'2px', margin:'0 auto 20px' }}/>
            <div style={{ fontSize:'16px', fontWeight:800, color: darkMode?'#fff':'#0f172a', marginBottom:'16px', textAlign:'center' }}>Adaugă masă</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              {[
                { icon:'🔍', label:'Caută aliment', sub:'Local · USDA · AI', color:'#f97316', action:() => { setShowActionSheet(false); setShowFoodSearch(true); } },
                { icon:'📷', label:'Fotografiază', sub:'AI analizează macro', color:'#10b981', action:() => { setShowActionSheet(false); switchTab('alimente'); } },
                { icon:'🔲', label:'Barcode', sub:'Scanează produsul', color:'#3b82f6', action:() => { setShowActionSheet(false); switchTab('alimente'); } },
                { icon:'📋', label:'Listă & Template', sub:'Selectează cantități', color:'#8b5cf6', action:() => { setShowActionSheet(false); switchTab('alimente'); } },
              ].map(opt => (
                <button key={opt.label} onClick={opt.action} className="btn-tap"
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px', background: darkMode?'rgba(255,255,255,0.05)':'#f8fafc', border:`1px solid ${darkMode?'rgba(255,255,255,0.08)':'#e2e8f0'}`, borderRadius:'16px', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${opt.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>{opt.icon}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color: darkMode?'#fff':'#0f172a' }}>{opt.label}</div>
                    <div style={{ fontSize:'11px', color: darkMode?'rgba(255,255,255,0.4)':'#94a3b8', marginTop:'1px' }}>{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowActionSheet(false)}
              style={{ width:'100%', padding:'14px', background: darkMode?'rgba(255,255,255,0.06)':'#f1f5f9', border:'none', borderRadius:'14px', color: darkMode?'rgba(255,255,255,0.5)':'#64748b', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Anulează
            </button>
          </div>
        </div>
      )}
      {gymMode && (
        <GymMode workouts={workouts} setWorkouts={setWorkouts}
          onClose={() => setGymMode(false)} onSendToCoach={sendMessage}
          profile={profile} th={th}
        />
      )}
      {showFoodSearch && (
        <FoodSearch th={th} darkMode={darkMode}
          customFoods={customFoods} onAddMeal={addMeal}
          onClose={() => setShowFoodSearch(false)}
          dayType={dayType} todayStats={todayStats} dayMacros={dayMacros}
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
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: darkMode ? '#1e293b' : '#fff', color: th.text, fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '100px', border: `1px solid ${th.border}`, zIndex: 100, whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', animation: 'fadeUp 0.3s ease' }}>{toast}</div>
      )}
    </div>
  );
}
