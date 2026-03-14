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

// ─── Exercise Database ────────────────────────────────────────────
const MUSCLE_GROUPS = [
  { id:'piept',   label:'Piept',   icon:'💪', color:'#ef4444' },
  { id:'spate',   label:'Spate',   icon:'🔙', color:'#3b82f6' },
  { id:'umeri',   label:'Umeri',   icon:'🏋️', color:'#8b5cf6' },
  { id:'brate',   label:'Brațe',   icon:'💪', color:'#f59e0b' },
  { id:'picioare',label:'Picioare',icon:'🦵', color:'#10b981' },
  { id:'core',    label:'Core',    icon:'🎯', color:'#f97316' },
];

const EXERCISES = {
  piept: [
    { id:'bench',    name:'Bench Press (halteră)',  type:'barbell' },
    { id:'dbpress',  name:'Bench Press (gantere)',  type:'dumbbell' },
    { id:'incline',  name:'Incline Press',          type:'barbell' },
    { id:'flyes',    name:'Flyes (gantere)',         type:'dumbbell' },
    { id:'cable_fly',name:'Cable Crossover',        type:'cable' },
    { id:'dips',     name:'Dips (piept)',            type:'bodyweight' },
  ],
  spate: [
    { id:'deadlift', name:'Deadlift',               type:'barbell' },
    { id:'rows',     name:'Bent-over Rows',         type:'barbell' },
    { id:'pulldown', name:'Lat Pulldown',           type:'cable' },
    { id:'pullup',   name:'Pull-up',                type:'bodyweight' },
    { id:'seated_row',name:'Seated Cable Row',     type:'cable' },
    { id:'facepull', name:'Face Pull',              type:'cable' },
  ],
  umeri: [
    { id:'ohpress',  name:'Overhead Press',         type:'barbell' },
    { id:'dbpress_s',name:'Arnold Press',           type:'dumbbell' },
    { id:'laterals', name:'Lateral Raises',         type:'dumbbell' },
    { id:'frontrise',name:'Front Raises',           type:'dumbbell' },
    { id:'shrugs',   name:'Shrugs',                 type:'barbell' },
  ],
  brate: [
    { id:'curl',     name:'Bicep Curl (halteră)',   type:'barbell' },
    { id:'dbcurl',   name:'Bicep Curl (gantere)',   type:'dumbbell' },
    { id:'hammer',   name:'Hammer Curl',            type:'dumbbell' },
    { id:'skullcr',  name:'Skull Crushers',         type:'barbell' },
    { id:'tricepext',name:'Tricep Pushdown',        type:'cable' },
    { id:'dipstric', name:'Dips (triceps)',          type:'bodyweight' },
  ],
  picioare: [
    { id:'squat',    name:'Squat',                  type:'barbell' },
    { id:'legpress', name:'Leg Press',              type:'machine' },
    { id:'rdl',      name:'Romanian Deadlift',      type:'barbell' },
    { id:'lunge',    name:'Lunges',                 type:'dumbbell' },
    { id:'legcurl',  name:'Leg Curl',               type:'machine' },
    { id:'legext',   name:'Leg Extension',          type:'machine' },
    { id:'calf',     name:'Calf Raises',            type:'machine' },
  ],
  core: [
    { id:'plank',    name:'Plank',                  type:'bodyweight' },
    { id:'crunch',   name:'Crunch',                 type:'bodyweight' },
    { id:'lgrise',   name:'Leg Raises',             type:'bodyweight' },
    { id:'russian',  name:'Russian Twist',          type:'bodyweight' },
    { id:'cabcr',    name:'Cable Crunch',           type:'cable' },
  ],
};

const CARDIO_TYPES = [
  { id:'mers',    name:'Mers pe jos',  icon:'🚶', met:3.5, unitLabel:'min', color:'#10b981' },
  { id:'alergare',name:'Alergare',     icon:'🏃', met:9.0, unitLabel:'min', color:'#f97316' },
  { id:'munca',   name:'Muncă fizică', icon:'🔨', met:4.0, unitLabel:'min', color:'#f59e0b' },
  { id:'bicicleta',name:'Bicicletă',   icon:'🚴', met:7.5, unitLabel:'min', color:'#3b82f6' },
  { id:'inot',    name:'Înot',         icon:'🏊', met:8.0, unitLabel:'min', color:'#6366f1' },
];

// ─── Food Database ────────────────────────────────────────────────
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

const FOOD_CATS = [
  {id:'all',label:'Toate'},{id:'proteine',label:'Proteine'},{id:'carbs',label:'Carbs'},{id:'legume',label:'Legume'},{id:'grasimi',label:'Grăsimi'},
];

