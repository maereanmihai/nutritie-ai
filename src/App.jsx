import { useState, useRef, useEffect, useCallback } from "react";

// ─── System Prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `# ASISTENT PERSONAL — NUTRIȚIE, METABOLISM, PERFORMANȚĂ FIZICĂ & OPTIMIZARE HORMONALĂ

## IDENTITATE ȘI MISIUNE
Ești asistentul personal al lui Mihai pentru nutriție, metabolism, performanță fizică și optimizare hormonală.
Analizezi alimentația, suplimentele, somnul, hidratarea și activitatea fizică exclusiv pe baza dovezilor științifice.
Nu faci presupuneri. Nu oferi opinii nevalidate. Nu repeți informații deja cunoscute. Nu pui întrebări inutile.
Răspunzi concis, tehnic și structurat. Folosești emoji-uri relevante. Formatezi cu markdown.

IMPORTANT — EXTRAGERE DATE AUTOMATE:
Când utilizatorul raportează date, adaugă ÎNTOTDEAUNA un bloc JSON la final (ultima linie):
- Greutate → {"_data": {"type": "weight", "value": X.X}}
- Total zi cu calorii și proteine → {"_data": {"type": "daily", "calories": XXXX, "protein": XXX}}
- Masă cu macro calculate → {"_data": {"type": "daily", "calories": XXXX, "protein": XXX}}
Dacă nu există date de extras, NU adăuga blocul JSON.

## PROFIL UTILIZATOR
| Parametru | Valoare |
|---|---|
| Nume | Mihai |
| Vârstă | 45 ani |
| Înălțime | 188 cm |
| Greutate curentă | ~96 kg |
| Greutate țintă | ~88–90 kg |
| Activitate de bază | Mers pe jos frecvent + antrenamente cu greutăți |
| TDEE estimat | 2.550–2.750 kcal/zi |

## OBIECTIVE PRIORITIZATE
**Prioritate 1 — Hormonal & sexual**
- Creșterea libidoului — obiectiv principal
- Optimizarea testosteronului total și liber (SHBG ↓, testosteron liber ↑)

**Prioritate 2 — Compoziție corporală**
- Scăderea grăsimii abdominale, creșterea masei musculare

**Prioritate 3 — Metabolic & cardiovascular**
- LDL < 100 mg/dL (baseline 209 → 119 mg/dL, progres activ)

**Prioritate 4 — Performanță & cogniție**
- Rezistență aerobă/anaerobă, forță, claritate mentală

## ȚINTE NUTRIȚIONALE ZILNICE
| Macro | Țintă |
|---|---|
| **Calorii** | Deficit ~500–600 kcal față de TDEE |
| **Proteine** | ≥150 g (ideal 160–180 g) |
| **Carbohidrați** | 100–140 g repaus / 140–180 g antrenament |
| **Grăsimi** | 55–75 g |
| **Fibre** | ≥30 g |
| **Hidratare** | ≥3,4 L |

## CICLIZAREA MACRO
| Tip zi | Calorii | Carbs | Proteine | Grăsimi |
|---|---|---|---|---|
| **Antrenament** | 2.150–2.250 | 140–180 g | 165–180 g | 60–75 g |
| **Activă** | 1.900–2.000 | 110–140 g | 160–175 g | 60–70 g |
| **Repaus** | 1.700–1.800 | 80–110 g | 155–170 g | 60–70 g |

## SUPLIMENTE
- L-Carnitină, Magneziu bisglicinat, Zinc, Vitamax, CoQ10, D3, Omega-3, Boron, Centrum Energy, Ghimbir, Creatină 3–5g, Citrulină malat 6–8g

## COMENZI
- **Start zi** → protocol complet
- **Masă: [descriere]** → calculează macro, running total
- **Total zi** → raport complet cu totaluri calorii și proteine
- **Greutate: X kg** → înregistrează
- **Analiză săptămână** → progres + ajustări

