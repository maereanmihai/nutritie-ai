import { useState, useRef, useEffect, useCallback } from "react";

// ─── System Prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `# ASISTENT PERSONAL — NUTRIȚIE, METABOLISM, PERFORMANȚĂ FIZICĂ & OPTIMIZARE HORMONALĂ

## IDENTITATE ȘI MISIUNE
Ești asistentul personal al lui Mihai. Răspunzi concis, tehnic, structurat. Formatezi cu markdown. Folosești emoji-uri.

IMPORTANT — EXTRAGERE DATE:
Când utilizatorul raportează date, adaugă JSON la final (ultima linie):
- Greutate → {"_data": {"type": "weight", "value": X.X}}
- Total zi / masă cu macro → {"_data": {"type": "daily", "calories": XXXX, "protein": XXX}}
Dacă nu există date de extras, NU adăuga JSON.

## PROFIL
| Parametru | Valoare |
|---|---|
| Nume | Mihai, 45 ani, 188 cm, ~96 kg → țintă 88–90 kg |
| TDEE | 2.550–2.750 kcal/zi |
| Antrenament | 2× Fullbody + 3× Split/săptămână, greutăți libere + aparate |

## MACRO ȚINTĂ
| Tip zi | Calorii | Carbs | Proteine | Grăsimi |
|---|---|---|---|---|
| Antrenament | 2.150–2.250 | 140–180g | 165–180g | 60–75g |
| Activă | 1.900–2.000 | 110–140g | 160–175g | 60–70g |
| Repaus | 1.700–1.800 | 80–110g | 155–170g | 60–70g |

## SUPLIMENTE
L-Carnitină, Mg bisglicinat, Zinc, Vitamax, CoQ10, D3, Omega-3, Boron, Centrum Energy, Ghimbir, Creatină 3–5g, Citrulină malat 6–8g

