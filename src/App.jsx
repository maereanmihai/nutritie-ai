import { useState, useRef, useEffect, useCallback } from "react";

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `# ASISTENT PERSONAL — NUTRIȚIE, METABOLISM, PERFORMANȚĂ FIZICĂ & OPTIMIZARE HORMONALĂ

## IDENTITATE ȘI MISIUNE
Ești asistentul personal al lui Mihai. Răspunzi concis, tehnic, structurat. Formatezi cu markdown. Folosești emoji-uri.

IMPORTANT — EXTRAGERE DATE:
Când utilizatorul raportează date, adaugă JSON la final (ultima linie):
- Greutate → {"_data": {"type": "weight", "value": X.X}}
- Total zi / masă cu macro → {"_data": {"type": "daily", "calories": XXXX, "protein": XXX}}
- Energie/Libido → {"_data": {"type": "hrv", "energy": X, "libido": X}}
- Somn → {"_data": {"type": "sleep", "hours": X, "quality": X}}
Dacă nu există date de extras, NU adăuga JSON.

## PROFIL
| Parametru | Valoare |
|---|---|
| Nume | Mihai, 45 ani, 188 cm, ~96 kg → Țintă 88–90 kg |
| TDEE | 2.550–2.750 kcal/zi |
| Antrenament | 2× Fullbody + 3× Split/săptămână |

## MACRO ȚINTĂ
| Tip zi | Calorii | Proteine |
|---|---|---|
| Antrenament | 2.150–2.250 | 165–180g |
| Activă | 1.900–2.000 | 160–175g |
| Repaus | 1.700–1.800 | 155–170g |

## SUPLIMENTE
L-Carnitină, Mg bisglicinat, Zinc, Vitamax, CoQ10, D3, Omega-3, Boron, Centrum Energy, Ghimbir, Creatină 3–5g, Citrulină malat 6–8g

## REGULI
1. Proteine ≥150g întotdeauna
2. Nuci braziliene: max 1–2 buc/zi
3. Somn <6h = alertă testosteron`;