## REGULI ABSOLUTE
1. Nu pui întrebări inutile
2. Nu repeți informații din profil
3. Proteine ≥150 g întotdeauna
4. Nuci braziliene: max 1–2 buc/zi
5. Somn <6h = alertă testosteron (Leproult & Van Cauter, 2011)
6. LDL monitorizat prin grăsimi saturate și fibre solubile`;

// ─── Foods Database ───────────────────────────────────────────────
// macros per 100g: { kcal, p (protein), c (carbs), f (fat) }
const FOODS = [
  { id:'ou',       name:'Ou întreg',         emoji:'🥚', unit:'buc', unitG:55,  kcal:155, p:13,  c:1.1, f:11,  cat:'proteine' },
  { id:'albus',    name:'Albuș lichid',       emoji:'🥛', unit:'ml',  unitG:1,   kcal:52,  p:11,  c:0.7, f:0.2, cat:'proteine' },
  { id:'iaurt',    name:'Iaurt proteic 2%',   emoji:'🥣', unit:'g',   unitG:1,   kcal:65,  p:9,   c:5,   f:1.5, cat:'proteine' },
  { id:'branza',   name:'Brânză de vaci',     emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:12,  c:3.5, f:4,   cat:'proteine' },
  { id:'parmezan', name:'Parmezan',           emoji:'🧀', unit:'g',   unitG:1,   kcal:431, p:38,  c:0,   f:29,  cat:'proteine' },
  { id:'vita',     name:'Vită mușchi',        emoji:'🥩', unit:'g',   unitG:1,   kcal:158, p:26,  c:0,   f:6,   cat:'proteine' },
  { id:'pui',      name:'Piept pui',          emoji:'🍗', unit:'g',   unitG:1,   kcal:165, p:31,  c:0,   f:3.6, cat:'proteine' },
  { id:'pulpe',    name:'Pulpe pui',          emoji:'🍗', unit:'g',   unitG:1,   kcal:209, p:26,  c:0,   f:11,  cat:'proteine' },
  { id:'pastrav',  name:'Păstrăv',            emoji:'🐟', unit:'g',   unitG:1,   kcal:148, p:21,  c:0,   f:7,   cat:'proteine' },
  { id:'cartof_d', name:'Cartof dulce',       emoji:'🍠', unit:'g',   unitG:1,   kcal:86,  p:1.6, c:20,  f:0.1, cat:'carbs' },
  { id:'cartof',   name:'Cartof',             emoji:'🥔', unit:'g',   unitG:1,   kcal:77,  p:2,   c:17,  f:0.1, cat:'carbs' },
  { id:'ovaz',     name:'Ovăz',               emoji:'🌾', unit:'g',   unitG:1,   kcal:389, p:17,  c:66,  f:7,   cat:'carbs' },
  { id:'ciuperci', name:'Ciuperci',           emoji:'🍄', unit:'g',   unitG:1,   kcal:22,  p:3.1, c:3.3, f:0.3, cat:'legume' },
  { id:'sfecla',   name:'Sfeclă roșie',       emoji:'🫐', unit:'g',   unitG:1,   kcal:43,  p:1.6, c:9.6, f:0.2, cat:'legume' },
  { id:'varza',    name:'Varză',              emoji:'🥬', unit:'g',   unitG:1,   kcal:25,  p:1.3, c:5.8, f:0.1, cat:'legume' },
  { id:'varzam',   name:'Varză murată',       emoji:'🥬', unit:'g',   unitG:1,   kcal:19,  p:0.9, c:4.3, f:0.1, cat:'legume' },
  { id:'ulei',     name:'Ulei măsline',       emoji:'🫒', unit:'ml',  unitG:0.9, kcal:884, p:0,   c:0,   f:100, cat:'grasimi' },
  { id:'chia',     name:'Semințe chia',       emoji:'🌱', unit:'g',   unitG:1,   kcal:486, p:17,  c:42,  f:31,  cat:'grasimi' },
  { id:'psyllium', name:'Psyllium',           emoji:'🌿', unit:'g',   unitG:1,   kcal:200, p:2,   c:85,  f:1,   cat:'grasimi' },
];

const CATS = [
  { id:'all',      label:'Toate' },
  { id:'proteine', label:'Proteine' },
  { id:'carbs',    label:'Carbs' },
  { id:'legume',   label:'Legume' },
  { id:'grasimi',  label:'Grăsimi' },
];

// ─── Helpers ──────────────────────────────────────────────────────
const DAY_TYPES = [
  { val:"antrenament", label:"ANTRENAMENT", labelShort:"ANTR", icon:"⚡", gradient:"linear-gradient(135deg,#f97316,#ef4444)", color:"#f97316", glow:"rgba(249,115,22,0.4)", desc:"2.150–2.250 kcal · Carbs 140–180g" },
  { val:"normal",      label:"ZI ACTIVĂ",   labelShort:"ACTIV", icon:"🔥", gradient:"linear-gradient(135deg,#3b82f6,#6366f1)", color:"#3b82f6", glow:"rgba(59,130,246,0.4)",  desc:"1.900–2.000 kcal · Carbs 110–140g" },
  { val:"repaus",      label:"REPAUS",       labelShort:"REPAUS",icon:"🌙", gradient:"linear-gradient(135deg,#8b5cf6,#ec4899)", color:"#8b5cf6", glow:"rgba(139,92,246,0.4)",  desc:"1.700–1.800 kcal · Carbs 80–110g" },
];

const QUICK_COMMANDS = [
  { label:"Start zi", icon:"🌅", cmd:"Start zi" },
  { label:"Total zi", icon:"📊", cmd:"Total zi" },
  { label:"Analiză săpt.", icon:"📈", cmd:"Analiză săptămână" },
];
const QUICK_LOG = [
  { label:"Masă",     icon:"🍽️", prefix:"Masă: " },
  { label:"Activitate",icon:"💪", prefix:"Activitate: " },
  { label:"Somn",     icon:"😴", prefix:"Somn: " },
  { label:"Greutate", icon:"⚖️", prefix:"Greutate: " },
  { label:"Forță",    icon:"🏋️", prefix:"Forță: " },
  { label:"Energie",  icon:"⚡", prefix:"Energie: " },
];

const RO_DAYS   = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

const SESSION_KEY = 'nutritie_session_v4';
const STATS_KEY   = 'nutritie_stats_v4';

function loadSession() {
  try {
    const today = new Date().toDateString();
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { messages:[], dayType:'normal', date:today };
    const data = JSON.parse(raw);
    if (data.date !== today) return { messages:[], dayType:'normal', date:today };
    return data;
  } catch { return { messages:[], dayType:'normal', date:new Date().toDateString() }; }
}
function saveSession(messages, dayType) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ messages, dayType, date:new Date().toDateString() })); } catch {}
}
function loadStats() {
  try { const r = localStorage.getItem(STATS_KEY); return r ? JSON.parse(r) : { weight:{}, daily:{} }; }
  catch { return { weight:{}, daily:{} }; }
}
function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} }
function todayKey() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function calcMacros(food, qty) {
  const g = food.unit === 'buc' ? qty * food.unitG : food.unit === 'ml' ? qty * food.unitG : qty;
  const f = g / 100;
  return { kcal: Math.round(food.kcal*f), p: Math.round(food.p*f*10)/10, c: Math.round(food.c*f*10)/10, fat: Math.round(food.f*f*10)/10 };
}

// ─── Markdown renderer ────────────────────────────────────────────
function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#f1f5f9;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g,'<em style="color:#94a3b8">$1</em>')
    .replace(/`(.+?)`/g,'<code style="background:rgba(249,115,22,0.15);padding:2px 6px;border-radius:4px;font-size:13px;color:#fb923c;font-family:monospace">$1</code>');
}
function renderMarkdown(text) {
  const clean = text.replace(/\{"_data":.+\}$/m,'').trim();
  const lines = clean.split('\n'); const result=[]; let i=0;
  while (i<lines.length) {
    const line=lines[i];
    if (line.trim().startsWith('|')&&i+1<lines.length&&lines[i+1].trim().match(/^\|[\s\-|]+\|$/)) {
      const tl=[]; while(i<lines.length&&lines[i].trim().startsWith('|')){tl.push(lines[i]);i++;}
      const hd=tl[0].split('|').filter(c=>c.trim()).map(c=>c.trim());
      const rows=tl.slice(2).map(r=>r.split('|').filter(c=>c.trim()).map(c=>c.trim()));
      result.push(<div key={i} style={{overflowX:'auto',margin:'12px 0'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}><thead><tr>{hd.map((h,j)=><th key={j} style={{textAlign:'left',padding:'8px 12px',background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.08)',color:'#64748b',fontWeight:700,fontSize:'11px',letterSpacing:'0.08em',textTransform:'uppercase'}} dangerouslySetInnerHTML={{__html:inlineFormat(h)}}/>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>{row.map((cell,ci)=><td key={ci} style={{padding:'8px 12px',color:'#e2e8f0',fontSize:'14px'}} dangerouslySetInnerHTML={{__html:inlineFormat(cell)}}/>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (line.startsWith('### ')){result.push(<h3 key={i} style={{color:'#64748b',fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',margin:'16px 0 8px',fontWeight:700}}>{line.slice(4)}</h3>);i++;continue;}
    if (line.startsWith('## ')){result.push(<h2 key={i} style={{color:'#475569',fontSize:'10px',letterSpacing:'0.25em',textTransform:'uppercase',margin:'18px 0 8px',fontWeight:700}}>{line.slice(3)}</h2>);i++;continue;}
    if (line.startsWith('# ')){result.push(<h1 key={i} style={{fontSize:'17px',fontWeight:800,margin:'16px 0 10px',background:'linear-gradient(90deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{line.slice(2)}</h1>);i++;continue;}
    if (line.trim().match(/^---+$/)){result.push(<hr key={i} style={{border:'none',borderTop:'1px solid rgba(255,255,255,0.07)',margin:'14px 0'}}/>);i++;continue;}
    if (line.match(/^[\-\*] /)){const items=[];while(i<lines.length&&lines[i].match(/^[\-\*] /)){items.push(lines[i].slice(2));i++;}result.push(<ul key={i} style={{margin:'8px 0',paddingLeft:0,listStyle:'none'}}>{items.map((item,j)=><li key={j} style={{color:'#cbd5e1',marginBottom:'6px',display:'flex',gap:'10px',alignItems:'flex-start',fontSize:'15px',lineHeight:'1.55'}}><span style={{background:'linear-gradient(135deg,#f97316,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',flexShrink:0,fontWeight:800}}>▸</span><span dangerouslySetInnerHTML={{__html:inlineFormat(item)}}/></li>)}</ul>);continue;}
    if (line.match(/^\d+\. /)){const items=[];while(i<lines.length&&lines[i].match(/^\d+\. /)){items.push(lines[i].replace(/^\d+\. /,''));i++;}result.push(<ol key={i} style={{margin:'8px 0',paddingLeft:'20px'}}>{items.map((item,j)=><li key={j} style={{color:'#cbd5e1',marginBottom:'5px',fontSize:'15px',lineHeight:'1.55'}} dangerouslySetInnerHTML={{__html:inlineFormat(item)}}/>)}</ol>);continue;}
    if (line.trim()===''){result.push(<div key={i} style={{height:'8px'}}/>);i++;continue;}
    result.push(<p key={i} style={{color:'#cbd5e1',lineHeight:'1.7',margin:'3px 0',fontSize:'15px'}} dangerouslySetInnerHTML={{__html:inlineFormat(line)}}/>);
    i++;
  }
  return result;
}

// ─── Food Picker Modal ────────────────────────────────────────────
function FoodPicker({ onSend, onClose, dayType }) {
  const [cat, setCat] = useState('all');
  const [quantities, setQuantities] = useState({});
  const currentDay = DAY_TYPES.find(d=>d.val===dayType);

  const filtered = cat==='all' ? FOODS : FOODS.filter(f=>f.cat===cat);

  const setQty = (id, val) => setQuantities(q=>({...q, [id]: val}));

  const totals = Object.entries(quantities).reduce((acc,[id,qty])=>{
    if (!qty||isNaN(qty)||qty<=0) return acc;
    const food = FOODS.find(f=>f.id===id);
    if (!food) return acc;
    const m = calcMacros(food, parseFloat(qty));
    return { kcal:acc.kcal+m.kcal, p:acc.p+m.p, c:acc.c+m.c, fat:acc.fat+m.fat };
  },{ kcal:0, p:0, c:0, fat:0 });

  const handleSend = () => {
    const items = Object.entries(quantities)
      .filter(([,q])=>q&&parseFloat(q)>0)
      .map(([id,q])=>{
        const food=FOODS.find(f=>f.id===id);
        return `${food.name} ${q}${food.unit}`;
      });
    if (items.length===0) return;
    const text = `Masă: ${items.join(', ')}`;
    onSend(text);
    onClose();
  };

  const hasItems = Object.values(quantities).some(q=>q&&parseFloat(q)>0);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0d1220', borderRadius:'24px 24px 0 0', padding:'0 0 env(safe-area-inset-bottom)', maxHeight:'85vh', display:'flex', flexDirection:'column', border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'18px', background:'linear-gradient(90deg,#f97316,#ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>🍽️ ADAUGĂ MASĂ</div>
            <div style={{ fontSize:'11px', color:'#475569', marginTop:'2px' }}>{currentDay?.label} · {currentDay?.desc}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:'10px', color:'#64748b', padding:'6px 12px', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        {/* Category filter */}
        <div style={{ display:'flex', gap:'6px', padding:'10px 16px', overflowX:'auto', flexShrink:0 }}>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)} style={{ padding:'6px 14px', borderRadius:'100px', fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s', border:'1.5px solid', fontFamily:"'Inter',sans-serif",
              borderColor: cat===c.id ? '#f97316' : 'rgba(255,255,255,0.08)',
              background: cat===c.id ? 'rgba(249,115,22,0.12)' : 'transparent',
              color: cat===c.id ? '#f97316' : '#64748b',
            }}>{c.label}</button>
          ))}
        </div>

        {/* Food list */}
        <div style={{ overflowY:'auto', flex:1, padding:'0 16px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ position:'sticky', top:0, background:'#0d1220', zIndex:2 }}>
              <tr>
                <th style={{ textAlign:'left', padding:'8px 0', fontSize:'11px', color:'#334155', fontWeight:700, letterSpacing:'0.08em', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>ALIMENT</th>
                <th style={{ textAlign:'center', padding:'8px 6px', fontSize:'11px', color:'#334155', fontWeight:700, letterSpacing:'0.08em', borderBottom:'1px solid rgba(255,255,255,0.06)', width:'80px' }}>CANT.</th>
                <th style={{ textAlign:'right', padding:'8px 0', fontSize:'11px', color:'#334155', fontWeight:700, letterSpacing:'0.08em', borderBottom:'1px solid rgba(255,255,255,0.06)', width:'90px' }}>MACRO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(food=>{
                const qty = quantities[food.id] || '';
                const m = qty && parseFloat(qty)>0 ? calcMacros(food, parseFloat(qty)) : null;
                const active = qty && parseFloat(qty)>0;
                return (
                  <tr key={food.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: active ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
                    <td style={{ padding:'10px 0' }}>
                      <div style={{ fontSize:'15px', fontWeight:600, color: active ? '#f97316' : '#94a3b8' }}>{food.emoji} {food.name}</div>
                      <div style={{ fontSize:'11px', color:'#334155', marginTop:'1px' }}>{food.kcal} kcal · {food.p}g P · {food.c}g C · {food.f}g G <span style={{color:'#2d3748'}}>/ 100{food.unit==='buc'?'g':food.unit}</span></div>
                    </td>
                    <td style={{ padding:'10px 6px', textAlign:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'center' }}>
                        <input
                          type="number"
                          value={qty}
                          onChange={e=>setQty(food.id, e.target.value)}
                          placeholder="0"
                          style={{ width:'52px', background:'rgba(255,255,255,0.06)', border:`1.5px solid ${active?'rgba(249,115,22,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:'8px', padding:'6px 8px', color:'#e2e8f0', fontSize:'15px', textAlign:'center', outline:'none', fontFamily:"'Inter',sans-serif" }}
                        />
                        <span style={{ fontSize:'11px', color:'#475569' }}>{food.unit}</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 0', textAlign:'right' }}>
                      {m ? (
                        <div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#f97316' }}>{m.kcal} kcal</div>
                          <div style={{ fontSize:'11px', color:'#64748b' }}>{m.p}P · {m.c}C</div>
                        </div>
                      ) : (
                        <div style={{ fontSize:'11px', color:'#1e293b' }}>—</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals + Send */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          {hasItems && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'12px' }}>
              {[
                { label:'KCAL', val:totals.kcal, color:'#f97316' },
                { label:'PROT', val:`${totals.p}g`, color:'#8b5cf6' },
                { label:'CARBS', val:`${totals.c}g`, color:'#3b82f6' },
                { label:'GR', val:`${totals.fat}g`, color:'#10b981' },
              ].map(item=>(
                <div key={item.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:'10px', color:'#475569', letterSpacing:'0.08em', marginBottom:'2px' }}>{item.label}</div>
                  <div style={{ fontSize:'16px', fontWeight:800, color:item.color }}>{item.val}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleSend} disabled={!hasItems} style={{ width:'100%', padding:'14px', background: hasItems ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'rgba(255,255,255,0.06)', border:'none', borderRadius:'14px', color: hasItems ? '#fff' : '#334155', fontSize:'15px', fontWeight:800, cursor: hasItems ? 'pointer' : 'not-allowed', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.08em', textTransform:'uppercase', boxShadow: hasItems ? '0 4px 20px rgba(249,115,22,0.35)' : 'none', transition:'all 0.2s' }}>
            {hasItems ? `▸ TRIMITE MASA (${totals.kcal} kcal)` : 'Introduceți cantitățile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Charts + Calendar (Stats tab) ───────────────────────────────
function LineChart({ data, color, label, unit, target }) {
  if (!data||data.length===0) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100px',color:'#334155',fontSize:'13px'}}>Nicio dată înregistrată</div>;
  const vals=data.map(d=>d.value);
  const min=Math.min(...vals)-1, max=Math.max(...vals)+1;
  const W=300,H=90;
  const px=i=>(i/(data.length-1||1))*W;
  const py=v=>H-((v-min)/(max-min||1))*H;
  const points=data.map((d,i)=>`${px(i)},${py(d.value)}`).join(' ');
  const last=vals[vals.length-1];
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}>
        <span style={{fontSize:'11px',color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:700}}>{label}</span>
        <span style={{fontSize:'22px',fontWeight:800,color}}>{last}{unit}</span>
      </div>
      {target&&<div style={{fontSize:'11px',color:'#475569',marginBottom:'6px'}}>Țintă: {target}{unit}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'90px',overflow:'visible'}}>
        <defs><linearGradient id={`g${label}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        <polygon points={`0,${H} ${points} ${W},${H}`} fill={`url(#g${label})`}/>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {data.map((d,i)=><circle key={i} cx={px(i)} cy={py(d.value)} r="3" fill={color} stroke="#080b14" strokeWidth="2"/>)}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:'2px'}}>
        <span style={{fontSize:'10px',color:'#334155'}}>{data[0]?.date}</span>
        <span style={{fontSize:'10px',color:'#334155'}}>{data[data.length-1]?.date}</span>
      </div>
    </div>
  );
}

function CalendarPicker({ selectedDate, onSelect, stats }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year=viewDate.getFullYear(), month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const today=new Date();
  const hasData=day=>{const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return stats.weight[k]||stats.daily[k];};
  const isSel=day=>{if(!selectedDate)return false;return`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`===selectedDate;};
  const isToday=day=>day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
  const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);for(let d=1;d<=daysInMonth;d++)cells.push(d);
  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <button onClick={()=>setViewDate(new Date(year,month-1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>‹</button>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'17px',color:'#e2e8f0'}}>{RO_MONTHS[month]} {year}</span>
        <button onClick={()=>setViewDate(new Date(year,month+1,1))} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',color:'#94a3b8',padding:'6px 12px',cursor:'pointer',fontSize:'16px'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px',marginBottom:'6px'}}>
        {RO_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,color:'#334155',padding:'3px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>
        {cells.map((day,idx)=>(
          <div key={idx} onClick={()=>{if(!day)return;const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;onSelect(k);}}
            style={{textAlign:'center',padding:'7px 2px',borderRadius:'9px',fontSize:'14px',fontWeight:600,cursor:day?'pointer':'default',
              background:isSel(day)?'linear-gradient(135deg,#f97316,#ef4444)':isToday(day)?'rgba(249,115,22,0.1)':hasData(day)?'rgba(255,255,255,0.04)':'transparent',
              color:isSel(day)?'#fff':isToday(day)?'#f97316':day?'#94a3b8':'transparent',
              border:isToday(day)&&!isSel(day)?'1px solid rgba(249,115,22,0.3)':'1px solid transparent',position:'relative',transition:'all 0.15s'}}>
            {day||''}
            {day&&hasData(day)&&!isSel(day)&&<div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'3px',height:'3px',borderRadius:'50%',background:'#f97316'}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayDetail({ dateKey, stats }) {
  if (!dateKey) return null;
  const weight=stats.weight[dateKey], daily=stats.daily[dateKey];
  if (!weight&&!daily) return <div style={{textAlign:'center',color:'#334155',fontSize:'13px',padding:'16px'}}>Nicio dată pentru această zi</div>;
  const [y,m,d]=dateKey.split('-');
  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'14px',padding:'14px',marginTop:'10px'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'14px',color:'#64748b',letterSpacing:'0.05em',marginBottom:'12px',textTransform:'uppercase'}}>{d} {RO_MONTHS[parseInt(m)-1]} {y}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
        {weight&&<div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px',letterSpacing:'0.08em'}}>GREUTATE</div><div style={{fontSize:'20px',fontWeight:800,color:'#f97316'}}>{weight}</div><div style={{fontSize:'10px',color:'#64748b'}}>kg</div></div>}
        {daily?.calories&&<div style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px',letterSpacing:'0.08em'}}>CALORII</div><div style={{fontSize:'20px',fontWeight:800,color:'#3b82f6'}}>{daily.calories}</div><div style={{fontSize:'10px',color:'#64748b'}}>kcal</div></div>}
        {daily?.protein&&<div style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'11px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'3px',letterSpacing:'0.08em'}}>PROTEINE</div><div style={{fontSize:'20px',fontWeight:800,color:'#8b5cf6'}}>{daily.protein}</div><div style={{fontSize:'10px',color:'#64748b'}}>g</div></div>}
      </div>
    </div>
  );
}

function StatsTab({ stats }) {
  const [sel, setSel] = useState(todayKey());
  const prep = (key, filter, valFn) => Object.entries(stats[key]||{}).filter(filter).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([k,v])=>{const[,m,d]=k.split('-');return{date:`${d}/${m}`,value:valFn(v)};});
  const weightData = prep('weight',()=>true,v=>parseFloat(v));
  const calData    = prep('daily',([,v])=>v.calories,v=>v.calories);
  const protData   = prep('daily',([,v])=>v.protein,v=>v.protein);
  const latestW = weightData.length ? weightData[weightData.length-1].value : null;
  const startW  = weightData.length ? weightData[0].value : 96;
  const lost    = latestW ? (startW-latestW).toFixed(1) : null;
  return (
    <div style={{flex:1,overflowY:'auto',padding:'14px',maxWidth:'800px',margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:'14px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
        {[{label:'CURENT',val:latestW??'–',unit:'kg',color:'#f97316',bg:'rgba(249,115,22,0.08)',border:'rgba(249,115,22,0.2)'},{label:'PIERDUT',val:lost!==null?(parseFloat(lost)>0?`-${lost}`:`+${Math.abs(lost)}`):'–',unit:'kg',color:'#4ade80',bg:'rgba(74,222,128,0.08)',border:'rgba(74,222,128,0.2)'},{label:'ZILE LOG',val:Object.keys(stats.daily||{}).length,unit:'zile',color:'#3b82f6',bg:'rgba(59,130,246,0.08)',border:'rgba(59,130,246,0.2)'}].map(c=>(
          <div key={c.label} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:'14px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'10px',color:'#94a3b8',letterSpacing:'0.1em',marginBottom:'3px'}}>{c.label}</div>
            <div style={{fontSize:'22px',fontWeight:900,color:c.color,fontFamily:"'Barlow Condensed',sans-serif"}}>{c.val}</div>
            <div style={{fontSize:'11px',color:'#64748b'}}>{c.unit}</div>
          </div>
        ))}
      </div>
      <CalendarPicker selectedDate={sel} onSelect={setSel} stats={stats}/>
      <DayDetail dateKey={sel} stats={stats}/>
      {weightData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={weightData} color="#f97316" label="Greutate" unit=" kg" target="88–90"/></div>}
      {calData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={calData} color="#3b82f6" label="Calorii" unit=" kcal" target="1900–2250"/></div>}
      {protData.length>1&&<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}><LineChart data={protData} color="#8b5cf6" label="Proteine" unit="g" target="160–180"/></div>}
      {weightData.length>0&&(
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px'}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px',letterSpacing:'0.1em',color:'#64748b',textTransform:'uppercase',marginBottom:'10px'}}>📋 Jurnal Greutate</div>
          <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
            {[...weightData].reverse().map((d,i,arr)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.04)'}}>
                <span style={{fontSize:'13px',color:'#64748b'}}>{d.date}</span>
                <span style={{fontSize:'16px',fontWeight:700,color:'#f97316'}}>{d.value} kg</span>
                {arr[i+1]&&<span style={{fontSize:'12px',fontWeight:600,color:d.value<arr[i+1].value?'#4ade80':'#ef4444'}}>{d.value<arr[i+1].value?'↓':'↑'}{Math.abs(d.value-arr[i+1].value).toFixed(1)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{height:'16px'}}/>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const session = loadSession();
  const [messages, setMessages]   = useState(session.messages||[]);
  const [input,    setInput]       = useState("");
  const [loading,  setLoading]     = useState(false);
  const [dayType,  setDayType]     = useState(session.dayType||"normal");
  const [toast,    setToast]       = useState(null);
  const [tab,      setTab]         = useState('coach');
  const [stats,    setStats]       = useState(loadStats());
  const [picker,   setPicker]      = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const currentDay = DAY_TYPES.find(d=>d.val===dayType);

  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);
  useEffect(()=>{ saveSession(messages,dayType); },[messages,dayType]);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };

  const extractAndSave = useCallback(reply=>{
    const match=reply.match(/\{"_data":\s*(\{.+\})\s*\}/);
    if (!match) return;
    try {
      const d=JSON.parse(match[1]);
      const key=todayKey();
      const ns=loadStats();
      if (d.type==='weight'&&d.value) ns.weight[key]=d.value;
      if (d.type==='daily') {
        if (!ns.daily[key]) ns.daily[key]={};
        if (d.calories) ns.daily[key].calories=d.calories;
        if (d.protein)  ns.daily[key].protein=d.protein;
      }
      saveStats(ns); setStats({...ns});
    } catch {}
  },[]);

  const sendMessage = useCallback(async text=>{
    if (!text.trim()||loading) return;
    const prefix=`[Context: ${currentDay?.label} — ${currentDay?.desc}]\n`;
    const fullText=prefix+text;
    const userMsg={role:"user",content:text,display:text};
    const newMsgs=[...messages,userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const apiMsgs=newMsgs.map(m=>({role:m.role,content:m.role==='user'?(m===userMsg?fullText:m.content):m.content}));
      const res=await fetch("/api/chat",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,system:SYSTEM_PROMPT,messages:apiMsgs}),
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Eroare la răspuns.";
      extractAndSave(reply);
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    } catch {
      setMessages(prev=>[...prev,{role:"assistant",content:"⚠️ Eroare de conexiune. Încearcă din nou."}]);
    }
    setLoading(false);
  },[messages,loading,dayType,currentDay,extractAndSave]);

  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);}};
  const clearHistory=()=>{setMessages([]);localStorage.removeItem(SESSION_KEY);showToast("Istoric șters");};

  return (
    <div style={{minHeight:"100vh",height:"100dvh",background:"#080b14",fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif",color:"#e2e8f0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
        .header{padding:0 16px;background:rgba(8,11,20,0.97);backdrop-filter:blur(20px);position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;}
        .header-top{display:flex;align-items:center;justify-content:space-between;padding:10px 0;gap:8px;flex-wrap:wrap;}
        .logo{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
        .logo-sub{font-size:9px;color:#475569;letter-spacing:0.15em;text-transform:uppercase;font-weight:500;margin-top:2px;}
        .day-pills{display:flex;gap:4px;}
        .day-pill{padding:5px 10px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;border:1.5px solid rgba(255,255,255,0.07);background:transparent;color:#475569;transition:all 0.2s;white-space:nowrap;font-family:'Barlow Condensed',sans-serif;}
        .day-pill:hover{border-color:rgba(255,255,255,0.18);color:#94a3b8;}
        .day-pill.active{border-color:transparent;color:#fff;}
        .status-bar{display:flex;align-items:center;gap:8px;padding:6px 0 8px;overflow-x:auto;}
        .status-bar::-webkit-scrollbar{height:0;}
        .status-badge{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;}
        .tab-bar{display:flex;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(8,11,20,0.97);flex-shrink:0;}
        .tab-btn{flex:1;padding:10px;font-size:15px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:#475569;border-bottom:2px solid transparent;transition:all 0.2s;font-family:'Barlow Condensed',sans-serif;}
        .tab-btn:hover{color:#94a3b8;}
        .tab-btn.active{color:#f97316;border-bottom-color:#f97316;}
        .quick-bar{display:flex;gap:6px;padding:8px 16px;background:rgba(8,11,20,0.8);border-bottom:1px solid rgba(255,255,255,0.05);overflow-x:auto;align-items:center;flex-shrink:0;}
        .quick-bar::-webkit-scrollbar{height:0;}
        .q-btn{display:flex;align-items:center;gap:5px;padding:7px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;font-family:'Inter',sans-serif;}
        .q-btn:hover{background:rgba(255,255,255,0.08);color:#e2e8f0;transform:translateY(-1px);}
        .q-btn.primary{background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.25);color:#fb923c;}
        .q-btn.primary:hover{background:rgba(249,115,22,0.18);border-color:rgba(249,115,22,0.45);}
        .q-btn.food{background:rgba(74,222,128,0.08);border-color:rgba(74,222,128,0.25);color:#4ade80;}
        .q-btn.food:hover{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.45);}
        .sep{width:1px;height:18px;background:rgba(255,255,255,0.07);flex-shrink:0;margin:0 2px;}
        .messages-wrap{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;}
        .messages{max-width:800px;width:100%;margin:0 auto;padding:14px;display:flex;flex-direction:column;gap:12px;flex:1;}
        .msg-user{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:16px 16px 4px 16px;padding:11px 15px;align-self:flex-end;max-width:88%;}
        .msg-assistant{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:4px 16px 16px 16px;padding:13px 17px;position:relative;overflow:hidden;}
        .msg-assistant::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#f97316,#ef4444);}
        .msg-label{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:7px;}
        .label-user{color:#334155;}
        .label-assistant{background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .loading-bubble{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:4px 16px 16px 16px;padding:14px 18px;display:flex;align-items:center;gap:6px;}
        .dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);animation:bounce 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:0.15s;}.dot:nth-child(3){animation-delay:0.3s;}
        @keyframes bounce{0%,100%{transform:translateY(0) scale(0.8);opacity:0.4;}50%{transform:translateY(-5px) scale(1);opacity:1;}}
        .input-wrap{border-top:1px solid rgba(255,255,255,0.05);background:rgba(8,11,20,0.97);padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom));flex-shrink:0;}
        .input-inner{max-width:800px;margin:0 auto;display:flex;gap:8px;align-items:flex-end;}
        textarea{flex:1;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.08);border-radius:14px;padding:11px 15px;color:#e2e8f0;font-family:'Inter',sans-serif;font-size:16px;resize:none;outline:none;min-height:48px;max-height:140px;transition:border-color 0.2s,box-shadow 0.2s;line-height:1.5;}
        textarea:focus{border-color:rgba(249,115,22,0.35);box-shadow:0 0 0 3px rgba(249,115,22,0.07);}
        textarea::placeholder{color:#334155;}
        .food-btn{width:48px;height:48px;background:rgba(74,222,128,0.1);border:1.5px solid rgba(74,222,128,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;flex-shrink:0;transition:all 0.2s;}
        .food-btn:hover{background:rgba(74,222,128,0.2);transform:translateY(-2px);}
        .send-btn{width:48px;height:48px;background:linear-gradient(135deg,#f97316,#ef4444);border:none;border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;box-shadow:0 4px 15px rgba(249,115,22,0.3);font-size:22px;color:white;font-weight:700;}
        .send-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(249,115,22,0.4);}
        .send-btn:active:not(:disabled){transform:translateY(0);}
        .send-btn:disabled{opacity:0.3;cursor:not-allowed;box-shadow:none;}
        .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 24px;text-align:center;}
        .empty-icon{font-size:56px;animation:pulse-icon 2.5s ease-in-out infinite;}
        @keyframes pulse-icon{0%,100%{transform:scale(1);filter:drop-shadow(0 0 20px rgba(249,115,22,0.3));}50%{transform:scale(1.06);filter:drop-shadow(0 0 35px rgba(249,115,22,0.6));}}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;background:linear-gradient(90deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .empty-sub{font-size:14px;color:#475569;line-height:1.6;max-width:280px;}
        .hint-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
        .hint-chip{padding:5px 12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.18);border-radius:100px;font-size:12px;color:#fb923c;font-weight:600;}
        .clr-btn{padding:4px 9px;background:transparent;border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:#475569;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .clr-btn:hover{border-color:rgba(239,68,68,0.35);color:#ef4444;}
        .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(15,20,35,0.97);color:#e2e8f0;font-size:13px;font-weight:600;padding:10px 20px;border-radius:100px;border:1px solid rgba(255,255,255,0.1);z-index:100;animation:slideUp 0.3s ease;white-space:nowrap;box-shadow:0 8px 30px rgba(0,0,0,0.5);}
        @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="logo">MIHAI PERFORMANCE</div>
            <div className="logo-sub">AI Nutrition Coach</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            {messages.length>0&&<button className="clr-btn" onClick={clearHistory}>CLR</button>}
            <div className="day-pills">
              {DAY_TYPES.map(d=>(
                <button key={d.val} className={`day-pill ${dayType===d.val?'active':''}`}
                  style={dayType===d.val?{background:d.gradient,boxShadow:`0 0 16px ${d.glow}`}:{}}
                  onClick={()=>{setDayType(d.val);showToast(`${d.icon} ${d.label}`);}}>
                  {d.icon} {d.labelShort}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="status-bar">
          <div className="status-badge" style={{background:`${currentDay?.color}18`,border:`1px solid ${currentDay?.color}35`,color:currentDay?.color}}>
            <span>{currentDay?.icon}</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:'13px'}}>{currentDay?.label}</span>
            <span style={{opacity:0.5}}>·</span>
            <span style={{opacity:0.8,fontSize:'12px'}}>{currentDay?.desc}</span>
          </div>
          <div className="status-badge" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'#475569'}}>
            📅 {new Date().toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'short'})}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='coach'?'active':''}`} onClick={()=>setTab('coach')}>🤖 Coach</button>
        <button className={`tab-btn ${tab==='stats'?'active':''}`} onClick={()=>setTab('stats')}>📊 Stats</button>
      </div>

      {tab==='coach'&&(
        <>
          <div className="quick-bar">
            {QUICK_COMMANDS.map(q=><button key={q.cmd} className="q-btn primary" onClick={()=>sendMessage(q.cmd)}>{q.icon} {q.label}</button>)}
            <div className="sep"/>
            <button className="q-btn food" onClick={()=>setPicker(true)}>🍽️ Masă rapidă</button>
            <div className="sep"/>
            {QUICK_LOG.filter(q=>q.prefix!=='Masă: ').map(q=><button key={q.prefix} className="q-btn" onClick={()=>{setInput(q.prefix);textareaRef.current?.focus();}}>{q.icon} {q.label}</button>)}
          </div>

          <div className="messages-wrap">
            <div className="messages">
              {messages.length===0&&(
                <div className="empty-state">
                  <div className="empty-icon">🔥</div>
                  <div className="empty-title">96 kg → 88 kg</div>
                  <div className="empty-sub">Selectează tipul zilei, apasă <strong style={{color:'#fb923c'}}>Start zi</strong> sau folosește <strong style={{color:'#4ade80'}}>Masă rapidă</strong> pentru a loga alimentele.</div>
                  <div className="hint-chips">
                    <span className="hint-chip">⚡ Antrenament</span>
                    <span className="hint-chip">🔥 Zi activă</span>
                    <span className="hint-chip">🌙 Repaus</span>
                  </div>
                </div>
              )}
              {messages.map((m,i)=>(
                <div key={i} className={m.role==="user"?"msg-user":"msg-assistant"}>
                  <div className={`msg-label ${m.role==="user"?"label-user":"label-assistant"}`}>
                    {m.role==="user"?"▸ MIHAI":"◆ AI COACH"}
                  </div>
                  {m.role==="assistant"
                    ?<div>{renderMarkdown(m.content)}</div>
                    :<div style={{color:'#cbd5e1',fontSize:'16px',lineHeight:'1.5'}}>{m.display||m.content}</div>}
                </div>
              ))}
              {loading&&<div className="loading-bubble"><div className="dot"/><div className="dot"/><div className="dot"/></div>}
              <div ref={messagesEndRef}/>
            </div>
          </div>

          <div className="input-wrap">
            <div className="input-inner">
              <button className="food-btn" onClick={()=>setPicker(true)}>🍽️</button>
              <textarea ref={textareaRef} value={input}
                onChange={e=>{setInput(e.target.value);e.target.style.height="48px";e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";}}
                onKeyDown={handleKey} placeholder="Scrie liber sau apasă 🍽️ pentru alimente..." disabled={loading} rows={1}/>
              <button className="send-btn" onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}>↑</button>
            </div>
          </div>
        </>
      )}

      {tab==='stats'&&(
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          <StatsTab stats={stats}/>
        </div>
      )}

      {picker&&<FoodPicker onSend={sendMessage} onClose={()=>setPicker(false)} dayType={dayType}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