## REGULI
1. Proteine ≥150g întotdeauna
2. Nuci braziliene: max 1–2 buc/zi
3. Somn <6h = alertă testosteron
4. LDL monitorizat prin grăsimi saturate + fibre solubile`;

// ─── Constants & Data ─────────────────────────────────────────────
const DAY_TYPES = [
  { val:'antrenament', label:'ANTRENAMENT', labelShort:'ANTR',  icon:'⚡', gradient:'linear-gradient(135deg,#f97316,#ef4444)', color:'#f97316', glow:'rgba(249,115,22,0.4)', desc:'2.150–2.250 kcal · 165–180g prot', calTarget:2200, protTarget:172 },
  { val:'normal',      label:'ZI ACTIVĂ',   labelShort:'ACTIV', icon:'🔥', gradient:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#3b82f6', glow:'rgba(59,130,246,0.4)',  desc:'1.900–2.000 kcal · 160–175g prot', calTarget:1950, protTarget:167 },
  { val:'repaus',      label:'REPAUS',       labelShort:'REPAUS',icon:'🌙', gradient:'linear-gradient(135deg,#8b5cf6,#ec4899)', color:'#8b5cf6', glow:'rgba(139,92,246,0.4)',  desc:'1.700–1.800 kcal · 155–170g prot', calTarget:1750, protTarget:162 },
];

const MUSCLE_GROUPS = [
  { id:'piept',    label:'Piept',    icon:'💪', color:'#ef4444' },
  { id:'spate',    label:'Spate',    icon:'🔙', color:'#3b82f6' },
  { id:'umeri',    label:'Umeri',    icon:'🏋️', color:'#8b5cf6' },
  { id:'brate',    label:'Brațe',    icon:'💪', color:'#f59e0b' },
  { id:'picioare', label:'Picioare', icon:'🦵', color:'#10b981' },
  { id:'core',     label:'Core',     icon:'🎯', color:'#f97316' },
];

const EXERCISES = {
  piept:    [{id:'bench',name:'Bench Press (halteră)'},{id:'dbpress',name:'Bench Press (gantere)'},{id:'incline',name:'Incline Press'},{id:'flyes',name:'Flyes (gantere)'},{id:'cable_fly',name:'Cable Crossover'},{id:'dips',name:'Dips (piept)'}],
  spate:    [{id:'deadlift',name:'Deadlift'},{id:'rows',name:'Bent-over Rows'},{id:'pulldown',name:'Lat Pulldown'},{id:'pullup',name:'Pull-up'},{id:'seated_row',name:'Seated Cable Row'},{id:'facepull',name:'Face Pull'}],
  umeri:    [{id:'ohpress',name:'Overhead Press'},{id:'dbpress_s',name:'Arnold Press'},{id:'laterals',name:'Lateral Raises'},{id:'frontrise',name:'Front Raises'},{id:'shrugs',name:'Shrugs'}],
  brate:    [{id:'curl',name:'Bicep Curl (halteră)'},{id:'dbcurl',name:'Bicep Curl (gantere)'},{id:'hammer',name:'Hammer Curl'},{id:'skullcr',name:'Skull Crushers'},{id:'tricepext',name:'Tricep Pushdown'},{id:'dipstric',name:'Dips (triceps)'}],
  picioare: [{id:'squat',name:'Squat'},{id:'legpress',name:'Leg Press'},{id:'rdl',name:'Romanian Deadlift'},{id:'lunge',name:'Lunges'},{id:'legcurl',name:'Leg Curl'},{id:'legext',name:'Leg Extension'},{id:'calf',name:'Calf Raises'}],
  core:     [{id:'plank',name:'Plank'},{id:'crunch',name:'Crunch'},{id:'lgrise',name:'Leg Raises'},{id:'russian',name:'Russian Twist'},{id:'cabcr',name:'Cable Crunch'}],
};

const CARDIO_TYPES = [
  { id:'mers',     name:'Mers pe jos',  icon:'🚶', met:3.5, color:'#10b981' },
  { id:'alergare', name:'Alergare',     icon:'🏃', met:9.0, color:'#f97316' },
  { id:'munca',    name:'Muncă fizică', icon:'🔨', met:4.0, color:'#f59e0b' },
  { id:'bicicleta',name:'Bicicletă',    icon:'🚴', met:7.5, color:'#3b82f6' },
  { id:'inot',     name:'Înot',         icon:'🏊', met:8.0, color:'#6366f1' },
];

const FOODS = [
  { id:'ou',       name:'Ou întreg',       emoji:'🥚', unit:'buc', unitG:55,  kcal:155, p:13,  c:1.1, f:11,  cat:'proteine' },
  { id:'albus',    name:'Albuș lichid',    emoji:'🥛', unit:'ml',  unitG:1,   kcal:52,  p:11,  c:0.7, f:0.2, cat:'proteine' },
  { id:'iaurt',    name:'Iaurt proteic 2%',emoji:'🥣', unit:'g',   unitG:1,   kcal:65,  p:9,   c:5,   f:1.5, cat:'proteine' },
  { id:'branza',   name:'Brânză de vaci',  emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:12,  c:3.5, f:4,   cat:'proteine' },
  { id:'parmezan', name:'Parmezan',        emoji:'🧀', unit:'g',   unitG:1,   kcal:431, p:38,  c:0,   f:29,  cat:'proteine' },
  { id:'vita',     name:'Vită mușchi',     emoji:'🥩', unit:'g',   unitG:1,   kcal:158, p:26,  c:0,   f:6,   cat:'proteine' },
  { id:'pui',      name:'Piept pui',       emoji:'🍗', unit:'g',   unitG:1,   kcal:165, p:31,  c:0,   f:3.6, cat:'proteine' },
  { id:'pulpe',    name:'Pulpe pui',       emoji:'🍗', unit:'g',   unitG:1,   kcal:209, p:26,  c:0,   f:11,  cat:'proteine' },
  { id:'pastrav',  name:'Păstrăv',         emoji:'🐟', unit:'g',   unitG:1,   kcal:148, p:21,  c:0,   f:7,   cat:'proteine' },
  { id:'cartof_d', name:'Cartof dulce',    emoji:'🍠', unit:'g',   unitG:1,   kcal:86,  p:1.6, c:20,  f:0.1, cat:'carbs' },
  { id:'cartof',   name:'Cartof',          emoji:'🥔', unit:'g',   unitG:1,   kcal:77,  p:2,   c:17,  f:0.1, cat:'carbs' },
  { id:'ovaz',     name:'Ovăz',            emoji:'🌾', unit:'g',   unitG:1,   kcal:389, p:17,  c:66,  f:7,   cat:'carbs' },
  { id:'ciuperci', name:'Ciuperci',        emoji:'🍄', unit:'g',   unitG:1,   kcal:22,  p:3.1, c:3.3, f:0.3, cat:'legume' },
  { id:'sfecla',   name:'Sfeclă roșie',    emoji:'🫐', unit:'g',   unitG:1,   kcal:43,  p:1.6, c:9.6, f:0.2, cat:'legume' },
  { id:'varza',    name:'Varză',           emoji:'🥬', unit:'g',   unitG:1,   kcal:25,  p:1.3, c:5.8, f:0.1, cat:'legume' },
  { id:'varzam',   name:'Varză murată',    emoji:'🥬', unit:'g',   unitG:1,   kcal:19,  p:0.9, c:4.3, f:0.1, cat:'legume' },
  { id:'ulei',     name:'Ulei măsline',    emoji:'🫒', unit:'ml',  unitG:0.9, kcal:884, p:0,   c:0,   f:100, cat:'grasimi' },
  { id:'chia',     name:'Semințe chia',    emoji:'🌱', unit:'g',   unitG:1,   kcal:486, p:17,  c:42,  f:31,  cat:'grasimi' },
  { id:'psyllium', name:'Psyllium',        emoji:'🌿', unit:'g',   unitG:1,   kcal:200, p:2,   c:85,  f:1,   cat:'grasimi' },
];

const FOOD_CATS = [{id:'all',label:'Toate'},{id:'proteine',label:'Proteine'},{id:'carbs',label:'Carbs'},{id:'legume',label:'Legume'},{id:'grasimi',label:'Grăsimi'}];

const DEFAULT_TEMPLATES = [
  { id:'mic_dejun', name:'Mic dejun standard', icon:'🌅', items:[{id:'ou',qty:3},{id:'albus',qty:100},{id:'ovaz',qty:50}] },
  { id:'post_antr', name:'Post-antrenament',   icon:'💪', items:[{id:'pui',qty:200},{id:'cartof_d',qty:150},{id:'branza',qty:50}] },
  { id:'pranz',     name:'Prânz proteic',      icon:'🍽️', items:[{id:'pui',qty:180},{id:'ciuperci',qty:100},{id:'varza',qty:100},{id:'ulei',qty:10}] },
  { id:'cina',      name:'Cină ușoară',        icon:'🌙', items:[{id:'pastrav',qty:200},{id:'varza',qty:150},{id:'sfecla',qty:80}] },
];

const QUICK_COMMANDS = [
  {label:'Start zi', icon:'🌅', cmd:'Start zi'},
  {label:'Total zi', icon:'📊', cmd:'Total zi'},
  {label:'Analiză săpt.', icon:'📈', cmd:'Analiză săptămână'},
];

const RO_DAYS   = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

// ─── Storage keys ─────────────────────────────────────────────────
const SESSION_KEY   = 'mp_session_v6';
const STATS_KEY     = 'mp_stats_v6';
const WORKOUT_KEY   = 'mp_workout_v6';
const PATTERN_KEY   = 'mp_patterns_v1';
const TEMPLATES_KEY = 'mp_templates_v1';
const PHOTOS_KEY    = 'mp_photos_v1';
const WEEKLY_KEY    = 'mp_weekly_v1';
const NOTIF_KEY     = 'mp_notif_v1';

// ─── Storage helpers ──────────────────────────────────────────────
function ls(key, def) { try { const r=localStorage.getItem(key); return r?JSON.parse(r):def; } catch { return def; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function loadSession() {
  const today=new Date().toDateString(), d=ls(SESSION_KEY,null);
  if (!d||d.date!==today) return {messages:[],dayType:'normal',date:today};
  return d;
}
function saveSession(m,dt){ lsSet(SESSION_KEY,{messages:m,dayType:dt,date:new Date().toDateString()}); }
function loadStats()    { return ls(STATS_KEY,   {weight:{},daily:{}}); }
function saveStats(s)   { lsSet(STATS_KEY,s); }
function loadWorkouts() { return ls(WORKOUT_KEY, {days:{}}); }
function saveWorkouts(w){ lsSet(WORKOUT_KEY,w); }

function todayKey() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// ─── Helpers ──────────────────────────────────────────────────────
function calcMacros(food,qty){ const g=food.unit==='buc'?qty*food.unitG:food.unit==='ml'?qty*food.unitG:qty,f=g/100; return{kcal:Math.round(food.kcal*f),p:Math.round(food.p*f*10)/10,c:Math.round(food.c*f*10)/10,fat:Math.round(food.f*f*10)/10}; }
function calcTemplateMacros(items){ return items.reduce((a,item)=>{ const food=FOODS.find(f=>f.id===item.id); if(!food)return a; const m=calcMacros(food,item.qty); return{kcal:a.kcal+m.kcal,p:a.p+m.p,c:a.c+m.c,fat:a.fat+m.fat}; },{kcal:0,p:0,c:0,fat:0}); }
function calcBurned(met,min){ return Math.round((met*3.5*96/200)*min); }

// ─── Streak Calculator ────────────────────────────────────────────
function calcStreak(stats) {
  const keys = Object.keys(stats.daily||{}).sort((a,b)=>b.localeCompare(a));
  if (!keys.length) return 0;
  const today = todayKey();
  let streak = 0, cur = new Date(today);
  for (let i=0; i<60; i++) {
    const k = cur.toISOString().slice(0,10);
    if (stats.daily[k] || (i===0)) {
      if (stats.daily[k]) streak++;
      else if (i===0) break;
    } else break;
    cur.setDate(cur.getDate()-1);
  }
  return streak;
}

// ─── Push Notifications ───────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function scheduleNotifications(enabled) {
  lsSet(NOTIF_KEY, {enabled, setupDate: new Date().toISOString()});
}

function checkAndSendNotif(stats) {
  const cfg = ls(NOTIF_KEY, {enabled:false});
  if (!cfg.enabled || Notification.permission !== 'granted') return;
  const now = new Date();
  const h = now.getHours();
  const key = `notif_${todayKey()}`;
  const sent = ls(key, {morning:false,lunch:false,evening:false});

  if (h >= 7 && h < 9 && !sent.morning) {
    new Notification('🌅 MIHAI PERFORMANCE', {body:'Start zi! Selectează tipul zilei și activează protocolul.',icon:'/icon-192.png'});
    lsSet(key, {...sent, morning:true});
  }
  if (h >= 12 && h < 14 && !sent.lunch) {
    const todayStats = stats.daily?.[todayKey()];
    if (!todayStats?.calories) {
      new Notification('🍽️ Ai mâncat?', {body:'Nu ai logat nicio masă azi. Înregistrează prânzul!',icon:'/icon-192.png'});
      lsSet(key, {...sent, lunch:true});
    }
  }
  if (h >= 20 && h < 22 && !sent.evening) {
    if (!stats.weight?.[todayKey()]) {
      new Notification('⚖️ Greutate', {body:'Nu ai logat greutatea azi. Înregistreaz-o înainte de culcare!',icon:'/icon-192.png'});
      lsSet(key, {...sent, evening:true});
    }
  }
}

// ─── Weekly Report ────────────────────────────────────────────────
async function generateWeeklyReport(stats, workouts) {
  const keys = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return d.toISOString().slice(0,10); }).reverse();
  const weeklyNutrition = keys.map(k=>({date:k, ...stats.daily?.[k]})).filter(d=>d.calories);
  const weeklyWeight = keys.map(k=>({date:k, weight:stats.weight?.[k]})).filter(d=>d.weight);
  const weeklyWorkouts = keys.map(k=>({date:k, data:workouts.days?.[k]})).filter(d=>d.data);

  const avgCal = weeklyNutrition.length ? Math.round(weeklyNutrition.reduce((a,d)=>a+d.calories,0)/weeklyNutrition.length) : 0;
  const avgProt = weeklyNutrition.length ? Math.round(weeklyNutrition.reduce((a,d)=>a+(d.protein||0),0)/weeklyNutrition.length) : 0;
  const totalSets = weeklyWorkouts.reduce((a,d)=>a+(d.data?.exercises?.length||0),0);
  const weightChange = weeklyWeight.length>=2 ? (parseFloat(weeklyWeight[weeklyWeight.length-1].weight)-parseFloat(weeklyWeight[0].weight)).toFixed(1) : null;

  return { period: `${keys[0]} → ${keys[6]}`, avgCal, avgProt, totalSets, weightChange, logDays: weeklyNutrition.length, workoutDays: weeklyWorkouts.length };
}

// ─── Markdown renderer ────────────────────────────────────────────
function inlineFormat(t){ return t.replace(/\*\*(.+?)\*\*/g,'<strong style="color:#f1f5f9;font-weight:700">$1</strong>').replace(/\*(.+?)\*/g,'<em style="color:#94a3b8">$1</em>').replace(/`(.+?)`/g,'<code style="background:rgba(249,115,22,0.15);padding:2px 6px;border-radius:4px;font-size:13px;color:#fb923c;font-family:monospace">$1</code>'); }
function renderMarkdown(text){
  const clean=text.replace(/\{"_data":.+\}$/m,'').trim(),lines=clean.split('\n'),result=[];let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(line.trim().startsWith('|')&&i+1<lines.length&&lines[i+1].trim().match(/^\|[\s\-|]+\|$/)){const tl=[];while(i<lines.length&&lines[i].trim().startsWith('|')){tl.push(lines[i]);i++;}const hd=tl[0].split('|').filter(c=>c.trim()).map(c=>c.trim()),rows=tl.slice(2).map(r=>r.split('|').filter(c=>c.trim()).map(c=>c.trim()));result.push(<div key={i} style={{overflowX:'auto',margin:'12px 0'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}><thead><tr>{hd.map((h,j)=><th key={j} style={{textAlign:'left',padding:'8px 12px',background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.08)',color:'#64748b',fontWeight:700,fontSize:'11px',letterSpacing:'0.08em',textTransform:'uppercase'}} dangerouslySetInnerHTML={{__html:inlineFormat(h)}}/>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>{row.map((cell,ci)=><td key={ci} style={{padding:'8px 12px',color:'#e2e8f0',fontSize:'14px'}} dangerouslySetInnerHTML={{__html:inlineFormat(cell)}}/>)}</tr>)}</tbody></table></div>);continue;}
    if(line.startsWith('### ')){result.push(<h3 key={i} style={{color:'#64748b',fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',margin:'16px 0 8px',fontWeight:700}}>{line.slice(4)}</h3>);i++;continue;}
    if(line.startsWith('## ')){result.push(<h2 key={i} style={{color:'#475569',fontSize:'10px',letterSpacing:'0.25em',textTransform:'uppercase',margin:'18px 0 8px',fontWeight:700}}>{line.slice(3)}</h2>);i++;continue;}
    if(line.startsWith('# ')){result.push(<h1 key={i} style={{fontSize:'17px',fontWeight:800,margin:'16px 0 10px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{line.slice(2)}</h1>);i++;continue;}
    if(line.trim().match(/^---+$/)){result.push(<hr key={i} style={{border:'none',borderTop:'1px solid rgba(255,255,255,0.07)',margin:'14px 0'}}/>);i++;continue;}
    if(line.match(/^[\-\*] /)){const items=[];while(i<lines.length&&lines[i].match(/^[\-\*] /)){items.push(lines[i].slice(2));i++;}result.push(<ul key={i} style={{margin:'8px 0',paddingLeft:0,listStyle:'none'}}>{items.map((item,j)=><li key={j} style={{color:'#cbd5e1',marginBottom:'6px',display:'flex',gap:'10px',alignItems:'flex-start',fontSize:'15px',lineHeight:'1.55'}}><span style={{background:'linear-gradient(135deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',flexShrink:0,fontWeight:800}}>▸</span><span dangerouslySetInnerHTML={{__html:inlineFormat(item)}}/></li>)}</ul>);continue;}
    if(line.match(/^\d+\. /)){const items=[];while(i<lines.length&&lines[i].match(/^\d+\. /)){items.push(lines[i].replace(/^\d+\. /,''));i++;}result.push(<ol key={i} style={{margin:'8px 0',paddingLeft:'20px'}}>{items.map((item,j)=><li key={j} style={{color:'#cbd5e1',marginBottom:'5px',fontSize:'15px',lineHeight:'1.55'}} dangerouslySetInnerHTML={{__html:inlineFormat(item)}}/>)}</ol>);continue;}
    if(line.trim()===''){result.push(<div key={i} style={{height:'8px'}}/>);i++;continue;}
    result.push(<p key={i} style={{color:'#cbd5e1',lineHeight:'1.7',margin:'3px 0',fontSize:'15px'}} dangerouslySetInnerHTML={{__html:inlineFormat(line)}}/>);i++;
  }
  return result;
}

// ─── Running Macro Bar ────────────────────────────────────────────
function MacroBar({stats, dayType}) {
  const currentDay = DAY_TYPES.find(d=>d.val===dayType);
  const todayData  = stats.daily?.[todayKey()] || {};
  const cal  = todayData.calories || 0;
  const prot = todayData.protein  || 0;
  const calTarget  = currentDay?.calTarget  || 2000;
  const protTarget = currentDay?.protTarget || 165;
  const calPct  = Math.min(100, Math.round((cal/calTarget)*100));
  const protPct = Math.min(100, Math.round((prot/protTarget)*100));
  const calColor  = calPct>105?'#ef4444':calPct>90?'#4ade80':'#3b82f6';
  const protColor = protPct>=100?'#4ade80':protPct>75?'#f97316':'#ef4444';

  if (!todayData.calories && !todayData.protein) return null;

  return (
    <div style={{background:'rgba(8,11,20,0.95)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'8px 16px',display:'flex',gap:'16px',alignItems:'center',flexShrink:0}}>
      <div style={{flex:1}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
          <span style={{fontSize:'10px',color:'#64748b',fontWeight:700,letterSpacing:'0.08em'}}>CALORII</span>
          <span style={{fontSize:'11px',fontWeight:700,color:calColor}}>{cal} / {calTarget}</span>
        </div>
        <div style={{height:'5px',background:'rgba(255,255,255,0.06)',borderRadius:'3px',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${calPct}%`,background:calColor,borderRadius:'3px',transition:'width 0.5s ease'}}/>
        </div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
          <span style={{fontSize:'10px',color:'#64748b',fontWeight:700,letterSpacing:'0.08em'}}>PROTEINE</span>
          <span style={{fontSize:'11px',fontWeight:700,color:protColor}}>{prot}g / {protTarget}g</span>
        </div>
        <div style={{height:'5px',background:'rgba(255,255,255,0.06)',borderRadius:'3px',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${protPct}%`,background:protColor,borderRadius:'3px',transition:'width 0.5s ease'}}/>
        </div>
      </div>
      <div style={{fontSize:'10px',color:'#334155',whiteSpace:'nowrap'}}>{calTarget-cal>0?`-${calTarget-cal} kcal`:'+'+Math.abs(calTarget-cal)}</div>
    </div>
  );
}

// ─── Streak Counter ───────────────────────────────────────────────
function StreakBadge({stats}) {
  const streak = calcStreak(stats);
  if (streak === 0) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 10px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'100px',fontSize:'12px',fontWeight:700,color:'#fbbf24',whiteSpace:'nowrap'}}>
      🔥 {streak} zile
    </div>
  );
}

// ─── Food Picker ──────────────────────────────────────────────────
function FoodPicker({onSend, onClose, dayType}) {
  const [cat,      setCat]       = useState('all');
  const [quantities,setQuantities]= useState({});
  const [activeTab, setActiveTab] = useState('alimente'); // 'alimente' | 'templates'
  const [templates, setTemplates] = useState(ls(TEMPLATES_KEY, DEFAULT_TEMPLATES));
  const [editingTpl, setEditingTpl] = useState(null);
  const [newTplName, setNewTplName] = useState('');

  const currentDay = DAY_TYPES.find(d=>d.val===dayType);
  const filtered   = cat==='all'?FOODS:FOODS.filter(f=>f.cat===cat);
  const setQty     = (id,val)=>setQuantities(q=>({...q,[id]:val}));
  const totals     = Object.entries(quantities).reduce((acc,[id,qty])=>{if(!qty||isNaN(qty)||qty<=0)return acc;const food=FOODS.find(f=>f.id===id);if(!food)return acc;const m=calcMacros(food,parseFloat(qty));return{kcal:acc.kcal+m.kcal,p:acc.p+m.p,c:acc.c+m.c,fat:acc.fat+m.fat};},{kcal:0,p:0,c:0,fat:0});
  const hasItems   = Object.values(quantities).some(q=>q&&parseFloat(q)>0);

  const handleSend = ()=>{
    const items=Object.entries(quantities).filter(([,q])=>q&&parseFloat(q)>0).map(([id,q])=>{const food=FOODS.find(f=>f.id===id);return`${food.name} ${q}${food.unit}`;});
    if(!items.length)return;
    onSend(`Masă: ${items.join(', ')}`);
    onClose();
  };

  const sendTemplate = (tpl)=>{
    const items=tpl.items.map(item=>{const food=FOODS.find(f=>f.id===item.id);return food?`${food.name} ${item.qty}${food.unit}`:null;}).filter(Boolean);
    onSend(`Masă: ${items.join(', ')} (${tpl.name})`);
    onClose();
  };

  const saveAsTemplate = ()=>{
    if(!newTplName.trim()||!hasItems)return;
    const items=Object.entries(quantities).filter(([,q])=>q&&parseFloat(q)>0).map(([id,q])=>({id,qty:parseFloat(q)}));
    const newTpl={id:`tpl_${Date.now()}`,name:newTplName,icon:'⭐',items};
    const updated=[...templates,newTpl];
    setTemplates(updated);
    lsSet(TEMPLATES_KEY,updated);
    setNewTplName('');
  };

  const deleteTpl = (id)=>{
    const updated=templates.filter(t=>t.id!==id);
    setTemplates(updated);
    lsSet(TEMPLATES_KEY,updated);
  };

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#0d1220',borderRadius:'24px 24px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column',border:'1px solid rgba(255,255,255,0.08)',borderBottom:'none'}}>
        {/* Header */}
        <div style={{padding:'14px 18px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'18px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>🍽️ ADAUGĂ MASĂ</div>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'10px',color:'#64748b',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>✕</button>
          </div>
          {/* Tab switcher */}
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            {[{id:'alimente',label:'🥗 Alimente'},{id:'templates',label:'⭐ Templates'}].map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:'8px',fontSize:'13px',fontWeight:700,cursor:'pointer',border:'none',background:'transparent',color:activeTab===t.id?'#f97316':'#475569',borderBottom:`2px solid ${activeTab===t.id?'#f97316':'transparent'}`,transition:'all 0.2s',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em'}}>{t.label}</button>
            ))}
          </div>
        </div>

        {activeTab==='alimente'&&(
          <>
            <div style={{display:'flex',gap:'6px',padding:'10px 16px',overflowX:'auto',flexShrink:0}}>
              {FOOD_CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Inter',sans-serif",borderColor:cat===c.id?'#f97316':'rgba(255,255,255,0.08)',background:cat===c.id?'rgba(249,115,22,0.12)':'transparent',color:cat===c.id?'#f97316':'#64748b'}}>{c.label}</button>)}
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'0 16px'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead style={{position:'sticky',top:0,background:'#0d1220',zIndex:2}}>
                  <tr>{['ALIMENT','CANT.','MACRO'].map((h,i)=><th key={i} style={{textAlign:i===2?'right':i===1?'center':'left',padding:'8px '+(i===1?'6px':'0'),fontSize:'11px',color:'#334155',fontWeight:700,letterSpacing:'0.08em',borderBottom:'1px solid rgba(255,255,255,0.06)',width:i===1?'80px':i===2?'90px':'auto'}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map(food=>{const qty=quantities[food.id]||'';const m=qty&&parseFloat(qty)>0?calcMacros(food,parseFloat(qty)):null;const active=!!(qty&&parseFloat(qty)>0);return(
                    <tr key={food.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',background:active?'rgba(249,115,22,0.04)':'transparent'}}>
                      <td style={{padding:'10px 0'}}><div style={{fontSize:'15px',fontWeight:600,color:active?'#f97316':'#94a3b8'}}>{food.emoji} {food.name}</div><div style={{fontSize:'11px',color:'#334155',marginTop:'1px'}}>{food.kcal} kcal · {food.p}g P / 100{food.unit==='buc'?'g':food.unit}</div></td>
                      <td style={{padding:'10px 6px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}><input type="number" value={qty} onChange={e=>setQty(food.id,e.target.value)} placeholder="0" style={{width:'52px',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${active?'rgba(249,115,22,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',padding:'6px 8px',color:'#e2e8f0',fontSize:'15px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/><span style={{fontSize:'11px',color:'#475569'}}>{food.unit}</span></div></td>
                      <td style={{padding:'10px 0',textAlign:'right'}}>{m?<div><div style={{fontSize:'14px',fontWeight:700,color:'#f97316'}}>{m.kcal} kcal</div><div style={{fontSize:'11px',color:'#64748b'}}>{m.p}P</div></div>:<div style={{fontSize:'11px',color:'#1e293b'}}>—</div>}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
              {hasItems&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'10px'}}>{[{l:'KCAL',v:totals.kcal,c:'#f97316'},{l:'PROT',v:`${totals.p}g`,c:'#8b5cf6'},{l:'CARBS',v:`${totals.c}g`,c:'#3b82f6'},{l:'GR',v:`${totals.fat}g`,c:'#10b981'}].map(x=><div key={x.l} style={{background:'rgba(255,255,255,0.04)',borderRadius:'10px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'16px',fontWeight:800,color:x.c}}>{x.v}</div></div>)}</div>}
              {hasItems&&(
                <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                  <input value={newTplName} onChange={e=>setNewTplName(e.target.value)} placeholder="Salvează ca template..." style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',padding:'8px 12px',color:'#e2e8f0',fontSize:'14px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
                  <button onClick={saveAsTemplate} disabled={!newTplName.trim()} style={{padding:'8px 14px',background:newTplName.trim()?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.04)',border:`1px solid ${newTplName.trim()?'rgba(251,191,36,0.3)':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',color:newTplName.trim()?'#fbbf24':'#334155',fontSize:'13px',fontWeight:700,cursor:newTplName.trim()?'pointer':'not-allowed'}}>⭐ Salvează</button>
                </div>
              )}
              <button onClick={handleSend} disabled={!hasItems} style={{width:'100%',padding:'14px',background:hasItems?'linear-gradient(135deg,#f97316,#ef4444)':'rgba(255,255,255,0.06)',border:'none',borderRadius:'14px',color:hasItems?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:hasItems?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.08em',textTransform:'uppercase',boxShadow:hasItems?'0 4px 20px rgba(249,115,22,0.35)':'none',transition:'all 0.2s'}}>
                {hasItems?`▸ TRIMITE MASA (${totals.kcal} kcal)`:'Introduceți cantitățile'}
              </button>
            </div>
          </>
        )}

        {activeTab==='templates'&&(
          <div style={{overflowY:'auto',flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
            {templates.map(tpl=>{
              const m=calcTemplateMacros(tpl.items);
              return(
                <div key={tpl.id} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'14px',padding:'14px',display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{fontSize:'28px',flexShrink:0}}>{tpl.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'15px',fontWeight:700,color:'#e2e8f0',marginBottom:'4px'}}>{tpl.name}</div>
                    <div style={{display:'flex',gap:'10px'}}>
                      <span style={{fontSize:'12px',color:'#f97316',fontWeight:600}}>{m.kcal} kcal</span>
                      <span style={{fontSize:'12px',color:'#8b5cf6'}}>{m.p}g prot</span>
                      <span style={{fontSize:'12px',color:'#3b82f6'}}>{m.c}g carbs</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>sendTemplate(tpl)} style={{padding:'8px 16px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>▸</button>
                    {!DEFAULT_TEMPLATES.find(d=>d.id===tpl.id)&&<button onClick={()=>deleteTpl(tpl.id)} style={{padding:'8px 10px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',fontSize:'13px',cursor:'pointer'}}>×</button>}
                  </div>
                </div>
              );
            })}
            <div style={{height:'20px'}}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Progress Photos ──────────────────────────────────────────────
function PhotosPanel() {
  const [photos, setPhotos] = useState(ls(PHOTOS_KEY, []));
  const fileRef = useRef(null);

  const addPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newPhoto = { id: Date.now(), date: todayKey(), dataUrl: ev.target.result, note: '' };
      const updated = [...photos, newPhoto].slice(-20); // max 20 photos
      setPhotos(updated);
      lsSet(PHOTOS_KEY, updated);
    };
    reader.readAsDataURL(file);
  };

  const deletePhoto = (id) => {
    const updated = photos.filter(p=>p.id!==id);
    setPhotos(updated);
    lsSet(PHOTOS_KEY, updated);
  };

  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#94a3b8',letterSpacing:'0.05em',textTransform:'uppercase'}}>📸 PROGRES FOTO</div>
        <button onClick={()=>fileRef.current?.click()} style={{padding:'7px 14px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'10px',color:'#3b82f6',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif"}}>+ ADAUGĂ</button>
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={addPhoto} style={{display:'none'}}/>
      </div>
      {photos.length===0?(
        <div style={{textAlign:'center',color:'#334155',fontSize:'13px',padding:'20px'}}>Nicio poză adăugată. Fotografiază progresul săptămânal!</div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
          {[...photos].reverse().map(photo=>{
            const [,m,d]=photo.date.split('-');
            return(
              <div key={photo.id} style={{position:'relative',borderRadius:'10px',overflow:'hidden',aspectRatio:'1'}}>
                <img src={photo.dataUrl} alt={photo.date} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.7))',padding:'6px 8px'}}>
                  <div style={{fontSize:'11px',color:'#fff',fontWeight:600}}>{d}/{m}</div>
                </div>
                <button onClick={()=>deletePhoto(photo.id)} style={{position:'absolute',top:'4px',right:'4px',background:'rgba(0,0,0,0.6)',border:'none',borderRadius:'50%',width:'22px',height:'22px',color:'#fff',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Muscle Volume Chart ──────────────────────────────────────────
function MuscleVolumeChart({workouts}) {
  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return d.toISOString().slice(0,10); });
  const volumeByGroup = {};
  MUSCLE_GROUPS.forEach(g=>{ volumeByGroup[g.id]=0; });
  last7.forEach(date=>{
    const day=workouts.days?.[date];
    if(!day?.exercises) return;
    day.exercises.forEach(ex=>{
      if(volumeByGroup[ex.group]!==undefined) volumeByGroup[ex.group]+=ex.sets?.length||0;
    });
  });
  const maxSets = Math.max(1,...Object.values(volumeByGroup));
  const totalSets = Object.values(volumeByGroup).reduce((a,b)=>a+b,0);
  if (totalSets===0) return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#94a3b8',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'8px'}}>💪 VOLUM / GRUPĂ (7 zile)</div>
      <div style={{textAlign:'center',color:'#334155',fontSize:'13px',padding:'12px'}}>Nicio sesiune în ultimele 7 zile</div>
    </div>
  );
  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'15px',color:'#94a3b8',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'14px'}}>💪 VOLUM / GRUPĂ (7 zile)</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {MUSCLE_GROUPS.map(g=>{
          const sets=volumeByGroup[g.id]||0;
          const pct=Math.round((sets/maxSets)*100);
          const warn=sets<6&&totalSets>10;
          return(
            <div key={g.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                <span style={{fontSize:'12px',color:warn?'#ef4444':'#94a3b8',fontWeight:600}}>{g.icon} {g.label}{warn?' ⚠️':''}</span>
                <span style={{fontSize:'12px',fontWeight:700,color:g.color}}>{sets} seturi</span>
              </div>
              <div style={{height:'6px',background:'rgba(255,255,255,0.05)',borderRadius:'3px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:g.color,borderRadius:'3px',transition:'width 0.5s ease',opacity:sets===0?0.2:1}}/>
              </div>
            </div>
          );
        })}
      </div>
      {MUSCLE_GROUPS.some(g=>volumeByGroup[g.id]<4&&totalSets>8)&&(
        <div style={{marginTop:'12px',padding:'8px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',fontSize:'12px',color:'#fca5a5'}}>
          ⚠️ Dezechilibru detectat — grupele cu sub 4 seturi necesită atenție
        </div>
      )}
    </div>
  );
}

// ─── Weekly Report ────────────────────────────────────────────────
function WeeklyReportPanel({stats, workouts}) {
  const [report,  setReport]  = useState(ls(WEEKLY_KEY, null));
  const [loading, setLoading] = useState(false);
  const [expanded,setExpanded]= useState(false);

  useEffect(()=>{
    // Auto-run on Monday
    const day=new Date().getDay();
    const lastRun=report?.date;
    const lastRunDay=lastRun?new Date(lastRun).getDay():null;
    if(day===1&&lastRunDay!==1&&Object.keys(stats.daily||{}).length>=3) runReport();
  },[]);

  async function runReport(){
    setLoading(true);
    setExpanded(true);
    const data=await generateWeeklyReport(stats,workouts);
    const workoutDetails=Object.entries(workouts.days||{}).slice(-7).map(([date,d])=>`${date}: ${d.exercises?.length||0} exerciții, ${d.cardio?.length||0} sesiuni cardio`).join('\n');
    const prompt=`Generează un raport săptămânal concis pentru Mihai.

DATE SĂPTĂMÂNA ${data.period}:
- Zile logate: ${data.logDays}/7
- Calorii medii/zi: ${data.avgCal} kcal (țintă ~2000)
- Proteine medii/zi: ${data.avgProt}g (țintă 160-175g)
- Zile antrenament: ${data.workoutDays}
- Total exerciții: ${data.totalSets}
- Schimbare greutate: ${data.weightChange!==null?data.weightChange+'kg':'neînregistrată'}
${workoutDetails}

Format: scurt, cu emoji, maxim 200 cuvinte. Include: rezumat performanță, ce a mers bine, ce trebuie îmbunătățit, obiectiv săptămâna viitoare. Răspunde în română.`;

    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})});
      const d=await res.json();
      const text=d.content?.[0]?.text||'Eroare.';
      const newReport={text,date:new Date().toISOString(),data};
      setReport(newReport);
      lsSet(WEEKLY_KEY,newReport);
    }catch{setReport({text:'⚠️ Eroare de conexiune.',date:new Date().toISOString()});}
    setLoading(false);
  }

  const lastRunLabel=report?.date?new Date(report.date).toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'short'}):null;

  return(
    <div style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.18)',borderRadius:'16px',overflow:'hidden'}}>
      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',color:'#10b981',letterSpacing:'0.05em'}}>📅 RAPORT SĂPTĂMÂNAL</div>
          <div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>{lastRunLabel?`Generat: ${lastRunLabel}`:'Se generează automat luni'}</div>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <button onClick={e=>{e.stopPropagation();runReport();}} disabled={loading} style={{padding:'7px 14px',background:loading?'rgba(16,185,129,0.1)':'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'10px',color:'#10b981',fontSize:'13px',fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:"'Barlow Condensed',sans-serif",opacity:loading?0.6:1}}>
            {loading?'⏳':'▸ GENEREAZĂ'}
          </button>
          <span style={{color:'#475569',fontSize:'18px'}}>{expanded?'↑':'↓'}</span>
        </div>
      </div>
      {expanded&&(
        <div style={{borderTop:'1px solid rgba(16,185,129,0.12)',padding:'16px'}}>
          {loading&&<div style={{display:'flex',gap:'6px',justifyContent:'center',padding:'16px'}}>{[0,1,2].map(i=><div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div>}
          {!loading&&report&&<div>{renderMarkdown(report.text)}</div>}
          {!loading&&!report&&<div style={{textAlign:'center',color:'#334155',fontSize:'13px',padding:'16px'}}>Apasă GENEREAZĂ pentru raportul săptămânal.</div>}
        </div>
      )}
    </div>
  );
}

// ─── Pattern Detection ────────────────────────────────────────────
function PatternPanel({stats, workouts}) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [expanded,setExpanded]= useState(false);

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(PATTERN_KEY);
      if(saved){const d=JSON.parse(saved);setReport(d.report);setLastRun(d.date);const days=(Date.now()-new Date(d.date).getTime())/(1000*60*60*24);if(days>=7)checkAndAutoRun();}
      else checkAndAutoRun();
    }catch{}
  },[]);

  function checkAndAutoRun(){if(Object.keys(stats.daily||{}).length>=7)runAnalysis(true);}

  async function runAnalysis(silent=false){
    const logDays=Object.keys(stats.daily||{}).length;if(logDays<3)return;
    if(!silent)setExpanded(true);setLoading(true);
    const weight=Object.entries(stats.weight||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-14);
    const daily=Object.entries(stats.daily||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-14);
    const days=Object.entries(workouts.days||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-14);
    const prompt=`Analizează datele lui Mihai și identifică patternuri concrete.
Greutate: ${JSON.stringify(weight)}
Nutriție: ${JSON.stringify(daily)}
Antrenamente: ${JSON.stringify(days)}
Profil: 45 ani, 188cm, ~96kg → 88-90kg, 2×fullbody+3×split/săpt.
Macro țintă: antr 2150-2250kcal/165-180g prot, activ 1900-2000/160-175g, repaus 1700-1800/155-170g.
Analiză: 1.TREND GREUTATE 2.CONSISTENȚĂ NUTRIȚIE 3.CORELAȚII 4.PUNCTE SLABE 5.RECOMANDĂRI (max 3). Direct, tehnic, română.`;
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,messages:[{role:'user',content:prompt}]})});
      const data=await res.json();const text=data.content?.[0]?.text||'Eroare.';const now=new Date().toISOString();
      setReport(text);setLastRun(now);setExpanded(true);lsSet(PATTERN_KEY,{report:text,date:now});
    }catch{setReport('⚠️ Eroare de conexiune.');}
    setLoading(false);
  }

  const logDays=Object.keys(stats.daily||{}).length;
  const lastRunLabel=lastRun?new Date(lastRun).toLocaleDateString('ro-RO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):null;

  return(
    <div style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'16px',overflow:'hidden'}}>
      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'16px',background:'linear-gradient(90deg,#8b5cf6,#ec4899)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'0.05em'}}>🧠 PATTERN DETECTION</div>
          <div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>{lastRunLabel?`Ultima: ${lastRunLabel}`:logDays>=3?'Date suficiente pentru analiză':`Necesare ${3-logDays} zile în plus`}</div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          {logDays>=3&&<button onClick={e=>{e.stopPropagation();runAnalysis();}} disabled={loading} style={{padding:'7px 14px',background:loading?'rgba(139,92,246,0.1)':'linear-gradient(135deg,#8b5cf6,#ec4899)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:"'Barlow Condensed',sans-serif",opacity:loading?0.6:1,boxShadow:loading?'none':'0 4px 15px rgba(139,92,246,0.3)'}}>{loading?'⏳':'▸ ANALIZEAZĂ'}</button>}
          <span style={{color:'#475569',fontSize:'18px'}}>{expanded?'↑':'↓'}</span>
        </div>
      </div>
      {expanded&&<div style={{borderTop:'1px solid rgba(139,92,246,0.15)',padding:'16px'}}>
        {loading&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'10px',padding:'16px'}}><div style={{display:'flex',gap:'6px'}}>{[0,1,2].map(i=><div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'linear-gradient(135deg,#8b5cf6,#ec4899)',animation:`bnc 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</div><div style={{fontSize:'13px',color:'#64748b'}}>Analizez {logDays} zile...</div></div>}
        {!loading&&report&&<div style={{fontSize:'14px',lineHeight:'1.7'}}>{renderMarkdown(report)}</div>}
        {!loading&&!report&&<div style={{textAlign:'center',color:'#334155',fontSize:'13px',padding:'16px'}}>Loghează cel puțin 3 zile pentru a activa analiza.</div>}
      </div>}
    </div>
  );
}

// ─── Notification Settings ────────────────────────────────────────
function NotifSettings() {
  const [cfg, setCfg] = useState(ls(NOTIF_KEY, {enabled:false}));
  const [perm,setPerm]= useState(typeof Notification!=='undefined'?Notification.permission:'denied');

  const toggle = async () => {
    if (!cfg.enabled) {
      const granted = await requestNotifPermission();
      setPerm(Notification.permission);
      if (granted) { const newCfg={enabled:true,setupDate:new Date().toISOString()}; setCfg(newCfg); lsSet(NOTIF_KEY,newCfg); }
    } else {
      const newCfg={...cfg,enabled:false}; setCfg(newCfg); lsSet(NOTIF_KEY,newCfg);
    }
  };

  return(
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'14px',padding:'14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div>
        <div style={{fontSize:'14px',fontWeight:700,color:'#94a3b8'}}>🔔 Notificări push</div>
        <div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>Dimineața 8:00 · Prânz 12:30 · Seara 20:30</div>
      </div>
      <button onClick={toggle} style={{padding:'8px 16px',borderRadius:'100px',border:'none',background:cfg.enabled?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)',color:cfg.enabled?'#4ade80':'#475569',fontSize:'13px',fontWeight:700,cursor:'pointer',border:`1px solid ${cfg.enabled?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)'}`}}>
        {cfg.enabled?'✓ Activ':'Activează'}
      </button>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────
function LineChart({data,color,label,unit,target}){
  if(!data||data.length===0)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'90px',color:'#334155',fontSize:'13px'}}>Nicio dată</div>;
  const vals=data.map(d=>d.value),min=Math.min(...vals)-1,max=Math.max(...vals)+1,W=300,H=90;
  const px=i=>(i/(data.length-1||1))*W,py=v=>H-((v-min)/(max-min||1))*H;
  const points=data.map((d,i)=>`${px(i)},${py(d.value)}`).join(' '),last=vals[vals.length-1];
  return(<div><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}><span style={{fontSize:'11px',color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:700}}>{label}</span><span style={{fontSize:'22px',fontWeight:800,color}}>{last}{unit}</span></div>{target&&<div style={{fontSize:'11px',color:'#475569',marginBottom:'6px'}}>Țintă: {target}{unit}</div>}<svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'90px',overflow:'visible'}}><defs><linearGradient id={`g${label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`0,${H} ${points} ${W},${H}`} fill={`url(#g${label.replace(/\s/g,'')})`}/><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{data.map((d,i)=><circle key={i} cx={px(i)} cy={py(d.value)} r="3" fill={color} stroke="#080b14" strokeWidth="2"/>)}</svg><div style={{display:'flex',justifyContent:'space-between',marginTop:'2px'}}><span style={{fontSize:'10px',color:'#334155'}}>{data[0]?.date}</span><span style={{fontSize:'10px',color:'#334155'}}>{data[data.length-1]?.date}</span></div></div>);
}

// ─── Calendar ─────────────────────────────────────────────────────
function CalendarPicker({selectedDate,onSelect,stats,workouts}){
  const [viewDate,setViewDate]=useState(new Date());
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate(),today=new Date();
  const k=day=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const hasData=day=>{const key=k(day);return stats.weight[key]||stats.daily[key]||(workouts.days[key]&&(workouts.days[key].exercises?.length>0||workouts.days[key].cardio?.length>0));};
  const hasWorkout=day=>{const key=k(day);return workouts.days[key]&&(workouts.days[key].exercises?.length>0||workouts.days[key].cardio?.length>0);};
  const isSel=day=>k(day)===selectedDate;
  const isToday=day=>day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
  const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);for(let d=1;d<=daysInMonth;d++)cells.push(d);
  return(<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}><button onClick={()=>setViewDate(new Date(year,month-1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>‹</button><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'17px',color:'#e2e8f0'}}>{RO_MONTHS[month]} {year}</span><button onClick={()=>setViewDate(new Date(year,month+1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>›</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px',marginBottom:'6px'}}>{RO_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,color:'#334155',padding:'3px 0'}}>{d}</div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>{cells.map((day,idx)=><div key={idx} onClick={()=>{if(!day)return;onSelect(k(day));}} style={{textAlign:'center',padding:'7px 2px',borderRadius:'9px',fontSize:'14px',fontWeight:600,cursor:day?'pointer':'default',background:isSel(day)?'linear-gradient(135deg,#f97316,#ef4444)':isToday(day)?'rgba(249,115,22,0.1)':hasData(day)?'rgba(255,255,255,0.04)':'transparent',color:isSel(day)?'#fff':isToday(day)?'#f97316':day?'#94a3b8':'transparent',border:isToday(day)&&!isSel(day)?'1px solid rgba(249,115,22,0.3)':'1px solid transparent',position:'relative',transition:'all 0.15s'}}>{day||''}{day&&hasData(day)&&!isSel(day)&&<div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'3px',height:'3px',borderRadius:'50%',background:hasWorkout(day)?'#8b5cf6':'#f97316'}}/>}</div>)}</div></div>);
}

// ─── Workout Tab ──────────────────────────────────────────────────
function WorkoutTab({workouts,setWorkouts,onSendToCoach}){
  const [mode,setMode]=useState('gym');
  const [selGroup,setSelGroup]=useState('piept');
  const [selEx,setSelEx]=useState(null);
  const [sets,setSets]=useState([]);
  const [cardioType,setCardioType]=useState('mers');
  const [cardioDur,setCardioDur]=useState('');
  const [cardioInt,setCardioInt]=useState('moderată');
  const key=todayKey();
  const todayW=workouts.days[key]||{exercises:[],cardio:[]};
  const addSet=()=>setSets(s=>[...s,{kg:'',reps:''}]);
  const updSet=(i,f,v)=>setSets(s=>s.map((set,idx)=>idx===i?{...set,[f]:v}:set));
  const rmSet=i=>setSets(s=>s.filter((_,idx)=>idx!==i));
  const getPR=exId=>{const all=Object.values(workouts.days).flatMap(d=>(d.exercises||[]).filter(e=>e.id===exId).flatMap(e=>e.sets));if(!all.length)return null;return Math.max(...all.map(s=>parseFloat(s.kg)));};
  const saveEx=()=>{
    if(!selEx||!sets.length)return;
    const valid=sets.filter(s=>s.kg&&s.reps&&parseFloat(s.kg)>0&&parseInt(s.reps)>0);if(!valid.length)return;
    const ex=EXERCISES[selGroup].find(e=>e.id===selEx);
    const vol=valid.reduce((a,s)=>a+parseFloat(s.kg)*parseInt(s.reps),0);
    const entry={id:selEx,name:ex.name,group:selGroup,sets:valid,volume:Math.round(vol),time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const nw={...workouts};if(!nw.days[key])nw.days[key]={exercises:[],cardio:[]};
    nw.days[key].exercises=[...nw.days[key].exercises,entry];
    const allEx=Object.values(nw.days).flatMap(d=>d.exercises||[]).filter(e=>e.id===selEx);
    const maxPrev=Math.max(0,...allEx.slice(0,-1).map(e=>Math.max(...e.sets.map(s=>parseFloat(s.kg)))));
    const maxNew=Math.max(...valid.map(s=>parseFloat(s.kg)));const isPR=maxNew>maxPrev;
    saveWorkouts(nw);setWorkouts({...nw});setSets([]);setSelEx(null);
    onSendToCoach(`Forță: ${ex.name} — ${valid.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}${isPR?' 🏆 RECORD PERSONAL':''}`);
  };
  const saveCardio=()=>{
    if(!cardioDur||parseInt(cardioDur)<=0)return;
    const ct=CARDIO_TYPES.find(c=>c.id===cardioType);const kcal=calcBurned(ct.met,parseInt(cardioDur));
    const entry={id:cardioType,name:ct.name,icon:ct.icon,duration:parseInt(cardioDur),intensity:cardioInt,kcal,time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const nw={...workouts};if(!nw.days[key])nw.days[key]={exercises:[],cardio:[]};
    nw.days[key].cardio=[...(nw.days[key].cardio||[]),entry];
    saveWorkouts(nw);setWorkouts({...nw});setCardioDur('');
    onSendToCoach(`Activitate: ${ct.name} ${cardioDur} min (${cardioInt}) — ~${kcal} kcal arse`);
  };
  const totalVol=todayW.exercises.reduce((a,e)=>a+e.volume,0);
  const totalCard=(todayW.cardio||[]).reduce((a,c)=>a+c.kcal,0);
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
      {(todayW.exercises.length>0||(todayW.cardio||[]).length>0)&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>{[{l:'EXERCIȚII',v:todayW.exercises.length,c:'#f97316',bg:'rgba(249,115,22,0.08)',b:'rgba(249,115,22,0.2)'},{l:'VOLUM',v:`${(totalVol/1000).toFixed(1)}t`,c:'#8b5cf6',bg:'rgba(139,92,246,0.08)',b:'rgba(139,92,246,0.2)'},{l:'CARDIO',v:`${totalCard}kcal`,c:'#10b981',bg:'rgba(16,185,129,0.08)',b:'rgba(16,185,129,0.2)'}].map(x=><div key={x.l} style={{background:x.bg,border:`1px solid ${x.b}`,borderRadius:'14px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',letterSpacing:'0.1em',marginBottom:'3px'}}>{x.l}</div><div style={{fontSize:'20px',fontWeight:900,color:x.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}</div></div>)}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>{[{id:'gym',label:'🏋️ Sală',c:'#f97316'},{id:'cardio',label:'🏃 Cardio',c:'#10b981'}].map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{padding:'12px',borderRadius:'12px',border:`2px solid ${mode===m.id?m.c:'rgba(255,255,255,0.07)'}`,background:mode===m.id?`${m.c}15`:'transparent',color:mode===m.id?m.c:'#64748b',fontSize:'15px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s'}}>{m.label}</button>)}</div>
      {mode==='gym'&&<>
        <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'2px'}}>{MUSCLE_GROUPS.map(g=><button key={g.id} onClick={()=>{setSelGroup(g.id);setSelEx(null);setSets([]);}} style={{padding:'8px 14px',borderRadius:'100px',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s',flexShrink:0,borderColor:selGroup===g.id?g.color:'rgba(255,255,255,0.08)',background:selGroup===g.id?`${g.color}18`:'transparent',color:selGroup===g.id?g.color:'#64748b'}}>{g.icon} {g.label}</button>)}</div>
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'12px',display:'flex',flexDirection:'column',gap:'6px'}}>
          <div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>ALEGE EXERCIȚIU</div>
          {EXERCISES[selGroup].map(ex=>{const pr=getPR(ex.id);return(<button key={ex.id} onClick={()=>{setSelEx(ex.id);if(!sets.length)setSets([{kg:'',reps:''}]);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:'10px',border:`1.5px solid ${selEx===ex.id?'rgba(249,115,22,0.5)':'rgba(255,255,255,0.06)'}`,background:selEx===ex.id?'rgba(249,115,22,0.08)':'rgba(255,255,255,0.02)',cursor:'pointer',transition:'all 0.15s',textAlign:'left'}}><span style={{fontSize:'15px',fontWeight:600,color:selEx===ex.id?'#f97316':'#94a3b8'}}>{ex.name}</span>{pr&&<span style={{fontSize:'11px',color:'#475569',background:'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:'6px'}}>PR: {pr}kg</span>}</button>);})}
        </div>
        {selEx&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'16px',padding:'14px'}}>
          <div style={{fontSize:'13px',color:'#f97316',fontWeight:700,letterSpacing:'0.05em',marginBottom:'12px',fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase'}}>{EXERCISES[selGroup].find(e=>e.id===selEx)?.name}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'8px'}}>{['KG','REPS',''].map((h,i)=><div key={i} style={{fontSize:'11px',color:'#475569',textAlign:'center',letterSpacing:'0.08em',width:i===2?'32px':'auto'}}>{h}</div>)}</div>
          {sets.map((set,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'6px',alignItems:'center'}}>
            <input type="number" value={set.kg} onChange={e=>updSet(i,'kg',e.target.value)} placeholder="kg" style={{background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',color:'#e2e8f0',fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
            <input type="number" value={set.reps} onChange={e=>updSet(i,'reps',e.target.value)} placeholder="reps" style={{background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',color:'#e2e8f0',fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
            <button onClick={()=>rmSet(i)} style={{width:'32px',height:'42px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>)}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'10px'}}>
            <button onClick={addSet} style={{padding:'10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',color:'#64748b',fontSize:'14px',fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>+ Set</button>
            <button onClick={saveEx} style={{padding:'10px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 15px rgba(249,115,22,0.3)'}}>SALVEAZĂ ▸</button>
          </div>
        </div>}
        {todayW.exercises.length>0&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}>
          <div style={{fontSize:'12px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 SESIUNE AZI</div>
          {todayW.exercises.map((ex,i)=>{const mg=MUSCLE_GROUPS.find(g=>g.id===ex.group);return(<div key={i} style={{marginBottom:'10px',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',borderLeft:`3px solid ${mg?.color||'#f97316'}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}><span style={{fontSize:'14px',fontWeight:700,color:'#e2e8f0'}}>{ex.name}</span><span style={{fontSize:'11px',color:'#334155'}}>{ex.time}</span></div><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{ex.sets.map((s,j)=><span key={j} style={{fontSize:'13px',color:'#64748b',background:'rgba(255,255,255,0.04)',padding:'3px 8px',borderRadius:'6px'}}>{s.kg}kg×{s.reps}</span>)}<span style={{fontSize:'12px',color:'#475569',marginLeft:'auto'}}>Vol: {ex.volume}kg</span></div></div>);})}
        </div>}
      </>}
      {mode==='cardio'&&<>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{CARDIO_TYPES.map(ct=><button key={ct.id} onClick={()=>setCardioType(ct.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 16px',borderRadius:'100px',border:`1.5px solid ${cardioType===ct.id?ct.color:'rgba(255,255,255,0.08)'}`,background:cardioType===ct.id?`${ct.color}15`:'transparent',color:cardioType===ct.id?ct.color:'#64748b',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",transition:'all 0.2s'}}><span style={{fontSize:'18px'}}>{ct.icon}</span>{ct.name}</button>)}</div>
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>
          <div><div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>DURATĂ (minute)</div><div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>{[15,20,30,45,60,90].map(min=><button key={min} onClick={()=>setCardioDur(String(min))} style={{padding:'8px 16px',borderRadius:'10px',border:`1.5px solid ${cardioDur===String(min)?'#10b981':'rgba(255,255,255,0.08)'}`,background:cardioDur===String(min)?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.03)',color:cardioDur===String(min)?'#10b981':'#64748b',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>{min}</button>)}</div><input type="number" value={cardioDur} onChange={e=>setCardioDur(e.target.value)} placeholder="sau introdu manual..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.08)',borderRadius:'10px',padding:'10px 14px',color:'#e2e8f0',fontSize:'16px',outline:'none',fontFamily:"'Inter',sans-serif"}}/></div>
          <div><div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>INTENSITATE</div><div style={{display:'flex',gap:'8px'}}>{['ușoară','moderată','intensă'].map(int=><button key={int} onClick={()=>setCardioInt(int)} style={{flex:1,padding:'10px',borderRadius:'10px',border:`1.5px solid ${cardioInt===int?'#10b981':'rgba(255,255,255,0.08)'}`,background:cardioInt===int?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.03)',color:cardioInt===int?'#10b981':'#64748b',fontSize:'13px',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>{int}</button>)}</div></div>
          {cardioDur&&parseInt(cardioDur)>0&&<div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>ESTIMAT ARS</div><div style={{fontSize:'28px',fontWeight:900,color:'#10b981',fontFamily:"'Barlow Condensed',sans-serif"}}>{calcBurned(CARDIO_TYPES.find(c=>c.id===cardioType).met,parseInt(cardioDur))} kcal</div></div>}
          <button onClick={saveCardio} disabled={!cardioDur||parseInt(cardioDur)<=0} style={{padding:'14px',background:cardioDur&&parseInt(cardioDur)>0?'linear-gradient(135deg,#10b981,#059669)':'rgba(255,255,255,0.06)',border:'none',borderRadius:'12px',color:cardioDur&&parseInt(cardioDur)>0?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:cardioDur&&parseInt(cardioDur)>0?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:cardioDur&&parseInt(cardioDur)>0?'0 4px 15px rgba(16,185,129,0.3)':'none',transition:'all 0.2s'}}>▸ SALVEAZĂ CARDIO</button>
        </div>
        {(todayW.cardio||[]).length>0&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}>
          <div style={{fontSize:'12px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 CARDIO AZI</div>
          {(todayW.cardio||[]).map((c,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',marginBottom:'6px',borderLeft:'3px solid #10b981'}}><span style={{fontSize:'16px'}}>{c.icon}</span><div style={{flex:1,marginLeft:'10px'}}><div style={{fontSize:'14px',fontWeight:700,color:'#e2e8f0'}}>{c.name}</div><div style={{fontSize:'12px',color:'#475569'}}>{c.duration} min · {c.intensity}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:'16px',fontWeight:800,color:'#10b981'}}>{c.kcal} kcal</div><div style={{fontSize:'11px',color:'#334155'}}>{c.time}</div></div></div>)}
        </div>}
      </>}
      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────
function StatsTab({stats, workouts}) {
  const [sel,setSel]=useState(todayKey());
  const prep=(key,filter,valFn)=>Object.entries(stats[key]||{}).filter(filter).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([k,v])=>{const[,m,d]=k.split('-');return{date:`${d}/${m}`,value:valFn(v)};});
  const weightData=prep('weight',()=>true,v=>parseFloat(v));
  const calData=prep('daily',([,v])=>v.calories,v=>v.calories);
  const protData=prep('daily',([,v])=>v.protein,v=>v.protein);
  const latestW=weightData.length?weightData[weightData.length-1].value:null;
  const startW=weightData.length?weightData[0].value:96;
  const lost=latestW?(startW-latestW).toFixed(1):null;
  const streak=calcStreak(stats);
  const selWeight=stats.weight[sel],selDaily=stats.daily[sel],selWorkout=workouts.days[sel];
  const [y,m,d]=sel.split('-');
  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
        {[{l:'CURENT',v:latestW??'–',u:'kg',c:'#f97316',bg:'rgba(249,115,22,0.08)',b:'rgba(249,115,22,0.2)'},{l:'PIERDUT',v:lost!==null?(parseFloat(lost)>0?`-${lost}`:`+${Math.abs(lost)}`):'–',u:'kg',c:'#4ade80',bg:'rgba(74,222,128,0.08)',b:'rgba(74,222,128,0.2)'},{l:'LOG',v:Object.keys(stats.daily||{}).length,u:'zile',c:'#3b82f6',bg:'rgba(59,130,246,0.08)',b:'rgba(59,130,246,0.2)'},{l:'STREAK',v:streak,u:'🔥',c:'#fbbf24',bg:'rgba(251,191,36,0.08)',b:'rgba(251,191,36,0.2)'}].map(x=><div key={x.l} style={{background:x.bg,border:`1px solid ${x.b}`,borderRadius:'12px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'9px',color:'#94a3b8',letterSpacing:'0.1em',marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'18px',fontWeight:900,color:x.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}</div><div style={{fontSize:'10px',color:'#64748b'}}>{x.u}</div></div>)}
      </div>
      <NotifSettings/>
      <CalendarPicker selectedDate={sel} onSelect={setSel} stats={stats} workouts={workouts}/>
      {/* Day detail */}
      {(selWeight||selDaily||selWorkout)&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'14px',padding:'14px'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'14px',color:'#64748b',letterSpacing:'0.05em',marginBottom:'12px',textTransform:'uppercase'}}>{d} {RO_MONTHS[parseInt(m)-1]} {y}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:selWorkout?'12px':'0'}}>
          {selWeight&&<div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>GREUTATE</div><div style={{fontSize:'20px',fontWeight:800,color:'#f97316'}}>{selWeight}</div><div style={{fontSize:'10px',color:'#64748b'}}>kg</div></div>}
          {selDaily?.calories&&<div style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>CALORII</div><div style={{fontSize:'20px',fontWeight:800,color:'#3b82f6'}}>{selDaily.calories}</div><div style={{fontSize:'10px',color:'#64748b'}}>kcal</div></div>}
          {selDaily?.protein&&<div style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>PROTEINE</div><div style={{fontSize:'20px',fontWeight:800,color:'#8b5cf6'}}>{selDaily.protein}</div><div style={{fontSize:'10px',color:'#64748b'}}>g</div></div>}
        </div>
        {selWorkout?.exercises?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:'#475569',marginBottom:'6px',letterSpacing:'0.08em',fontWeight:700}}>EXERCIȚII</div>{selWorkout.exercises.map((ex,i)=><div key={i} style={{fontSize:'13px',color:'#94a3b8',marginBottom:'4px'}}>▸ {ex.name} — {ex.sets.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}</div>)}</div>}
        {selWorkout?.cardio?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:'#475569',marginBottom:'6px',letterSpacing:'0.08em',fontWeight:700}}>CARDIO</div>{selWorkout.cardio.map((c,i)=><div key={i} style={{fontSize:'13px',color:'#94a3b8',marginBottom:'4px'}}>{c.icon} {c.name} {c.duration}min — {c.kcal} kcal</div>)}</div>}
      </div>}
      <MuscleVolumeChart workouts={workouts}/>
      {weightData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={weightData} color="#f97316" label="Greutate" unit=" kg" target="88–90"/></div>}
      {calData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={calData} color="#3b82f6" label="Calorii" unit=" kcal" target="1900–2250"/></div>}
      {protData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={protData} color="#8b5cf6" label="Proteine" unit="g" target="160–180"/></div>}
      {weightData.length>0&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px',letterSpacing:'0.1em',color:'#64748b',textTransform:'uppercase',marginBottom:'10px'}}>📋 Jurnal Greutate</div><div style={{display:'flex',flexDirection:'column',gap:'5px'}}>{[...weightData].reverse().map((d,i,arr)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.04)'}}><span style={{fontSize:'13px',color:'#64748b'}}>{d.date}</span><span style={{fontSize:'16px',fontWeight:700,color:'#f97316'}}>{d.value} kg</span>{arr[i+1]&&<span style={{fontSize:'12px',fontWeight:600,color:d.value<arr[i+1].value?'#4ade80':'#ef4444'}}>{d.value<arr[i+1].value?'↓':'↑'}{Math.abs(d.value-arr[i+1].value).toFixed(1)}</span>}</div>)}</div></div>}
      <PhotosPanel/>
      <WeeklyReportPanel stats={stats} workouts={workouts}/>
      <PatternPanel stats={stats} workouts={workouts}/>
      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App(){
  const session=loadSession();
  const [messages,setMessages]=useState(session.messages||[]);
  const [input,   setInput]   =useState('');
  const [loading, setLoading] =useState(false);
  const [dayType, setDayType] =useState(session.dayType||'normal');
  const [toast,   setToast]   =useState(null);
  const [tab,     setTab]     =useState('coach');
  const [stats,   setStats]   =useState(loadStats());
  const [workouts,setWorkouts]=useState(loadWorkouts());
  const [picker,  setPicker]  =useState(false);
  const messagesEndRef=useRef(null),textareaRef=useRef(null);
  const currentDay=DAY_TYPES.find(d=>d.val===dayType);

  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,loading]);
  useEffect(()=>{ saveSession(messages,dayType); },[messages,dayType]);

  // Notification check every 5 min
  useEffect(()=>{
    const cfg=ls(NOTIF_KEY,{enabled:false});
    if(cfg.enabled) checkAndSendNotif(stats);
    const iv=setInterval(()=>{ const c=ls(NOTIF_KEY,{enabled:false}); if(c.enabled)checkAndSendNotif(loadStats()); },5*60*1000);
    return()=>clearInterval(iv);
  },[]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const extractAndSave=useCallback(reply=>{
    const match=reply.match(/\{"_data":\s*(\{.+\})\s*\}/);if(!match)return;
    try{
      const d=JSON.parse(match[1]),key=todayKey(),ns=loadStats();
      if(d.type==='weight'&&d.value)ns.weight[key]=d.value;
      if(d.type==='daily'){if(!ns.daily[key])ns.daily[key]={};if(d.calories)ns.daily[key].calories=d.calories;if(d.protein)ns.daily[key].protein=d.protein;}
      saveStats(ns);setStats({...ns});
    }catch{}
  },[]);

  const sendMessage=useCallback(async text=>{
    if(!text.trim()||loading)return;
    const prefix=`[Context: ${currentDay?.label} — ${currentDay?.desc}]\n`;
    const userMsg={role:'user',content:text,display:text};
    const newMsgs=[...messages,userMsg];
    setMessages(newMsgs);setInput('');setLoading(true);
    if(tab!=='coach')setTab('coach');
    try{
      const apiMsgs=newMsgs.map(m=>({role:m.role,content:m.role==='user'?(m===userMsg?prefix+text:m.content):m.content}));
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,system:SYSTEM_PROMPT,messages:apiMsgs})});
      const data=await res.json();
      const reply=data.content?.[0]?.text||'Eroare la răspuns.';
      extractAndSave(reply);
      setMessages(prev=>[...prev,{role:'assistant',content:reply}]);
    }catch{setMessages(prev=>[...prev,{role:'assistant',content:'⚠️ Eroare de conexiune.'}]);}
    setLoading(false);
  },[messages,loading,dayType,currentDay,tab,extractAndSave]);

  const handleKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input);}};
  const clearHistory=()=>{setMessages([]);localStorage.removeItem(SESSION_KEY);showToast('Istoric șters');};

  return(
    <div style={{minHeight:'100vh',height:'100dvh',background:'#080b14',fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif",color:'#e2e8f0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
        .hdr{padding:0 16px;background:rgba(8,11,20,0.97);backdrop-filter:blur(20px);position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;}
        .hdr-top{display:flex;align-items:center;justify-content:space-between;padding:10px 0;gap:8px;flex-wrap:wrap;}
        .logo{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
        .logo-sub{font-size:9px;color:#475569;letter-spacing:0.15em;text-transform:uppercase;font-weight:500;margin-top:2px;}
        .day-pills{display:flex;gap:4px;}
        .day-pill{padding:5px 10px;border-radius:100px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;border:1.5px solid rgba(255,255,255,0.07);background:transparent;color:#475569;transition:all 0.2s;white-space:nowrap;font-family:'Barlow Condensed',sans-serif;}
        .day-pill.active{border-color:transparent;color:#fff;}
        .sbar{display:flex;align-items:center;gap:8px;padding:6px 0 8px;overflow-x:auto;}
        .sbar::-webkit-scrollbar{height:0;}
        .sbadge{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;}
        .tab-bar{display:flex;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(8,11,20,0.97);flex-shrink:0;}
        .tab-btn{flex:1;padding:10px;font-size:14px;font-weight:700;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:#475569;border-bottom:2px solid transparent;transition:all 0.2s;font-family:'Barlow Condensed',sans-serif;letter-spacing:0.05em;}
        .tab-btn:hover{color:#94a3b8;}
        .tab-btn.active{color:#f97316;border-bottom-color:#f97316;}
        .qbar{display:flex;gap:6px;padding:8px 16px;background:rgba(8,11,20,0.8);border-bottom:1px solid rgba(255,255,255,0.05);overflow-x:auto;align-items:center;flex-shrink:0;}
        .qbar::-webkit-scrollbar{height:0;}
        .qbtn{display:flex;align-items:center;gap:5px;padding:7px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;font-family:'Inter',sans-serif;}
        .qbtn:hover{background:rgba(255,255,255,0.08);color:#e2e8f0;transform:translateY(-1px);}
        .qbtn.pr{background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.25);color:#fb923c;}
        .qbtn.pr:hover{background:rgba(249,115,22,0.18);}
        .qbtn.gn{background:rgba(74,222,128,0.08);border-color:rgba(74,222,128,0.25);color:#4ade80;}
        .qbtn.gn:hover{background:rgba(74,222,128,0.15);}
        .sep{width:1px;height:18px;background:rgba(255,255,255,0.07);flex-shrink:0;margin:0 2px;}
        .msgs-wrap{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;}
        .msgs{max-width:800px;width:100%;margin:0 auto;padding:14px;display:flex;flex-direction:column;gap:12px;flex:1;}
        .mu{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:16px 16px 4px 16px;padding:11px 15px;align-self:flex-end;max-width:88%;}
        .ma{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:4px 16px 16px 16px;padding:13px 17px;position:relative;overflow:hidden;}
        .ma::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#f97316,#ef4444);}
        .mlbl{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:7px;}
        .lu{color:#334155;}.la{background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .ldots{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:4px 16px 16px 16px;padding:14px 18px;display:flex;align-items:center;gap:6px;}
        .dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);animation:bnc 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:0.15s;}.dot:nth-child(3){animation-delay:0.3s;}
        @keyframes bnc{0%,100%{transform:translateY(0) scale(0.8);opacity:0.4;}50%{transform:translateY(-5px) scale(1);opacity:1;}}
        .inpwrap{border-top:1px solid rgba(255,255,255,0.05);background:rgba(8,11,20,0.97);padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom));flex-shrink:0;}
        .inpinner{max-width:800px;margin:0 auto;display:flex;gap:8px;align-items:flex-end;}
        textarea{flex:1;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.08);border-radius:14px;padding:11px 15px;color:#e2e8f0;font-family:'Inter',sans-serif;font-size:16px;resize:none;outline:none;min-height:48px;max-height:140px;transition:border-color 0.2s,box-shadow 0.2s;line-height:1.5;}
        textarea:focus{border-color:rgba(249,115,22,0.35);box-shadow:0 0 0 3px rgba(249,115,22,0.07);}
        textarea::placeholder{color:#334155;}
        .fbtn{width:48px;height:48px;background:rgba(74,222,128,0.1);border:1.5px solid rgba(74,222,128,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;flex-shrink:0;transition:all 0.2s;}
        .fbtn:hover{background:rgba(74,222,128,0.2);transform:translateY(-2px);}
        .sbtn{width:48px;height:48px;background:linear-gradient(135deg,#f97316,#ef4444);border:none;border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;box-shadow:0 4px 15px rgba(249,115,22,0.3);font-size:22px;color:white;font-weight:700;}
        .sbtn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(249,115,22,0.4);}
        .sbtn:disabled{opacity:0.3;cursor:not-allowed;box-shadow:none;}
        .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 24px;text-align:center;}
        .eicon{font-size:56px;animation:pls 2.5s ease-in-out infinite;}
        @keyframes pls{0%,100%{transform:scale(1);filter:drop-shadow(0 0 20px rgba(249,115,22,0.3));}50%{transform:scale(1.06);filter:drop-shadow(0 0 35px rgba(249,115,22,0.6));}}
        .etitle{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .esub{font-size:14px;color:#475569;line-height:1.6;max-width:280px;}
        .hchips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
        .hchip{padding:5px 12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.18);border-radius:100px;font-size:12px;color:#fb923c;font-weight:600;}
        .clrbtn{padding:4px 9px;background:transparent;border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:#475569;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .clrbtn:hover{border-color:rgba(239,68,68,0.35);color:#ef4444;}
        .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(15,20,35,0.97);color:#e2e8f0;font-size:13px;font-weight:600;padding:10px 20px;border-radius:100px;border:1px solid rgba(255,255,255,0.1);z-index:100;animation:su 0.3s ease;white-space:nowrap;box-shadow:0 8px 30px rgba(0,0,0,0.5);}
        @keyframes su{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
      `}</style>

      {/* Header */}
      <div className="hdr">
        <div className="hdr-top">
          <div><div className="logo">MIHAI PERFORMANCE</div><div className="logo-sub">AI Nutrition & Fitness Coach</div></div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <StreakBadge stats={stats}/>
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
          <div className="sbadge" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#475569'}}>📅 {new Date().toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'short'})}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='coach'?'active':''}`} onClick={()=>setTab('coach')}>🤖 Coach</button>
        <button className={`tab-btn ${tab==='workout'?'active':''}`} onClick={()=>setTab('workout')}>🏋️ Workout</button>
        <button className={`tab-btn ${tab==='stats'?'active':''}`} onClick={()=>setTab('stats')}>📊 Stats</button>
      </div>

      {tab==='coach'&&(<>
        <MacroBar stats={stats} dayType={dayType}/>
        <div className="qbar">
          {QUICK_COMMANDS.map(q=><button key={q.cmd} className="qbtn pr" onClick={()=>sendMessage(q.cmd)}>{q.icon} {q.label}</button>)}
          <div className="sep"/>
          <button className="qbtn gn" onClick={()=>setPicker(true)}>🍽️ Masă rapidă</button>
          <div className="sep"/>
          {[{icon:'😴',prefix:'Somn: '},{icon:'⚖️',prefix:'Greutate: '},{icon:'🏋️',prefix:'Forță: '},{icon:'⚡',prefix:'Energie: '}].map(q=><button key={q.prefix} className="qbtn" onClick={()=>{setInput(q.prefix);textareaRef.current?.focus();}}>{q.icon} {q.prefix.replace(':','').trim()}</button>)}
        </div>
        <div className="msgs-wrap">
          <div className="msgs">
            {messages.length===0&&<div className="empty"><div className="eicon">🔥</div><div className="etitle">96 kg → 88 kg</div><div className="esub">Selectează tipul zilei, apasă <strong style={{color:'#fb923c'}}>Start zi</strong> sau loghează prin <strong style={{color:'#8b5cf6'}}>Workout</strong>.</div><div className="hchips"><span className="hchip">⚡ Antrenament</span><span className="hchip">🔥 Zi activă</span><span className="hchip">🌙 Repaus</span></div></div>}
            {messages.map((m,i)=><div key={i} className={m.role==='user'?'mu':'ma'}><div className={`mlbl ${m.role==='user'?'lu':'la'}`}>{m.role==='user'?'▸ MIHAI':'◆ AI COACH'}</div>{m.role==='assistant'?<div>{renderMarkdown(m.content)}</div>:<div style={{color:'#cbd5e1',fontSize:'16px',lineHeight:'1.5'}}>{m.display||m.content}</div>}</div>)}
            {loading&&<div className="ldots"><div className="dot"/><div className="dot"/><div className="dot"/></div>}
            <div ref={messagesEndRef}/>
          </div>
        </div>
        <div className="inpwrap">
          <div className="inpinner">
            <button className="fbtn" onClick={()=>setPicker(true)}>🍽️</button>
            <textarea ref={textareaRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height='48px';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px';}} onKeyDown={handleKey} placeholder="Scrie liber sau apasă 🍽️..." disabled={loading} rows={1}/>
            <button className="sbtn" onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}>↑</button>
          </div>
        </div>
      </>)}

      {tab==='workout'&&<div style={{flex:1,overflowY:'auto',minHeight:0}}><WorkoutTab workouts={workouts} setWorkouts={setWorkouts} onSendToCoach={sendMessage}/></div>}
      {tab==='stats'&&<div style={{flex:1,overflowY:'auto',minHeight:0}}><StatsTab stats={stats} workouts={workouts}/></div>}

      {picker&&<FoodPicker onSend={sendMessage} onClose={()=>setPicker(false)} dayType={dayType}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