// ─── Style helpers ────────────────────────────────────────────────────────────
const panel        = (th, r=16) => ({background:th.surface, border:`1px solid ${th.border}`, borderRadius:`${r}px`});
const card         = (th, color) => ({background:`${color}12`, border:`1px solid ${color}30`, borderRadius:'12px'});
const inputStyle   = (th) => ({background:th.surface, border:`1px solid ${th.border}`, borderRadius:'10px', padding:'10px 14px', color:th.text, fontSize:'16px', outline:'none', fontFamily:"'Inter',sans-serif", width:'100%'});
const inputSmall   = (th) => ({background:th.surface, border:`1px solid ${th.border}`, borderRadius:'8px', padding:'8px 10px', color:th.text, fontSize:'14px', outline:'none', fontFamily:"'Inter',sans-serif", width:'100%'});
const selectStyle  = (th) => ({background:th.surface, border:`1px solid ${th.border}`, borderRadius:'10px', padding:'10px 14px', color:th.text, fontSize:'15px', outline:'none', fontFamily:"'Inter',sans-serif", width:'100%'});
const primaryBtn   = (disabled=false) => ({background:disabled?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#f97316,#ef4444)', border:'none', borderRadius:'12px', color:disabled?'#475569':'#fff', fontSize:'15px', fontWeight:800, cursor:disabled?'not-allowed':'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.08em', textTransform:'uppercase', boxShadow:disabled?'none':'0 4px 20px rgba(249,115,22,0.3)', transition:'all 0.2s', width:'100%', padding:'14px'});
const ghostBtn     = (th) => ({background:th.surface, border:`1px solid ${th.border}`, borderRadius:'10px', color:th.text3, fontSize:'14px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif"});
const secondaryBtn = (th) => ({padding:'10px', ...ghostBtn(th)});
const pillBtn      = (th, active, color) => ({padding:'8px 16px', borderRadius:'10px', border:`1.5px solid ${active?color:th.border}`, background:active?`${color}15`:th.surface, color:active?color:th.text3, fontSize:'14px', fontWeight:700, cursor:'pointer', transition:'all 0.15s'});
const accentPill   = (th, active, color) => ({padding:'6px 14px', borderRadius:'100px', border:`1.5px solid ${active?color:th.border}`, background:active?`${color}12`:th.surface, color:active?color:th.text3, fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.05em'});

// ─── Micro components ─────────────────────────────────────────────────────────
function StatCard({label, value, unit, color, theme}) {
  return (
    <div style={{...card(theme,color), padding:'12px', textAlign:'center'}}>
      <div style={{fontSize:'9px', color:theme.text2, letterSpacing:'0.1em', marginBottom:'3px', textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'20px', fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif"}}>{value}</div>
      {unit&&<div style={{fontSize:'10px', color:theme.text3}}>{unit}</div>}
    </div>
  );
}

function SectionTitle({icon, label, color='#94a3b8', theme}) {
  return (
    <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'15px', color, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:'12px'}}>
      {icon} {label}
    </div>
  );
}

function MetricBadge({label, value, color, theme}) {
  return (
    <div style={{background:theme.surface, borderRadius:'10px', padding:'8px', textAlign:'center'}}>
      <div style={{fontSize:'10px', color:theme.text3, marginBottom:'2px', letterSpacing:'0.06em', textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'16px', fontWeight:800, color}}>{value}</div>
    </div>
  );
}

function ActionButton({label, onClick, disabled, variant='primary', theme, style={}}) {
  if (variant==='primary') return <button onClick={onClick} disabled={disabled} style={{...primaryBtn(disabled), ...style}}>{label}</button>;
  if (variant==='ghost')   return <button onClick={onClick} disabled={disabled} style={{...secondaryBtn(theme), ...style}}>{label}</button>;
  if (variant==='danger')  return <button onClick={onClick} style={{padding:'6px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'8px', color:'#ef4444', fontSize:'12px', fontWeight:600, cursor:'pointer', ...style}}>{label}</button>;
  return <button onClick={onClick} style={style}>{label}</button>;
}

function EmptyState({icon, title, subtitle, theme}) {
  return (
    <div style={{textAlign:'center', color:theme.text4, fontSize:'13px', padding:'20px'}}>
      {icon&&<div style={{fontSize:'24px', marginBottom:'8px'}}>{icon}</div>}
      {title&&<div style={{fontWeight:600, color:theme.text3, marginBottom:'4px'}}>{title}</div>}
      {subtitle}
    </div>
  );
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function callCoach(messages, maxTokens=1200, system=SYSTEM_PROMPT){
  const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:maxTokens,system,messages})});
  const data=await res.json();
  return data.content?.[0]?.text||'Eroare.';
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: '#060810', bg2: '#0a0d18', bg3: '#0f1222',
    surface: 'rgba(255,255,255,0.04)', surface2: 'rgba(255,255,255,0.07)', surface3: 'rgba(255,255,255,0.11)',
    border: 'rgba(255,200,100,0.08)', softBorder: 'rgba(255,200,100,0.18)',
    text: '#f0ece4', text2: '#a09070', text3: '#5a5040', text4: '#302820',
    accent: '#f97316',
    gold: '#d4a847',
    goldGlow: 'rgba(212,168,71,0.3)',
  },
  light: {
    bg: '#f5f0e8', bg2: '#ffffff', bg3: '#ede8df',
    surface: 'rgba(0,0,0,0.03)', surface2: 'rgba(0,0,0,0.06)', surface3: 'rgba(0,0,0,0.09)',
    border: 'rgba(0,0,0,0.08)', softBorder: 'rgba(0,0,0,0.15)',
    text: '#1a1208', text2: '#4a3c28', text3: '#7a6a50', text4: '#a09070',
    accent: '#ea580c',
    gold: '#b8860b',
    goldGlow: 'rgba(184,134,11,0.3)',
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_TYPES = [
  { val:'antrenament', label:'ANTRENAMENT', labelShort:'ANTR',  icon:'⚡', gradient:'linear-gradient(135deg,#f97316,#ef4444)', color:'#f97316', glow:'rgba(249,115,22,0.4)', desc:'2.150–2.250 kcal · 165–180g prot', calTarget:2200, protTarget:172 },
  { val:'normal',      label:'ZI ACTIVĂ',   labelShort:'ACTIV', icon:'🔥', gradient:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#3b82f6', glow:'rgba(59,130,246,0.4)',  desc:'1.900–2.000 kcal · 160–175g prot', calTarget:1950, protTarget:167 },
  { val:'repaus',      label:'REPAUS',       labelShort:'REPAUS',icon:'🌙', gradient:'linear-gradient(135deg,#8b5cf6,#ec4899)', color:'#8b5cf6', glow:'rgba(139,92,246,0.4)',  desc:'1.700–1.800 kcal · 155–170g prot', calTarget:1750, protTarget:162 },
];

const QUICK_COMMANDS = [
  {label:'Start zi', icon:'🌅', cmd:'Start zi'},
  {label:'Total zi', icon:'📈', cmd:'Total zi'},
  {label:'Analiză săpt.', icon:'📊', cmd:'Analiză săptămână'},
];

const MUSCLE_GROUPS = [
  { id:'piept',    label:'Piept',    icon:'💪', color:'#ef4444' },
  { id:'spate',    label:'Spate',    icon:'🏋', color:'#3b82f6' },
  { id:'umeri',    label:'Umeri',    icon:'🏅', color:'#8b5cf6' },
  { id:'brate',    label:'Brațe',    icon:'💪', color:'#f59e0b' },
  { id:'picioare', label:'Picioare', icon:'🦵', color:'#10b981' },
  { id:'core',     label:'Core',     icon:'🎯', color:'#f97316' },
];

const EXERCISES = {
  piept:    [{id:'bench',name:'Bench Press (halteră)'},{id:'dbpress',name:'Bench Press (gantere)'},{id:'incline',name:'Incline Press'},{id:'flyes',name:'Flyes'},{id:'cable_fly',name:'Cable Crossover'},{id:'dips',name:'Dips (piept)'}],
  spate:    [{id:'deadlift',name:'Deadlift'},{id:'rows',name:'Bent-over Rows'},{id:'pulldown',name:'Lat Pulldown'},{id:'pullup',name:'Pull-up'},{id:'seated_row',name:'Seated Cable Row'},{id:'facepull',name:'Face Pull'}],
  umeri:    [{id:'ohpress',name:'Overhead Press'},{id:'dbpress_s',name:'Arnold Press'},{id:'laterals',name:'Lateral Raises'},{id:'frontrise',name:'Front Raises'},{id:'shrugs',name:'Shrugs'}],
  brate:    [{id:'curl',name:'Bicep Curl (halteră)'},{id:'dbcurl',name:'Bicep Curl (gantere)'},{id:'hammer',name:'Hammer Curl'},{id:'skullcr',name:'Skull Crushers'},{id:'tricepext',name:'Tricep Pushdown'},{id:'dipstric',name:'Dips (triceps)'}],
  picioare: [{id:'squat',name:'Squat'},{id:'legpress',name:'Leg Press'},{id:'rdl',name:'Romanian Deadlift'},{id:'lunge',name:'Lunges'},{id:'legcurl',name:'Leg Curl'},{id:'legext',name:'Leg Extension'},{id:'calf',name:'Calf Raises'}],
  core:     [{id:'plank',name:'Plank'},{id:'crunch',name:'Crunch'},{id:'lgrise',name:'Leg Raises'},{id:'russian',name:'Russian Twist'},{id:'cabcr',name:'Cable Crunch'}],
};

const CARDIO_TYPES = [
  { id:'mers',     name:'Mers pe jos',  icon:'🚶', met:3.5, color:'#10b981' },
  { id:'alergare', name:'Alergare',     icon:'🏃', met:9.0, color:'#f97316' },
  { id:'munca',    name:'Muncă fizică', icon:'🔧', met:4.0, color:'#f59e0b' },
  { id:'bicicleta',name:'Bicicletă',    icon:'🚴', met:7.5, color:'#3b82f6' },
  { id:'inot',     name:'Înot',         icon:'🏊', met:8.0, color:'#6366f1' },
];

const FOODS = [
  // ─── PROTEINE ───
  { id:'ou',         name:'Ou întreg',        emoji:'🥚', unit:'buc', unitG:55,  kcal:155, p:13,  c:1.1, f:11,  fiber:0,   cat:'proteine' },
  { id:'albus',      name:'Albuș lichid',     emoji:'🥛', unit:'ml',  unitG:1,   kcal:52,  p:11,  c:0.7, f:0.2, fiber:0,   cat:'proteine' },
  { id:'iaurt',      name:'Iaurt proteic 2%', emoji:'🥛', unit:'g',   unitG:1,   kcal:65,  p:9,   c:5,   f:1.5, fiber:0,   cat:'proteine' },
  { id:'branza',     name:'Brânză de vaci',   emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:12,  c:3.5, f:4,   fiber:0,   cat:'proteine' },
  { id:'cottage',    name:'Brânză Cottage',   emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:11,  c:3.4, f:4.3, fiber:0,   cat:'proteine' },
  { id:'fagaras',    name:'Brânză Făgăraș',   emoji:'🧀', unit:'g',   unitG:1,   kcal:263, p:18,  c:2,   f:21,  fiber:0,   cat:'proteine' },
  { id:'parmezan',   name:'Parmezan',         emoji:'🧀', unit:'g',   unitG:1,   kcal:431, p:38,  c:0,   f:29,  fiber:0,   cat:'proteine' },
  { id:'vita',       name:'Vită mușchi',      emoji:'🥩', unit:'g',   unitG:1,   kcal:158, p:26,  c:0,   f:6,   fiber:0,   cat:'proteine' },
  { id:'pui',        name:'Piept pui',        emoji:'🍗', unit:'g',   unitG:1,   kcal:165, p:31,  c:0,   f:3.6, fiber:0,   cat:'proteine' },
  { id:'pulpe',      name:'Pulpe pui',        emoji:'🍗', unit:'g',   unitG:1,   kcal:209, p:26,  c:0,   f:11,  fiber:0,   cat:'proteine' },
  { id:'pastrav',    name:'Păstrăv',          emoji:'🐟', unit:'g',   unitG:1,   kcal:148, p:21,  c:0,   f:7,   fiber:0,   cat:'proteine' },
  // ─── CARBS ───
  { id:'cartof_d',   name:'Cartof dulce',     emoji:'🍠', unit:'g',   unitG:1,   kcal:86,  p:1.6, c:20,  f:0.1, fiber:3,   cat:'carbs' },
  { id:'cartof',     name:'Cartof',           emoji:'🥔', unit:'g',   unitG:1,   kcal:77,  p:2,   c:17,  f:0.1, fiber:2.2, cat:'carbs' },
  { id:'ovaz',       name:'Ovăz',             emoji:'🌾', unit:'g',   unitG:1,   kcal:389, p:17,  c:66,  f:7,   fiber:10,  cat:'carbs' },
  { id:'orez',       name:'Orez fiert',       emoji:'🍚', unit:'g',   unitG:1,   kcal:130, p:2.7, c:28,  f:0.3, fiber:0.4, cat:'carbs' },
  { id:'banana',     name:'Banană',           emoji:'🍌', unit:'buc', unitG:120, kcal:89,  p:1.1, c:23,  f:0.3, fiber:2.6, cat:'carbs' },
  { id:'mar',        name:'Măr',              emoji:'🍎', unit:'buc', unitG:150, kcal:52,  p:0.3, c:14,  f:0.2, fiber:2.4, cat:'carbs' },
  { id:'para',       name:'Pară',             emoji:'🍐', unit:'buc', unitG:160, kcal:57,  p:0.4, c:15,  f:0.1, fiber:3.1, cat:'carbs' },
  { id:'paine_n',    name:'Pâine neagră',     emoji:'🍞', unit:'felie', unitG:30, kcal:65,  p:2.5, c:12,  f:0.8, fiber:1.9, cat:'carbs' },
  // ─── LEGUME ───
  { id:'ciuperci',   name:'Ciuperci',         emoji:'🍄', unit:'g',   unitG:1,   kcal:22,  p:3.1, c:3.3, f:0.3, fiber:1,   cat:'legume' },
  { id:'sfecla',     name:'Sfeclă roșie',     emoji:'🟣', unit:'g',   unitG:1,   kcal:43,  p:1.6, c:9.6, f:0.2, fiber:2.8, cat:'legume' },
  { id:'varza',      name:'Varză',            emoji:'🥬', unit:'g',   unitG:1,   kcal:25,  p:1.3, c:5.8, f:0.1, fiber:2.5, cat:'legume' },
  { id:'varzam',     name:'Varză murată',     emoji:'🥬', unit:'g',   unitG:1,   kcal:19,  p:0.9, c:4.3, f:0.1, fiber:2.9, cat:'legume' },
  { id:'ardei_k',    name:'Ardei Kapia',      emoji:'🫑', unit:'g',   unitG:1,   kcal:31,  p:1,   c:6,   f:0.3, fiber:2,   cat:'legume' },
  { id:'conopida',   name:'Conopidă',         emoji:'🥦', unit:'g',   unitG:1,   kcal:25,  p:1.9, c:5,   f:0.3, fiber:2,   cat:'legume' },
  // ─── GRĂSIMI ───
  { id:'ulei',       name:'Ulei măsline',     emoji:'🫒', unit:'ml',  unitG:0.9, kcal:884, p:0,   c:0,   f:100, fiber:0,   cat:'grasimi' },
  { id:'chia',       name:'Semințe chia',     emoji:'🌱', unit:'g',   unitG:1,   kcal:486, p:17,  c:42,  f:31,  fiber:34,  cat:'grasimi' },
  { id:'psyllium',   name:'Psyllium',         emoji:'🌿', unit:'g',   unitG:1,   kcal:200, p:2,   c:85,  f:1,   fiber:71,  cat:'grasimi' },
  { id:'migdale',    name:'Migdale',          emoji:'🌰', unit:'g',   unitG:1,   kcal:579, p:21,  c:22,  f:50,  fiber:12,  cat:'grasimi' },
  { id:'cioc_n',     name:'Ciocolată neagră 85%', emoji:'🍫', unit:'g', unitG:1, kcal:598, p:8,   c:46,  f:43,  fiber:11,  cat:'grasimi' },
];

const FOOD_CATS = [
  {id:'all',label:'Toate'},
  {id:'proteine',label:'Proteine'},
  {id:'carbs',label:'Carbs'},
  {id:'legume',label:'Legume'},
  {id:'grasimi',label:'Grăsimi'}
];

const DEFAULT_TEMPLATES = [
  { id:'mic_dejun', name:'Mic dejun standard', icon:'🌅', items:[{id:'ou',qty:3},{id:'albus',qty:100},{id:'ovaz',qty:50}] },
  { id:'post_antr', name:'Post-antrenament',   icon:'💪', items:[{id:'pui',qty:200},{id:'cartof_d',qty:150},{id:'branza',qty:50}] },
  { id:'pranz',     name:'Prânz proteic',      icon:'🍽', items:[{id:'pui',qty:180},{id:'ciuperci',qty:100},{id:'varza',qty:100},{id:'ulei',qty:10}] },
  { id:'cina',      name:'Cină ușoară',        icon:'🌙', items:[{id:'pastrav',qty:200},{id:'varza',qty:150},{id:'sfecla',qty:80}] },
];

const RO_DAYS   = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = {
  session:'mp_session_v7', stats:'mp_stats_v7', workout:'mp_workout_v7',
  pattern:'mp_patterns_v1', templates:'mp_tpl_v1', photos:'mp_photos_v1',
  weekly:'mp_weekly_v1', notif:'mp_notif_v1', theme:'mp_theme_v1',
  blood:'mp_blood_v1', hrv:'mp_hrv_v1',
};

function ls(key,def){try{if(typeof window==='undefined')return def;const r=window.localStorage.getItem(key);return r?JSON.parse(r):def;}catch{return def;}}
function lsSet(key,val){try{if(typeof window==='undefined')return;window.localStorage.setItem(key,JSON.stringify(val));}catch{}}

function loadSession(){const t=todayKey(),d=ls(KEYS.session,null);if(!d||d.date!==t)return{messages:[],dayType:'normal',date:t};return d;}
function saveSession(m,dt){lsSet(KEYS.session,{messages:m,dayType:dt,date:todayKey()});}
function loadStats()   { return ls(KEYS.stats,   {weight:{},daily:{},water:{}}); }
function saveStats(s)  { lsSet(KEYS.stats,s); }
function loadWorkouts(){ return ls(KEYS.workout, {days:{}}); }
function saveWorkouts(w){ lsSet(KEYS.workout,w); }

function localDateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
function todayKey(){ return localDateKey(); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcMacros(food,qty){ const g=food.unit==='buc'?qty*food.unitG:food.unit==='ml'?qty*food.unitG:food.unit==='felie'?qty*food.unitG:qty,f=g/100; return{kcal:Math.round(food.kcal*f),p:Math.round(food.p*f*10)/10,c:Math.round(food.c*f*10)/10,fat:Math.round(food.f*f*10)/10,fiber:Math.round((food.fiber||0)*f*10)/10}; }
function calcTemplateMacros(items){ return items.reduce((a,item)=>{ const food=FOODS.find(f=>f.id===item.id);if(!food)return a;const m=calcMacros(food,item.qty);return{kcal:a.kcal+m.kcal,p:a.p+m.p,c:a.c+m.c,fat:a.fat+m.fat}; },{kcal:0,p:0,c:0,fat:0}); }
function calcBurned(met,min){ return Math.round((met*3.5*96/200)*min); }
function calcStreak(stats){if(!stats?.daily)return 0;let streak=0;const cur=new Date();for(let i=0;i<60;i++){const k=localDateKey(cur);if(stats.daily[k])streak++;else if(i>0)break;cur.setDate(cur.getDate()-1);}return streak;}

// ─── Markdown ─────────────────────────────────────────────────────────────────
function escapeHtml(str=''){return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function inlineFormat(t, th){
  const safe=escapeHtml(t);
  const txt=th?.text||'#f1f5f9', txt2=th?.text2||'#94a3b8';
  return safe
    .replace(/\*\*(.+?)\*\*/g,`<strong style="color:${txt};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g,`<em style="color:${txt2}">$1</em>`)
    .replace(/`(.+?)`/g,'<code style="background:rgba(249,115,22,0.15);padding:2px 6px;border-radius:4px;font-size:13px;color:#fb923c;font-family:monospace">$1</code>');
}
function renderMarkdown(text, th){
  const clean=text.replace(/\{"_data":.+\}$/m,'').trim(),lines=clean.split('\n'),result=[];let i=0;
  const c1=th?.text||'#e2e8f0', c2=th?.text2||'#94a3b8', c3=th?.text3||'#64748b';
  const brd=th?.border||'rgba(255,255,255,0.07)', surf=th?.surface||'rgba(255,255,255,0.03)';
  const body=th?.text||'#cbd5e1';
  while(i<lines.length){
    const line=lines[i];
    if(line.trim().startsWith('|')&&i+1<lines.length&&lines[i+1].trim().match(/^\|[\s\-|]+\|$/)){
      const tl=[];while(i<lines.length&&lines[i].trim().startsWith('|')){tl.push(lines[i]);i++;}
      const hd=tl[0].split('|').filter(c=>c.trim()).map(c=>c.trim()),rows=tl.slice(2).map(r=>r.split('|').filter(c=>c.trim()).map(c=>c.trim()));
      result.push(<div key={i} style={{overflowX:'auto',margin:'12px 0'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}><thead><tr>{hd.map((h,j)=><th key={j} style={{textAlign:'left',padding:'8px 12px',background:surf,borderBottom:`1px solid ${brd}`,color:c3,fontWeight:700,fontSize:'11px',letterSpacing:'0.08em',textTransform:'uppercase'}} dangerouslySetInnerHTML={{__html:inlineFormat(h,th)}}/>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:`1px solid ${brd}`}}>{row.map((cell,ci)=><td key={ci} style={{padding:'8px 12px',color:c1,fontSize:'14px'}} dangerouslySetInnerHTML={{__html:inlineFormat(cell,th)}}/>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if(line.startsWith('### ')){result.push(<h3 key={i} style={{color:c3,fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',margin:'16px 0 8px',fontWeight:700}}>{line.slice(4)}</h3>);i++;continue;}
    if(line.startsWith('## ')){result.push(<h2 key={i} style={{color:c3,fontSize:'10px',letterSpacing:'0.25em',textTransform:'uppercase',margin:'18px 0 8px',fontWeight:700}}>{line.slice(3)}</h2>);i++;continue;}
    if(line.startsWith('# ')){result.push(<h1 key={i} style={{fontSize:'17px',fontWeight:800,margin:'16px 0 10px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{line.slice(2)}</h1>);i++;continue;}
    if(line.trim().match(/^---+$/)){result.push(<hr key={i} style={{border:'none',borderTop:`1px solid ${brd}`,margin:'14px 0'}}/>);i++;continue;}
    if(line.match(/^[\-\*] /)){
      const items=[];while(i<lines.length&&lines[i].match(/^[\-\*] /)){items.push(lines[i].slice(2));i++;}
      result.push(<ul key={i} style={{margin:'8px 0',paddingLeft:0,listStyle:'none'}}>{items.map((item,j)=><li key={j} style={{color:body,marginBottom:'6px',display:'flex',gap:'10px',alignItems:'flex-start',fontSize:'15px',lineHeight:'1.55'}}><span style={{background:'linear-gradient(135deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',flexShrink:0,fontWeight:800}}>◆</span><span dangerouslySetInnerHTML={{__html:inlineFormat(item,th)}}/></li>)}</ul>);
      continue;
    }
    if(line.match(/^\d+\. /)){
      const items=[];while(i<lines.length&&lines[i].match(/^\d+\. /)){items.push(lines[i].replace(/^\d+\. /,''));i++;}
      result.push(<ol key={i} style={{margin:'8px 0',paddingLeft:'20px'}}>{items.map((item,j)=><li key={j} style={{color:body,marginBottom:'5px',fontSize:'15px',lineHeight:'1.55'}} dangerouslySetInnerHTML={{__html:inlineFormat(item,th)}}/>)}</ol>);
      continue;
    }
    if(line.trim()===''){result.push(<div key={i} style={{height:'8px'}}/>);i++;continue;}
    result.push(<p key={i} style={{color:body,lineHeight:'1.7',margin:'3px 0',fontSize:'15px'}} dangerouslySetInnerHTML={{__html:inlineFormat(line,th)}}/>);i++;
  }
  return result;
}

// ─── Mini Line Chart ──────────────────────────────────────────────────────────
function LineChart({data,color,label,unit,target,theme=THEMES.dark}){
  if(!data||data.length===0)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'90px',color:theme.text3,fontSize:'13px'}}>Nicio dată</div>;
  const vals=data.map(d=>d.value),min=Math.min(...vals)-1,max=Math.max(...vals)+1,W=300,H=90;
  const px=i=>(i/(data.length-1||1))*W,py=v=>H-((v-min)/(max-min||1))*H;
  const points=data.map((d,i)=>`${px(i)},${py(d.value)}`).join(' '),last=vals[vals.length-1];
  const uid=`${label.replace(/\s/g,'')}-${color.replace('#','')}`;
  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}>
      <span style={{fontSize:'11px',color:theme.text3,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:700}}>{label}</span>
      <span style={{fontSize:'22px',fontWeight:800,color}}>{last}{unit}</span>
    </div>
    {target&&<div style={{fontSize:'11px',color:theme.text3,marginBottom:'6px'}}>Țintă: {target}{unit}</div>}
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'90px',overflow:'visible'}}>
      <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,${H} ${points} ${W},${H}`} fill={`url(#g${uid})`}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i)=><circle key={i} cx={px(i)} cy={py(d.value)} r="3" fill={color} stroke={theme.bg} strokeWidth="2"/>)}
    </svg>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:'2px'}}>
      <span style={{fontSize:'10px',color:theme.text4}}>{data[0]?.date}</span>
      <span style={{fontSize:'10px',color:theme.text4}}>{data[data.length-1]?.date}</span>
    </div>
  </div>);}

function WaterTracker({stats, setStats, theme=THEMES.dark}) {
  const key = todayKey();
  const ml = stats.water?.[key] || 0;
  const target = 3400;
  const pct = Math.min(100, Math.round((ml/target)*100));
  const color = pct>=100?'#4ade80':pct>=70?'#3b82f6':'#f97316';
  const add = (amount) => {const ns = loadStats();if (!ns.water) ns.water = {};ns.water[key] = (ns.water[key]||0) + amount;saveStats(ns); setStats({...ns});};
  const reset = () => {const ns = loadStats();if (!ns.water) ns.water = {};ns.water[key] = 0;saveStats(ns); setStats({...ns});};
  return (
    <div style={{background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.18)',borderRadius:'16px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
        <SectionTitle icon="💧" label="HIDRATARE" color="#3b82f6" theme={theme}/>
        <div style={{display:'flex',alignItems:'baseline',gap:'4px'}}>
          <span style={{fontSize:'22px',fontWeight:900,color}}>{ml}ml</span>
          <span style={{fontSize:'12px',color:theme.text3}}>/ {target}ml</span>
        </div>
      </div>
      <div style={{height:'8px',background:theme.surface2,borderRadius:'4px',overflow:'hidden',marginBottom:'12px'}}>
        <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,#3b82f6,${color})`,borderRadius:'4px',transition:'width 0.4s ease'}}/>
      </div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        {[150,250,330,500].map(amt=>(
          <button key={amt} onClick={()=>add(amt)} style={{flex:1,minWidth:'60px',padding:'10px 6px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'10px',color:'#3b82f6',fontSize:'13px',fontWeight:700,cursor:'pointer',transition:'all 0.15s',fontFamily:"'Barlow Condensed',sans-serif"}}>+{amt}</button>
        ))}
        <button onClick={reset} style={{padding:'10px 12px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'12px',cursor:'pointer'}}>↺</button>
      </div>
      {pct>=100&&<div style={{marginTop:'10px',textAlign:'center',fontSize:'13px',color:'#4ade80',fontWeight:600}}>✅ Obiectiv hidratare atins!</div>}
    </div>
  );
}

function RestTimer({theme=THEMES.dark}) {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(null);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  useEffect(()=>{
    if (running && remaining > 0) {intervalRef.current = setInterval(()=>setRemaining(r=>r-1), 1000);}
    else if (remaining === 0) {setRunning(false);if (typeof navigator!=='undefined'&&'vibrate' in navigator) navigator.vibrate([200,100,200]);}
    return ()=>clearInterval(intervalRef.current);
  },[running, remaining]);
  const start = (dur) => { setDuration(dur); setRemaining(dur); setRunning(true); };
  const stop  = () => { setRunning(false); setRemaining(null); clearInterval(intervalRef.current); };
  const pct   = remaining!==null ? Math.round((remaining/duration)*100) : 100;
  const color = remaining!==null&&remaining<=10?'#ef4444':remaining!==null&&remaining<=30?'#f59e0b':'#10b981';
  return (
    <div style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.18)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#10b981',letterSpacing:'0.05em',marginBottom:'12px'}}>⏱ REST TIMER</div>
      {running && remaining !== null ? (
        <div style={{textAlign:'center'}}>
          <div style={{position:'relative',width:'120px',height:'120px',margin:'0 auto 14px'}}>
            <svg viewBox="0 0 120 120" style={{width:'120px',height:'120px',transform:'rotate(-90deg)'}}>
              <circle cx="60" cy="60" r="54" fill="none" stroke={theme.surface2} strokeWidth="8"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={`${2*Math.PI*54}`}
                strokeDashoffset={`${2*Math.PI*54*(1-pct/100)}`}
                strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:'32px',fontWeight:900,color,fontFamily:"'Barlow Condensed',sans-serif"}}>{remaining}</span>
              <span style={{fontSize:'11px',color:theme.text3}}>sec</span>
            </div>
          </div>
          <button onClick={stop} style={{padding:'10px 28px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'100px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>✕ Stop</button>
        </div>
      ) : (
        <div>
          <div style={{fontSize:'11px',color:theme.text3,marginBottom:'8px',letterSpacing:'0.08em',fontWeight:700}}>DURATĂ REST</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {[60,90,120,180,240].map(s=>(
              <button key={s} onClick={()=>start(s)} style={{flex:1,padding:'12px 8px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'10px',color:'#10b981',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",transition:'all 0.15s'}}>{s<60?`${s}s`:`${s/60}min`}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseProgress({workouts, theme=THEMES.dark}) {
  const [selEx, setSelEx] = useState('squat');
  const progressData = Object.entries(workouts.days||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-20).flatMap(([date,day])=>{const matches=(day.exercises||[]).filter(e=>e.id===selEx);if(!matches.length)return[];const maxKg=Math.max(...matches.flatMap(ex=>ex.sets.map(s=>parseFloat(s.kg)||0)));const[,m,d]=date.split('-');return[{date:`${d}/${m}`,value:maxKg}];});
  const pr = progressData.length ? Math.max(...progressData.map(d=>d.value)) : 0;
  return (
    <div style={{...panel(theme),padding:'14px'}}>
      <SectionTitle icon="📊" label="PROGRES EXERCIȚIU" color={theme.text2} theme={theme}/>
      <select value={selEx} onChange={e=>setSelEx(e.target.value)} style={{...selectStyle(theme),marginBottom:'12px'}}>
        {Object.entries(EXERCISES).map(([group,exList])=>(
          <optgroup key={group} label={group.toUpperCase()}>
            {exList.map(ex=><option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </optgroup>
        ))}
      </select>
      {progressData.length>1 ? (<><LineChart data={progressData} color="#f59e0b" label="Greutate maximă" unit=" kg" theme={theme}/><div style={{marginTop:'10px',textAlign:'center',padding:'8px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'10px'}}><span style={{fontSize:'12px',color:theme.text3}}>RECORD PERSONAL: </span><span style={{fontSize:'18px',fontWeight:800,color:'#f59e0b',fontFamily:"'Barlow Condensed',sans-serif"}}>{pr} kg 🏅</span></div></>) : (<EmptyState subtitle="Loghează cel puțin 2 sesiuni pentru a vedea progresul." theme={theme}/>)}
    </div>
  );
}

function WellbeingTracker({onSendToCoach, theme=THEMES.dark}) {
  const [energy,setEnergy]=useState('');const [libido,setLibido]=useState('');const [sleep,setSleep]=useState('');const [sleepQ,setSleepQ]=useState('');const [recovery,setRecovery]=useState('');const [saved,setSaved]=useState(false);
  const hrvData = ls(KEYS.hrv, {});const todayHrv = hrvData[todayKey()];
  const handleSave = () => {if (!energy && !libido && !sleep) return;const entry = { energy:energy?parseInt(energy):null, libido:libido?parseInt(libido):null, sleep:sleep?parseFloat(sleep):null, sleepQuality:sleepQ?parseInt(sleepQ):null, recovery:recovery?parseInt(recovery):null, time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}) };const newData = {...hrvData, [todayKey()]:entry};lsSet(KEYS.hrv, newData);setSaved(true);const parts = [];if (energy) parts.push(`Energie: ${energy}/10`);if (libido) parts.push(`Libido: ${libido}/10`);if (recovery) parts.push(`Recuperare: ${recovery}/10`);if (sleep) parts.push(`Somn: ${sleep}h (calitate ${sleepQ}/10)`);if (parts.length) onSendToCoach(parts.join(', '));setTimeout(()=>setSaved(false), 2000);};
  const ScoreInput = ({label, value, setValue, color}) => (<div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em',marginBottom:'6px'}}>{label}</div><div style={{display:'flex',gap:'4px'}}>{[1,2,3,4,5,6,7,8,9,10].map(n=>(<button key={n} onClick={()=>setValue(String(n))} style={{flex:1,padding:'8px 2px',borderRadius:'6px',border:`1px solid ${parseInt(value)>=n?color:theme.softBorder}`,background:parseInt(value)>=n?`${color}20`:'transparent',color:parseInt(value)>=n?color:theme.text4,fontSize:'11px',fontWeight:700,cursor:'pointer',transition:'all 0.1s'}}>{n}</button>))}</div></div>);
  return (
    <div style={{background:'rgba(236,72,153,0.05)',border:'1px solid rgba(236,72,153,0.18)',borderRadius:'16px',padding:'14px'}}>
      <SectionTitle icon="❤️" label="WELLBEING & HRV" color="#ec4899" theme={theme}/>
      {todayHrv && (<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>{[{l:'ENERGIE',v:todayHrv.energy,c:'#f59e0b'},{l:'LIBIDO',v:todayHrv.libido,c:'#ec4899'},{l:'RECUPERARE',v:todayHrv.recovery,c:'#10b981'}].map(x=>x.v&&(<div key={x.l} style={{background:`${x.c}12`,border:`1px solid ${x.c}30`,borderRadius:'10px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'9px',color:theme.text3,marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'20px',fontWeight:900,color:x.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}/10</div></div>))}</div>)}
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        <ScoreInput label="⚡ ENERGIE (1-10)" value={energy} setValue={setEnergy} color="#f59e0b"/>
        <ScoreInput label="🔥 LIBIDO (1-10)"  value={libido}  setValue={setLibido}  color="#ec4899"/>
        <ScoreInput label="💪 RECUPERARE (1-10)" value={recovery} setValue={setRecovery} color="#10b981"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          <div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em',marginBottom:'6px'}}>😴 SOMN (ore)</div><input type="number" value={sleep} onChange={e=>setSleep(e.target.value)} placeholder="7.5" step="0.5" style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px',color:theme.text,fontSize:'15px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div>
          <div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em',marginBottom:'6px'}}>⭐ CALITATE SOMN</div><input type="number" value={sleepQ} onChange={e=>setSleepQ(e.target.value)} placeholder="1-10" min="1" max="10" style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px',color:theme.text,fontSize:'15px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div>
        </div>
        <button onClick={handleSave} style={{padding:'12px',background:saved?'rgba(74,222,128,0.15)':'linear-gradient(135deg,#ec4899,#8b5cf6)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s',boxShadow:'0 4px 15px rgba(236,72,153,0.25)'}}>
          {saved?'✅ SALVAT':'◆ SALVEAZĂ WELLBEING'}
        </button>
      </div>
    </div>
  );
}

function BloodAnalysis({theme=THEMES.dark}) {
  const [records, setRecords] = useState(ls(KEYS.blood, []));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({date:'', ldl:'', hdl:'', testosterone:'', glucose:'', triglycerides:'', note:''});
  const save = () => {if (!form.date) return;const existing=records.find(r=>r.date===form.date);let updated;if(existing){updated=records.map(r=>r.date===form.date?{...r,...form}:r);}else{updated=[...records,{...form,id:Date.now()}];}updated.sort((a,b)=>a.date.localeCompare(b.date));setRecords(updated); lsSet(KEYS.blood, updated);setEditing(false);setForm({date:'', ldl:'', hdl:'', testosterone:'', glucose:'', triglycerides:'', note:''}); };
  const del = (id) => { const u=records.filter(r=>r.id!==id); setRecords(u); lsSet(KEYS.blood,u); };
  const ldlData = records.filter(r=>r.ldl).map(r=>({date:r.date.slice(5),value:parseFloat(r.ldl)}));
  const testData = records.filter(r=>r.testosterone).map(r=>({date:r.date.slice(5),value:parseFloat(r.testosterone)}));
  const InputField = ({label, field, suffix}) => (<div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>{label}</div><div style={{display:'flex',gap:'6px',alignItems:'center'}}><input type="number" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} style={{flex:1,...inputSmall(theme),width:'auto'}}/>{suffix&&<span style={{fontSize:'12px',color:theme.text3,whiteSpace:'nowrap'}}>{suffix}</span>}</div></div>);
  return (
    <div style={{background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:'16px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <SectionTitle icon="🩸" label="ANALIZE SÂNGE" color="#ef4444" theme={theme}/>
        <button onClick={()=>setEditing(e=>!e)} style={{padding:'6px 14px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'10px',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>+ ADAUGĂ</button>
      </div>
      {editing && (<div style={{background:theme.surface,borderRadius:'12px',padding:'14px',marginBottom:'12px',display:'flex',flexDirection:'column',gap:'10px'}}><div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>DATA</div><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}><InputField label="LDL" field="ldl" suffix="mg/dL"/><InputField label="HDL" field="hdl" suffix="mg/dL"/><InputField label="Testosteron" field="testosterone" suffix="ng/dL"/><InputField label="Glucoză" field="glucose" suffix="mg/dL"/><InputField label="Trigliceride" field="triglycerides" suffix="mg/dL"/></div><div><div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>NOTE</div><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Observații..." style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}><button onClick={()=>setEditing(false)} style={{padding:'10px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Anulează</button><button onClick={save} style={{padding:'10px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>SALVEAZĂ ◆</button></div></div>)}
      {ldlData.length>1&&<div style={{marginBottom:'12px'}}><LineChart data={ldlData} color="#ef4444" label="LDL" unit=" mg/dL" target="<100" theme={theme}/></div>}
      {testData.length>1&&<div style={{marginBottom:'12px'}}><LineChart data={testData} color="#f59e0b" label="Testosteron" unit=" ng/dL" target="400-900" theme={theme}/></div>}
      {records.length > 0 && (<div style={{display:'flex',flexDirection:'column',gap:'6px'}}>{[...records].reverse().slice(0,5).map(r=>(<div key={r.id} style={{padding:'10px 12px',background:theme.surface,borderRadius:'10px',border:`1px solid ${theme.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontSize:'12px',color:theme.text3,marginBottom:'4px'}}>{r.date}</div><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{r.ldl&&<span style={{fontSize:'12px',color:'#ef4444',fontWeight:600}}>LDL: {r.ldl}</span>}{r.hdl&&<span style={{fontSize:'12px',color:'#4ade80',fontWeight:600}}>HDL: {r.hdl}</span>}{r.testosterone&&<span style={{fontSize:'12px',color:'#f59e0b',fontWeight:600}}>T: {r.testosterone}</span>}{r.glucose&&<span style={{fontSize:'12px',color:'#3b82f6',fontWeight:600}}>Glc: {r.glucose}</span>}</div></div><button onClick={()=>del(r.id)} style={{background:'none',border:'none',color:theme.text4,cursor:'pointer',fontSize:'14px',padding:'0 4px'}}>×</button></div>))}</div>)}
      {records.length===0&&!editing&&<EmptyState subtitle="Adaugă prima analiză pentru a urmări evoluția." theme={theme}/>}
    </div>
  );
}

function ExportPanel({stats, workouts, theme=THEMES.dark}) {
  const exportCSV = () => {const rows = [['Data','Greutate(kg)','Calorii','Proteine(g)','Exercitii','Cardio(kcal)']];const allDates = new Set([...Object.keys(stats.weight||{}), ...Object.keys(stats.daily||{}), ...Object.keys(workouts.days||{})]);[...allDates].sort().forEach(date=>{rows.push([date,stats.weight?.[date]||'',stats.daily?.[date]?.calories||'',stats.daily?.[date]?.protein||'',workouts.days?.[date]?.exercises?.length||0,(workouts.days?.[date]?.cardio||[]).reduce((a,c)=>a+c.kcal,0)||'']);});const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:`${s}`;};const csv = rows.map(r=>r.map(csvCell).join(',')).join('\n');const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});const url = URL.createObjectURL(blob);const a = document.createElement('a');a.href=url; a.download=`mihai_performance_${todayKey()}.csv`; a.click();URL.revokeObjectURL(url);};
  const exportJSON = () => {const data = { exportDate:todayKey(), stats: loadStats(), workouts: loadWorkouts(), blood: ls(KEYS.blood,[]), hrv: ls(KEYS.hrv,{}) };const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url = URL.createObjectURL(blob);const a = document.createElement('a');a.href=url; a.download=`mihai_performance_backup_${todayKey()}.json`; a.click();URL.revokeObjectURL(url);};
  return (
    <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:theme.text2,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'12px'}}>📤 EXPORT DATE</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
        <button onClick={exportCSV} style={{padding:'12px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:'12px',color:'#10b981',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em'}}>📈 CSV</button>
        <button onClick={exportJSON} style={{padding:'12px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'12px',color:'#3b82f6',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em'}}>💾 JSON Backup</button>
      </div>
      <div style={{fontSize:'11px',color:theme.text4,marginTop:'8px',textAlign:'center'}}>CSV pentru Excel/medic · JSON pentru backup complet</div>
    </div>
  );
}

// ─── BARCODE SCANNER ─────────────────────────────────────────────────────────
function BarcodeScanner({onResult,theme=THEMES.dark}){
  const divRef=useRef(null);
  const [status,setStatus]=useState('idle');
  const [product,setProduct]=useState(null);
  const [qty,setQty]=useState('100');
  const [errorMsg,setErrorMsg]=useState('');
  const [manualCode,setManualCode]=useState('');
  const scannerRef=useRef(null);

  const stopScanner=()=>{
    if(scannerRef.current){
      try{scannerRef.current.stop().then(()=>{scannerRef.current.clear();scannerRef.current=null;}).catch(()=>{});}catch{}
    }
  };

  useEffect(()=>()=>stopScanner(),[]);

  const startScan=async()=>{
    setStatus('scanning');setProduct(null);setErrorMsg('');
    try{
      if(!window.Html5Qrcode){
        await new Promise((resolve,reject)=>{
          const s=document.createElement('script');
          s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
          s.onload=resolve;s.onerror=reject;
          document.head.appendChild(s);
        });
      }
      await new Promise(r=>setTimeout(r,100));
      const scanner=new window.Html5Qrcode('scanner-div');
      scannerRef.current=scanner;
      await scanner.start(
        {facingMode:'environment'},
        {fps:10,qrbox:{width:250,height:150},aspectRatio:1.5},
        (decodedText)=>{stopScanner();lookupBarcode(decodedText);},
        ()=>{}
      );
    }catch(e){
      setErrorMsg('Nu s-a putut accesa camera. Verifică permisiunile.');
      setStatus('error');
    }
  };

  const lookupBarcode=async(barcode)=>{
    setStatus('loading');
    try{
      const res=await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data=await res.json();
      if(data.status===1&&data.product){
        const p=data.product;const n=p.nutriments||{};
        setProduct({barcode,name:p.product_name||p.product_name_ro||'Produs necunoscut',brand:p.brands||'',kcal:Math.round(n['energy-kcal_100g']||n['energy-kcal']||0),p:Math.round((n.proteins_100g||0)*10)/10,c:Math.round((n.carbohydrates_100g||0)*10)/10,f:Math.round((n.fat_100g||0)*10)/10,fiber:Math.round((n.fiber_100g||0)*10)/10,img:p.image_front_small_url||null});
        setStatus('found');
      }else{setErrorMsg(`Produsul ${barcode} nu a fost găsit.`);setStatus('error');}
    }catch{setErrorMsg('Eroare de rețea. Încearcă din nou.');setStatus('error');}
  };

  const calcScanned=()=>{if(!product)return{kcal:0,p:0,c:0,f:0};const q=parseFloat(qty)||100,f=q/100;return{kcal:Math.round(product.kcal*f),p:Math.round(product.p*f*10)/10,c:Math.round(product.c*f*10)/10,f:Math.round(product.f*f*10)/10};};
  const m=calcScanned();

  return(
    <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:'14px',overflowY:'auto',flex:1}}>
      {status==='idle'&&(
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{fontSize:'64px',marginBottom:'12px'}}>📷</div>
          <div style={{fontSize:'15px',color:theme.text2,marginBottom:'6px',fontWeight:600}}>Scanează codul de bare</div>
          <div style={{fontSize:'13px',color:theme.text3,marginBottom:'20px'}}>Funcționează cu orice produs din magazin</div>
          <button onClick={startScan} style={{padding:'14px 32px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'16px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 20px rgba(249,115,22,0.35)'}}>
            📷 PORNEȘTE CAMERA
          </button>
          <div style={{marginTop:'16px',borderTop:`1px solid ${theme.border}`,paddingTop:'16px'}}>
            <div style={{fontSize:'12px',color:theme.text3,marginBottom:'8px'}}>sau introdu codul manual</div>
            <div style={{display:'flex',gap:'8px'}}>
              <input value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="ex: 5941154010018" type="number" style={{flex:1,background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px 12px',color:theme.text,fontSize:'15px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
              <button onClick={()=>manualCode&&lookupBarcode(manualCode)} disabled={!manualCode} style={{padding:'10px 16px',background:manualCode?'linear-gradient(135deg,#f97316,#ef4444)':theme.surface,border:'none',borderRadius:'10px',color:manualCode?'#fff':theme.text4,fontWeight:700,cursor:manualCode?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif"}}>→</button>
            </div>
          </div>
        </div>
      )}

      {status==='scanning'&&(
        <div>
          <div id="scanner-div" style={{width:'100%',borderRadius:'16px',overflow:'hidden',marginBottom:'12px'}}/>
          <style>{`#scanner-div video{border-radius:16px;} #scanner-div img{display:none;}`}</style>
          <button onClick={()=>{stopScanner();setStatus('idle');}} style={{width:'100%',padding:'10px 24px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'100px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>✕ Anulează</button>
        </div>
      )}

      {status==='loading'&&(
        <div style={{textAlign:'center',padding:'32px'}}>
          <div style={{display:'flex',justifyContent:'center',gap:'6px',marginBottom:'12px'}}>{[0,1,2].map(i=><div key={i} style={{width:'10px',height:'10px',borderRadius:'50%',background:'#f97316',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>
          <div style={{fontSize:'13px',color:theme.text3}}>Se caută produsul...</div>
        </div>
      )}

      {status==='error'&&(
        <div style={{textAlign:'center',padding:'20px'}}>
          <div style={{fontSize:'40px',marginBottom:'10px'}}>😕</div>
          <div style={{fontSize:'14px',color:'#ef4444',marginBottom:'16px'}}>{errorMsg}</div>
          <div style={{display:'flex',gap:'8px',justifyContent:'center',marginBottom:'12px'}}>
            <input value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Introdu codul manual" type="number" style={{flex:1,maxWidth:'220px',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px 12px',color:theme.text,fontSize:'15px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
            <button onClick={()=>manualCode&&lookupBarcode(manualCode)} disabled={!manualCode} style={{padding:'10px 16px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>→</button>
          </div>
          <button onClick={()=>{setStatus('idle');setErrorMsg('');}} style={{padding:'8px 20px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'13px',cursor:'pointer'}}>← Înapoi</button>
        </div>
      )}

      {status==='found'&&product&&(
        <div>
          <div style={{display:'flex',gap:'12px',alignItems:'flex-start',padding:'14px',background:theme.surface,borderRadius:'14px',border:`1px solid ${theme.border}`,marginBottom:'14px'}}>
            {product.img&&<img src={product.img} alt="" style={{width:'60px',height:'60px',objectFit:'contain',borderRadius:'8px',background:'#fff',flexShrink:0}}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'15px',fontWeight:700,color:theme.text,marginBottom:'2px',lineHeight:1.3}}>{product.name}</div>
              {product.brand&&<div style={{fontSize:'12px',color:theme.text3,marginBottom:'6px'}}>{product.brand}</div>}
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {[{l:'KCAL',v:product.kcal,c:'#f97316'},{l:'P',v:`${product.p}g`,c:'#8b5cf6'},{l:'C',v:`${product.c}g`,c:'#3b82f6'},{l:'G',v:`${product.f}g`,c:'#10b981'}].map(x=><span key={x.l} style={{fontSize:'11px',fontWeight:700,color:x.c}}>{x.l}: {x.v}</span>)}
                <span style={{fontSize:'11px',color:theme.text4}}>/ 100g</span>
              </div>
            </div>
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em',marginBottom:'8px'}}>CANTITATE (g)</div>
            <div style={{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}}>
              {[30,50,100,150,200,250,300].map(q=><button key={q} onClick={()=>setQty(String(q))} style={{padding:'7px 12px',borderRadius:'8px',border:`1.5px solid ${qty===String(q)?'#f97316':theme.softBorder}`,background:qty===String(q)?'rgba(249,115,22,0.12)':theme.surface,color:qty===String(q)?'#f97316':theme.text3,fontSize:'13px',fontWeight:700,cursor:'pointer'}}>{q}</button>)}
            </div>
            <input type="number" value={qty} onChange={e=>setQty(e.target.value)} style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px',color:theme.text,fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
            {[{l:'KCAL',v:m.kcal,c:'#f97316'},{l:'PROT',v:`${m.p}g`,c:'#8b5cf6'},{l:'CARBS',v:`${m.c}g`,c:'#3b82f6'},{l:'GRĂS',v:`${m.f}g`,c:'#10b981'}].map(x=><div key={x.l} style={{background:`${x.c}12`,border:`1px solid ${x.c}30`,borderRadius:'10px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'9px',color:theme.text3,marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'16px',fontWeight:800,color:x.c}}>{x.v}</div></div>)}
          </div>
          <button onClick={()=>onResult(product,parseFloat(qty)||100)} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'14px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.08em',textTransform:'uppercase',boxShadow:'0 4px 20px rgba(249,115,22,0.3)'}}>
            ◆ ADAUGĂ ({m.kcal} kcal)
          </button>
          <button onClick={()=>{setStatus('idle');setProduct(null);}} style={{width:'100%',marginTop:'8px',padding:'10px',background:'transparent',border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'13px',cursor:'pointer'}}>← Scanează alt produs</button>
        </div>
      )}
    </div>
  );
}

// ─── FOOD PICKER ──────────────────────────────────────────────────────────────
function FoodPicker({onSend,onClose,theme=THEMES.dark}){
  const [cat,setCat]=useState('all'),[quantities,setQuantities]=useState({});
  const [activeTab,setActiveTab]=useState('alimente');
  const [templates,setTemplates]=useState(ls(KEYS.templates,DEFAULT_TEMPLATES));
  const [newTplName,setNewTplName]=useState('');
  const [recipes,setRecipes]=useState(()=>ls('mp_recipes_v1',[]));
  const [recipeForm,setRecipeForm]=useState({show:false,name:'',icon:'🍳',ingredients:[]});
  const [recipeIngName,setRecipeIngName]=useState('');
  const [recipeIngQty,setRecipeIngQty]=useState('');
  const [recipeIngFood,setRecipeIngFood]=useState(FOODS[0].id);
  const filtered=cat==='all'?FOODS:FOODS.filter(f=>f.cat===cat);
  const setQty=(id,val)=>setQuantities(q=>({...q,[id]:val}));
  const totals=Object.entries(quantities).reduce((acc,[id,qty])=>{if(!qty||isNaN(qty)||qty<=0)return acc;const food=FOODS.find(f=>f.id===id);if(!food)return acc;const m=calcMacros(food,parseFloat(qty));return{kcal:acc.kcal+m.kcal,p:acc.p+m.p,c:acc.c+m.c,fat:acc.fat+m.fat,fiber:acc.fiber+(m.fiber||0)};},{kcal:0,p:0,c:0,fat:0,fiber:0});
  const hasItems=Object.values(quantities).some(q=>q&&parseFloat(q)>0);
  const handleSend=()=>{const items=Object.entries(quantities).filter(([,q])=>q&&parseFloat(q)>0).map(([id,q])=>{const food=FOODS.find(f=>f.id===id);return`${food.name} ${q}${food.unit}`;});if(!items.length)return;onSend(`Masă: ${items.join(', ')} — ${totals.kcal} kcal, P:${totals.p}g, C:${totals.c}g, G:${totals.fat}g, Fibre:${totals.fiber}g`);onClose();};
  const sendTemplate=tpl=>{const items=tpl.items.map(i=>{const food=FOODS.find(f=>f.id===i.id);return food?`${food.name} ${i.qty}${food.unit}`:null;}).filter(Boolean);onSend(`Masă: ${items.join(', ')} (${tpl.name})`);onClose();};
  const saveAsTpl=()=>{if(!newTplName.trim()||!hasItems)return;const items=Object.entries(quantities).filter(([,q])=>q&&parseFloat(q)>0).map(([id,q])=>({id,qty:parseFloat(q)}));const upd=[...templates,{id:`tpl_${Date.now()}`,name:newTplName,icon:'⭐',items}];setTemplates(upd);lsSet(KEYS.templates,upd);setNewTplName('');};
  const delTpl=id=>{const upd=templates.filter(t=>t.id!==id);setTemplates(upd);lsSet(KEYS.templates,upd);};

  const calcRecipeMacros=(ingredients)=>ingredients.reduce((acc,ing)=>{
    const food=FOODS.find(f=>f.id===ing.foodId);if(!food)return acc;
    const m=calcMacros(food,parseFloat(ing.qty)||0);
    return{kcal:acc.kcal+m.kcal,p:acc.p+m.p,c:acc.c+m.c,fat:acc.fat+m.fat};
  },{kcal:0,p:0,c:0,fat:0});

  const addRecipeIng=()=>{
    if(!recipeIngQty||parseFloat(recipeIngQty)<=0)return;
    const food=FOODS.find(f=>f.id===recipeIngFood);
    setRecipeForm(rf=>({...rf,ingredients:[...rf.ingredients,{foodId:recipeIngFood,name:food.name,qty:parseFloat(recipeIngQty),unit:food.unit}]}));
    setRecipeIngQty('');
  };

  const saveRecipe=()=>{
    if(!recipeForm.name.trim()||!recipeForm.ingredients.length)return;
    const macros=calcRecipeMacros(recipeForm.ingredients);
    const newR={id:`rec_${Date.now()}`,name:recipeForm.name,icon:recipeForm.icon,ingredients:recipeForm.ingredients,macros};
    const upd=[...recipes,newR];setRecipes(upd);lsSet('mp_recipes_v1',upd);
    setRecipeForm({show:false,name:'',icon:'🍳',ingredients:[]});
  };

  const sendRecipe=(recipe)=>{
    const m=recipe.macros;
    onSend(`Masă: ${recipe.name} — ${m.kcal} kcal, P:${m.p}g, C:${m.c}g, G:${m.fat}g`);
    onClose();
  };

  const delRecipe=(id)=>{const upd=recipes.filter(r=>r.id!==id);setRecipes(upd);lsSet('mp_recipes_v1',upd);};

  const handleBarcodeResult=(product,qty)=>{
    const qf=qty/100;
    const name=`${product.name}${product.brand?` (${product.brand})`:''} ${qty}g`;
    onSend(`Masă: ${name} — ${Math.round(product.kcal*qf)} kcal, P:${Math.round(product.p*qf*10)/10}g, C:${Math.round(product.c*qf*10)/10}g, G:${Math.round(product.f*qf*10)/10}g`);
    onClose();
  };

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:theme.bg2,borderRadius:'24px 24px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column',border:`1px solid ${theme.border}`,borderBottom:'none'}}>
        <div style={{padding:'14px 18px 0',flexShrink:0,background:theme.bg2}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'18px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>🍽 ADAUGĂ MASĂ</div>
            <button onClick={onClose} style={{background:theme.surface2,border:'none',borderRadius:'10px',color:theme.text3,padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>✕</button>
          </div>
          <div style={{display:'flex',borderBottom:`1px solid ${theme.border}`}}>
            {[{id:'scanare',label:'📷'},{id:'retete',label:'👨‍🍳'},{id:'alimente',label:'🍙'},{id:'templates',label:'⭐'}].map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:'8px',fontSize:'16px',fontWeight:700,cursor:'pointer',border:'none',background:'transparent',color:activeTab===t.id?'#f97316':theme.text3,borderBottom:`2px solid ${activeTab===t.id?'#f97316':'transparent'}`}}>{t.label}</button>)}
          </div>
        </div>
        {activeTab==='scanare'&&<BarcodeScanner onResult={handleBarcodeResult} theme={theme}/>}
        {activeTab==='retete'&&(
          <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
            {!recipeForm.show&&(
              <button onClick={()=>setRecipeForm(rf=>({...rf,show:true}))} style={{padding:'12px',background:'rgba(249,115,22,0.1)',border:'1px dashed rgba(249,115,22,0.4)',borderRadius:'12px',color:'#f97316',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>+ REȚETĂ NOUĂ</button>
            )}
            {recipeForm.show&&(
              <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
                <div style={{display:'flex',gap:'8px'}}>
                  <select value={recipeForm.icon} onChange={e=>setRecipeForm(rf=>({...rf,icon:e.target.value}))} style={{background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px',color:theme.text,fontSize:'18px',outline:'none'}}>
                    {['🍳','🥗','🍲','🥩','🐟','🥚','🥣','🫕','🍱','🥙'].map(ic=><option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input value={recipeForm.name} onChange={e=>setRecipeForm(rf=>({...rf,name:e.target.value}))} placeholder="Numele rețetei..." style={{flex:1,background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em'}}>INGREDIENTE</div>
                {recipeForm.ingredients.map((ing,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:theme.surface2,borderRadius:'8px'}}>
                    <span style={{fontSize:'13px',color:theme.text2}}>{ing.name} — {ing.qty}{ing.unit}</span>
                    <button onClick={()=>setRecipeForm(rf=>({...rf,ingredients:rf.ingredients.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',color:theme.text4,cursor:'pointer',fontSize:'16px'}}>×</button>
                  </div>
                ))}
                <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:'6px',alignItems:'center'}}>
                  <select value={recipeIngFood} onChange={e=>setRecipeIngFood(e.target.value)} style={{background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px',color:theme.text,fontSize:'13px',outline:'none',fontFamily:"'Inter',sans-serif"}}>
                    {FOODS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input type="number" value={recipeIngQty} onChange={e=>setRecipeIngQty(e.target.value)} placeholder="qty" style={{width:'60px',background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px',color:theme.text,fontSize:'13px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
                  <button onClick={addRecipeIng} style={{padding:'8px 12px',background:'rgba(249,115,22,0.15)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'8px',color:'#f97316',fontWeight:700,cursor:'pointer',fontSize:'14px'}}>+</button>
                </div>
                {recipeForm.ingredients.length>0&&(
                  <div style={{padding:'8px 12px',background:'rgba(249,115,22,0.06)',borderRadius:'10px',fontSize:'12px',color:theme.text3}}>
                    {(()=>{const m=calcRecipeMacros(recipeForm.ingredients);return`Total: ${m.kcal} kcal · P:${m.p}g · C:${m.c}g · G:${m.fat}g`;})()}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <button onClick={()=>setRecipeForm({show:false,name:'',icon:'🍳',ingredients:[]})} style={{padding:'10px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Anulează</button>
                  <button onClick={saveRecipe} disabled={!recipeForm.name.trim()||!recipeForm.ingredients.length} style={{padding:'10px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>SALVEAZĂ ◆</button>
                </div>
              </div>
            )}
            {recipes.length===0&&!recipeForm.show&&(
              <div style={{textAlign:'center',padding:'24px',color:theme.text3,fontSize:'13px'}}>
                <div style={{fontSize:'32px',marginBottom:'8px'}}>👨‍🍳</div>
                <div style={{fontWeight:600,color:theme.text2,marginBottom:'4px'}}>Nicio rețetă salvată</div>
                <div>Creează prima ta rețetă cu macros calculate automat!</div>
              </div>
            )}
            {recipes.map(r=>(
              <div key={r.id} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'14px',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{fontSize:'28px',flexShrink:0}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:theme.text,marginBottom:'4px'}}>{r.name}</div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {[{l:'kcal',v:r.macros.kcal,c:'#f97316'},{l:'P',v:`${r.macros.p}g`,c:'#8b5cf6'},{l:'C',v:`${r.macros.c}g`,c:'#3b82f6'},{l:'G',v:`${r.macros.fat}g`,c:'#10b981'}].map(x=><span key={x.l} style={{fontSize:'12px',fontWeight:700,color:x.c}}>{x.v} {x.l}</span>)}
                  </div>
                </div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>sendRecipe(r)} style={{padding:'8px 14px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>◆</button>
                  <button onClick={()=>delRecipe(r.id)} style={{padding:'8px 10px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',fontSize:'13px',cursor:'pointer'}}>×</button>
                </div>
              </div>
            ))}
            <div style={{height:'16px'}}/>
          </div>
        )}
        {activeTab==='alimente'&&<>
          <div style={{display:'flex',gap:'6px',padding:'10px 16px',overflowX:'auto',flexShrink:0}}>
            {FOOD_CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Inter',sans-serif",borderColor:cat===c.id?'#f97316':theme.softBorder,background:cat===c.id?'rgba(249,115,22,0.12)':'transparent',color:cat===c.id?'#f97316':theme.text3}}>{c.label}</button>)}
          </div>
          <div style={{overflowY:'auto',flex:1,padding:'0 16px'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead style={{position:'sticky',top:0,background:theme.bg2,zIndex:2}}><tr>{['ALIMENT','CANT.','MACRO'].map((h,i)=><th key={i} style={{textAlign:i===2?'right':i===1?'center':'left',padding:'8px '+(i===1?'6px':'0'),fontSize:'11px',color:theme.text4,fontWeight:700,letterSpacing:'0.08em',borderBottom:`1px solid ${theme.border}`,width:i===1?'80px':i===2?'90px':'auto'}}>{h}</th>)}</tr></thead>
              <tbody>{filtered.map(food=>{const qty=quantities[food.id]||'';const m=qty&&parseFloat(qty)>0?calcMacros(food,parseFloat(qty)):null;const active=!!(qty&&parseFloat(qty)>0);return(<tr key={food.id} style={{borderBottom:`1px solid ${theme.border}`,background:active?'rgba(249,115,22,0.04)':'transparent'}}><td style={{padding:'10px 0'}}><div style={{fontSize:'15px',fontWeight:600,color:active?'#f97316':theme.text2}}>{food.emoji} {food.name}</div><div style={{fontSize:'11px',color:theme.text4,marginTop:'1px'}}>{food.kcal} kcal · {food.p}g P / 100{food.unit==='buc'||food.unit==='felie'?'g':food.unit}</div></td><td style={{padding:'10px 6px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}><input type="number" value={qty} onChange={e=>setQty(food.id,e.target.value)} placeholder="0" style={{width:'52px',background:theme.surface2,border:`1.5px solid ${active?'rgba(249,115,22,0.4)':theme.softBorder}`,borderRadius:'8px',padding:'6px 8px',color:theme.text,fontSize:'15px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/><span style={{fontSize:'11px',color:theme.text3}}>{food.unit}</span></div></td><td style={{padding:'10px 0',textAlign:'right'}}>{m?<div><div style={{fontSize:'14px',fontWeight:700,color:'#f97316'}}>{m.kcal} kcal</div><div style={{fontSize:'11px',color:theme.text3}}>{m.p}P</div></div>:<div style={{fontSize:'11px',color:theme.text4}}>—</div>}</td></tr>);})}</tbody>
            </table>
          </div>
          <div style={{padding:'12px 16px',borderTop:`1px solid ${theme.border}`,flexShrink:0}}>
            {hasItems&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'10px'}}>{[{l:'KCAL',v:totals.kcal,c:'#f97316'},{l:'PROT',v:`${totals.p}g`,c:'#8b5cf6'},{l:'CARBS',v:`${totals.c}g`,c:'#3b82f6'},{l:'GR',v:`${totals.fat}g`,c:'#10b981'}].map(x=><div key={x.l} style={{background:theme.surface,borderRadius:'10px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'10px',color:theme.text3,marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'16px',fontWeight:800,color:x.c}}>{x.v}</div></div>)}</div>}
            {hasItems&&<div style={{display:'flex',gap:'8px',marginBottom:'8px'}}><input value={newTplName} onChange={e=>setNewTplName(e.target.value)} placeholder="Salvează ca template..." style={{flex:1,background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'10px',padding:'8px 12px',color:theme.text,fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/><button onClick={saveAsTpl} disabled={!newTplName.trim()} style={{padding:'8px 14px',background:newTplName.trim()?'rgba(251,191,36,0.15)':theme.surface,border:`1px solid ${newTplName.trim()?'rgba(251,191,36,0.3)':theme.softBorder}`,borderRadius:'10px',color:newTplName.trim()?'#fbbf24':theme.text4,fontSize:'13px',fontWeight:700,cursor:newTplName.trim()?'pointer':'not-allowed'}}>⭐</button></div>}
            <button onClick={handleSend} disabled={!hasItems} style={{width:'100%',padding:'14px',background:hasItems?'linear-gradient(135deg,#f97316,#ef4444)':theme.surface2,border:'none',borderRadius:'14px',color:hasItems?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:hasItems?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.08em',textTransform:'uppercase',transition:'all 0.2s'}}>
              {hasItems?`◆ TRIMITE MASA (${totals.kcal} kcal)`:'Introduceți cantitățile'}
            </button>
          </div>
        </>
        }
        {activeTab==='templates'&&<div style={{overflowY:'auto',flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
          {templates.map(tpl=>{const m=calcTemplateMacros(tpl.items);return(<div key={tpl.id} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'14px',display:'flex',alignItems:'center',gap:'12px'}}><div style={{fontSize:'28px',flexShrink:0}}>{tpl.icon}</div><div style={{flex:1}}><div style={{fontSize:'15px',fontWeight:700,color:theme.text,marginBottom:'4px'}}>{tpl.name}</div><div style={{display:'flex',gap:'10px'}}><span style={{fontSize:'12px',color:'#f97316',fontWeight:600}}>{m.kcal} kcal</span><span style={{fontSize:'12px',color:'#8b5cf6'}}>{m.p}g prot</span></div></div><div style={{display:'flex',gap:'6px'}}><button onClick={()=>sendTemplate(tpl)} style={{padding:'8px 16px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>◆</button>{!DEFAULT_TEMPLATES.find(d=>d.id===tpl.id)&&<button onClick={()=>delTpl(tpl.id)} style={{padding:'8px 10px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',fontSize:'13px',cursor:'pointer'}}>×</button>}</div></div>);})}
          <div style={{height:'20px'}}/>
        </div>}
      </div>
    </div>
  );
}

// ─── MACRO BAR ────────────────────────────────────────────────────────────────
function MacroBar({stats,dayType,theme=THEMES.dark}){
  const currentDay=DAY_TYPES.find(d=>d.val===dayType);
  const todayData=stats.daily?.[todayKey()]||{};
  const cal=todayData.calories||0,prot=todayData.protein||0;
  const fiber=todayData.fiber||0;
  const calTarget=currentDay?.calTarget||2000,protTarget=currentDay?.protTarget||165;
  // Ciclu carbs: antrenament=carbs mari, repaus=carbs mici
  const carbsTarget=dayType==='antrenament'?220:dayType==='repaus'?130:175;
  const carbs=todayData.carbs||0;
  const calPct=Math.min(100,Math.round((cal/calTarget)*100));
  const protPct=Math.min(100,Math.round((prot/protTarget)*100));
  const carbsPct=Math.min(100,Math.round((carbs/carbsTarget)*100));
  const fiberPct=Math.min(100,Math.round((fiber/30)*100));
  const calColor=calPct>105?'#ef4444':calPct>90?'#4ade80':'#3b82f6';
  const protColor=protPct>=100?'#4ade80':protPct>75?'#f97316':'#ef4444';
  const carbsColor=carbsPct>105?'#ef4444':carbsPct>90?'#4ade80':'#f59e0b';
  const fiberColor=fiberPct>=100?'#4ade80':fiberPct>60?'#f97316':'#8b5cf6';
  if(!cal&&!prot)return null;
  const bars=[
    {label:'CALORII',current:cal,target:calTarget,color:calColor,unit:''},
    {label:'PROTEINE',current:prot,target:protTarget,color:protColor,unit:'g'},
    {label:`CARBS ${dayType==='antrenament'?'↑':dayType==='repaus'?'↓':''}`,current:carbs,target:carbsTarget,color:carbsColor,unit:'g'},
    {label:'FIBRE',current:fiber,target:30,color:fiberColor,unit:'g'},
  ];
  return(
    <div style={{background:theme.bg2,borderBottom:`1px solid ${theme.border}`,padding:'8px 16px',display:'flex',gap:'10px',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
      {bars.map(({label,current,target,color,unit})=>(
        <div key={label} style={{flex:'1 1 80px',minWidth:'70px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
            <span style={{fontSize:'9px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em'}}>{label}</span>
            <span style={{fontSize:'10px',fontWeight:700,color}}>{current}{unit}/{target}{unit}</span>
          </div>
          <div style={{height:'4px',background:theme.surface2,borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Math.min(100,Math.round((current/target)*100))}%`,background:color,borderRadius:'2px',transition:'width 0.5s ease'}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function StreakBadge({stats}){
  const streak=calcStreak(stats);
  if(!streak)return null;
  const isHot=streak>=7;
  return(
    <div style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 12px',
      background:isHot?'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(249,115,22,0.15))':'rgba(251,191,36,0.1)',
      border:`1px solid ${isHot?'rgba(251,191,36,0.4)':'rgba(251,191,36,0.2)'}`,
      borderRadius:'100px',fontWeight:800,color:'#fbbf24',whiteSpace:'nowrap',
      boxShadow:isHot?'0 0 12px rgba(251,191,36,0.25)':'none',
      animation:isHot?'pulseBadge 2s ease-in-out infinite':'none'}}>
      <span style={{fontSize:'16px'}}>{isHot?'🔥':'⚡'}</span>
      <span style={{fontSize:'13px',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em'}}>{streak}</span>
      <span style={{fontSize:'10px',opacity:0.7}}>zile</span>
    </div>
  );
}

function CalendarPicker({selectedDate,onSelect,stats,workouts,theme=THEMES.dark}){
  const [vd,setVd]=useState(new Date());
  const year=vd.getFullYear(),month=vd.getMonth();
  const fd=new Date(year,month,1).getDay(),dim=new Date(year,month+1,0).getDate(),today=new Date();
  const k=day=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const hasData=day=>{const key=k(day);return stats.weight?.[key]||stats.daily?.[key]||(workouts.days?.[key]&&(workouts.days[key].exercises?.length||workouts.days[key].cardio?.length));};
  const hasW=day=>{const key=k(day);return workouts.days?.[key]&&(workouts.days[key].exercises?.length||workouts.days[key].cardio?.length);};
  const isSel=day=>k(day)===selectedDate;
  const isToday=day=>day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
  const cells=[];for(let i=0;i<fd;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  return(<div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'14px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}><button onClick={()=>setVd(new Date(year,month-1,1))} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'8px',color:theme.text2,padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>‹</button><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'17px',color:theme.text}}>{RO_MONTHS[month]} {year}</span><button onClick={()=>setVd(new Date(year,month+1,1))} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'8px',color:theme.text2,padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>›</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px',marginBottom:'6px'}}>{RO_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,color:theme.text4,padding:'3px 0'}}>{d}</div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>{cells.map((day,idx)=><div key={idx} onClick={()=>{if(!day)return;onSelect(k(day));}} style={{textAlign:'center',padding:'7px 2px',borderRadius:'9px',fontSize:'14px',fontWeight:600,cursor:day?'pointer':'default',background:isSel(day)?'linear-gradient(135deg,#f97316,#ef4444)':isToday(day)?'rgba(249,115,22,0.1)':hasData(day)?theme.surface:'transparent',color:isSel(day)?'#fff':isToday(day)?'#f97316':day?theme.text2:'transparent',border:isToday(day)&&!isSel(day)?'1px solid rgba(249,115,22,0.3)':'1px solid transparent',position:'relative',transition:'all 0.15s'}}>{day||''}{day&&hasData(day)&&!isSel(day)&&<div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'3px',height:'3px',borderRadius:'50%',background:hasW(day)?'#8b5cf6':'#f97316'}}/>}</div>)}</div></div>);
}

function MuscleVolumeChart({workouts,theme=THEMES.dark}){
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return localDateKey(d);});
  const vol={};MUSCLE_GROUPS.forEach(g=>{vol[g.id]=0;});
  last7.forEach(date=>{const day=workouts.days?.[date];if(!day?.exercises)return;day.exercises.forEach(ex=>{if(vol[ex.group]!==undefined)vol[ex.group]+=ex.sets?.length||0;});});
  const maxS=Math.max(1,...Object.values(vol)),totalS=Object.values(vol).reduce((a,b)=>a+b,0);
  if(!totalS)return null;
  return(<div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'16px'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:theme.text2,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'14px'}}>💪 VOLUM / GRUPĂ (7 zile)</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{MUSCLE_GROUPS.map(g=>{const sets=vol[g.id]||0,pct=Math.round((sets/maxS)*100),warn=sets<4&&totalS>8;return(<div key={g.id}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}><span style={{fontSize:'12px',color:warn?'#ef4444':theme.text2,fontWeight:600}}>{g.icon} {g.label}{warn?' ⚠️':''}</span><span style={{fontSize:'12px',fontWeight:700,color:g.color}}>{sets} seturi</span></div><div style={{height:'6px',background:theme.surface2,borderRadius:'3px',overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:g.color,borderRadius:'3px',transition:'width 0.5s ease',opacity:sets===0?0.2:1}}/></div></div>);})}</div></div>);
}

function PatternPanel({stats,workouts,theme=THEMES.dark}){
  const [report,setReport]=useState(null),[loading,setLoading]=useState(false),[lastRun,setLastRun]=useState(null),[expanded,setExpanded]=useState(false);
  useEffect(()=>{try{const s=localStorage.getItem(KEYS.pattern);if(s){const d=JSON.parse(s);setReport(d.report);setLastRun(d.date);const days=(Date.now()-new Date(d.date).getTime())/(1000*60*60*24);if(days>=7)run(true);}else run(true);}catch{}},[])
  function run(silent=false){const ld=Object.keys(stats.daily||{}).length;if(ld<3)return;if(!silent)setExpanded(true);setLoading(true);const w=Object.entries(stats.weight||{}).slice(-14),d=Object.entries(stats.daily||{}).slice(-14),days=Object.entries(workouts.days||{}).slice(-14);callCoach([{role:'user',content:`Analizează datele: greutate ${JSON.stringify(w)}, nutriție ${JSON.stringify(d)}, antrenamente ${JSON.stringify(days)}. Profil: 45ani/188cm/96→88kg. Analiză: 1.TREND 2.CONSISTENȚĂ 3.CORELAȚII 4.PUNCTE SLABE 5.RECOMANDĂRI. Direct, română.`}],1500).then(text=>{const now=new Date().toISOString();setReport(text);setLastRun(now);setExpanded(true);lsSet(KEYS.pattern,{report:text,date:now});}).catch(()=>setReport('⚠️ Eroare.')).finally(()=>setLoading(false));}
  const ld=Object.keys(stats.daily||{}).length;
  return(<div style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'16px',overflow:'hidden'}}><div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}><div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',background:'linear-gradient(90deg,#8b5cf6,#ec4899)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'0.05em'}}>🧠 PATTERN DETECTION</div><div style={{fontSize:'11px',color:theme.text3,marginTop:'2px'}}>{lastRun?`Ultima: ${new Date(lastRun).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}`:ld>=3?'Date disponibile':`Necesare ${3-ld} zile în plus`}</div></div><div style={{display:'flex',gap:'8px'}}>{ld>=3&&<button onClick={e=>{e.stopPropagation();run();}} disabled={loading} style={{padding:'7px 14px',background:loading?'rgba(139,92,246,0.1)':'linear-gradient(135deg,#8b5cf6,#ec4899)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:"'Barlow Condensed',sans-serif",opacity:loading?0.6:1}}>{loading?'⟳':'◆ ANALIZEAZĂ'}</button>}<span style={{color:theme.text3,fontSize:'18px'}}>{expanded?'↑':'↓'}</span></div></div>{expanded&&<div style={{borderTop:'1px solid rgba(139,92,246,0.15)',padding:'16px'}}>{loading&&<div style={{display:'flex',justifyContent:'center',padding:'16px',gap:'6px'}}>{[0,1,2].map(i=><div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#8b5cf6',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>}{!loading&&report&&<div>{renderMarkdown(report,theme)}</div>}{!loading&&!report&&<div style={{textAlign:'center',color:theme.text4,fontSize:'13px',padding:'16px'}}>Loghează min. 3 zile pentru analiză.</div>}</div>}</div>);
}

function WeeklyReport({stats,workouts,theme=THEMES.dark}){
  const [report,setReport]=useState(ls(KEYS.weekly,null)),[loading,setLoading]=useState(false),[expanded,setExpanded]=useState(false);
  useEffect(()=>{const day=new Date().getDay(),lr=report?.date,lrd=lr?new Date(lr).getDay():null;if(day===1&&lrd!==1&&Object.keys(stats.daily||{}).length>=3)run();},[]);
  function run(){setLoading(true);setExpanded(true);const keys=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return localDateKey(d);}).reverse();const wn=keys.map(k=>stats.daily?.[k]).filter(Boolean);const avgCal=wn.length?Math.round(wn.reduce((a,d)=>a+(d.calories||0),0)/wn.length):0;const avgProt=wn.length?Math.round(wn.reduce((a,d)=>a+(d.protein||0),0)/wn.length):0;callCoach([{role:'user',content:`Raport săptămânal Mihai: ${wn.length}/7 zile logate, calorii medii ${avgCal}, proteine medii ${avgProt}g. Profil: 45ani/188cm/96kg→88kg. Concis, emoji, max 200 cuvinte, română.`}],600).then(text=>{const r={text,date:new Date().toISOString()};setReport(r);lsSet(KEYS.weekly,r);}).catch(()=>setReport({text:'⚠️ Eroare.',date:new Date().toISOString()})).finally(()=>setLoading(false));}
  return(<div style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.18)',borderRadius:'16px',overflow:'hidden'}}><div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}><div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',color:'#10b981',letterSpacing:'0.05em'}}>📅 RAPORT SĂPTĂMÂNAL</div><div style={{fontSize:'11px',color:theme.text3,marginTop:'2px'}}>{report?.date?new Date(report.date).toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'short'}):'Auto-generat luni'}</div></div><div style={{display:'flex',gap:'8px'}}><button onClick={e=>{e.stopPropagation();run();}} disabled={loading} style={{padding:'7px 14px',background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'10px',color:'#10b981',fontSize:'13px',fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:"'Barlow Condensed',sans-serif",opacity:loading?0.6:1}}>{loading?'⟳':'◆'}</button><span style={{color:theme.text3,fontSize:'18px'}}>{expanded?'↑':'↓'}</span></div></div>{expanded&&<div style={{borderTop:'1px solid rgba(16,185,129,0.12)',padding:'16px'}}>{loading&&<div style={{display:'flex',justifyContent:'center',gap:'6px',padding:'16px'}}>{[0,1,2].map(i=><div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>}{!loading&&report&&<div>{renderMarkdown(report.text,theme)}</div>}</div>}</div>);
}

// ─── SUPPLEMENT REMINDER ─────────────────────────────────────────────────────
const SUPLIMENTE_DEFAULT = [
  {id:'creatina',   name:'Creatină',        emoji:'💊', ora:'08:00', zile:[1,2,3,4,5,6,7]},
  {id:'omega3',     name:'Omega-3',         emoji:'🐟', ora:'13:00', zile:[1,2,3,4,5,6,7]},
  {id:'d3',         name:'Vitamina D3',     emoji:'☀️', ora:'08:00', zile:[1,2,3,4,5,6,7]},
  {id:'mg',         name:'Mg Bisglicinat',  emoji:'🌙', ora:'21:00', zile:[1,2,3,4,5,6,7]},
  {id:'zinc',       name:'Zinc',            emoji:'⚡', ora:'08:00', zile:[1,2,3,4,5,6,7]},
  {id:'coq10',      name:'CoQ10',           emoji:'❤️', ora:'08:00', zile:[1,2,3,4,5,6,7]},
  {id:'citrul',     name:'Citrulină malat', emoji:'🏋', ora:'17:00', zile:[1,3,5]},
  {id:'carnitina',  name:'L-Carnitină',     emoji:'🔥', ora:'07:30', zile:[1,2,3,4,5,6,7]},
];

function SupplementTracker({theme=THEMES.dark}){
  const todayKey2=todayKey();
  const [suplimente,setSuplimente]=useState(()=>ls('mp_suplimente_v1',SUPLIMENTE_DEFAULT));
  const [taken,setTaken]=useState(()=>ls('mp_supl_taken_v1',{}));
  const todayTaken=taken[todayKey2]||{};
  const todayDow=new Date().getDay()||7; // 1=luni...7=duminică

  const toggleTaken=(id)=>{
    const newTaken={...taken};
    if(!newTaken[todayKey2])newTaken[todayKey2]={};
    newTaken[todayKey2][id]=!newTaken[todayKey2][id];
    setTaken(newTaken);
    lsSet('mp_supl_taken_v1',newTaken);
  };

  const todaySupl=suplimente.filter(s=>s.zile.includes(todayDow));
  const takenCount=todaySupl.filter(s=>todayTaken[s.id]).length;
  const pct=todaySupl.length?Math.round((takenCount/todaySupl.length)*100):0;

  // Grupează pe ore
  const byOra={};
  todaySupl.forEach(s=>{if(!byOra[s.ora])byOra[s.ora]=[];byOra[s.ora].push(s);});
  const sortedOre=Object.keys(byOra).sort();

  return(
    <div style={{background:'rgba(139,92,246,0.05)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#8b5cf6',letterSpacing:'0.05em'}}>💊 SUPLIMENTE AZI</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'13px',fontWeight:700,color:pct===100?'#4ade80':'#8b5cf6'}}>{takenCount}/{todaySupl.length}</span>
          <div style={{width:'60px',height:'6px',background:'rgba(139,92,246,0.2)',borderRadius:'3px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:pct===100?'#4ade80':'#8b5cf6',borderRadius:'3px',transition:'width 0.3s'}}/>
          </div>
        </div>
      </div>
      {sortedOre.map(ora=>(
        <div key={ora} style={{marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:'#8b5cf6',fontWeight:700,marginBottom:'6px',letterSpacing:'0.08em'}}>⏰ {ora}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {byOra[ora].map(s=>(
              <button key={s.id} onClick={()=>toggleTaken(s.id)}
                style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',borderRadius:'100px',
                  border:`1.5px solid ${todayTaken[s.id]?'#4ade80':'rgba(139,92,246,0.3)'}`,
                  background:todayTaken[s.id]?'rgba(74,222,128,0.12)':'transparent',
                  color:todayTaken[s.id]?'#4ade80':'#8b5cf6',
                  fontSize:'13px',fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                <span>{s.emoji}</span>
                <span>{s.name}</span>
                {todayTaken[s.id]&&<span>✓</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {pct===100&&<div style={{textAlign:'center',padding:'8px',background:'rgba(74,222,128,0.1)',borderRadius:'10px',color:'#4ade80',fontWeight:700,fontSize:'13px'}}>✅ Toate suplimentele luate azi!</div>}
    </div>
  );
}

// ─── WORKOUT PLAN ─────────────────────────────────────────────────────────────
const PLAN_DEFAULT = {
  name: 'Plan 5 zile Split',
  zile: [
    {zi:'Luni',    focus:'Piept + Triceps', exercitii:['bench','incline','flyes','skullcr','tricepext']},
    {zi:'Marți',   focus:'Spate + Biceps',  exercitii:['deadlift','rows','pulldown','curl','hammer']},
    {zi:'Miercuri',focus:'Cardio + Core',   exercitii:[]},
    {zi:'Joi',     focus:'Umeri + Triceps', exercitii:['ohpress','laterals','frontrise','dipstric','tricepext']},
    {zi:'Vineri',  focus:'Picioare',        exercitii:['squat','legpress','rdl','legcurl','calf']},
    {zi:'Sâmbătă', focus:'Fullbody',        exercitii:['bench','rows','squat','ohpress','curl']},
    {zi:'Duminică',focus:'Repaus',          exercitii:[]},
  ]
};

function WorkoutPlan({theme=THEMES.dark}){
  const [plan]=useState(()=>ls('mp_workout_plan_v1',PLAN_DEFAULT));
  const todayDow=(new Date().getDay()+6)%7; // 0=luni...6=duminica
  const allEx=Object.values(EXERCISES).flat();

  return(
    <div style={{background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#3b82f6',letterSpacing:'0.05em',marginBottom:'12px'}}>📅 PLAN SĂPTĂMÂNAL — {plan.name}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {plan.zile.map((z,i)=>{
          const isToday=i===todayDow;
          const exNames=z.exercitii.map(id=>allEx.find(e=>e.id===id)?.name).filter(Boolean);
          return(
            <div key={i} style={{padding:'10px 14px',borderRadius:'12px',
              background:isToday?'rgba(59,130,246,0.1)':theme.surface,
              border:`1.5px solid ${isToday?'#3b82f6':theme.border}`,
              transition:'all 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:exNames.length?'6px':'0'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  {isToday&&<span style={{fontSize:'10px',padding:'2px 6px',background:'#3b82f6',color:'#fff',borderRadius:'4px',fontWeight:700}}>AZI</span>}
                  <span style={{fontWeight:700,color:isToday?'#3b82f6':theme.text,fontSize:'14px'}}>{z.zi}</span>
                </div>
                <span style={{fontSize:'12px',color:z.focus==='Repaus'?theme.text3:'#3b82f6',fontWeight:600}}>{z.focus}</span>
              </div>
              {exNames.length>0&&(
                <div style={{fontSize:'12px',color:theme.text3,lineHeight:1.6}}>
                  {exNames.join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── GUIDED WORKOUT TIMER ─────────────────────────────────────────────────────
function GuidedTimer({theme=THEMES.dark}){
  const [phase,setPhase]=useState('idle'); // idle | work | rest | done
  const [currentSet,setCurrentSet]=useState(1);
  const [totalSets,setTotalSets]=useState(4);
  const [workTime,setWorkTime]=useState(45);
  const [restTime,setRestTime]=useState(90);
  const [remaining,setRemaining]=useState(0);
  const intervalRef=useRef(null);

  const pct=phase==='work'?Math.round((remaining/workTime)*100):phase==='rest'?Math.round((remaining/restTime)*100):100;
  const color=phase==='work'?'#f97316':phase==='rest'?'#10b981':'#3b82f6';

  useEffect(()=>{
    if((phase==='work'||phase==='rest')&&remaining>0){
      intervalRef.current=setInterval(()=>setRemaining(r=>r-1),1000);
    } else if(remaining===0&&phase==='work'){
      clearInterval(intervalRef.current);
      if(currentSet<totalSets){setPhase('rest');setRemaining(restTime);if(navigator.vibrate)navigator.vibrate([100,50,100]);}
      else{setPhase('done');if(navigator.vibrate)navigator.vibrate([200,100,200,100,200]);}
    } else if(remaining===0&&phase==='rest'){
      clearInterval(intervalRef.current);
      setCurrentSet(s=>s+1);setPhase('work');setRemaining(workTime);
      if(navigator.vibrate)navigator.vibrate([300]);
    }
    return()=>clearInterval(intervalRef.current);
  },[phase,remaining]);

  const start=()=>{setPhase('work');setRemaining(workTime);setCurrentSet(1);};
  const stop=()=>{clearInterval(intervalRef.current);setPhase('idle');setRemaining(0);setCurrentSet(1);};
  const skip=()=>{clearInterval(intervalRef.current);setRemaining(0);};

  return(
    <div style={{background:'rgba(249,115,22,0.05)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#f97316',letterSpacing:'0.05em',marginBottom:'12px'}}>⏱ TIMER ANTRENAMENT GHIDAT</div>

      {phase==='idle'&&(
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
            {[{l:'SETURI',v:totalSets,sv:setTotalSets,min:1,max:10},{l:'LUCRU (s)',v:workTime,sv:setWorkTime,min:10,max:120,step:5},{l:'REPAUS (s)',v:restTime,sv:setRestTime,min:15,max:300,step:15}].map(({l,v,sv,min,max,step=1})=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontSize:'10px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>{l}</div>
                <input type="number" value={v} min={min} max={max} step={step}
                  onChange={e=>sv(Math.max(min,Math.min(max,parseInt(e.target.value)||min)))}
                  style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px',color:theme.text,fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
              </div>
            ))}
          </div>
          <button onClick={start} style={{padding:'14px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 15px rgba(249,115,22,0.3)'}}>
            ▶ START ANTRENAMENT
          </button>
        </div>
      )}

      {(phase==='work'||phase==='rest')&&(
        <div style={{textAlign:'center'}}>
          <div style={{marginBottom:'8px',fontSize:'13px',fontWeight:700,color:theme.text3}}>
            SET {currentSet} / {totalSets} — {phase==='work'?'🏋 LUCREAZĂ':'💚 ODIHNĂ'}
          </div>
          <div style={{position:'relative',width:'140px',height:'140px',margin:'0 auto 16px'}}>
            <svg viewBox="0 0 140 140" style={{width:'140px',height:'140px',transform:'rotate(-90deg)'}}>
              <circle cx="70" cy="70" r="62" fill="none" stroke={theme.surface2} strokeWidth="10"/>
              <circle cx="70" cy="70" r="62" fill="none" stroke={color} strokeWidth="10"
                strokeDasharray={`${2*Math.PI*62}`}
                strokeDashoffset={`${2*Math.PI*62*(1-pct/100)}`}
                strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:'42px',fontWeight:900,color,fontFamily:"'Barlow Condensed',sans-serif"}}>{remaining}</span>
              <span style={{fontSize:'12px',color:theme.text3}}>sec</span>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px',justifyContent:'center'}}>
            <button onClick={skip} style={{padding:'10px 20px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'100px',color:'#3b82f6',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>⏭ Skip</button>
            <button onClick={stop} style={{padding:'10px 20px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'100px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>✕ Stop</button>
          </div>
        </div>
      )}

      {phase==='done'&&(
        <div style={{textAlign:'center',padding:'16px'}}>
          <div style={{fontSize:'48px',marginBottom:'8px'}}>🏆</div>
          <div style={{fontSize:'18px',fontWeight:800,color:'#4ade80',fontFamily:"'Barlow Condensed',sans-serif",marginBottom:'4px'}}>ANTRENAMENT COMPLET!</div>
          <div style={{fontSize:'13px',color:theme.text3,marginBottom:'16px'}}>{totalSets} seturi × {workTime}s lucru</div>
          <button onClick={stop} style={{padding:'10px 24px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>◆ DIN NOU</button>
        </div>
      )}
    </div>
  );
}

// ─── MEAL PLAN AI ─────────────────────────────────────────────────────────────
function MealPlanAI({dayType,theme=THEMES.dark}){
  const [plan,setPlan]=useState(()=>ls('mp_meal_plan_v1',null));
  const [loading,setLoading]=useState(false);
  const [expanded,setExpanded]=useState(false);

  const currentDay=DAY_TYPES.find(d=>d.val===dayType);

  const generate=async()=>{
    setLoading(true);setExpanded(true);
    try{
      const prompt=`Generează un plan alimentar complet pentru O ZI de tip "${currentDay?.label}" pentru Mihai (45 ani, 188cm, 96kg, obiectiv slăbit+masă musculară).
Target: ${currentDay?.calTarget} kcal, ${currentDay?.protTarget}g proteine.
Include: Mic dejun, Gustare 1, Prânz, Gustare 2, Cină.
Pentru fiecare masă: alimente specifice cu gramaje, kcal și macros.
Folosește alimente din lista: ouă, piept pui, pește, brânză vaci, iaurt, ovăz, orez, cartofi dulci, legume, ulei măsline.
Format: tabel markdown cu coloana Masă | Alimente | Kcal | P | C | G.
La final: total zinic.`;
      const text=await callCoach([{role:'user',content:prompt}],1200);
      const newPlan={text,date:new Date().toISOString(),dayType};
      setPlan(newPlan);lsSet('mp_meal_plan_v1',newPlan);
    }catch{setPlan({text:'⚠️ Eroare la generare.',date:new Date().toISOString(),dayType});}
    setLoading(false);
  };

  return(
    <div style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'16px',overflow:'hidden'}}>
      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',color:'#10b981',letterSpacing:'0.05em'}}>🥗 PLAN ALIMENTAR AI</div>
          <div style={{fontSize:'11px',color:theme.text3,marginTop:'2px'}}>{plan?.date?`Generat: ${new Date(plan.date).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} (${plan.dayType})`:'Generează un plan personalizat'}</div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={e=>{e.stopPropagation();generate();}} disabled={loading}
            style={{padding:'7px 14px',background:'linear-gradient(135deg,#10b981,#059669)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:"'Barlow Condensed',sans-serif",opacity:loading?0.6:1}}>
            {loading?'⟳':'◆ GENEREAZĂ'}
          </button>
          <span style={{color:theme.text3,fontSize:'18px'}}>{expanded?'↑':'↓'}</span>
        </div>
      </div>
      {expanded&&<div style={{borderTop:'1px solid rgba(16,185,129,0.15)',padding:'16px'}}>
        {loading&&<div style={{display:'flex',justifyContent:'center',gap:'6px',padding:'16px'}}>{[0,1,2].map(i=><div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>}
        {!loading&&plan&&<div>{renderMarkdown(plan.text,THEMES.dark)}</div>}
        {!loading&&!plan&&<div style={{textAlign:'center',color:theme.text3,fontSize:'13px',padding:'16px'}}>Apasă GENEREAZĂ pentru un plan alimentar personalizat pentru ziua de azi.</div>}
      </div>}
    </div>
  );
}

// ─── PHOTO FOOD ANALYSIS ──────────────────────────────────────────────────────
function PhotoFoodAnalysis({onSendToCoach,theme=THEMES.dark}){
  const [status,setStatus]=useState('idle'); // idle | analyzing | done | error
  const [result,setResult]=useState(null);
  const inputRef=useRef(null);

  const analyze=async(file)=>{
    if(!file)return;
    setStatus('analyzing');setResult(null);
    try{
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(',')[1]);
        r.onerror=rej;
        r.readAsDataURL(file);
      });
      const response=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:800,
          messages:[{
            role:'user',
            content:[
              {type:'image',source:{type:'base64',media_type:file.type||'image/jpeg',data:base64}},
              {type:'text',text:'Analizează această masă/farfurie. Identifică alimentele vizibile și estimează:\n1. Fiecare aliment cu gramajul estimat\n2. Caloriile totale estimate\n3. Macros estimate: Proteine, Carbohidrați, Grăsimi\nFii specific și realist. Răspunde în română cu un tabel markdown.'}
            ]
          }]
        })
      });
      const data=await response.json();
      const text=data.content?.[0]?.text||'Nu am putut analiza imaginea.';
      setResult(text);setStatus('done');
      onSendToCoach(`📸 Analiză poză masă:\n${text}`);
    }catch{setStatus('error');setResult('Eroare la analiză. Încearcă din nou.');}
  };

  return(
    <div style={{background:'rgba(236,72,153,0.05)',border:'1px solid rgba(236,72,153,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#ec4899',letterSpacing:'0.05em',marginBottom:'12px'}}>📸 ANALIZĂ POZĂ MASĂ</div>

      {status==='idle'&&(
        <div style={{textAlign:'center',padding:'16px 0'}}>
          <div style={{fontSize:'48px',marginBottom:'8px'}}>📷</div>
          <div style={{fontSize:'14px',color:theme.text2,marginBottom:'6px',fontWeight:600}}>Fă o poză la farfurie</div>
          <div style={{fontSize:'12px',color:theme.text3,marginBottom:'16px'}}>AI estimează caloriile și macros automat</div>
          <button onClick={()=>inputRef.current?.click()}
            style={{padding:'12px 28px',background:'linear-gradient(135deg,#ec4899,#8b5cf6)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",boxShadow:'0 4px 15px rgba(236,72,153,0.3)'}}>
            📷 ALEGE POZA
          </button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}}
            onChange={e=>e.target.files?.[0]&&analyze(e.target.files[0])}/>
        </div>
      )}

      {status==='analyzing'&&(
        <div style={{textAlign:'center',padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'center',gap:'6px',marginBottom:'12px'}}>{[0,1,2].map(i=><div key={i} style={{width:'10px',height:'10px',borderRadius:'50%',background:'#ec4899',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>
          <div style={{fontSize:'13px',color:theme.text3}}>AI analizează poza...</div>
        </div>
      )}

      {(status==='done'||status==='error')&&result&&(
        <div>
          <div style={{marginBottom:'12px'}}>{renderMarkdown(result,theme)}</div>
          <button onClick={()=>{setStatus('idle');setResult(null);inputRef.current?.click();}}
            style={{width:'100%',padding:'10px',background:'linear-gradient(135deg,#ec4899,#8b5cf6)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>
            📷 ANALIZEAZĂ ALTĂ POZĂ
          </button>
        </div>
      )}
    </div>
  );
}

// ─── BODY MEASUREMENTS TRACKER ───────────────────────────────────────────────
function BodyMeasurements({theme=THEMES.dark}){
  const [records,setRecords]=useState(()=>ls('mp_body_meas_v1',[]));
  const [form,setForm]=useState({date:todayKey(),greutate:'',talie:'',biceps:'',piept:''});
  const [showForm,setShowForm]=useState(false);

  const save=()=>{
    if(!form.date)return;
    const existing=records.find(r=>r.date===form.date);
    let updated;
    if(existing){updated=records.map(r=>r.date===form.date?{...r,...form}:r);}
    else{updated=[...records,{...form,id:Date.now()}];}
    updated.sort((a,b)=>a.date.localeCompare(b.date));
    setRecords(updated);lsSet('mp_body_meas_v1',updated);
    setShowForm(false);
    setForm({date:todayKey(),greutate:'',talie:'',biceps:'',piept:''});
  };

  const del=(id)=>{const u=records.filter(r=>r.id!==id);setRecords(u);lsSet('mp_body_meas_v1',u);};
  const makeChartData=(field)=>records.filter(r=>r[field]).map(r=>({date:r.date.slice(5),value:parseFloat(r[field])}));

  const METRICS=[
    {key:'greutate',label:'Greutate',unit:'kg',color:'#f97316'},
    {key:'talie',   label:'Talie',   unit:'cm',color:'#3b82f6'},
    {key:'biceps',  label:'Biceps',  unit:'cm',color:'#8b5cf6'},
    {key:'piept',   label:'Piept',   unit:'cm',color:'#10b981'},
  ];

  const latest=records[records.length-1]||{};
  const prev=records[records.length-2]||{};

  return(
    <div style={{background:'rgba(249,115,22,0.05)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#f97316',letterSpacing:'0.05em'}}>📏 MĂSURĂTORI CORPORALE</div>
        <button onClick={()=>setShowForm(s=>!s)} style={{padding:'6px 14px',background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'10px',color:'#f97316',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>
          {showForm?'✕':'+ ADAUGĂ'}
        </button>
      </div>

      {records.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
          {METRICS.map(({key,label,unit,color})=>{
            const val=latest[key];const prevVal=prev[key];
            const diff=val&&prevVal?parseFloat(val)-parseFloat(prevVal):null;
            return(
              <div key={key} style={{background:`${color}12`,border:`1px solid ${color}30`,borderRadius:'12px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'10px',color:theme.text3,marginBottom:'3px',textTransform:'uppercase',fontWeight:700}}>{label}</div>
                <div style={{fontSize:'18px',fontWeight:900,color,fontFamily:"'Barlow Condensed',sans-serif"}}>{val||'—'}</div>
                <div style={{fontSize:'10px',color:theme.text4}}>{val?unit:''}</div>
                {diff!==null&&<div style={{fontSize:'11px',fontWeight:700,color:key==='greutate'||key==='talie'?(diff<0?'#4ade80':'#ef4444'):(diff>0?'#4ade80':'#ef4444')}}>{diff>0?'+':''}{diff.toFixed(1)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {showForm&&(
        <div style={{background:theme.surface,borderRadius:'12px',padding:'14px',marginBottom:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
          <div>
            <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>DATA</div>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {METRICS.map(({key,label,unit,color})=>(
              <div key={key}>
                <div style={{fontSize:'11px',fontWeight:700,marginBottom:'4px',color}}>{label} ({unit})</div>
                <input type="number" step="0.1" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  placeholder={key==='greutate'?'96.5':key==='talie'?'88':key==='biceps'?'40':'105'}
                  style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.softBorder}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'15px',outline:'none',fontFamily:"'Inter',sans-serif",textAlign:'center'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            <button onClick={()=>setShowForm(false)} style={{padding:'10px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Anulează</button>
            <button onClick={save} style={{padding:'10px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>SALVEAZĂ ◆</button>
          </div>
        </div>
      )}

      {records.length>1&&(
        <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'14px'}}>
          {METRICS.map(({key,label,unit,color})=>{const data=makeChartData(key);return data.length>1?(<div key={key} style={{...panel(theme),padding:'12px'}}><LineChart data={data} color={color} label={label} unit={` ${unit}`} theme={theme}/></div>):null;})}
        </div>
      )}

      {records.length>0&&(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
            <thead><tr>{['Data','Greutate','Talie','Biceps','Piept',''].map((h,i)=>(<th key={i} style={{padding:'6px 8px',borderBottom:`1px solid ${theme.border}`,color:theme.text3,fontWeight:700,fontSize:'11px',textAlign:i===0?'left':'center'}}>{h}</th>))}</tr></thead>
            <tbody>{[...records].reverse().map(r=>(<tr key={r.id} style={{borderBottom:`1px solid ${theme.border}`}}><td style={{padding:'8px',color:theme.text3}}>{r.date.slice(5)}</td>{['greutate','talie','biceps','piept'].map(k=>(<td key={k} style={{padding:'8px',textAlign:'center',fontWeight:600,color:theme.text}}>{r[k]||'—'}</td>))}<td style={{padding:'8px',textAlign:'center'}}><button onClick={()=>del(r.id)} style={{background:'none',border:'none',color:theme.text4,cursor:'pointer',fontSize:'14px'}}>×</button></td></tr>))}</tbody>
          </table>
        </div>
      )}

      {records.length===0&&!showForm&&(
        <div style={{textAlign:'center',padding:'20px',color:theme.text3,fontSize:'13px'}}>
          <div style={{fontSize:'32px',marginBottom:'8px'}}>📏</div>
          <div style={{fontWeight:600,color:theme.text2,marginBottom:'4px'}}>Nicio măsurătoare</div>
          <div>Adaugă prima înregistrare pentru a urmări evoluția</div>
        </div>
      )}
    </div>
  );
}

// ─── GYM MODE FULLSCREEN ─────────────────────────────────────────────────────
function GymMode({workouts,setWorkouts,onSendToCoach,onClose,theme=THEMES.dark}){
  const key=todayKey();
  const [selGroup,setSelGroup]=useState('piept');
  const [selEx,setSelEx]=useState(null);
  const [sets,setSets]=useState([{kg:'',reps:''}]);
  const [restTimer,setRestTimer]=useState(null);
  const [restRunning,setRestRunning]=useState(false);
  const [restDuration,setRestDuration]=useState(90);
  const [sessionPRs,setSessionPRs]=useState([]);
  const [totalVolume,setTotalVolume]=useState(0);
  const intervalRef=useRef(null);
  const wakeLockRef=useRef(null);

  // Wake Lock — ecranul nu se închide
  useEffect(()=>{
    const requestWakeLock=async()=>{
      try{if('wakeLock' in navigator){wakeLockRef.current=await navigator.wakeLock.request('screen');}}catch{}
    };
    requestWakeLock();
    return()=>{wakeLockRef.current?.release?.();};
  },[]);

  // Rest timer
  useEffect(()=>{
    if(restRunning&&restTimer>0){
      intervalRef.current=setInterval(()=>setRestTimer(t=>t-1),1000);
    }else if(restTimer===0&&restRunning){
      setRestRunning(false);
      if(navigator.vibrate)navigator.vibrate([300,100,300]);
      speak('Odihna s-a terminat! Următorul set!');
    }
    return()=>clearInterval(intervalRef.current);
  },[restRunning,restTimer]);

  const speak=(text)=>{
    if('speechSynthesis' in window){
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='ro-RO';u.rate=0.95;u.volume=1;
      window.speechSynthesis.speak(u);
    }
  };

  const startRest=(duration=restDuration)=>{
    setRestTimer(duration);setRestRunning(true);
    clearInterval(intervalRef.current);
  };

  const stopRest=()=>{setRestRunning(false);setRestTimer(null);clearInterval(intervalRef.current);};

  const getPR=exId=>{const all=Object.values(workouts.days).flatMap(d=>(d.exercises||[]).filter(e=>e.id===exId).flatMap(e=>e.sets));if(!all.length)return null;return Math.max(...all.map(s=>parseFloat(s.kg)));};

  const saveSet=(setIndex)=>{
    const set=sets[setIndex];
    if(!set.kg||!set.reps||parseFloat(set.kg)<=0||parseInt(set.reps)<=0)return;
    const kg=parseFloat(set.kg),reps=parseInt(set.reps);
    const vol=kg*reps;
    setTotalVolume(v=>v+vol);
    const pr=getPR(selEx)||0;
    if(kg>pr){
      setSessionPRs(p=>[...p,{ex:EXERCISES[selGroup].find(e=>e.id===selEx)?.name,kg}]);
      speak(`Record personal! ${kg} kilograme!`);
    }else{
      speak(`Set ${setIndex+1} salvat. ${reps} repetări la ${kg} kilograme. Odihnă!`);
    }
    startRest();
    // Adaugă set nou gol
    setSets(s=>[...s,{kg:set.kg,reps:''}]);
  };

  const finishExercise=()=>{
    const valid=sets.filter(s=>s.kg&&s.reps&&parseFloat(s.kg)>0&&parseInt(s.reps)>0);
    if(!valid.length)return;
    const ex=EXERCISES[selGroup].find(e=>e.id===selEx);
    const vol=valid.reduce((a,s)=>a+parseFloat(s.kg)*parseInt(s.reps),0);
    const entry={id:selEx,name:ex.name,group:selGroup,sets:valid,volume:Math.round(vol),time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const nw={...workouts};
    if(!nw.days[key])nw.days[key]={exercises:[],cardio:[]};
    nw.days[key].exercises=[...nw.days[key].exercises,entry];
    saveWorkouts(nw);setWorkouts({...nw});
    const allEx=Object.values(nw.days).flatMap(d=>d.exercises||[]).filter(e=>e.id===selEx);
    const maxPrev=Math.max(0,...allEx.slice(0,-1).map(e=>Math.max(...e.sets.map(s=>parseFloat(s.kg)))));
    const maxNew=Math.max(...valid.map(s=>parseFloat(s.kg)));
    const isPR=maxNew>maxPrev;
    onSendToCoach(`Forță: ${ex.name} — ${valid.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}${isPR?' 🏅 RECORD PERSONAL':''}`);
    speak(`Exercițiu complet! ${ex.name} finalizat!`);
    setSets([{kg:'',reps:''}]);setSelEx(null);stopRest();
  };

  const todayExCount=(workouts.days[key]?.exercises||[]).length;
  const restPct=restTimer!==null?Math.round((restTimer/restDuration)*100):0;
  const restColor=restTimer!==null&&restTimer<=10?'#ef4444':restTimer!==null&&restTimer<=30?'#f59e0b':'#10b981';
  const allEx=Object.values(EXERCISES).flat();

  return(
    <div style={{position:'fixed',inset:0,zIndex:200,background:'#060810',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(212,168,71,0.15)',background:'rgba(10,13,24,0.98)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'20px',background:'linear-gradient(90deg,#d4a847,#f97316)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'0.08em'}}>
            💪 GYM MODE
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <div style={{fontSize:'12px',color:'#d4a847',fontWeight:700}}>{todayExCount} exerciții</div>
            <div style={{fontSize:'12px',color:'#10b981',fontWeight:700}}>{Math.round(totalVolume)}kg vol</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {sessionPRs.length>0&&<div style={{padding:'4px 10px',background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'100px',fontSize:'12px',color:'#fbbf24',fontWeight:700}}>🏅 {sessionPRs.length} PR</div>}
          <button onClick={()=>{wakeLockRef.current?.release?.();onClose();}} style={{padding:'8px 16px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>✕ IEȘI</button>
        </div>
      </div>

      {/* Rest Timer — fullscreen când rulează */}
      {restRunning&&restTimer!==null&&(
        <div style={{position:'absolute',inset:0,zIndex:10,background:'rgba(6,8,16,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px'}}>
          <div style={{fontSize:'16px',color:'rgba(160,144,112,0.7)',fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase'}}>ODIHNĂ</div>
          <div style={{position:'relative',width:'200px',height:'200px'}}>
            <svg viewBox="0 0 200 200" style={{width:'200px',height:'200px',transform:'rotate(-90deg)'}}>
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(212,168,71,0.1)" strokeWidth="12"/>
              <circle cx="100" cy="100" r="90" fill="none" stroke={restColor} strokeWidth="12"
                strokeDasharray={`${2*Math.PI*90}`}
                strokeDashoffset={`${2*Math.PI*90*(1-restPct/100)}`}
                strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:'72px',fontWeight:900,color:restColor,fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>{restTimer}</span>
              <span style={{fontSize:'16px',color:'rgba(160,144,112,0.6)'}}>sec</span>
            </div>
          </div>
          <div style={{display:'flex',gap:'12px'}}>
            {[30,60,90].map(s=>(
              <button key={s} onClick={()=>startRest(s)} style={{padding:'10px 20px',background:'rgba(212,168,71,0.1)',border:'1px solid rgba(212,168,71,0.2)',borderRadius:'100px',color:'#d4a847',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>+{s}s</button>
            ))}
            <button onClick={stopRest} style={{padding:'10px 24px',background:'rgba(249,115,22,0.15)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'100px',color:'#f97316',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>SKIP ▶</button>
          </div>
          <div style={{fontSize:'13px',color:'rgba(160,144,112,0.5)'}}>Apasă SKIP pentru a sări odihna</div>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'14px',display:'flex',flexDirection:'column',gap:'12px'}}>

        {/* Grup muscular */}
        <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'4px'}}>
          {MUSCLE_GROUPS.map(g=>(
            <button key={g.id} onClick={()=>{setSelGroup(g.id);setSelEx(null);setSets([{kg:'',reps:''}]);}}
              style={{padding:'10px 16px',borderRadius:'100px',fontSize:'14px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s',flexShrink:0,
                borderColor:selGroup===g.id?g.color:'rgba(212,168,71,0.15)',
                background:selGroup===g.id?`${g.color}18`:'transparent',
                color:selGroup===g.id?g.color:'rgba(160,144,112,0.5)'}}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>

        {/* Exerciții */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          {EXERCISES[selGroup].map(ex=>{
            const pr=getPR(ex.id);
            const done=(workouts.days[key]?.exercises||[]).some(e=>e.id===ex.id);
            return(
              <button key={ex.id} onClick={()=>{setSelEx(ex.id);setSets([{kg:'',reps:''}]);stopRest();}}
                style={{padding:'12px',borderRadius:'12px',border:`1.5px solid ${selEx===ex.id?'#f97316':done?'rgba(74,222,128,0.3)':'rgba(212,168,71,0.1)'}`,
                  background:selEx===ex.id?'rgba(249,115,22,0.1)':done?'rgba(74,222,128,0.05)':'transparent',
                  cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                <div style={{fontSize:'13px',fontWeight:700,color:selEx===ex.id?'#f97316':done?'#4ade80':'rgba(224,216,196,0.8)',marginBottom:'4px'}}>{ex.name}{done?' ✓':''}</div>
                {pr&&<div style={{fontSize:'11px',color:'rgba(212,168,71,0.6)'}}>PR: {pr}kg</div>}
              </button>
            );
          })}
        </div>

        {/* Set input */}
        {selEx&&(
          <div style={{background:'rgba(212,168,71,0.05)',border:'1px solid rgba(212,168,71,0.2)',borderRadius:'16px',padding:'16px'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'18px',color:'#f97316',marginBottom:'14px',letterSpacing:'0.05em'}}>
              {EXERCISES[selGroup].find(e=>e.id===selEx)?.name}
            </div>

            {/* Seturile */}
            {sets.map((set,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'10px',marginBottom:'10px',alignItems:'center'}}>
                <div>
                  {i===0&&<div style={{fontSize:'11px',color:'rgba(160,144,112,0.6)',fontWeight:700,marginBottom:'4px',letterSpacing:'0.08em'}}>KG</div>}
                  <input type="number" value={set.kg} onChange={e=>setSets(s=>s.map((x,j)=>j===i?{...x,kg:e.target.value}:x))}
                    placeholder="kg" inputMode="decimal"
                    style={{width:'100%',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${set.kg?'rgba(249,115,22,0.4)':'rgba(212,168,71,0.15)'}`,borderRadius:'12px',padding:'14px 10px',color:'#f0ece4',fontSize:'22px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif",fontWeight:700}}/>
                </div>
                <div>
                  {i===0&&<div style={{fontSize:'11px',color:'rgba(160,144,112,0.6)',fontWeight:700,marginBottom:'4px',letterSpacing:'0.08em'}}>REPS</div>}
                  <input type="number" value={set.reps} onChange={e=>setSets(s=>s.map((x,j)=>j===i?{...x,reps:e.target.value}:x))}
                    placeholder="reps" inputMode="numeric"
                    style={{width:'100%',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${set.reps?'rgba(74,222,128,0.4)':'rgba(212,168,71,0.15)'}`,borderRadius:'12px',padding:'14px 10px',color:'#f0ece4',fontSize:'22px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif",fontWeight:700}}/>
                </div>
                <button onClick={()=>saveSet(i)} disabled={!set.kg||!set.reps}
                  style={{width:'52px',height:'52px',background:set.kg&&set.reps?'linear-gradient(135deg,#4ade80,#10b981)':'rgba(255,255,255,0.05)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'22px',cursor:set.kg&&set.reps?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',marginTop:i===0?'20px':'0',transition:'all 0.2s',boxShadow:set.kg&&set.reps?'0 4px 12px rgba(74,222,128,0.3)':'none'}}>
                  ✓
                </button>
              </div>
            ))}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'6px'}}>
              <div>
                <div style={{fontSize:'11px',color:'rgba(160,144,112,0.6)',fontWeight:700,marginBottom:'4px',letterSpacing:'0.08em'}}>ODIHNĂ (sec)</div>
                <div style={{display:'flex',gap:'6px'}}>
                  {[60,90,120,180].map(s=>(
                    <button key={s} onClick={()=>setRestDuration(s)}
                      style={{flex:1,padding:'8px 4px',borderRadius:'8px',border:`1px solid ${restDuration===s?'#d4a847':'rgba(212,168,71,0.15)'}`,background:restDuration===s?'rgba(212,168,71,0.12)':'transparent',color:restDuration===s?'#d4a847':'rgba(160,144,112,0.5)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
                      {s<60?`${s}s`:`${s/60}m`}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={finishExercise} disabled={!sets.some(s=>s.kg&&s.reps)}
                style={{padding:'14px',background:sets.some(s=>s.kg&&s.reps)?'linear-gradient(135deg,#f97316,#ef4444)':'rgba(255,255,255,0.05)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:sets.some(s=>s.kg&&s.reps)?'0 4px 15px rgba(249,115,22,0.3)':'none',transition:'all 0.2s',alignSelf:'flex-end'}}>
                FINALIZEAZĂ ◆
              </button>
            </div>
          </div>
        )}

        {/* Sesiune curentă */}
        {(workouts.days[key]?.exercises||[]).length>0&&(
          <div style={{background:'rgba(74,222,128,0.05)',border:'1px solid rgba(74,222,128,0.15)',borderRadius:'14px',padding:'14px'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'13px',color:'#4ade80',letterSpacing:'0.08em',marginBottom:'10px'}}>✅ EXERCIȚII COMPLETATE</div>
            {(workouts.days[key].exercises||[]).map((ex,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(74,222,128,0.08)'}}>
                <span style={{fontSize:'14px',color:'#4ade80',fontWeight:600}}>{ex.name}</span>
                <span style={{fontSize:'12px',color:'rgba(160,144,112,0.6)'}}>{ex.sets.map(s=>`${s.kg}×${s.reps}`).join(', ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* PR-uri sesiune */}
        {sessionPRs.length>0&&(
          <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'14px',padding:'14px',textAlign:'center'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',color:'#fbbf24',marginBottom:'8px'}}>🏅 RECORDURI SESIUNE</div>
            {sessionPRs.map((pr,i)=>(
              <div key={i} style={{fontSize:'14px',color:'#fbbf24',fontWeight:700}}>{pr.ex}: {pr.kg}kg</div>
            ))}
          </div>
        )}

        <div style={{height:'20px'}}/>
      </div>
    </div>
  );
}

function WorkoutTab({workouts,setWorkouts,onSendToCoach,theme=THEMES.dark}){
  const [mode,setMode]=useState('gym'),[selGroup,setSelGroup]=useState('piept'),[selEx,setSelEx]=useState(null),[sets,setSets]=useState([]);
  const [cardioType,setCT]=useState('mers'),[cardioDur,setCD]=useState(''),[cardioInt,setCI]=useState('moderată');
  const key=todayKey(),todayW=workouts.days[key]||{exercises:[],cardio:[]};
  const [progressAlert,setProgressAlert]=useState(null);
  const addSet=()=>setSets(s=>[...s,{kg:'',reps:''}]);
  const updSet=(i,f,v)=>setSets(s=>s.map((set,idx)=>idx===i?{...set,[f]:v}:set));
  const rmSet=i=>setSets(s=>s.filter((_,idx)=>idx!==i));
  const getPR=exId=>{const all=Object.values(workouts.days).flatMap(d=>(d.exercises||[]).filter(e=>e.id===exId).flatMap(e=>e.sets));if(!all.length)return null;return Math.max(...all.map(s=>parseFloat(s.kg)));};

  const getProgressAdvice=(exId,newSets,allDays)=>{
    // Găsește ultimele 2 sesiuni ale acestui exercițiu (exclude azi)
    const prevSessions=Object.entries(allDays)
      .filter(([date])=>date!==todayKey())
      .sort(([a],[b])=>b.localeCompare(a))
      .flatMap(([,day])=>(day.exercises||[]).filter(e=>e.id===exId))
      .slice(0,2);
    if(prevSessions.length<1)return null;
    const lastSession=prevSessions[0];
    const maxKgLast=Math.max(...lastSession.sets.map(s=>parseFloat(s.kg)||0));
    const maxRepsLast=Math.max(...lastSession.sets.map(s=>parseInt(s.reps)||0));
    const totalRepsLast=lastSession.sets.reduce((a,s)=>a+parseInt(s.reps||0),0);
    const maxKgNew=Math.max(...newSets.map(s=>parseFloat(s.kg)||0));
    const totalRepsNew=newSets.reduce((a,s)=>a+parseInt(s.reps||0),0);
    // PR nou
    const allPR=getPR(exId)||0;
    if(maxKgNew>allPR)return{type:'pr',msg:`🏅 RECORD PERSONAL! ${maxKgNew}kg — cel mai greu până acum!`,color:'#fbbf24'};
    // Același volum de 2 ori → crește greutatea
    if(prevSessions.length>=2){
      const prev2=prevSessions[1];
      const maxKgPrev2=Math.max(...prev2.sets.map(s=>parseFloat(s.kg)||0));
      if(maxKgLast===maxKgNew&&maxKgPrev2===maxKgNew&&totalRepsNew>=totalRepsLast){
        const increment=maxKgNew>=50?5:2.5;
        return{type:'increase',msg:`⬆️ Gata pentru progres! Încearcă ${maxKgNew+increment}kg data viitoare.`,color:'#10b981'};
      }
    }
    // Mai puțin decât ultima dată → recuperare
    if(maxKgNew<maxKgLast)return{type:'decrease',msg:`💤 Sub nivelul anterior (${maxKgLast}kg). Verifică recuperarea și somnul.`,color:'#f59e0b'};
    // Progres față de ultima dată
    if(maxKgNew>maxKgLast)return{type:'progress',msg:`💪 Progres față de ultima sesiune! +${(maxKgNew-maxKgLast).toFixed(1)}kg`,color:'#10b981'};
    return null;
  };

  const saveEx=()=>{
    if(!selEx||!sets.length)return;
    const valid=sets.filter(s=>s.kg&&s.reps&&parseFloat(s.kg)>0&&parseInt(s.reps)>0);
    if(!valid.length)return;
    const ex=EXERCISES[selGroup].find(e=>e.id===selEx);
    const vol=valid.reduce((a,s)=>a+parseFloat(s.kg)*parseInt(s.reps),0);
    const entry={id:selEx,name:ex.name,group:selGroup,sets:valid,volume:Math.round(vol),time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const nw={...workouts};
    if(!nw.days[key])nw.days[key]={exercises:[],cardio:[]};
    nw.days[key].exercises=[...nw.days[key].exercises,entry];
    const allEx=Object.values(nw.days).flatMap(d=>d.exercises||[]).filter(e=>e.id===selEx);
    const maxPrev=Math.max(0,...allEx.slice(0,-1).map(e=>Math.max(...e.sets.map(s=>parseFloat(s.kg)))));
    const maxNew=Math.max(...valid.map(s=>parseFloat(s.kg)));
    const isPR=maxNew>maxPrev;
    // Analiză volum progresiv
    const advice=getProgressAdvice(selEx,valid,nw.days);
    if(advice){setProgressAlert(advice);setTimeout(()=>setProgressAlert(null),5000);}
    saveWorkouts(nw);setWorkouts({...nw});setSets([]);setSelEx(null);
    onSendToCoach(`Forță: ${ex.name} — ${valid.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}${isPR?' 🏅 RECORD PERSONAL':''}`);
  };
  const totalVol=todayW.exercises.reduce((a,e)=>a+e.volume,0);const totalCard=(todayW.cardio||[]).reduce((a,c)=>a+c.kcal,0);
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
      {(todayW.exercises.length>0||(todayW.cardio||[]).length>0)&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>{[{l:'EXERCIȚII',v:todayW.exercises.length,c:'#f97316'},{l:'VOLUM',v:`${(totalVol/1000).toFixed(1)}t`,c:'#8b5cf6'},{l:'CARDIO',v:`${totalCard}kcal`,c:'#10b981'}].map(x=><StatCard key={x.l} label={x.l} value={x.v} color={x.c} theme={theme}/>)}</div>}
      {progressAlert&&(
        <div style={{padding:'12px 16px',background:`${progressAlert.color}15`,border:`1px solid ${progressAlert.color}40`,borderRadius:'12px',fontSize:'14px',fontWeight:700,color:progressAlert.color,animation:'fadeIn 0.3s ease',textAlign:'center'}}>
          {progressAlert.msg}
        </div>
      )}
      <RestTimer theme={theme}/>
      <GuidedTimer theme={theme}/>
      <WorkoutPlan theme={theme}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>{[{id:'gym',label:'🏋 Sală',c:'#f97316'},{id:'cardio',label:'🏃 Cardio',c:'#10b981'}].map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{padding:'12px',borderRadius:'12px',border:`2px solid ${mode===m.id?m.c:theme.border}`,background:mode===m.id?`${m.c}15`:'transparent',color:mode===m.id?m.c:theme.text3,fontSize:'15px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s'}}>{m.label}</button>)}</div>
      {mode==='gym'&&<>
        <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'2px'}}>{MUSCLE_GROUPS.map(g=><button key={g.id} onClick={()=>{setSelGroup(g.id);setSelEx(null);setSets([]);}} style={{padding:'8px 14px',borderRadius:'100px',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s',flexShrink:0,borderColor:selGroup===g.id?g.color:theme.softBorder,background:selGroup===g.id?`${g.color}18`:'transparent',color:selGroup===g.id?g.color:theme.text3}}>{g.icon} {g.label}</button>)}</div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'12px',display:'flex',flexDirection:'column',gap:'6px'}}><div style={{fontSize:'11px',color:theme.text3,letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>ALEGE EXERCIȚIU</div>{EXERCISES[selGroup].map(ex=>{const pr=getPR(ex.id);return(<button key={ex.id} onClick={()=>{setSelEx(ex.id);if(!sets.length)setSets([{kg:'',reps:''}]);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:'10px',border:`1.5px solid ${selEx===ex.id?'rgba(249,115,22,0.5)':theme.surface2}`,background:selEx===ex.id?'rgba(249,115,22,0.08)':theme.surface,cursor:'pointer',transition:'all 0.15s',textAlign:'left'}}><span style={{fontSize:'15px',fontWeight:600,color:selEx===ex.id?'#f97316':theme.text2}}>{ex.name}</span>{pr&&<span style={{fontSize:'11px',color:theme.text3,background:theme.surface,padding:'2px 8px',borderRadius:'6px'}}>PR: {pr}kg</span>}</button>);})}</div>
        {selEx&&<div style={{background:theme.surface,border:'1px solid rgba(249,115,22,0.2)',borderRadius:'16px',padding:'14px'}}><div style={{fontSize:'13px',color:'#f97316',fontWeight:700,letterSpacing:'0.05em',marginBottom:'12px',fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase'}}>{EXERCISES[selGroup].find(e=>e.id===selEx)?.name}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'8px'}}>{['KG','REPS',''].map((h,i)=><div key={i} style={{fontSize:'11px',color:theme.text3,textAlign:'center',letterSpacing:'0.08em',width:i===2?'32px':'auto'}}>{h}</div>)}</div>{sets.map((set,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'6px',alignItems:'center'}}><input type="number" value={set.kg} onChange={e=>updSet(i,'kg',e.target.value)} placeholder="kg" style={{background:theme.surface2,border:`1.5px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px',color:theme.text,fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/><input type="number" value={set.reps} onChange={e=>updSet(i,'reps',e.target.value)} placeholder="reps" style={{background:theme.surface2,border:`1.5px solid ${theme.softBorder}`,borderRadius:'10px',padding:'10px',color:theme.text,fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/><button onClick={()=>rmSet(i)} style={{width:'32px',height:'42px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>)}<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'10px'}}><button onClick={addSet} style={{padding:'10px',background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'10px',color:theme.text3,fontSize:'14px',fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>+ Set</button><button onClick={saveEx} style={{padding:'10px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 15px rgba(249,115,22,0.3)'}}>SALVEAZĂ ◆</button></div></div>}
        {todayW.exercises.length>0&&<div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'14px'}}><div style={{fontSize:'12px',color:theme.text3,letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 SESIUNE AZI</div>{todayW.exercises.map((ex,i)=>{const mg=MUSCLE_GROUPS.find(g=>g.id===ex.group);return(<div key={i} style={{marginBottom:'10px',padding:'10px 12px',background:theme.surface,borderRadius:'10px',borderLeft:`3px solid ${mg?.color||'#f97316'}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}><span style={{fontSize:'14px',fontWeight:700,color:theme.text}}>{ex.name}</span><span style={{fontSize:'11px',color:theme.text4}}>{ex.time}</span></div><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{ex.sets.map((s,j)=><span key={j} style={{fontSize:'13px',color:theme.text3,background:theme.surface,padding:'3px 8px',borderRadius:'6px'}}>{s.kg}kg×{s.reps}</span>)}<span style={{fontSize:'12px',color:theme.text3,marginLeft:'auto'}}>Vol: {ex.volume}kg</span></div></div>);})}</div>}
      </>}
      {mode==='cardio'&&<>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{CARDIO_TYPES.map(ct=><button key={ct.id} onClick={()=>setCT(ct.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 16px',borderRadius:'100px',border:`1.5px solid ${cardioType===ct.id?ct.color:theme.softBorder}`,background:cardioType===ct.id?`${ct.color}15`:'transparent',color:cardioType===ct.id?ct.color:theme.text3,fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",transition:'all 0.2s'}}><span style={{fontSize:'18px'}}>{ct.icon}</span>{ct.name}</button>)}</div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>
          <div><div style={{fontSize:'11px',color:theme.text3,letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>DURATĂ (min)</div><div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>{[15,20,30,45,60,90].map(min=><button key={min} onClick={()=>setCD(String(min))} style={{padding:'8px 16px',borderRadius:'10px',border:`1.5px solid ${cardioDur===String(min)?'#10b981':theme.softBorder}`,background:cardioDur===String(min)?'rgba(16,185,129,0.12)':theme.surface,color:cardioDur===String(min)?'#10b981':theme.text3,fontSize:'14px',fontWeight:700,cursor:'pointer'}}>{min}</button>)}</div><input type="number" value={cardioDur} onChange={e=>setCD(e.target.value)} placeholder="manual..." style={{width:'100%',background:theme.surface2,border:`1.5px solid ${theme.border}`,borderRadius:'10px',padding:'10px 14px',color:theme.text,fontSize:'16px',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div>
          <div><div style={{fontSize:'11px',color:theme.text3,letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>INTENSITATE</div><div style={{display:'flex',gap:'8px'}}>{['ușoară','moderată','intensă'].map(int=><button key={int} onClick={()=>setCI(int)} style={{flex:1,padding:'10px',borderRadius:'10px',border:`1.5px solid ${cardioInt===int?'#10b981':theme.softBorder}`,background:cardioInt===int?'rgba(16,185,129,0.12)':theme.surface,color:cardioInt===int?'#10b981':theme.text3,fontSize:'13px',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>{int}</button>)}</div></div>
          {cardioDur&&parseInt(cardioDur)>0&&<div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'12px',color:theme.text3,marginBottom:'4px'}}>ESTIMAT ARS</div><div style={{fontSize:'28px',fontWeight:900,color:'#10b981',fontFamily:"'Barlow Condensed',sans-serif"}}>{calcBurned(CARDIO_TYPES.find(c=>c.id===cardioType).met,parseInt(cardioDur))} kcal</div></div>}
          <button onClick={saveCardio} disabled={!cardioDur||parseInt(cardioDur)<=0} style={{padding:'14px',background:cardioDur&&parseInt(cardioDur)>0?'linear-gradient(135deg,#10b981,#059669)':theme.surface2,border:'none',borderRadius:'12px',color:cardioDur&&parseInt(cardioDur)>0?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:cardioDur&&parseInt(cardioDur)>0?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s'}}>◆ SALVEAZĂ CARDIO</button>
        </div>
        {(todayW.cardio||[]).length>0&&<div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'16px',padding:'14px'}}><div style={{fontSize:'12px',color:theme.text3,letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 CARDIO AZI</div>{(todayW.cardio||[]).map((c,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:theme.surface,borderRadius:'10px',marginBottom:'6px',borderLeft:'3px solid #10b981'}}><span style={{fontSize:'16px'}}>{c.icon}</span><div style={{flex:1,marginLeft:'10px'}}><div style={{fontSize:'14px',fontWeight:700,color:theme.text}}>{c.name}</div><div style={{fontSize:'12px',color:theme.text3}}>{c.duration} min · {c.intensity}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:'16px',fontWeight:800,color:'#10b981'}}>{c.kcal} kcal</div><div style={{fontSize:'11px',color:theme.text4}}>{c.time}</div></div></div>)}</div>}
      </>}
      <ExerciseProgress workouts={workouts} theme={theme}/>
      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function TDEECalculator({theme=THEMES.dark}){
  const [form,setForm]=useState(()=>ls('mp_tdee_form_v1',{
    varsta:'45', inaltime:'188', greutate:'96', sex:'male',
    activitate:'1.55', obiectiv:'deficit'
  }));
  const [result,setResult]=useState(null);

  const ACTIVITATE=[
    {val:'1.2',  label:'Sedentar',        desc:'Birou, fără sport'},
    {val:'1.375',label:'Ușor activ',      desc:'1-3 zile/săpt'},
    {val:'1.55', label:'Moderat activ',   desc:'3-5 zile/săpt'},
    {val:'1.725',label:'Foarte activ',    desc:'6-7 zile/săpt'},
    {val:'1.9',  label:'Extrem activ',    desc:'2x/zi sau muncă fizică'},
  ];

  const OBIECTIV=[
    {val:'deficit_agresiv', label:'Slăbire rapidă',   kcal:-500, desc:'-500 kcal/zi'},
    {val:'deficit',         label:'Slăbire moderată', kcal:-250, desc:'-250 kcal/zi'},
    {val:'mentinere',       label:'Menținere',         kcal:0,    desc:'±0 kcal/zi'},
    {val:'surplus',         label:'Creștere masă',     kcal:250,  desc:'+250 kcal/zi'},
  ];

  const calculate=()=>{
    const v=parseInt(form.varsta),h=parseInt(form.inaltime),w=parseFloat(form.greutate);
    if(!v||!h||!w)return;
    // Mifflin-St Jeor
    const bmr=form.sex==='male'?(10*w+6.25*h-5*v+5):(10*w+6.25*h-5*v-161);
    const tdee=Math.round(bmr*parseFloat(form.activitate));
    const obj=OBIECTIV.find(o=>o.val===form.obiectiv);
    const target=tdee+(obj?.kcal||0);
    const protein=Math.round(w*2.2); // 2.2g/kg
    const fat=Math.round(target*0.25/9);
    const carbs=Math.round((target-protein*4-fat*9)/4);
    const bmi=Math.round(w/((h/100)**2)*10)/10;
    const idealWeight=Math.round((22*(h/100)**2)*10)/10;
    setResult({bmr:Math.round(bmr),tdee,target,protein,fat,carbs,bmi,idealWeight});
    lsSet('mp_tdee_form_v1',form);
  };

  return(
    <div style={{background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#3b82f6',letterSpacing:'0.05em',marginBottom:'14px'}}>🧮 CALCULATOR TDEE & MACROS</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
        {[
          {key:'varsta',    label:'Vârstă (ani)',    placeholder:'45'},
          {key:'inaltime',  label:'Înălțime (cm)',   placeholder:'188'},
          {key:'greutate',  label:'Greutate (kg)',   placeholder:'96'},
        ].map(({key,label,placeholder})=>(
          <div key={key} style={key==='greutate'?{gridColumn:'1/-1'}:{}}>
            <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'4px'}}>{label}</div>
            <input type="number" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
              placeholder={placeholder}
              style={{width:'100%',background:theme.surface2,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'8px 10px',color:theme.text,fontSize:'15px',outline:'none',fontFamily:"'Inter',sans-serif",textAlign:'center'}}/>
          </div>
        ))}
      </div>

      <div style={{marginBottom:'12px'}}>
        <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'6px'}}>SEX</div>
        <div style={{display:'flex',gap:'8px'}}>
          {[{val:'male',label:'👨 Bărbat'},{val:'female',label:'👩 Femeie'}].map(({val,label})=>(
            <button key={val} onClick={()=>setForm(f=>({...f,sex:val}))}
              style={{flex:1,padding:'8px',borderRadius:'10px',border:`1.5px solid ${form.sex===val?'#3b82f6':theme.border}`,
                background:form.sex===val?'rgba(59,130,246,0.12)':'transparent',
                color:form.sex===val?'#3b82f6':theme.text3,fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:'12px'}}>
        <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'6px'}}>NIVEL ACTIVITATE</div>
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {ACTIVITATE.map(({val,label,desc})=>(
            <button key={val} onClick={()=>setForm(f=>({...f,activitate:val}))}
              style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderRadius:'10px',
                border:`1.5px solid ${form.activitate===val?'#3b82f6':theme.border}`,
                background:form.activitate===val?'rgba(59,130,246,0.1)':'transparent',cursor:'pointer'}}>
              <span style={{fontSize:'13px',fontWeight:600,color:form.activitate===val?'#3b82f6':theme.text2}}>{label}</span>
              <span style={{fontSize:'11px',color:theme.text3}}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={{fontSize:'11px',color:theme.text3,fontWeight:700,marginBottom:'6px'}}>OBIECTIV</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
          {OBIECTIV.map(({val,label,desc})=>(
            <button key={val} onClick={()=>setForm(f=>({...f,obiectiv:val}))}
              style={{padding:'8px 10px',borderRadius:'10px',border:`1.5px solid ${form.obiectiv===val?'#f97316':theme.border}`,
                background:form.obiectiv===val?'rgba(249,115,22,0.1)':'transparent',cursor:'pointer',textAlign:'left'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:form.obiectiv===val?'#f97316':theme.text2}}>{label}</div>
              <div style={{fontSize:'11px',color:theme.text3}}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={calculate} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 15px rgba(59,130,246,0.3)',marginBottom:'14px'}}>
        🧮 CALCULEAZĂ
      </button>

      {result&&(
        <div style={{display:'flex',flexDirection:'column',gap:'10px',animation:'tabIn 0.3s ease'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {[
              {l:'BMR',v:`${result.bmr} kcal`,c:'#8b5cf6',desc:'Metabolism bazal'},
              {l:'TDEE',v:`${result.tdee} kcal`,c:'#3b82f6',desc:'Necesarul total'},
              {l:'TARGET',v:`${result.target} kcal`,c:'#f97316',desc:'Cu obiectivul tău'},
              {l:'BMI',v:result.bmi,c:result.bmi<25?'#4ade80':result.bmi<30?'#f59e0b':'#ef4444',desc:`Ideal: ${result.idealWeight}kg`},
            ].map(({l,v,c,desc})=>(
              <div key={l} style={{background:`${c}12`,border:`1px solid ${c}30`,borderRadius:'12px',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'10px',color:theme.text3,marginBottom:'3px',textTransform:'uppercase',fontWeight:700}}>{l}</div>
                <div style={{fontSize:'20px',fontWeight:900,color:c,fontFamily:"'Barlow Condensed',sans-serif"}}>{v}</div>
                <div style={{fontSize:'10px',color:theme.text4,marginTop:'2px'}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.15)',borderRadius:'12px',padding:'12px'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'13px',color:'#f97316',marginBottom:'8px',letterSpacing:'0.05em'}}>MACROS RECOMANDATE / ZI</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {[{l:'PROTEINE',v:`${result.protein}g`,c:'#8b5cf6'},{l:'CARBOHIDRAȚI',v:`${result.carbs}g`,c:'#3b82f6'},{l:'GRĂSIMI',v:`${result.fat}g`,c:'#10b981'}].map(({l,v,c})=>(
                <div key={l} style={{textAlign:'center'}}>
                  <div style={{fontSize:'9px',color:theme.text3,marginBottom:'2px',fontWeight:700}}>{l}</div>
                  <div style={{fontSize:'18px',fontWeight:900,color:c,fontFamily:"'Barlow Condensed',sans-serif"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyComparison({stats,workouts,theme=THEMES.dark}){
  const getWeekKeys=(weeksAgo=0)=>{
    const keys=[];
    const today=new Date();
    const dayOfWeek=(today.getDay()+6)%7; // 0=luni
    const startOfWeek=new Date(today);
    startOfWeek.setDate(today.getDate()-dayOfWeek-(weeksAgo*7));
    for(let i=0;i<7;i++){
      const d=new Date(startOfWeek);
      d.setDate(startOfWeek.getDate()+i);
      keys.push(localDateKey(d));
    }
    return keys;
  };

  const thisWeek=getWeekKeys(0);
  const lastWeek=getWeekKeys(1);

  const calcWeekStats=(keys)=>{
    const days=keys.map(k=>stats.daily?.[k]).filter(Boolean);
    const weights=keys.map(k=>stats.weight?.[k]).filter(Boolean);
    const workoutDays=keys.filter(k=>workouts.days?.[k]?.exercises?.length>0);
    return{
      avgCal:days.length?Math.round(days.reduce((a,d)=>a+(d.calories||0),0)/days.length):0,
      avgProt:days.length?Math.round(days.reduce((a,d)=>a+(d.protein||0),0)/days.length):0,
      loggedDays:days.length,
      workoutDays:workoutDays.length,
      avgWeight:weights.length?Math.round(weights.reduce((a,w)=>a+parseFloat(w),0)/weights.length*10)/10:null,
    };
  };

  const tw=calcWeekStats(thisWeek);
  const lw=calcWeekStats(lastWeek);

  if(!tw.loggedDays&&!lw.loggedDays)return null;

  const Diff=({curr,prev,unit='',inverse=false})=>{
    if(!curr||!prev)return null;
    const diff=curr-prev;
    if(diff===0)return<span style={{fontSize:'11px',color:theme.text3}}>—</span>;
    const positive=inverse?(diff<0):(diff>0);
    return<span style={{fontSize:'11px',fontWeight:700,color:positive?'#4ade80':'#ef4444'}}>{diff>0?'+':''}{diff}{unit}</span>;
  };

  const COLS=[
    {label:'Calorii medii',  twVal:tw.avgCal,  lwVal:lw.avgCal,  unit:' kcal', color:'#f97316'},
    {label:'Proteine medii', twVal:tw.avgProt, lwVal:lw.avgProt, unit:'g',     color:'#8b5cf6'},
    {label:'Zile logate',    twVal:tw.loggedDays,lwVal:lw.loggedDays,unit:'/7',color:'#3b82f6'},
    {label:'Antrenamente',   twVal:tw.workoutDays,lwVal:lw.workoutDays,unit:'',color:'#10b981'},
    {label:'Greutate medie', twVal:tw.avgWeight,lwVal:lw.avgWeight,unit:'kg',  color:'#d4a847'},
  ];

  return(
    <div style={{background:'rgba(212,168,71,0.05)',border:'1px solid rgba(212,168,71,0.15)',borderRadius:'16px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#d4a847',letterSpacing:'0.05em',marginBottom:'14px'}}>📊 COMPARAȚIE SĂPTĂMÂNI</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:'0',marginBottom:'8px'}}>
        {['METRIC','SĂPT. CURENTĂ','SĂPT. TRECUTĂ','±'].map((h,i)=>(
          <div key={i} style={{fontSize:'10px',color:theme.text3,fontWeight:700,letterSpacing:'0.08em',padding:'4px 8px',borderBottom:`1px solid ${theme.border}`,textAlign:i>0?'center':'left'}}>{h}</div>
        ))}
      </div>
      {COLS.map(({label,twVal,lwVal,unit,color})=>(
        <div key={label} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:'0',borderBottom:`1px solid ${theme.border}`}}>
          <div style={{padding:'10px 8px',fontSize:'13px',color:theme.text2,fontWeight:600}}>{label}</div>
          <div style={{padding:'10px 8px',textAlign:'center',fontSize:'14px',fontWeight:800,color:twVal?color:theme.text4}}>{twVal||'—'}{twVal?unit:''}</div>
          <div style={{padding:'10px 8px',textAlign:'center',fontSize:'14px',fontWeight:600,color:lwVal?theme.text3:theme.text4}}>{lwVal||'—'}{lwVal?unit:''}</div>
          <div style={{padding:'10px 8px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Diff curr={twVal} prev={lwVal} unit={unit==='kg'?'kg':unit==='/7'?'':unit==='g'?'g':''} inverse={label.includes('Greutate')||label.includes('Calorii')}/>
          </div>
        </div>
      ))}
      <div style={{fontSize:'11px',color:theme.text3,marginTop:'8px',textAlign:'center'}}>
        Verde = îmbunătățire · Roșu = scădere față de săptămâna trecută
      </div>
    </div>
  );
}

function StatsTab({stats,workouts,onSendToCoach,setStats,theme=THEMES.dark}){
  const [sel,setSel]=useState(todayKey());
  const prep=(key,filter,valFn)=>Object.entries(stats[key]||{}).filter(filter).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([k,v])=>{const[,m,d]=k.split('-');return{date:`${d}/${m}`,value:valFn(v)};});
  const weightData=prep('weight',()=>true,v=>parseFloat(v));
  const calData=prep('daily',([,v])=>v.calories,v=>v.calories);
  const protData=prep('daily',([,v])=>v.protein,v=>v.protein);
  const latestW=weightData.length?weightData[weightData.length-1].value:null;
  const startW=weightData.length?weightData[0].value:96;
  const lost=latestW?(startW-latestW).toFixed(1):null;
  const streak=calcStreak(stats);
  const selWeight=stats.weight?.[sel],selDaily=stats.daily?.[sel],selWorkout=workouts.days?.[sel];
  const [y,m,d]=sel.split('-');
  const hrvData=ls(KEYS.hrv,{});
  const energyData=Object.entries(hrvData).filter(([,v])=>v.energy).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([k,v])=>{const[,mo,dy]=k.split('-');return{date:`${dy}/${mo}`,value:v.energy};});
  const libidoData=Object.entries(hrvData).filter(([,v])=>v.libido).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([k,v])=>{const[,mo,dy]=k.split('-');return{date:`${dy}/${mo}`,value:v.libido};});
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
        {[{l:'CURENT',v:latestW??'—',u:'kg',c:'#f97316'},{l:'PIERDUT',v:lost!==null?(parseFloat(lost)>0?`-${lost}`:`+${Math.abs(lost)}`):'—',u:'kg',c:'#4ade80'},{l:'LOG',v:Object.keys(stats.daily||{}).length,u:'zile',c:'#3b82f6'},{l:'STREAK',v:streak,u:'🔥',c:'#fbbf24'}].map(x=><StatCard key={x.l} label={x.l} value={x.v} unit={x.u} color={x.c} theme={theme}/>)}
      </div>
      <WaterTracker stats={stats} setStats={setStats} theme={theme}/>
      <CalendarPicker selectedDate={sel} onSelect={setSel} stats={stats} workouts={workouts} theme={theme}/>
      {(selWeight||selDaily||selWorkout)&&<div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'14px'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'14px',color:theme.text3,letterSpacing:'0.05em',marginBottom:'12px',textTransform:'uppercase'}}>{d} {RO_MONTHS[parseInt(m)-1]} {y}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:selWorkout?'12px':'0'}}>
          {selWeight&&<MetricBadge label="GREUTATE" value={selWeight} color="#f97316" theme={theme}/>}
          {selDaily?.calories&&<MetricBadge label="CALORII" value={selDaily.calories} color="#3b82f6" theme={theme}/>}
          {selDaily?.protein&&<MetricBadge label="PROTEINE" value={`${selDaily.protein}g`} color="#8b5cf6" theme={theme}/>}
        </div>
        {selWorkout?.exercises?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:theme.text3,marginBottom:'6px',fontWeight:700}}>EXERCIȚII</div>{selWorkout.exercises.map((ex,i)=><div key={i} style={{fontSize:'13px',color:theme.text2,marginBottom:'4px'}}>◆ {ex.name} — {ex.sets.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}</div>)}</div>}
        {selWorkout?.cardio?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:theme.text3,marginBottom:'6px',fontWeight:700}}>CARDIO</div>{selWorkout.cardio.map((c,i)=><div key={i} style={{fontSize:'13px',color:theme.text2,marginBottom:'4px'}}>{c.icon} {c.name} {c.duration}min — {c.kcal} kcal</div>)}</div>}
      </div>}
      <BodyMeasurements theme={theme}/>
      <SupplementTracker theme={theme}/>
      <MuscleVolumeChart workouts={workouts} theme={theme}/>
      <WellbeingTracker onSendToCoach={onSendToCoach} theme={theme}/>
      {weightData.length>1&&<div style={{...panel(theme),padding:'16px'}}><LineChart data={weightData} color="#f97316" label="Greutate" unit=" kg" target="88–90" theme={theme}/></div>}
      {calData.length>1&&<div style={{...panel(theme),padding:'16px'}}><LineChart data={calData} color="#3b82f6" label="Calorii" unit=" kcal" target="1900–2250" theme={theme}/></div>}
      {protData.length>1&&<div style={{...panel(theme),padding:'16px'}}><LineChart data={protData} color="#8b5cf6" label="Proteine" unit="g" target="160–180" theme={theme}/></div>}
      {energyData.length>1&&<div style={{...panel(theme),padding:'16px'}}><LineChart data={energyData} color="#f59e0b" label="Energie" unit="/10" theme={theme}/></div>}
      {libidoData.length>1&&<div style={{...panel(theme),padding:'16px'}}><LineChart data={libidoData} color="#ec4899" label="Libido" unit="/10" theme={theme}/></div>}
      {weightData.length>0&&<div style={{...panel(theme),padding:'14px'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px',letterSpacing:'0.1em',color:theme.text3,textTransform:'uppercase',marginBottom:'10px'}}>📋 Jurnal Greutate</div><div style={{display:'flex',flexDirection:'column',gap:'5px'}}>{[...weightData].reverse().map((d,i,arr)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:theme.surface,borderRadius:'10px',border:`1px solid ${theme.border}`}}><span style={{fontSize:'13px',color:theme.text3}}>{d.date}</span><span style={{fontSize:'16px',fontWeight:700,color:'#f97316'}}>{d.value} kg</span>{arr[i+1]&&<span style={{fontSize:'12px',fontWeight:600,color:d.value<arr[i+1].value?'#4ade80':'#ef4444'}}>{d.value<arr[i+1].value?'↓':'↑'}{Math.abs(d.value-arr[i+1].value).toFixed(1)}</span>}</div>)}</div></div>}
      <TDEECalculator theme={theme}/>
      <WeeklyComparison stats={stats} workouts={workouts} theme={theme}/>
      <BloodAnalysis theme={theme}/>
      <PhotoFoodAnalysis onSendToCoach={onSendToCoach} theme={theme}/>
      <ExportPanel stats={stats} workouts={workouts} theme={theme}/>
      <WeeklyReport stats={stats} workouts={workouts} theme={theme}/>
      <PatternPanel stats={stats} workouts={workouts} theme={theme}/>
      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const session=loadSession();
  const [messages,setMessages]=useState(()=>session.messages||[]);
  const [input,   setInput]   =useState('');
  const [loading, setLoading] =useState(false);
  const [dayType, setDayType] =useState(()=>session.dayType||'normal');
  const [toast,   setToast]   =useState(null);
  const [tab,     setTab]     =useState('coach');
  const [stats,   setStats]   =useState(()=>loadStats());
  const [workouts,setWorkouts]=useState(()=>loadWorkouts());
  const [picker,  setPicker]  =useState(false);
  const [showMealPlan,setShowMealPlan]=useState(false);
  const [showWeightWidget,setShowWeightWidget]=useState(false);
  const [quickWeight,setQuickWeight]=useState('');
  const [gymMode,setGymMode]=useState(false);
  const [darkMode,setDarkMode]=useState(()=>ls(KEYS.theme,true));
  const messagesEndRef=useRef(null),textareaRef=useRef(null),messagesRef=useRef(messages);
  useEffect(()=>{messagesRef.current=messages;},[messages]);
  const currentDay=DAY_TYPES.find(d=>d.val===dayType);

  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,loading]);
  useEffect(()=>{ saveSession(messages,dayType); },[messages,dayType]);
  useEffect(()=>{ lsSet(KEYS.theme,darkMode); },[darkMode]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const extractAndSave=useCallback((reply)=>{
    const lines=reply.trim().split('\n');
    const lastLine=lines[lines.length-1]?.trim();
    if(!lastLine||!lastLine.startsWith('{')||!lastLine.includes('"_data"'))return;
    try{
      const parsed=JSON.parse(lastLine);
      const d=parsed._data;
      const key=todayKey();
      const ns=loadStats();
      if(d.type==='weight'&&typeof d.value==='number')ns.weight[key]=d.value;
      if(d.type==='daily'){if(!ns.daily[key])ns.daily[key]={};if(typeof d.calories==='number')ns.daily[key].calories=d.calories;if(typeof d.protein==='number')ns.daily[key].protein=d.protein;if(typeof d.carbs==='number')ns.daily[key].carbs=d.carbs;if(typeof d.fiber==='number')ns.daily[key].fiber=d.fiber;}
      if(d.type==='hrv'){const hd=ls(KEYS.hrv,{});if(!hd[key])hd[key]={};if(typeof d.energy==='number')hd[key].energy=d.energy;if(typeof d.libido==='number')hd[key].libido=d.libido;lsSet(KEYS.hrv,hd);}
      if(d.type==='sleep'){const hd=ls(KEYS.hrv,{});if(!hd[key])hd[key]={};if(typeof d.hours==='number')hd[key].sleep=d.hours;if(typeof d.quality==='number')hd[key].sleepQuality=d.quality;lsSet(KEYS.hrv,hd);}
      saveStats(ns);setStats({...ns});
    }catch{}
  },[]);

  const sendMessage=useCallback(async(text)=>{
    if(!text.trim()||loading)return;
    const prefix=`[Context: ${currentDay?.label} — ${currentDay?.desc}]\n`;
    const userMsg={role:'user',content:text,display:text};
    const snapshot=[...messagesRef.current,userMsg];
    setMessages(snapshot);setInput('');setLoading(true);
    if(tab!=='coach')setTab('coach');
    try{
      const apiMsgs=snapshot.map(m=>({role:m.role,content:m.role==='user'?(m===userMsg?prefix+text:m.content):m.content}));
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,system:SYSTEM_PROMPT,messages:apiMsgs})});
      const data=await res.json();
      const reply=data.content?.[0]?.text||'Eroare la răspuns.';
      extractAndSave(reply);
      setMessages(prev=>[...prev,{role:'assistant',content:reply}]);
    }catch{
      setMessages(prev=>[...prev,{role:'assistant',content:'⚠️ Eroare de conexiune.'}]);
    }finally{
      setLoading(false);
    }
  },[loading,currentDay,tab,extractAndSave]);

  const handleKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input);}};
  const clearHistory=()=>{setMessages([]);try{localStorage.removeItem(KEYS.session);}catch{}showToast('Istoric șters');};

  const theme=darkMode?THEMES.dark:THEMES.light;
  const bg=theme.bg;
  const bgHdr=darkMode?'rgba(8,11,20,0.97)':'rgba(255,255,255,0.97)';
  const borderC=theme.border;
  const textC=theme.text;

  return(
    <div style={{minHeight:'100vh',height:'100dvh',background:bg,fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif",color:textC,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px;}
        .hdr{padding:0 16px;background:${bgHdr};backdrop-filter:blur(20px);position:sticky;top:0;z-index:20;border-bottom:1px solid ${borderC};flex-shrink:0;}
        .hdr-top{display:flex;align-items:center;justify-content:space-between;padding:10px 0;gap:8px;flex-wrap:wrap;}
        .logo{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
        .logo-sub{font-size:9px;color:#475569;letter-spacing:0.15em;text-transform:uppercase;font-weight:500;margin-top:2px;}
        .day-pills{display:flex;gap:4px;}
        .day-pill{padding:5px 10px;border-radius:100px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;border:1.5px solid ${borderC};background:transparent;color:#475569;transition:all 0.2s;white-space:nowrap;font-family:'Barlow Condensed',sans-serif;}
        .day-pill.active{border-color:transparent;color:#fff;}
        .sbar{display:flex;align-items:center;gap:8px;padding:6px 0 8px;overflow-x:auto;}
        .sbar::-webkit-scrollbar{height:0;}
        .sbadge{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;}
        .tab-bar{display:flex;border-bottom:1px solid ${borderC};background:${bgHdr};flex-shrink:0;}
        .tab-btn{flex:1;padding:10px;font-size:14px;font-weight:700;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:#475569;border-bottom:2px solid transparent;transition:all 0.2s;font-family:'Barlow Condensed',sans-serif;letter-spacing:0.05em;}
        .tab-btn:hover{color:#94a3b8;}
        .tab-btn.active{color:#f97316;border-bottom-color:#f97316;}
        .qbar{display:flex;gap:6px;padding:8px 16px;background:${bgHdr};border-bottom:1px solid ${borderC};overflow-x:auto;align-items:center;flex-shrink:0;}
        .qbar::-webkit-scrollbar{height:0;}
        .qbtn{display:flex;align-items:center;gap:5px;padding:7px 12px;background:${darkMode?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)'};border:1px solid ${borderC};border-radius:10px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;font-family:'Inter',sans-serif;}
        .qbtn:hover{background:${darkMode?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'};color:${textC};transform:translateY(-1px);}
        .qbtn.pr{background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.25);color:#fb923c;}
        .qbtn.gn{background:rgba(74,222,128,0.08);border-color:rgba(74,222,128,0.25);color:#4ade80;}
        .sep{width:1px;height:18px;background:${borderC};flex-shrink:0;margin:0 2px;}
        .msgs-wrap{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;}
        .msgs{max-width:800px;width:100%;margin:0 auto;padding:14px;display:flex;flex-direction:column;gap:12px;flex:1;}
        .mu{background:${darkMode?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)'};border:1px solid ${borderC};border-radius:16px 16px 4px 16px;padding:11px 15px;align-self:flex-end;max-width:88%;}
        .ma{background:${darkMode?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)'};border:1px solid ${borderC};border-radius:4px 16px 16px 16px;padding:13px 17px;position:relative;overflow:hidden;}
        .ma::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#f97316,#ef4444);}
        .mlbl{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:7px;}
        .lu{color:#334155;}.la{background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .ldots{background:${darkMode?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)'};border:1px solid ${darkMode?'rgba(212,168,71,0.08)':borderC};border-radius:4px 16px 16px 16px;padding:14px 18px;display:flex;align-items:center;gap:6px;}
        .dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#d4a847,#f97316);animation:bnc 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:0.15s;}.dot:nth-child(3){animation-delay:0.3s;}
        @keyframes bnc{0%,100%{transform:translateY(0) scale(0.8);opacity:0.4;}50%{transform:translateY(-5px) scale(1);opacity:1;}}
        .inpwrap{border-top:1px solid ${darkMode?'rgba(212,168,71,0.1)':borderC};background:${darkMode?'rgba(6,8,16,0.97)':bgHdr};padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom));flex-shrink:0;}
        .inpinner{max-width:800px;margin:0 auto;display:flex;gap:8px;align-items:flex-end;}
        textarea{flex:1;background:${darkMode?'rgba(212,168,71,0.04)':'rgba(0,0,0,0.05)'};border:1.5px solid ${darkMode?'rgba(212,168,71,0.12)':borderC};border-radius:14px;padding:11px 15px;color:${textC};font-family:'Inter',sans-serif;font-size:16px;resize:none;outline:none;min-height:48px;max-height:140px;transition:border-color 0.2s,box-shadow 0.2s;line-height:1.5;}
        textarea:focus{border-color:${darkMode?'rgba(212,168,71,0.4)':'rgba(249,115,22,0.35)'};box-shadow:0 0 0 3px ${darkMode?'rgba(212,168,71,0.07)':'rgba(249,115,22,0.07)'};}
        textarea::placeholder{color:${darkMode?'rgba(160,144,112,0.4)':'#a09070'};}
        .fbtn{width:48px;height:48px;background:${darkMode?'rgba(212,168,71,0.08)':'rgba(74,222,128,0.1)'};border:1.5px solid ${darkMode?'rgba(212,168,71,0.2)':'rgba(74,222,128,0.25)'};border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;flex-shrink:0;transition:all 0.2s;}
        .fbtn:hover{background:${darkMode?'rgba(212,168,71,0.15)':'rgba(74,222,128,0.2)'};transform:translateY(-2px);}
        .sbtn{width:48px;height:48px;background:linear-gradient(135deg,#d4a847,#f97316);border:none;border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;box-shadow:0 4px 15px rgba(212,168,71,0.35);font-size:22px;color:white;font-weight:700;}
        .sbtn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(212,168,71,0.45);}
        .sbtn:disabled{opacity:0.3;cursor:not-allowed;box-shadow:none;}
        .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 24px;text-align:center;}
        .eicon{font-size:56px;animation:pls 2.5s ease-in-out infinite;}
        @keyframes pls{0%,100%{transform:scale(1);filter:drop-shadow(0 0 20px rgba(212,168,71,0.4));}50%{transform:scale(1.06);filter:drop-shadow(0 0 40px rgba(212,168,71,0.7));}}
        .etitle{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#d4a847,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .esub{font-size:14px;color:${darkMode?'rgba(160,144,112,0.7)':'#7a6a50'};line-height:1.6;max-width:280px;}
        .hchips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
        .hchip{padding:5px 12px;background:rgba(212,168,71,0.08);border:1px solid rgba(212,168,71,0.2);border-radius:100px;font-size:12px;color:#d4a847;font-weight:600;}
        .clrbtn{padding:4px 9px;background:transparent;border:1px solid ${darkMode?'rgba(212,168,71,0.15)':borderC};border-radius:8px;color:${darkMode?'rgba(212,168,71,0.4)':'#7a6a50'};font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .clrbtn:hover{border-color:rgba(239,68,68,0.35);color:#ef4444;}
        .theme-btn{padding:4px 9px;background:transparent;border:1px solid ${darkMode?'rgba(212,168,71,0.15)':borderC};border-radius:8px;color:${darkMode?'rgba(212,168,71,0.5)':'#7a6a50'};font-size:14px;cursor:pointer;transition:all 0.15s;}
        .theme-btn:hover{border-color:rgba(212,168,71,0.4);color:#d4a847;}
        .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:${darkMode?'rgba(10,13,24,0.98)':'rgba(255,255,255,0.97)'};color:${textC};font-size:13px;font-weight:600;padding:10px 20px;border-radius:100px;border:1px solid ${darkMode?'rgba(212,168,71,0.2)':borderC};z-index:100;animation:su 0.3s ease;white-space:nowrap;box-shadow:0 8px 30px ${darkMode?'rgba(212,168,71,0.15)':'rgba(0,0,0,0.15)'};}
        @keyframes su{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        select option{background:${darkMode?'#0a0d18':'#fff'};color:${textC};}
        @keyframes shimmer{0%{background-position:0% center;}100%{background-position:200% center;}}
        @keyframes tabIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseBadge{0%,100%{box-shadow:0 0 8px rgba(251,191,36,0.2);}50%{box-shadow:0 0 18px rgba(251,191,36,0.5);}}
      `}</style>

      <div className="hdr">
        <div className="hdr-top">
          <div>
            <div className="logo" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'20px',fontWeight:900,letterSpacing:'0.08em',textTransform:'uppercase',background:'linear-gradient(90deg,#d4a847,#f97316,#d4a847)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',animation:'shimmer 4s linear infinite'}}>MIHAI PERFORMANCE</div>
            <div className="logo-sub" style={{fontSize:'9px',color:darkMode?'rgba(212,168,71,0.5)':'#7a6a50',letterSpacing:'0.2em',textTransform:'uppercase',fontWeight:600,marginTop:'2px'}}>AI Nutrition & Fitness Coach</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <StreakBadge stats={stats}/>
            <button className="theme-btn" onClick={()=>setDarkMode(d=>!d)}>{darkMode?'☀️':'🌙'}</button>
            {messages.length>0&&<button className="clrbtn" onClick={clearHistory}>CLR</button>}
            <div className="day-pills">
              {DAY_TYPES.map(d=><button key={d.val} className={`day-pill ${dayType===d.val?'active':''}`} style={dayType===d.val?{background:d.gradient,boxShadow:`0 0 16px ${d.glow}`}:{}} onClick={()=>{setDayType(d.val);showToast(`${d.icon} ${d.label}`);}}>{d.icon} {d.labelShort}</button>)}
            </div>
          </div>
        </div>
        <div className="sbar">
          <div className="sbadge" style={{background:`${currentDay?.color}18`,border:`1px solid ${currentDay?.color}35`,color:currentDay?.color}}>
            <span>{currentDay?.icon}</span><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px'}}>{currentDay?.label}</span><span style={{opacity:0.5}}>·</span><span style={{opacity:0.8,fontSize:'12px'}}>{currentDay?.desc}</span>
          </div>
          <div className="sbadge" style={{background:darkMode?'rgba(212,168,71,0.05)':'rgba(0,0,0,0.04)',border:`1px solid ${darkMode?'rgba(212,168,71,0.1)':borderC}`,color:darkMode?'rgba(160,144,112,0.7)':theme.text3}}>📅 {new Date().toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'short'})}</div>
          <button onClick={()=>setShowWeightWidget(w=>!w)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 12px',background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'100px',color:'#f97316',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'Barlow Condensed',sans-serif"}}>
            ⚖️ {stats.weight?.[todayKey()]?`${stats.weight[todayKey()]}kg`:'+ Greutate'}
          </button>
        </div>
        {showWeightWidget&&(
          <div style={{display:'flex',gap:'8px',alignItems:'center',padding:'8px 0',borderTop:`1px solid ${darkMode?'rgba(212,168,71,0.08)':borderC}`}}>
            <span style={{fontSize:'13px',color:darkMode?'rgba(212,168,71,0.7)':'#7a6a50',fontWeight:600,whiteSpace:'nowrap'}}>⚖️ Greutate azi:</span>
            <input type="number" step="0.1" value={quickWeight} onChange={e=>setQuickWeight(e.target.value)}
              placeholder="ex: 95.8"
              style={{flex:1,background:darkMode?'rgba(212,168,71,0.06)':'rgba(0,0,0,0.05)',border:`1.5px solid ${darkMode?'rgba(212,168,71,0.2)':borderC}`,borderRadius:'10px',padding:'7px 12px',color:textC,fontSize:'15px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
            <span style={{fontSize:'13px',color:darkMode?'rgba(160,144,112,0.6)':'#7a6a50'}}>kg</span>
            <button onClick={()=>{
              if(!quickWeight||parseFloat(quickWeight)<=0)return;
              const ns=loadStats();
              ns.weight[todayKey()]=parseFloat(quickWeight);
              saveStats(ns);setStats({...ns});
              setQuickWeight('');setShowWeightWidget(false);
              showToast(`⚖️ ${quickWeight}kg salvat!`);
            }} style={{padding:'7px 14px',background:'linear-gradient(135deg,#d4a847,#f97316)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",whiteSpace:'nowrap'}}>
              SALVEAZĂ
            </button>
            <button onClick={()=>setShowWeightWidget(false)} style={{padding:'7px 10px',background:'transparent',border:`1px solid ${darkMode?'rgba(212,168,71,0.15)':borderC}`,borderRadius:'10px',color:darkMode?'rgba(160,144,112,0.5)':'#7a6a50',fontSize:'13px',cursor:'pointer'}}>✕</button>
          </div>
        )}
      </div>

      <div className="tab-bar" style={{borderBottom:`1px solid ${darkMode?'rgba(212,168,71,0.1)':borderC}`,background:darkMode?'rgba(6,8,16,0.95)':bgHdr}}>
        <button className={`tab-btn ${tab==='coach'?'active':''}`} onClick={()=>setTab('coach')} style={{color:tab==='coach'?(darkMode?'#d4a847':'#b8860b'):darkMode?'rgba(160,144,112,0.5)':'#7a6a50',borderBottomColor:tab==='coach'?(darkMode?'#d4a847':'#b8860b'):'transparent'}}>🤖 Coach</button>
        <button className={`tab-btn ${tab==='workout'?'active':''}`} onClick={()=>setTab('workout')} style={{color:tab==='workout'?(darkMode?'#d4a847':'#b8860b'):darkMode?'rgba(160,144,112,0.5)':'#7a6a50',borderBottomColor:tab==='workout'?(darkMode?'#d4a847':'#b8860b'):'transparent'}}>🏋 Workout</button>
        <button className={`tab-btn ${tab==='stats'?'active':''}`} onClick={()=>setTab('stats')} style={{color:tab==='stats'?(darkMode?'#d4a847':'#b8860b'):darkMode?'rgba(160,144,112,0.5)':'#7a6a50',borderBottomColor:tab==='stats'?(darkMode?'#d4a847':'#b8860b'):'transparent'}}>📈 Stats</button>
      </div>

      {tab==='coach'&&(<>
        <MacroBar stats={stats} dayType={dayType} theme={theme}/>
        {showMealPlan&&<div style={{padding:'0 16px 8px'}}><MealPlanAI dayType={dayType} theme={theme}/></div>}
        <div className="qbar">
          {QUICK_COMMANDS.map(q=><button key={q.cmd} className="qbtn pr" onClick={()=>sendMessage(q.cmd)}>{q.icon} {q.label}</button>)}
          <div className="sep"/>
          <button className="qbtn gn" onClick={()=>setPicker(true)}>🍽 Masă</button>
          <button className="qbtn" style={{background:'rgba(16,185,129,0.08)',borderColor:'rgba(16,185,129,0.25)',color:'#10b981'}} onClick={()=>setShowMealPlan(p=>!p)}>🥗 Plan</button>
        </div>
        <div className="msgs-wrap">
          <div className="msgs">
            {messages.length===0&&<div className="empty"><div className="eicon">🔥</div><div className="etitle">96 kg → 88 kg</div><div className="esub">Selectează tipul zilei și apasă <strong style={{color:'#fb923c'}}>Start zi</strong>.</div><div className="hchips"><span className="hchip">⚡ Antrenament</span><span className="hchip">🔥 Zi activă</span><span className="hchip">🌙 Repaus</span></div></div>}
            {messages.map((m,i)=><div key={i} className={m.role==='user'?'mu':'ma'}><div className={`mlbl ${m.role==='user'?'lu':'la'}`}>{m.role==='user'?'◆ MIHAI':'⚡ AI COACH'}</div>{m.role==='assistant'?<div>{renderMarkdown(m.content,theme)}</div>:<div style={{color:theme.text,fontSize:'16px',lineHeight:'1.5'}}>{m.display||m.content}</div>}</div>)}
            {loading&&<div className="ldots"><div className="dot"/><div className="dot"/><div className="dot"/></div>}
            <div ref={messagesEndRef}/>
          </div>
        </div>
        <div className="inpwrap">
          <div className="inpinner">
            <button className="fbtn" onClick={()=>setPicker(true)}>🍽</button>
            <textarea ref={textareaRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height='48px';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px';}} onKeyDown={handleKey} placeholder="Scrie liber sau apasă 🍽..." disabled={loading} rows={1}/>
            <button className="sbtn" onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}>↑</button>
          </div>
        </div>
      </>)}

      {tab==='workout'&&<div style={{flex:1,overflowY:'auto',minHeight:0,animation:'tabIn 0.25s ease'}}>
        <div style={{padding:'10px 14px 0',display:'flex',justifyContent:'flex-end'}}>
          <button onClick={()=>setGymMode(true)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 20px',background:'linear-gradient(135deg,#d4a847,#f97316)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:900,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.08em',boxShadow:'0 4px 20px rgba(212,168,71,0.4)',animation:'pulseBadge 3s ease-in-out infinite'}}>
            💪 GYM MODE
          </button>
        </div>
        <WorkoutTab workouts={workouts} setWorkouts={setWorkouts} onSendToCoach={sendMessage} theme={theme}/>
      </div>}
      {gymMode&&<GymMode workouts={workouts} setWorkouts={setWorkouts} onSendToCoach={sendMessage} onClose={()=>setGymMode(false)} theme={theme}/>}
      {tab==='stats'&&<div style={{flex:1,overflowY:'auto',minHeight:0,animation:'tabIn 0.25s ease'}}><StatsTab stats={stats} workouts={workouts} onSendToCoach={sendMessage} setStats={setStats} theme={theme}/></div>}

      {picker&&<FoodPicker onSend={sendMessage} onClose={()=>setPicker(false)} theme={theme}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