// ─── Constants ────────────────────────────────────────────────────
const DAY_TYPES = [
  { val:'antrenament', label:'ANTRENAMENT', labelShort:'ANTR',  icon:'⚡', gradient:'linear-gradient(135deg,#f97316,#ef4444)', color:'#f97316', glow:'rgba(249,115,22,0.4)', desc:'2.150–2.250 kcal · Carbs 140–180g' },
  { val:'normal',      label:'ZI ACTIVĂ',   labelShort:'ACTIV', icon:'🔥', gradient:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#3b82f6', glow:'rgba(59,130,246,0.4)',  desc:'1.900–2.000 kcal · Carbs 110–140g' },
  { val:'repaus',      label:'REPAUS',       labelShort:'REPAUS',icon:'🌙', gradient:'linear-gradient(135deg,#8b5cf6,#ec4899)', color:'#8b5cf6', glow:'rgba(139,92,246,0.4)',  desc:'1.700–1.800 kcal · Carbs 80–110g' },
];

const QUICK_COMMANDS = [
  {label:'Start zi',icon:'🌅',cmd:'Start zi'},
  {label:'Total zi',icon:'📊',cmd:'Total zi'},
  {label:'Analiză săpt.',icon:'📈',cmd:'Analiză săptămână'},
];

const RO_DAYS   = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

const SESSION_KEY  = 'mp_session_v5';
const STATS_KEY    = 'mp_stats_v5';
const WORKOUT_KEY  = 'mp_workout_v5';

// ─── Storage ──────────────────────────────────────────────────────
function loadSession() {
  try {
    const today=new Date().toDateString(), raw=localStorage.getItem(SESSION_KEY);
    if (!raw) return {messages:[],dayType:'normal',date:today};
    const d=JSON.parse(raw);
    return d.date!==today ? {messages:[],dayType:'normal',date:today} : d;
  } catch { return {messages:[],dayType:'normal',date:new Date().toDateString()}; }
}
function saveSession(m,dt){ try{localStorage.setItem(SESSION_KEY,JSON.stringify({messages:m,dayType:dt,date:new Date().toDateString()}));}catch{} }
function loadStats(){ try{const r=localStorage.getItem(STATS_KEY);return r?JSON.parse(r):{weight:{},daily:{}};}catch{return{weight:{},daily:{}};} }
function saveStats(s){ try{localStorage.setItem(STATS_KEY,JSON.stringify(s));}catch{} }
function loadWorkouts(){ try{const r=localStorage.getItem(WORKOUT_KEY);return r?JSON.parse(r):{days:{}};}catch{return{days:{}};} }
function saveWorkouts(w){ try{localStorage.setItem(WORKOUT_KEY,JSON.stringify(w));}catch{} }
function todayKey(){ const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// ─── Helpers ──────────────────────────────────────────────────────
function calcMacros(food,qty){ const g=food.unit==='buc'?qty*food.unitG:food.unit==='ml'?qty*food.unitG:qty,f=g/100;return{kcal:Math.round(food.kcal*f),p:Math.round(food.p*f*10)/10,c:Math.round(food.c*f*10)/10,fat:Math.round(food.f*f*10)/10}; }
function calcCaloriesBurned(met,minutes,kg=96){ return Math.round((met*3.5*kg/200)*minutes); }

// ─── Markdown ─────────────────────────────────────────────────────
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

// ─── Food Picker ──────────────────────────────────────────────────
function FoodPicker({onSend,onClose,dayType}){
  const [cat,setCat]=useState('all'),[quantities,setQuantities]=useState({});
  const currentDay=DAY_TYPES.find(d=>d.val===dayType);
  const filtered=cat==='all'?FOODS:FOODS.filter(f=>f.cat===cat);
  const setQty=(id,val)=>setQuantities(q=>({...q,[id]:val}));
  const totals=Object.entries(quantities).reduce((acc,[id,qty])=>{if(!qty||isNaN(qty)||qty<=0)return acc;const food=FOODS.find(f=>f.id===id);if(!food)return acc;const m=calcMacros(food,parseFloat(qty));return{kcal:acc.kcal+m.kcal,p:acc.p+m.p,c:acc.c+m.c,fat:acc.fat+m.fat};},{kcal:0,p:0,c:0,fat:0});
  const hasItems=Object.values(quantities).some(q=>q&&parseFloat(q)>0);
  const handleSend=()=>{const items=Object.entries(quantities).filter(([,q])=>q&&parseFloat(q)>0).map(([id,q])=>{const food=FOODS.find(f=>f.id===id);return`${food.name} ${q}${food.unit}`;});if(!items.length)return;onSend(`Masă: ${items.join(', ')}`);onClose();};
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#0d1220',borderRadius:'24px 24px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxHeight:'88vh',display:'flex',flexDirection:'column',border:'1px solid rgba(255,255,255,0.08)',borderBottom:'none'}}>
        <div style={{padding:'14px 18px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:'18px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>🍽️ ADAUGĂ MASĂ</div><div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>{currentDay?.label} · {currentDay?.desc}</div></div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'10px',color:'#64748b',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:'6px',padding:'10px 16px',overflowX:'auto',flexShrink:0}}>
          {FOOD_CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Inter',sans-serif",borderColor:cat===c.id?'#f97316':'rgba(255,255,255,0.08)',background:cat===c.id?'rgba(249,115,22,0.12)':'transparent',color:cat===c.id?'#f97316':'#64748b'}}>{c.label}</button>)}
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'0 16px'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{position:'sticky',top:0,background:'#0d1220',zIndex:2}}>
              <tr>{['ALIMENT','CANT.','MACRO'].map((h,i)=><th key={i} style={{textAlign:i===2?'right':i===1?'center':'left',padding:'8px '+(i===1?'6px':'0'),fontSize:'11px',color:'#334155',fontWeight:700,letterSpacing:'0.08em',borderBottom:'1px solid rgba(255,255,255,0.06)',width:i===1?'80px':i===2?'90px':'auto'}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(food=>{const qty=quantities[food.id]||'';const m=qty&&parseFloat(qty)>0?calcMacros(food,parseFloat(qty)):null;const active=qty&&parseFloat(qty)>0;return(
                <tr key={food.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',background:active?'rgba(249,115,22,0.04)':'transparent'}}>
                  <td style={{padding:'10px 0'}}><div style={{fontSize:'15px',fontWeight:600,color:active?'#f97316':'#94a3b8'}}>{food.emoji} {food.name}</div><div style={{fontSize:'11px',color:'#334155',marginTop:'1px'}}>{food.kcal} kcal · {food.p}g P · {food.c}g C / 100{food.unit==='buc'?'g':food.unit}</div></td>
                  <td style={{padding:'10px 6px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}><input type="number" value={qty} onChange={e=>setQty(food.id,e.target.value)} placeholder="0" style={{width:'52px',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${active?'rgba(249,115,22,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',padding:'6px 8px',color:'#e2e8f0',fontSize:'15px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/><span style={{fontSize:'11px',color:'#475569'}}>{food.unit}</span></div></td>
                  <td style={{padding:'10px 0',textAlign:'right'}}>{m?<div><div style={{fontSize:'14px',fontWeight:700,color:'#f97316'}}>{m.kcal} kcal</div><div style={{fontSize:'11px',color:'#64748b'}}>{m.p}P · {m.c}C</div></div>:<div style={{fontSize:'11px',color:'#1e293b'}}>—</div>}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
          {hasItems&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'10px'}}>{[{l:'KCAL',v:totals.kcal,c:'#f97316'},{l:'PROT',v:`${totals.p}g`,c:'#8b5cf6'},{l:'CARBS',v:`${totals.c}g`,c:'#3b82f6'},{l:'GR',v:`${totals.fat}g`,c:'#10b981'}].map(x=><div key={x.l} style={{background:'rgba(255,255,255,0.04)',borderRadius:'10px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'2px'}}>{x.l}</div><div style={{fontSize:'16px',fontWeight:800,color:x.c}}>{x.v}</div></div>)}</div>}
          <button onClick={handleSend} disabled={!hasItems} style={{width:'100%',padding:'14px',background:hasItems?'linear-gradient(135deg,#f97316,#ef4444)':'rgba(255,255,255,0.06)',border:'none',borderRadius:'14px',color:hasItems?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:hasItems?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.08em',textTransform:'uppercase',boxShadow:hasItems?'0 4px 20px rgba(249,115,22,0.35)':'none',transition:'all 0.2s'}}>
            {hasItems?`▸ TRIMITE MASA (${totals.kcal} kcal)`:'Introduceți cantitățile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Workout Tab ──────────────────────────────────────────────────
function WorkoutTab({workouts,setWorkouts,onSendToCoach}){
  const [mode,setMode]=useState('gym'); // 'gym' | 'cardio'
  const [selectedGroup,setSelectedGroup]=useState('piept');
  const [selectedEx,setSelectedEx]=useState(null);
  const [sets,setSets]=useState([]); // [{kg, reps}]
  const [cardioType,setCardioType]=useState('mers');
  const [cardioDuration,setCardioDuration]=useState('');
  const [cardioIntensity,setCardioIntensity]=useState('moderată');

  const key=todayKey();
  const todayWorkout=workouts.days[key]||{exercises:[],cardio:[]};

  const addSet=()=>setSets(s=>[...s,{kg:'',reps:''}]);
  const updateSet=(i,field,val)=>setSets(s=>s.map((set,idx)=>idx===i?{...set,[field]:val}:set));
  const removeSet=i=>setSets(s=>s.filter((_,idx)=>idx!==i));

  const saveExercise=()=>{
    if(!selectedEx||sets.length===0)return;
    const validSets=sets.filter(s=>s.kg&&s.reps&&parseFloat(s.kg)>0&&parseInt(s.reps)>0);
    if(!validSets.length)return;
    const ex=EXERCISES[selectedGroup].find(e=>e.id===selectedEx);
    const volume=validSets.reduce((a,s)=>a+parseFloat(s.kg)*parseInt(s.reps),0);
    const entry={id:selectedEx,name:ex.name,group:selectedGroup,sets:validSets,volume:Math.round(volume),time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const newW={...workouts};
    if(!newW.days[key]) newW.days[key]={exercises:[],cardio:[]};
    newW.days[key].exercises=[...newW.days[key].exercises,entry];

    // Check PR
    const allSameEx=Object.values(newW.days).flatMap(d=>d.exercises||[]).filter(e=>e.id===selectedEx);
    const maxPrev=Math.max(0,...allSameEx.slice(0,-1).map(e=>Math.max(...e.sets.map(s=>parseFloat(s.kg)))));
    const maxNew=Math.max(...validSets.map(s=>parseFloat(s.kg)));
    const isPR=maxNew>maxPrev;

    saveWorkouts(newW); setWorkouts({...newW});
    setSets([]); setSelectedEx(null);

    // Send to coach
    const setsStr=validSets.map(s=>`${s.kg}kg×${s.reps}`).join(', ');
    onSendToCoach(`Forță: ${ex.name} — ${setsStr}${isPR?' 🏆 RECORD PERSONAL':''}`);
  };

  const saveCardio=()=>{
    if(!cardioDuration||parseInt(cardioDuration)<=0)return;
    const ct=CARDIO_TYPES.find(c=>c.id===cardioType);
    const kcal=calcCaloriesBurned(ct.met,parseInt(cardioDuration));
    const entry={id:cardioType,name:ct.name,icon:ct.icon,duration:parseInt(cardioDuration),intensity:cardioIntensity,kcal,time:new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})};
    const newW={...workouts};
    if(!newW.days[key]) newW.days[key]={exercises:[],cardio:[]};
    newW.days[key].cardio=[...(newW.days[key].cardio||[]),entry];
    saveWorkouts(newW); setWorkouts({...newW});
    setCardioDuration('');
    onSendToCoach(`Activitate: ${ct.name} ${cardioDuration} min (${cardioIntensity}) — ~${kcal} kcal arse`);
  };

  const totalVolume=todayWorkout.exercises.reduce((a,e)=>a+e.volume,0);
  const totalCardioKcal=(todayWorkout.cardio||[]).reduce((a,c)=>a+c.kcal,0);

  // PR finder
  const getPR=(exId)=>{
    const allSets=Object.values(workouts.days).flatMap(d=>(d.exercises||[]).filter(e=>e.id===exId).flatMap(e=>e.sets));
    if(!allSets.length)return null;
    return Math.max(...allSets.map(s=>parseFloat(s.kg)));
  };

  return(
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>

      {/* Today summary */}
      {(todayWorkout.exercises.length>0||(todayWorkout.cardio||[]).length>0)&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
          {[{l:'EXERCIȚII',v:todayWorkout.exercises.length,c:'#f97316',bg:'rgba(249,115,22,0.08)',b:'rgba(249,115,22,0.2)'},{l:'VOLUM TOT.',v:`${(totalVolume/1000).toFixed(1)}t`,c:'#8b5cf6',bg:'rgba(139,92,246,0.08)',b:'rgba(139,92,246,0.2)'},{l:'CARDIO',v:`${totalCardioKcal}kcal`,c:'#10b981',bg:'rgba(16,185,129,0.08)',b:'rgba(16,185,129,0.2)'}].map(x=>(
            <div key={x.l} style={{background:x.bg,border:`1px solid ${x.b}`,borderRadius:'14px',padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:'10px',color:'#94a3b8',letterSpacing:'0.1em',marginBottom:'3px'}}>{x.l}</div>
              <div style={{fontSize:'20px',fontWeight:900,color:x.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mode selector */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
        {[{id:'gym',label:'🏋️ Sală',color:'#f97316'},{id:'cardio',label:'🏃 Cardio',color:'#10b981'}].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{padding:'12px',borderRadius:'12px',border:`2px solid ${mode===m.id?m.color:'rgba(255,255,255,0.07)'}`,background:mode===m.id?`${m.color}15`:'transparent',color:mode===m.id?m.color:'#64748b',fontSize:'15px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s'}}>{m.label}</button>
        ))}
      </div>

      {mode==='gym'&&(
        <>
          {/* Muscle group selector */}
          <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'2px'}}>
            {MUSCLE_GROUPS.map(g=>(
              <button key={g.id} onClick={()=>{setSelectedGroup(g.id);setSelectedEx(null);setSets([]);}} style={{padding:'8px 14px',borderRadius:'100px',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',border:'1.5px solid',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',transition:'all 0.2s',flexShrink:0,borderColor:selectedGroup===g.id?g.color:'rgba(255,255,255,0.08)',background:selectedGroup===g.id?`${g.color}18`:'transparent',color:selectedGroup===g.id?g.color:'#64748b'}}>{g.icon} {g.label}</button>
            ))}
          </div>

          {/* Exercise selector */}
          <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'12px',display:'flex',flexDirection:'column',gap:'6px'}}>
            <div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>ALEGE EXERCIȚIU</div>
            {EXERCISES[selectedGroup].map(ex=>{
              const pr=getPR(ex.id);
              return(
                <button key={ex.id} onClick={()=>{setSelectedEx(ex.id);if(sets.length===0)setSets([{kg:'',reps:''}]);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:'10px',border:`1.5px solid ${selectedEx===ex.id?'rgba(249,115,22,0.5)':'rgba(255,255,255,0.06)'}`,background:selectedEx===ex.id?'rgba(249,115,22,0.08)':'rgba(255,255,255,0.02)',cursor:'pointer',transition:'all 0.15s',textAlign:'left'}}>
                  <span style={{fontSize:'15px',fontWeight:600,color:selectedEx===ex.id?'#f97316':'#94a3b8'}}>{ex.name}</span>
                  {pr&&<span style={{fontSize:'11px',color:'#475569',background:'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:'6px'}}>PR: {pr}kg</span>}
                </button>
              );
            })}
          </div>

          {/* Sets logger */}
          {selectedEx&&(
            <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'16px',padding:'14px'}}>
              <div style={{fontSize:'13px',color:'#f97316',fontWeight:700,letterSpacing:'0.05em',marginBottom:'12px',fontFamily:"'Barlow Condensed',sans-serif",textTransform:'uppercase'}}>
                {EXERCISES[selectedGroup].find(e=>e.id===selectedEx)?.name}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'8px'}}>
                <div style={{fontSize:'11px',color:'#475569',textAlign:'center',letterSpacing:'0.08em'}}>KG</div>
                <div style={{fontSize:'11px',color:'#475569',textAlign:'center',letterSpacing:'0.08em'}}>REPS</div>
                <div style={{width:'32px'}}/>
              </div>
              {sets.map((set,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',marginBottom:'6px',alignItems:'center'}}>
                  <input type="number" value={set.kg} onChange={e=>updateSet(i,'kg',e.target.value)} placeholder="kg" style={{background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',color:'#e2e8f0',fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
                  <input type="number" value={set.reps} onChange={e=>updateSet(i,'reps',e.target.value)} placeholder="reps" style={{background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',color:'#e2e8f0',fontSize:'16px',textAlign:'center',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
                  <button onClick={()=>removeSet(i)} style={{width:'32px',height:'42px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',color:'#ef4444',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'10px'}}>
                <button onClick={addSet} style={{padding:'10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',color:'#64748b',fontSize:'14px',fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif'}}>+ Set</button>
                <button onClick={saveExercise} style={{padding:'10px',background:'linear-gradient(135deg,#f97316,#ef4444)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:800,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:'0 4px 15px rgba(249,115,22,0.3)'}}>SALVEAZĂ ▸</button>
              </div>
            </div>
          )}

          {/* Today's exercises log */}
          {todayWorkout.exercises.length>0&&(
            <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}>
              <div style={{fontSize:'12px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 SESIUNE AZI</div>
              {todayWorkout.exercises.map((ex,i)=>{
                const mg=MUSCLE_GROUPS.find(g=>g.id===ex.group);
                return(
                  <div key={i} style={{marginBottom:'10px',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',borderLeft:`3px solid ${mg?.color||'#f97316'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                      <span style={{fontSize:'14px',fontWeight:700,color:'#e2e8f0'}}>{ex.name}</span>
                      <span style={{fontSize:'11px',color:'#334155'}}>{ex.time}</span>
                    </div>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      {ex.sets.map((s,j)=>(
                        <span key={j} style={{fontSize:'13px',color:'#64748b',background:'rgba(255,255,255,0.04)',padding:'3px 8px',borderRadius:'6px'}}>{s.kg}kg×{s.reps}</span>
                      ))}
                      <span style={{fontSize:'12px',color:'#475569',marginLeft:'auto'}}>Vol: {ex.volume}kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {mode==='cardio'&&(
        <>
          {/* Cardio type */}
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {CARDIO_TYPES.map(ct=>(
              <button key={ct.id} onClick={()=>setCardioType(ct.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 16px',borderRadius:'100px',border:`1.5px solid ${cardioType===ct.id?ct.color:'rgba(255,255,255,0.08)'}`,background:cardioType===ct.id?`${ct.color}15`:'transparent',color:cardioType===ct.id?ct.color:'#64748b',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",transition:'all 0.2s'}}>
                <span style={{fontSize:'18px'}}>{ct.icon}</span>{ct.name}
              </button>
            ))}
          </div>

          {/* Duration + intensity */}
          <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>
            <div>
              <div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>DURATĂ (minute)</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
                {[15,20,30,45,60,90].map(min=>(
                  <button key={min} onClick={()=>setCardioDuration(String(min))} style={{padding:'8px 16px',borderRadius:'10px',border:`1.5px solid ${cardioDuration===String(min)?'#10b981':'rgba(255,255,255,0.08)'}`,background:cardioDuration===String(min)?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.03)',color:cardioDuration===String(min)?'#10b981':'#64748b',fontSize:'14px',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>{min}</button>
                ))}
              </div>
              <input type="number" value={cardioDuration} onChange={e=>setCardioDuration(e.target.value)} placeholder="sau introdu manual..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.08)',borderRadius:'10px',padding:'10px 14px',color:'#e2e8f0',fontSize:'16px',outline:'none',fontFamily:"'Inter',sans-serif"}}/>
            </div>
            <div>
              <div style={{fontSize:'11px',color:'#475569',letterSpacing:'0.1em',marginBottom:'8px',fontWeight:700}}>INTENSITATE</div>
              <div style={{display:'flex',gap:'8px'}}>
                {['ușoară','moderată','intensă'].map(int=>(
                  <button key={int} onClick={()=>setCardioIntensity(int)} style={{flex:1,padding:'10px',borderRadius:'10px',border:`1.5px solid ${cardioIntensity===int?'#10b981':'rgba(255,255,255,0.08)'}`,background:cardioIntensity===int?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.03)',color:cardioIntensity===int?'#10b981':'#64748b',fontSize:'13px',fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>{int}</button>
                ))}
              </div>
            </div>
            {cardioDuration&&parseInt(cardioDuration)>0&&(
              <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'12px',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>ESTIMAT ARS</div>
                <div style={{fontSize:'28px',fontWeight:900,color:'#10b981',fontFamily:"'Barlow Condensed',sans-serif"}}>{calcCaloriesBurned(CARDIO_TYPES.find(c=>c.id===cardioType).met,parseInt(cardioDuration))} kcal</div>
              </div>
            )}
            <button onClick={saveCardio} disabled={!cardioDuration||parseInt(cardioDuration)<=0} style={{padding:'14px',background:cardioDuration&&parseInt(cardioDuration)>0?'linear-gradient(135deg,#10b981,#059669)':'rgba(255,255,255,0.06)',border:'none',borderRadius:'12px',color:cardioDuration&&parseInt(cardioDuration)>0?'#fff':'#334155',fontSize:'15px',fontWeight:800,cursor:cardioDuration&&parseInt(cardioDuration)>0?'pointer':'not-allowed',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'0.05em',boxShadow:cardioDuration&&parseInt(cardioDuration)>0?'0 4px 15px rgba(16,185,129,0.3)':'none',transition:'all 0.2s'}}>
              ▸ SALVEAZĂ CARDIO
            </button>
          </div>

          {/* Cardio log */}
          {(todayWorkout.cardio||[]).length>0&&(
            <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}>
              <div style={{fontSize:'12px',color:'#475569',letterSpacing:'0.1em',fontWeight:700,textTransform:'uppercase',marginBottom:'10px'}}>📋 CARDIO AZI</div>
              {(todayWorkout.cardio||[]).map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',marginBottom:'6px',borderLeft:'3px solid #10b981'}}>
                  <span style={{fontSize:'16px'}}>{c.icon}</span>
                  <div style={{flex:1,marginLeft:'10px'}}>
                    <div style={{fontSize:'14px',fontWeight:700,color:'#e2e8f0'}}>{c.name}</div>
                    <div style={{fontSize:'12px',color:'#475569'}}>{c.duration} min · {c.intensity}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'16px',fontWeight:800,color:'#10b981'}}>{c.kcal} kcal</div>
                    <div style={{fontSize:'11px',color:'#334155'}}>{c.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── Stats Charts ─────────────────────────────────────────────────
function LineChart({data,color,label,unit,target}){
  if(!data||data.length===0)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'90px',color:'#334155',fontSize:'13px'}}>Nicio dată înregistrată</div>;
  const vals=data.map(d=>d.value),min=Math.min(...vals)-1,max=Math.max(...vals)+1,W=300,H=90;
  const px=i=>(i/(data.length-1||1))*W,py=v=>H-((v-min)/(max-min||1))*H;
  const points=data.map((d,i)=>`${px(i)},${py(d.value)}`).join(' '),last=vals[vals.length-1];
  return(<div><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}><span style={{fontSize:'11px',color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:700}}>{label}</span><span style={{fontSize:'22px',fontWeight:800,color}}>{last}{unit}</span></div>{target&&<div style={{fontSize:'11px',color:'#475569',marginBottom:'6px'}}>Țintă: {target}{unit}</div>}<svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'90px',overflow:'visible'}}><defs><linearGradient id={`g${label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`0,${H} ${points} ${W},${H}`} fill={`url(#g${label.replace(/\s/g,'')})`}/><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{data.map((d,i)=><circle key={i} cx={px(i)} cy={py(d.value)} r="3" fill={color} stroke="#080b14" strokeWidth="2"/>)}</svg><div style={{display:'flex',justifyContent:'space-between',marginTop:'2px'}}><span style={{fontSize:'10px',color:'#334155'}}>{data[0]?.date}</span><span style={{fontSize:'10px',color:'#334155'}}>{data[data.length-1]?.date}</span></div></div>);
}

function CalendarPicker({selectedDate,onSelect,stats,workouts}){
  const [viewDate,setViewDate]=useState(new Date());
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate(),today=new Date();
  const hasData=day=>{const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return stats.weight[k]||stats.daily[k]||(workouts.days[k]&&(workouts.days[k].exercises?.length>0||workouts.days[k].cardio?.length>0));};
  const hasWorkout=day=>{const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return workouts.days[k]&&(workouts.days[k].exercises?.length>0||workouts.days[k].cardio?.length>0);};
  const isSel=day=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`===selectedDate;
  const isToday=day=>day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
  const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);for(let d=1;d<=daysInMonth;d++)cells.push(d);
  return(<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}><button onClick={()=>setViewDate(new Date(year,month-1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>‹</button><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'17px',color:'#e2e8f0'}}>{RO_MONTHS[month]} {year}</span><button onClick={()=>setViewDate(new Date(year,month+1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>›</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px',marginBottom:'6px'}}>{RO_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,color:'#334155',padding:'3px 0'}}>{d}</div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>{cells.map((day,idx)=><div key={idx} onClick={()=>{if(!day)return;onSelect(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);}} style={{textAlign:'center',padding:'7px 2px',borderRadius:'9px',fontSize:'14px',fontWeight:600,cursor:day?'pointer':'default',background:isSel(day)?'linear-gradient(135deg,#f97316,#ef4444)':isToday(day)?'rgba(249,115,22,0.1)':hasData(day)?'rgba(255,255,255,0.04)':'transparent',color:isSel(day)?'#fff':isToday(day)?'#f97316':day?'#94a3b8':'transparent',border:isToday(day)&&!isSel(day)?'1px solid rgba(249,115,22,0.3)':'1px solid transparent',position:'relative',transition:'all 0.15s'}}>{day||''}{day&&hasData(day)&&!isSel(day)&&<div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'3px',height:'3px',borderRadius:'50%',background:hasWorkout(day)?'#8b5cf6':'#f97316'}}/>}</div>)}</div></div>);
}

function StatsTab({stats,workouts}){
  const [sel,setSel]=useState(todayKey());
  const prep=(key,filter,valFn)=>Object.entries(stats[key]||{}).filter(filter).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([k,v])=>{const[,m,d]=k.split('-');return{date:`${d}/${m}`,value:valFn(v)};});
  const weightData=prep('weight',()=>true,v=>parseFloat(v));
  const calData=prep('daily',([,v])=>v.calories,v=>v.calories);
  const protData=prep('daily',([,v])=>v.protein,v=>v.protein);
  const latestW=weightData.length?weightData[weightData.length-1].value:null;
  const startW=weightData.length?weightData[0].value:96;
  const lost=latestW?(startW-latestW).toFixed(1):null;
  const selWeight=stats.weight[sel],selDaily=stats.daily[sel],selWorkout=workouts.days[sel];
  const [y,m,d]=sel.split('-');
  return(<div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>{[{l:'CURENT',v:latestW??'–',u:'kg',c:'#f97316',bg:'rgba(249,115,22,0.08)',b:'rgba(249,115,22,0.2)'},{l:'PIERDUT',v:lost!==null?(parseFloat(lost)>0?`-${lost}`:`+${Math.abs(lost)}`):'–',u:'kg',c:'#4ade80',bg:'rgba(74,222,128,0.08)',b:'rgba(74,222,128,0.2)'},{l:'ZILE LOG',v:Object.keys(stats.daily||{}).length,u:'zile',c:'#3b82f6',bg:'rgba(59,130,246,0.08)',b:'rgba(59,130,246,0.2)'}].map(x=><div key={x.l} style={{background:x.bg,border:`1px solid ${x.b}`,borderRadius:'14px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',letterSpacing:'0.1em',marginBottom:'3px'}}>{x.l}</div><div style={{fontSize:'20px',fontWeight:900,color:x.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{x.v}</div><div style={{fontSize:'10px',color:'#64748b'}}>{x.u}</div></div>)}</div>
    <CalendarPicker selectedDate={sel} onSelect={setSel} stats={stats} workouts={workouts}/>
    {/* Day detail */}
    {(selWeight||selDaily||selWorkout)&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'14px',padding:'14px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'14px',color:'#64748b',letterSpacing:'0.05em',marginBottom:'12px',textTransform:'uppercase'}}>{d} {RO_MONTHS[parseInt(m)-1]} {y}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom: selWorkout?'12px':'0'}}>
        {selWeight&&<div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>GREUTATE</div><div style={{fontSize:'20px',fontWeight:800,color:'#f97316'}}>{selWeight}</div><div style={{fontSize:'10px',color:'#64748b'}}>kg</div></div>}
        {selDaily?.calories&&<div style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>CALORII</div><div style={{fontSize:'20px',fontWeight:800,color:'#3b82f6'}}>{selDaily.calories}</div><div style={{fontSize:'10px',color:'#64748b'}}>kcal</div></div>}
        {selDaily?.protein&&<div style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px'}}>PROTEINE</div><div style={{fontSize:'20px',fontWeight:800,color:'#8b5cf6'}}>{selDaily.protein}</div><div style={{fontSize:'10px',color:'#64748b'}}>g</div></div>}
      </div>
      {selWorkout&&selWorkout.exercises?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:'#475569',marginBottom:'6px',letterSpacing:'0.08em',fontWeight:700}}>EXERCIȚII</div>{selWorkout.exercises.map((ex,i)=><div key={i} style={{fontSize:'13px',color:'#94a3b8',marginBottom:'4px'}}>▸ {ex.name} — {ex.sets.map(s=>`${s.kg}kg×${s.reps}`).join(', ')}</div>)}</div>}
      {selWorkout&&selWorkout.cardio?.length>0&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:'#475569',marginBottom:'6px',letterSpacing:'0.08em',fontWeight:700}}>CARDIO</div>{selWorkout.cardio.map((c,i)=><div key={i} style={{fontSize:'13px',color:'#94a3b8',marginBottom:'4px'}}>{c.icon} {c.name} {c.duration}min — {c.kcal} kcal</div>)}</div>}
    </div>}
    {weightData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={weightData} color="#f97316" label="Greutate" unit=" kg" target="88–90"/></div>}
    {calData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={calData} color="#3b82f6" label="Calorii" unit=" kcal" target="1900–2250"/></div>}
    {protData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={protData} color="#8b5cf6" label="Proteine" unit="g" target="160–180"/></div>}
    {weightData.length>0&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px',letterSpacing:'0.1em',color:'#64748b',textTransform:'uppercase',marginBottom:'10px'}}>📋 Jurnal Greutate</div><div style={{display:'flex',flexDirection:'column',gap:'5px'}}>{[...weightData].reverse().map((d,i,arr)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.04)'}}><span style={{fontSize:'13px',color:'#64748b'}}>{d.date}</span><span style={{fontSize:'16px',fontWeight:700,color:'#f97316'}}>{d.value} kg</span>{arr[i+1]&&<span style={{fontSize:'12px',fontWeight:600,color:d.value<arr[i+1].value?'#4ade80':'#ef4444'}}>{d.value<arr[i+1].value?'↓':'↑'}{Math.abs(d.value-arr[i+1].value).toFixed(1)}</span>}</div>)}</div></div>}
    <div style={{height:'16px'}}/>
  </div>);
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App(){
  const session=loadSession();
  const [messages,setMessages]=useState(session.messages||[]);
  const [input,setInput]=useState('');
  const [loading,setLoading]=useState(false);
  const [dayType,setDayType]=useState(session.dayType||'normal');
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState('coach');
  const [stats,setStats]=useState(loadStats());
  const [workouts,setWorkouts]=useState(loadWorkouts());
  const [picker,setPicker]=useState(false);
  const messagesEndRef=useRef(null),textareaRef=useRef(null);
  const currentDay=DAY_TYPES.find(d=>d.val===dayType);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages,loading]);
  useEffect(()=>{saveSession(messages,dayType);},[messages,dayType]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const extractAndSave=useCallback(reply=>{
    const match=reply.match(/\{"_data":\s*(\{.+\})\s*\}/);if(!match)return;
    try{const d=JSON.parse(match[1]),key=todayKey(),ns=loadStats();
    if(d.type==='weight'&&d.value)ns.weight[key]=d.value;
    if(d.type==='daily'){if(!ns.daily[key])ns.daily[key]={};if(d.calories)ns.daily[key].calories=d.calories;if(d.protein)ns.daily[key].protein=d.protein;}
    saveStats(ns);setStats({...ns});}catch{}
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
        <div className="qbar">
          {QUICK_COMMANDS.map(q=><button key={q.cmd} className="qbtn pr" onClick={()=>sendMessage(q.cmd)}>{q.icon} {q.label}</button>)}
          <div className="sep"/>
          <button className="qbtn gn" onClick={()=>setPicker(true)}>🍽️ Masă rapidă</button>
          <div className="sep"/>
          {[{icon:'😴',prefix:'Somn: '},{icon:'⚖️',prefix:'Greutate: '},{icon:'🏋️',prefix:'Forță: '},{icon:'⚡',prefix:'Energie: '}].map(q=><button key={q.prefix} className="qbtn" onClick={()=>{setInput(q.prefix);textareaRef.current?.focus();}}>{q.icon} {q.prefix.trim().replace(':','')}</button>)}
        </div>
        <div className="msgs-wrap">
          <div className="msgs">
            {messages.length===0&&<div className="empty"><div className="eicon">🔥</div><div className="etitle">96 kg → 88 kg</div><div className="esub">Selectează tipul zilei, apasă <strong style={{color:'#fb923c'}}>Start zi</strong> sau loghează prin tab-ul <strong style={{color:'#8b5cf6'}}>Workout</strong>.</div><div className="hchips"><span className="hchip">⚡ Antrenament</span><span className="hchip">🔥 Zi activă</span><span className="hchip">🌙 Repaus</span></div></div>}
            {messages.map((m,i)=><div key={i} className={m.role==='user'?'mu':'ma'}><div className={`mlbl ${m.role==='user'?'lu':'la'}`}>{m.role==='user'?'▸ MIHAI':'◆ AI COACH'}</div>{m.role==='assistant'?<div>{renderMarkdown(m.content)}</div>:<div style={{color:'#cbd5e1',fontSize:'16px',lineHeight:'1.5'}}>{m.display||m.content}</div>}</div>)}
            {loading&&<div className="ldots"><div className="dot"/><div className="dot"/><div className="dot"/></div>}
            <div ref={messagesEndRef}/>
          </div>
        </div>
        <div className="inpwrap">
          <div className="inpinner">
            <button className="fbtn" onClick={()=>setPicker(true)}>🍽️</button>
            <textarea ref={textareaRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height='48px';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px';}} onKeyDown={handleKey} placeholder="Scrie liber sau apasă 🍽️ pentru alimente..." disabled={loading} rows={1}/>
            <button className="sbtn" onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}>↑</button>
          </div>
        </div>
      </>)}

      {tab==='workout'&&<div style={{flex:1,overflowY:'auto',minHeight:0}}><WorkoutTab workouts={workouts} setWorkouts={setWorkouts} onSendToCoach={text=>{sendMessage(text);}}/></div>}

      {tab==='stats'&&<div style={{flex:1,overflowY:'auto',minHeight:0}}><StatsTab stats={stats} workouts={workouts}/></div>}

      {picker&&<FoodPicker onSend={sendMessage} onClose={()=>setPicker(false)} dayType={dayType}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
