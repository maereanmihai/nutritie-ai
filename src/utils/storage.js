const K = {
  profile: 'ha_profile_v1', stats: 'ha_stats_v1', workouts: 'ha_workouts_v1',
  session: 'ha_session_v1', theme: 'ha_theme_v1', templates: 'ha_tpl_v1',
  customFoods: 'ha_custom_v1', suplTaken: 'ha_supl_taken_v1', meals: 'ha_meals_v1',
};
const ls = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; } };
const lsSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// ─── PROFILE & TDEE ───────────────────────────────────────────────────────────
const defaultProfile = () => ({
  name: '', age: '', height: '', weight: '', targetWeight: '',
  sex: 'male', bodyType: 'mezomorf', goal: 'recompozitie', activity: 'moderat',
  supplements: '', notes: ''
});


export { K, ls, lsSave, todayKey };
