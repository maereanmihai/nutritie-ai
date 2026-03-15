import { useState, useRef, useEffect, useCallback } from "react";

// ─── API ───────────────────────────────────────────────────────────────────────
async function callAI(messages, system, maxTokens = 1200) {
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system, messages })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${txt}`);
  }
  const d = await res.json();
  return d.content?.[0]?.text || '';
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
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

function calcTDEE(p) {
  if (!p?.weight || !p?.height || !p?.age) return null;
  const w = parseFloat(p.weight), h = parseFloat(p.height), a = parseFloat(p.age);
  const bmr = p.sex === 'female' ? (10*w + 6.25*h - 5*a - 161) : (10*w + 6.25*h - 5*a + 5);
  const mult = { sedentar:1.2, usor:1.375, moderat:1.55, activ:1.725, foarte_activ:1.9 };
  const tdee = Math.round(bmr * (mult[p.activity] || 1.55));
  const targets = { slabit: Math.round(tdee*0.8), recompozitie: Math.round(tdee*0.9), masa: Math.round(tdee*1.1), mentinere: tdee };
  const base = targets[p.goal] || Math.round(tdee*0.85);
  const protein = Math.round(w * 2.0);
  const fat = Math.round(w * 1.0);
  const carbs = Math.max(50, Math.round((base - protein*4 - fat*9) / 4));
  return { bmr: Math.round(bmr), tdee, base, protein, fat, carbs };
}

function buildSystemPrompt(profile, dayType) {
  const m = calcTDEE(profile);
  const name = profile?.name || 'Utilizator';
  const dayMacros = getDayMacros(profile, dayType);
  return `# HEALTH AGENT — ASISTENT PERSONAL

## IDENTITATE
Ești asistentul personal al lui ${name}. Concis, tehnic, bazat pe știință. Markdown + emoji. Română.

EXTRAGERE DATE — adaugă JSON la ultima linie când există date:
- Greutate → {"_data":{"type":"weight","value":X.X}}
- Masă/Zi → {"_data":{"type":"daily","calories":XXXX,"protein":XXX,"carbs":XXX,"fat":XXX}}
- Energie → {"_data":{"type":"hrv","energy":X}}
- Somn → {"_data":{"type":"sleep","hours":X,"quality":X}}

## PROFIL
- **Utilizator:** ${name}${profile?.age ? `, ${profile.age} ani` : ''}${profile?.weight ? `, ${profile.weight}kg` : ''}${profile?.height ? `, ${profile.height}cm` : ''}${profile?.targetWeight ? ` → țintă ${profile.targetWeight}kg` : ''}
- **Tip corp:** ${profile?.bodyType || 'nespecificat'} | **Obiectiv:** ${profile?.goal || 'recompozitie'}
${m ? `- **TDEE:** ${m.tdee} kcal | **Tip zi curent:** ${dayType}` : ''}
${dayMacros ? `- **Target azi:** ${dayMacros.kcal} kcal · P:${dayMacros.protein}g · C:${dayMacros.carbs}g · G:${dayMacros.fat}g` : ''}
${profile?.supplements ? `- **Suplimente:** ${profile.supplements}` : ''}
${profile?.notes ? `- **Note:** ${profile.notes}` : ''}

## REGULI
1. Baza pe știință, nu empiric. Citează studii când e relevant.
2. Proteine ≥ 1.8g/kg. Ajustează la tip zi.
3. Fii concis și direct — maxim 3-4 puncte per răspuns.`;
}

// ─── DAY TYPES ────────────────────────────────────────────────────────────────
const DAY_TYPES = [
  { val: 'antrenament', label: 'Antrenament', short: 'ANTR', icon: '⚡', mult: 1.0, color: '#f97316', bg: 'linear-gradient(135deg,#f97316,#ef4444)', glow: 'rgba(249,115,22,0.4)' },
  { val: 'intens', label: 'Zi Intensă', short: 'INTENS', icon: '🔥', mult: 0.9, color: '#3b82f6', bg: 'linear-gradient(135deg,#3b82f6,#6366f1)', glow: 'rgba(59,130,246,0.4)' },
  { val: 'repaus', label: 'Repaus', short: 'REPAUS', icon: '🌙', mult: 0.8, color: '#8b5cf6', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', glow: 'rgba(139,92,246,0.4)' },
];

function getDayMacros(profile, dayType) {
  const base = calcTDEE(profile);
  if (!base) return null;
  let kcalFinal;
  if (dayType === 'antrenament') kcalFinal = base.base;
  else if (dayType === 'intens') kcalFinal = Math.round(base.base * 0.92);
  else kcalFinal = Math.round(base.base * 0.82);
  const protein = dayType === 'repaus' ? Math.round(base.protein * 0.9) : base.protein;
  const fat = base.fat;
  const carbs = Math.max(50, Math.round((kcalFinal - protein * 4 - fat * 9) / 4));
  return { kcal: kcalFinal, protein, fat, carbs };
}

// ─── QUOTES ───────────────────────────────────────────────────────────────────
const QUOTES_MALE = [
  { text: "Disciplina este podul dintre obiective și realizări.", author: "Jim Rohn" },
  { text: "Durerea este temporară. Abandonul durează pentru totdeauna.", author: "Lance Armstrong" },
  { text: "Nu contează cât de încet mergi, atât timp cât nu te oprești.", author: "Confucius" },
  { text: "Forța nu vine din capacitatea fizică. Vine dintr-o voință indomptabilă.", author: "Gandhi" },
  { text: "Fiecare campion a fost odată un concurent care a refuzat să renunțe.", author: "Rocky Balboa" },
  { text: "Succesul nu este final. Eșecul nu este fatal. Curajul de a continua contează.", author: "Churchill" },
  { text: "Corpul tău poate face aproape orice. Mintea ta trebuie convinsă.", author: "Anonim" },
  { text: "Motivația te pornește. Obiceiul te ține în mișcare.", author: "Jim Ryun" },
  { text: "Nu te măsura cu alții. Fii mai bun decât erai ieri.", author: "Anonim" },
  { text: "Greutățile pe care le ridici azi construiesc bărbatul de mâine.", author: "Anonim" },
  { text: "Un atlet de campionat nu există fără zile grele de antrenament.", author: "Anonim" },
  { text: "Câștigătorii fac ce e nevoie, chiar și când nu vor.", author: "Anonim" },
  { text: "Dacă nu construiești visul tău, cineva te va angaja să construiești al lui.", author: "Tony Gaskins" },
  { text: "Cel mai greu set e primul. Restul vin singure.", author: "Anonim" },
  { text: "Mâncarea e combustibil. Antrenamentul e construcție. Somnul e recuperare.", author: "Anonim" },
  { text: "Omul puternic nu e cel care nu cade niciodată, ci cel care se ridică mereu.", author: "Anonim" },
  { text: "Fiecare repetare te aduce mai aproape de versiunea cea mai bună a ta.", author: "Anonim" },
  { text: "Nu există scurtături spre un loc care merită să ajungi.", author: "Beverly Sills" },
  { text: "Dificultatea pregătește oameni obișnuiți pentru destinații extraordinare.", author: "C.S. Lewis" },
  { text: "Prima oară e alegere. A doua oară e obicei. A treia oară e caracter.", author: "Anonim" },
  { text: "Corpul atinge ceea ce mintea crede.", author: "Napoleon Hill" },
  { text: "Antrenamentul greu bate talentul când talentul nu se antrenează greu.", author: "Tim Notke" },
  { text: "Dacă îți este ușor, nu crești.", author: "Anonim" },
  { text: "Recuperarea e la fel de importantă ca antrenamentul.", author: "Anonim" },
  { text: "Fii obsedat sau fii mediocru.", author: "Grant Cardone" },
  { text: "Ziua în care plantezi sămânța nu e ziua în care mănânci fructul.", author: "Fabienne Fredrickson" },
  { text: "Înainte să te dai bătut, încearcă.", author: "Anonim" },
  { text: "Progresul, nu perfecțiunea.", author: "Anonim" },
  { text: "Starea fizică nu e un loc la care ajungi. E un mod de viață.", author: "Anonim" },
  { text: "Fiecare mare atlet a început ca începător.", author: "Anonim" },
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / (1000*60*60*24));
  return QUOTES_MALE[day % QUOTES_MALE.length];
}

// ─── FOODS DATABASE ───────────────────────────────────────────────────────────
const FOODS = [
  // PROTEINE
  { id:'ou',       name:'Ou întreg',          emoji:'🥚', unit:'buc', unitG:55,  kcal:155, p:13,  c:1.1, f:11,  fiber:0,   cat:'proteine' },
  { id:'albus',    name:'Albuș lichid',        emoji:'🥛', unit:'ml',  unitG:1,   kcal:52,  p:11,  c:0.7, f:0.2, fiber:0,   cat:'proteine' },
  { id:'iaurt',    name:'Iaurt proteic 2%',    emoji:'🥛', unit:'g',   unitG:1,   kcal:65,  p:9,   c:5,   f:1.5, fiber:0,   cat:'proteine' },
  { id:'branza',   name:'Brânză de vaci',      emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:12,  c:3.5, f:4,   fiber:0,   cat:'proteine' },
  { id:'cottage',  name:'Brânză Cottage',      emoji:'🧀', unit:'g',   unitG:1,   kcal:98,  p:11,  c:3.4, f:4.3, fiber:0,   cat:'proteine' },
  { id:'fagaras',  name:'Brânză Făgăraș',      emoji:'🧀', unit:'g',   unitG:1,   kcal:263, p:18,  c:2,   f:21,  fiber:0,   cat:'proteine' },
  { id:'vita',     name:'Vită mușchi',         emoji:'🥩', unit:'g',   unitG:1,   kcal:158, p:26,  c:0,   f:6,   fiber:0,   cat:'proteine' },
  { id:'pui',      name:'Piept pui',           emoji:'🍗', unit:'g',   unitG:1,   kcal:165, p:31,  c:0,   f:3.6, fiber:0,   cat:'proteine' },
  { id:'pulpe',    name:'Pulpe pui',           emoji:'🍗', unit:'g',   unitG:1,   kcal:209, p:26,  c:0,   f:11,  fiber:0,   cat:'proteine' },
  { id:'pastrav',  name:'Păstrăv',             emoji:'🐟', unit:'g',   unitG:1,   kcal:148, p:21,  c:0,   f:7,   fiber:0,   cat:'proteine' },
  { id:'somon',    name:'Somon',               emoji:'🐟', unit:'g',   unitG:1,   kcal:208, p:20,  c:0,   f:13,  fiber:0,   cat:'proteine' },
  { id:'ton',      name:'Ton conservă',        emoji:'🐟', unit:'g',   unitG:1,   kcal:116, p:26,  c:0,   f:1,   fiber:0,   cat:'proteine' },
  { id:'porc',     name:'Mușchi porc',         emoji:'🥩', unit:'g',   unitG:1,   kcal:143, p:22,  c:0,   f:6,   fiber:0,   cat:'proteine' },
  // CARBS
  { id:'ovaz',     name:'Ovăz',                emoji:'🌾', unit:'g',   unitG:1,   kcal:389, p:17,  c:66,  f:7,   fiber:10,  cat:'carbs' },
  { id:'orez',     name:'Orez fiert',          emoji:'🍚', unit:'g',   unitG:1,   kcal:130, p:2.7, c:28,  f:0.3, fiber:0.4, cat:'carbs' },
  { id:'orez_b',   name:'Orez brun fiert',     emoji:'🍚', unit:'g',   unitG:1,   kcal:112, p:2.6, c:23,  f:0.9, fiber:1.8, cat:'carbs' },
  { id:'cartof',   name:'Cartof fiert',        emoji:'🥔', unit:'g',   unitG:1,   kcal:77,  p:2,   c:17,  f:0.1, fiber:2.2, cat:'carbs' },
  { id:'cartof_d', name:'Cartof dulce',        emoji:'🍠', unit:'g',   unitG:1,   kcal:86,  p:1.6, c:20,  f:0.1, fiber:3,   cat:'carbs' },
  { id:'paste',    name:'Paste fierte',        emoji:'🍝', unit:'g',   unitG:1,   kcal:131, p:5,   c:25,  f:1.1, fiber:1.8, cat:'carbs' },
  { id:'paine_n',  name:'Pâine neagră',        emoji:'🍞', unit:'felie',unitG:30,  kcal:65,  p:2.5, c:12,  f:0.8, fiber:1.9, cat:'carbs' },
  { id:'fasole',   name:'Fasole roșie',        emoji:'🫘', unit:'g',   unitG:1,   kcal:127, p:8.7, c:22,  f:0.5, fiber:6.4, cat:'carbs' },
  { id:'linte',    name:'Linte fiartă',        emoji:'🫘', unit:'g',   unitG:1,   kcal:116, p:9,   c:20,  f:0.4, fiber:7.9, cat:'carbs' },
  // LEGUME
  { id:'broccoli', name:'Broccoli',            emoji:'🥦', unit:'g',   unitG:1,   kcal:34,  p:2.8, c:6.6, f:0.4, fiber:2.6, cat:'legume' },
  { id:'spanac',   name:'Spanac',              emoji:'🥬', unit:'g',   unitG:1,   kcal:23,  p:2.9, c:3.6, f:0.4, fiber:2.2, cat:'legume' },
  { id:'varza',    name:'Varză',               emoji:'🥬', unit:'g',   unitG:1,   kcal:25,  p:1.3, c:5.8, f:0.1, fiber:2.5, cat:'legume' },
  { id:'varzam',   name:'Varză murată',        emoji:'🥬', unit:'g',   unitG:1,   kcal:19,  p:0.9, c:4.3, f:0.1, fiber:2.9, cat:'legume' },
  { id:'ciuperci', name:'Ciuperci',            emoji:'🍄', unit:'g',   unitG:1,   kcal:22,  p:3.1, c:3.3, f:0.3, fiber:1,   cat:'legume' },
  { id:'ardei',    name:'Ardei gras',          emoji:'🫑', unit:'g',   unitG:1,   kcal:31,  p:1,   c:6,   f:0.3, fiber:2.1, cat:'legume' },
  { id:'rosii',    name:'Roșii',               emoji:'🍅', unit:'g',   unitG:1,   kcal:18,  p:0.9, c:3.9, f:0.2, fiber:1.2, cat:'legume' },
  { id:'castravete',name:'Castravete',         emoji:'🥒', unit:'g',   unitG:1,   kcal:15,  p:0.7, c:3.6, f:0.1, fiber:0.5, cat:'legume' },
  { id:'sfecla',   name:'Sfeclă roșie',        emoji:'🟣', unit:'g',   unitG:1,   kcal:43,  p:1.6, c:9.6, f:0.2, fiber:2.8, cat:'legume' },
  { id:'conopida', name:'Conopidă',            emoji:'🥦', unit:'g',   unitG:1,   kcal:25,  p:1.9, c:5,   f:0.3, fiber:2,   cat:'legume' },
  { id:'morcov',   name:'Morcov',              emoji:'🥕', unit:'g',   unitG:1,   kcal:41,  p:0.9, c:9.6, f:0.2, fiber:2.8, cat:'legume' },
  // FRUCTE
  { id:'mar',      name:'Măr',                 emoji:'🍎', unit:'buc', unitG:150, kcal:52,  p:0.3, c:14,  f:0.2, fiber:2.4, cat:'fructe' },
  { id:'banana',   name:'Banană',              emoji:'🍌', unit:'buc', unitG:120, kcal:89,  p:1.1, c:23,  f:0.3, fiber:2.6, cat:'fructe' },
  { id:'para',     name:'Pară',                emoji:'🍐', unit:'buc', unitG:160, kcal:57,  p:0.4, c:15,  f:0.1, fiber:3.1, cat:'fructe' },
  { id:'portocala',name:'Portocală',           emoji:'🍊', unit:'buc', unitG:130, kcal:47,  p:0.9, c:12,  f:0.1, fiber:2.4, cat:'fructe' },
  { id:'capsuni',  name:'Căpșuni',             emoji:'🍓', unit:'g',   unitG:1,   kcal:32,  p:0.7, c:7.7, f:0.3, fiber:2,   cat:'fructe' },
  { id:'afine',    name:'Afine',               emoji:'🫐', unit:'g',   unitG:1,   kcal:57,  p:0.7, c:14,  f:0.3, fiber:2.4, cat:'fructe' },
  { id:'kiwi',     name:'Kiwi',                emoji:'🥝', unit:'buc', unitG:75,  kcal:61,  p:1.1, c:15,  f:0.5, fiber:3,   cat:'fructe' },
  { id:'struguri', name:'Struguri',            emoji:'🍇', unit:'g',   unitG:1,   kcal:69,  p:0.7, c:18,  f:0.2, fiber:0.9, cat:'fructe' },
  { id:'piersica', name:'Piersică',            emoji:'🍑', unit:'buc', unitG:150, kcal:39,  p:0.9, c:9.5, f:0.3, fiber:1.5, cat:'fructe' },
  { id:'pepene',   name:'Pepene roșu',         emoji:'🍉', unit:'g',   unitG:1,   kcal:30,  p:0.6, c:7.6, f:0.2, fiber:0.4, cat:'fructe' },
  { id:'coacaze',  name:'Coacăze',             emoji:'🫐', unit:'g',   unitG:1,   kcal:63,  p:1.4, c:15,  f:0.4, fiber:4.3, cat:'fructe' },
  { id:'mango',    name:'Mango',               emoji:'🥭', unit:'g',   unitG:1,   kcal:60,  p:0.8, c:15,  f:0.4, fiber:1.6, cat:'fructe' },
  // GRASIMI
  { id:'ulei_m',   name:'Ulei măsline',        emoji:'🫒', unit:'ml',  unitG:0.9, kcal:884, p:0,   c:0,   f:100, fiber:0,   cat:'grasimi' },
  { id:'ulei_c',   name:'Ulei cocos',          emoji:'🥥', unit:'ml',  unitG:0.9, kcal:862, p:0,   c:0,   f:100, fiber:0,   cat:'grasimi' },
  { id:'migdale',  name:'Migdale',             emoji:'🌰', unit:'g',   unitG:1,   kcal:579, p:21,  c:22,  f:50,  fiber:12,  cat:'grasimi' },
  { id:'nuci',     name:'Nuci',                emoji:'🌰', unit:'g',   unitG:1,   kcal:654, p:15,  c:14,  f:65,  fiber:6.7, cat:'grasimi' },
  { id:'chia',     name:'Semințe chia',        emoji:'🌱', unit:'g',   unitG:1,   kcal:486, p:17,  c:42,  f:31,  fiber:34,  cat:'grasimi' },
  { id:'avocado',  name:'Avocado',             emoji:'🥑', unit:'g',   unitG:1,   kcal:160, p:2,   c:9,   f:15,  fiber:6.7, cat:'grasimi' },
  { id:'unt',      name:'Unt',                 emoji:'🧈', unit:'g',   unitG:1,   kcal:717, p:0.9, c:0.1, f:81,  fiber:0,   cat:'grasimi' },
  { id:'cioc_n',   name:'Ciocolată neagră 85%',emoji:'🍫', unit:'g',   unitG:1,   kcal:598, p:8,   c:46,  f:43,  fiber:11,  cat:'grasimi' },
  // DIVERSE
  { id:'miere',    name:'Miere',               emoji:'🍯', unit:'g',   unitG:1,   kcal:304, p:0.3, c:82,  f:0,   fiber:0.2, cat:'diverse' },
  { id:'cafea',    name:'Cafea neagră',        emoji:'☕', unit:'ml',  unitG:1,   kcal:1,   p:0.1, c:0,   f:0,   fiber:0,   cat:'diverse' },
  { id:'lapte',    name:'Lapte 1.5%',          emoji:'🥛', unit:'ml',  unitG:1,   kcal:42,  p:3.4, c:5,   f:1.5, fiber:0,   cat:'diverse' },
  { id:'psyllium', name:'Psyllium',            emoji:'🌿', unit:'g',   unitG:1,   kcal:200, p:2,   c:85,  f:1,   fiber:71,  cat:'diverse' },
  { id:'proteine_p',name:'Proteină Pudră',     emoji:'💪', unit:'g',   unitG:1,   kcal:380, p:80,  c:8,   f:4,   fiber:0,   cat:'diverse' },
];

const FOOD_CATS = [
  { id:'all',      label:'Toate',    icon:'🍽', color:'#6366f1' },
  { id:'proteine', label:'Proteine', icon:'🥩', color:'#ef4444' },
  { id:'carbs',    label:'Carbs',    icon:'🌾', color:'#f59e0b' },
  { id:'legume',   label:'Legume',   icon:'🥦', color:'#10b981' },
  { id:'fructe',   label:'Fructe',   icon:'🍎', color:'#ec4899' },
  { id:'grasimi',  label:'Grăsimi',  icon:'🫒', color:'#8b5cf6' },
  { id:'diverse',  label:'Diverse',  icon:'🫙', color:'#64748b' },
];

// ─── SUPPLEMENTS ──────────────────────────────────────────────────────────────
const DEFAULT_SUPPLEMENTS = [
  { id:'carnitina',   name:'L-Carnitină 2g',        emoji:'🔥', time:'07:00', note:'Pe stomacul gol — oxidare grăsimi', days:[1,2,3,4,5,6,7] },
  { id:'vitc_dim',    name:'Vitamina C 500mg',       emoji:'🍊', time:'07:00', note:'Pe stomacul gol — antioxidant', days:[1,2,3,4,5,6,7] },
  { id:'niacina',     name:'Niacină B3',             emoji:'⚡', time:'07:30', note:'Înainte de masă — metabolism lipide', days:[1,2,3,4,5,6,7] },
  { id:'cholest_dim', name:'Cholest Bio Forte',      emoji:'💛', time:'08:00', note:'Cu micul dejun — colesterol', days:[1,2,3,4,5,6,7] },
  { id:'d3',          name:'Vitamina D3 + K2',       emoji:'☀️', time:'08:00', note:'Cu masă grasă — liposolubilă', days:[1,2,3,4,5,6,7] },
  { id:'coq10',       name:'CoQ10 200mg',            emoji:'❤️', time:'08:00', note:'Cu masă — energie celulară', days:[1,2,3,4,5,6,7] },
  { id:'omega3',      name:'Omega-3 2g',             emoji:'🐟', time:'08:00', note:'Cu masă — antiinflamator', days:[1,2,3,4,5,6,7] },
  { id:'zinc',        name:'Zinc 25mg',              emoji:'🦪', time:'08:00', note:'Cu masă — testosteron, imunitate', days:[1,2,3,4,5,6,7] },
  { id:'vite',        name:'Vitamina E 400UI',       emoji:'🌿', time:'08:00', note:'Cu masă grasă — antioxidant', days:[1,2,3,4,5,6,7] },
  { id:'centrum',     name:'Centrum Energy',         emoji:'💊', time:'08:00', note:'Cu micul dejun — complex B', days:[1,2,3,4,5,6,7] },
  { id:'ginger',      name:'Ginger Root 500mg',      emoji:'🫚', time:'08:00', note:'Cu masă — antiinflamator, digestie', days:[1,2,3,4,5,6,7] },
  { id:'citrul',      name:'Citrulină Malat 6g',     emoji:'🏋', time:'17:00', note:'30-45 min pre-workout', days:[1,3,5] },
  { id:'creatina',    name:'Creatină 5g',            emoji:'💪', time:'17:00', note:'Pre sau post workout', days:[1,3,5] },
  { id:'mg',          name:'Mg Bisglicinat 400mg',   emoji:'🌙', time:'21:00', note:'1h înainte somn — relaxare', days:[1,2,3,4,5,6,7] },
  { id:'cholest_sea', name:'Cholest Bio Forte (s)',  emoji:'💛', time:'21:00', note:'Cu cina — dozaj optim seara', days:[1,2,3,4,5,6,7] },
  { id:'vitc_sea',    name:'Vitamina C 500mg (s)',   emoji:'🍊', time:'21:00', note:'Seara — recuperare nocturnă', days:[1,2,3,4,5,6,7] },
];

// ─── WORKOUT DATA ─────────────────────────────────────────────────────────────
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
  umeri:    [{id:'ohpress',name:'Overhead Press'},{id:'arnold',name:'Arnold Press'},{id:'laterals',name:'Lateral Raises'},{id:'frontrise',name:'Front Raises'},{id:'shrugs',name:'Shrugs'}],
  brate:    [{id:'curl',name:'Bicep Curl (halteră)'},{id:'dbcurl',name:'Bicep Curl (gantere)'},{id:'hammer',name:'Hammer Curl'},{id:'skullcr',name:'Skull Crushers'},{id:'tricepext',name:'Tricep Pushdown'},{id:'dipstric',name:'Dips (triceps)'}],
  picioare: [{id:'squat',name:'Squat'},{id:'legpress',name:'Leg Press'},{id:'rdl',name:'Romanian Deadlift'},{id:'lunge',name:'Lunges'},{id:'legcurl',name:'Leg Curl'},{id:'legext',name:'Leg Extension'},{id:'calf',name:'Calf Raises'}],
  core:     [{id:'plank',name:'Plank'},{id:'crunch',name:'Crunch'},{id:'lgrise',name:'Leg Raises'},{id:'russian',name:'Russian Twist'},{id:'cabcr',name:'Cable Crunch'}],
};

const CARDIO_TYPES = [
  { id:'mers',      name:'Mers',         icon:'🚶', met:3.5,  color:'#10b981' },
  { id:'alergare',  name:'Alergare',     icon:'🏃', met:9.0,  color:'#f97316' },
  { id:'bicicleta', name:'Bicicletă',    icon:'🚴', met:7.5,  color:'#3b82f6' },
  { id:'inot',      name:'Înot',         icon:'🏊', met:8.0,  color:'#6366f1' },
  { id:'sarit',     name:'Sărit coarda', icon:'⚡', met:10.0, color:'#f59e0b' },
];

const WORK_TYPES = [
  { id:'munca_usoara', name:'Muncă ușoară', icon:'🔧', met:2.5, desc:'Birou activ, deplasări' },
  { id:'munca_medie',  name:'Muncă medie',  icon:'⚒️', met:4.0, desc:'Construcții, agricultură' },
  { id:'munca_grea',   name:'Muncă grea',   icon:'🏗️', met:6.0, desc:'Muncă fizică intensă' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcMacros(food, qty) {
  const g = food.unit === 'buc' ? qty * food.unitG : food.unit === 'ml' ? qty * (food.unitG || 1) : qty;
  const f = g / 100;
  return {
    kcal: Math.round(food.kcal * f),
    p: Math.round(food.p * f * 10) / 10,
    c: Math.round(food.c * f * 10) / 10,
    fat: Math.round(food.f * f * 10) / 10,
    fiber: Math.round((food.fiber || 0) * f * 10) / 10,
  };
}

function calcBurned(met, minutes, weight = 80) {
  return Math.round((met * 3.5 * weight / 200) * minutes);
}

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function calcStreak(stats) {
  if (!stats?.daily) return 0;
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 90; i++) {
    const k = (() => { const d = new Date(cur); d.setDate(d.getDate()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    if (stats.daily[k]?.calories > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export default function App() {
  const [tab, setTab] = useState('azi');
  const [darkMode, setDarkMode] = useState(() => ls(K.theme, true));
  const [profile, setProfile] = useState(() => ls(K.profile, defaultProfile()));
  const [dayType, setDayType] = useState('antrenament');
  const [stats, setStats] = useState(() => ls(K.stats, { weight: {}, daily: {}, hrv: {} }));
  const [workouts, setWorkouts] = useState(() => ls(K.workouts, { days: {} }));
  const [meals, setMeals] = useState(() => ls(K.meals, {}));
  const [customFoods, setCustomFoods] = useState(() => ls(K.customFoods, []));
  const [suplTaken, setSuplTaken] = useState(() => ls(K.suplTaken, {}));
  const [supplements, setSupplements] = useState(() => ls('ha_supl_list_v1', DEFAULT_SUPPLEMENTS));
  const [messages, setMessages] = useState(() => { const s = ls(K.session, null); return s?.date === todayKey() ? s.messages : []; });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gymMode, setGymMode] = useState(false);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { lsSave(K.theme, darkMode); }, [darkMode]);
  useEffect(() => { lsSave(K.session, { date: todayKey(), messages }); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const showToast = (msg, dur = 2500) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  const saveProfile = useCallback((p) => {
    setProfile(p);
    lsSave(K.profile, p);
    showToast('✓ Profil salvat!');
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

  const extractAndSave = useCallback((reply) => {
    try {
      const lines = reply.trim().split('\n');
      const last = lines[lines.length-1]?.trim();
      if (!last?.startsWith('{') || !last?.includes('"_data"')) return;
      const d = JSON.parse(last)._data;
      const key = todayKey();
      setStats(prev => {
        const ns = { ...prev };
        if (d.type === 'weight' && d.value) {
          ns.weight = { ...ns.weight, [key]: d.value };
        }
        if (d.type === 'daily') {
          if (!ns.daily) ns.daily = {};
          if (!ns.daily[key]) ns.daily[key] = {};
          if (d.calories != null) ns.daily[key].calories = d.calories;
          if (d.protein != null) ns.daily[key].protein = d.protein;
          if (d.carbs != null) ns.daily[key].carbs = d.carbs;
          if (d.fat != null) ns.daily[key].fat = d.fat;
        }
        lsSave(K.stats, ns);
        return ns;
      });
    } catch {}
  }, []);

  const buildStartZiPrompt = useCallback(() => {
    const dayTargets = getDayMacros(profile, dayType);
    const day = DAY_TYPES.find(d => d.val === dayType);
    const isWorkout = dayType === 'antrenament';
    const supl = supplements.filter(s => { const dow = new Date().getDay() || 7; return s.days.includes(dow); });
    const suplList = supl.map(s => `${s.emoji} ${s.name} (${s.time}) — ${s.note}`).join('\n');
    return `START ZI — ${day?.label || dayType}

PROFIL: ${profile?.name || 'Utilizator'}, ${profile?.age} ani, ${profile?.weight}kg, obiectiv: ${profile?.goal}
${dayTargets ? `TARGET: ${dayTargets.kcal} kcal | P:${dayTargets.protein}g | C:${dayTargets.carbs}g | G:${dayTargets.fat}g` : ''}

SUPLIMENTELE MELE (cu timing):
${suplList}

Structurează răspunsul:

## 🎯 TARGET ZILNIC
Explică targetul caloric și macro-urile calculate Mifflin-St Jeor pentru ${day?.label}. Justifică de ce aceste valori pentru obiectivul ${profile?.goal}.

## 💊 SUPLIMENTE PE STOMACUL GOL (acum)
Din lista mea de suplimente, care se iau pe stomacul gol dimineața și de ce (interacțiuni, absorbție).

## 🍳 MICUL DEJUN — aștept să introduc
[Spune că aștepți să introduc micul dejun]

${isWorkout ? `## 🏋 PRE-WORKOUT (când îmi spui că urmează antrenamentul)
- Masă pre-workout: timing, macro-uri din studii
- Suplimentele mele pre-workout cu minutele exacte

## ⚡ POST-WORKOUT — fereastra anabolică
- Timing exact (30-60 min)
- Macro-uri necesare pentru recuperare` : ''}

## 🍽 CINĂ — aștept introducerea
## 📊 STOP ZI — la final, sinteză completă

Începe ACUM cu TARGET și SUPLIMENTE PE STOMACUL GOL.`;
  }, [profile, dayType, supplements]);

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

  const addMeal = useCallback((mealData) => {
    const key = todayKey();
    setMeals(prev => {
      const nm = { ...prev };
      if (!nm[key]) nm[key] = [];
      nm[key] = [...nm[key], { ...mealData, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }), id: Date.now() }];
      lsSave(K.meals, nm);
      return nm;
    });
    // Update daily stats — functional update
    setStats(prev => {
      const ns = { ...prev };
      if (!ns.daily) ns.daily = {};
      if (!ns.daily[key]) ns.daily[key] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      ns.daily[key].calories = (ns.daily[key].calories || 0) + mealData.kcal;
      ns.daily[key].protein = Math.round(((ns.daily[key].protein || 0) + mealData.p) * 10) / 10;
      ns.daily[key].carbs = Math.round(((ns.daily[key].carbs || 0) + mealData.c) * 10) / 10;
      ns.daily[key].fat = Math.round(((ns.daily[key].fat || 0) + mealData.fat) * 10) / 10;
      ns.daily[key].fiber = Math.round(((ns.daily[key].fiber || 0) + (mealData.fiber || 0)) * 10) / 10;
      lsSave(K.stats, ns);
      return ns;
    });
    showToast(`✓ ${mealData.name} adăugat!`);
  }, []);

  const th = darkMode ? {
    bg: '#070a12', bg2: '#0c1020', bg3: '#111827',
    card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.15)',
    text: '#f1f5f9', text2: '#94a3b8', text3: '#475569',
    accent: '#f97316',
  } : {
    bg: '#f8fafc', bg2: '#ffffff', bg3: '#f1f5f9',
    card: 'rgba(0,0,0,0.03)', card2: 'rgba(0,0,0,0.06)',
    border: 'rgba(0,0,0,0.08)', border2: 'rgba(0,0,0,0.15)',
    text: '#0f172a', text2: '#475569', text3: '#94a3b8',
    accent: '#ea580c',
  };

  const todayMeals = meals[todayKey()] || [];
  const todayStats = stats.daily?.[todayKey()] || {};
  const todayWorkout = workouts.days?.[todayKey()] || { exercises: [], cardio: [], work: [] };
  const dayMacros = getDayMacros(profile, dayType);
  const streak = calcStreak(stats);
  const currentDay = DAY_TYPES.find(d => d.val === dayType);
  const todayDow = new Date().getDay() || 7;
  const todaySupl = supplements.filter(s => s.days.includes(todayDow));
  const suplTakenToday = suplTaken[todayKey()] || {};

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
        @keyframes shimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .tab-content{animation:fadeUp 0.25s ease}
        .btn-tap{transition:transform 0.1s,opacity 0.1s}
        .btn-tap:active{transform:scale(0.95);opacity:0.85}
      `}</style>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'azi' && (
          <AziTab
            th={th} profile={profile} dayType={dayType} setDayType={setDayType}
            currentDay={currentDay} dayMacros={dayMacros} todayStats={todayStats}
            todayMeals={todayMeals} todayWorkout={todayWorkout} streak={streak}
            todaySupl={todaySupl} suplTakenToday={suplTakenToday}
            onToggleSupl={(id) => {
              const ns = { ...suplTaken, [todayKey()]: { ...suplTakenToday, [id]: !suplTakenToday[id] } };
              setSuplTaken(ns); lsSave(K.suplTaken, ns);
            }}
            messages={messages} input={input} setInput={setInput}
            loading={loading} onSend={sendMessage} messagesEndRef={messagesEndRef}
            darkMode={darkMode} setDarkMode={setDarkMode}
            onOpenFoodPicker={() => setShowFoodPicker(true)}
            onDeleteMeal={(id) => {
              const key = todayKey();
              const meal = todayMeals.find(m => m.id === id);
              if (!meal) return;
              setMeals(prev => {
                const nm = { ...prev, [key]: (prev[key]||[]).filter(m => m.id !== id) };
                lsSave(K.meals, nm); return nm;
              });
              setStats(prev => {
                const ns = { ...prev };
                if (ns.daily?.[key]) {
                  ns.daily[key] = {
                    ...ns.daily[key],
                    calories: Math.max(0, (ns.daily[key].calories || 0) - (meal.kcal || 0)),
                    protein: Math.max(0, Math.round(((ns.daily[key].protein || 0) - (meal.p || 0)) * 10) / 10),
                    carbs: Math.max(0, Math.round(((ns.daily[key].carbs || 0) - (meal.c || 0)) * 10) / 10),
                    fat: Math.max(0, Math.round(((ns.daily[key].fat || 0) - (meal.fat || 0)) * 10) / 10),
                    fiber: Math.max(0, Math.round(((ns.daily[key].fiber || 0) - (meal.fiber || 0)) * 10) / 10),
                  };
                }
                lsSave(K.stats, ns);
                return ns;
              });
              showToast('✓ Masă ștearsă');
            }}
          />
        )}
        {tab === 'alimente' && (
          <AlimenteTab th={th} customFoods={customFoods} setCustomFoods={(cf) => { setCustomFoods(cf); lsSave(K.customFoods, cf); }} onAddMeal={addMeal} />
        )}
        {tab === 'antrenament' && (
          <AntrenamentTab th={th} workouts={workouts} setWorkouts={setWorkouts} profile={profile} onSendToCoach={sendMessage} onOpenGymMode={() => setGymMode(true)} />
        )}
        {tab === 'progres' && (
          <ProgresTab th={th} stats={stats} setStats={setStats} workouts={workouts} profile={profile} />
        )}
        {tab === 'profil' && (
          <ProfilTab th={th} profile={profile} saveProfile={saveProfile} supplements={supplements} setSupplements={(s) => { setSupplements(s); lsSave('ha_supl_list_v1', s); }} sendMessage={sendMessage} />
        )}
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <div style={{ background: darkMode ? 'rgba(7,10,18,0.97)' : 'rgba(255,255,255,0.97)', borderTop: `1px solid ${th.border}`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 max(8px, env(safe-area-inset-bottom))', flexShrink: 0, backdropFilter: 'blur(20px)', zIndex: 10 }}>
        {[
          { id:'azi', icon:'🏠', label:'Azi' },
          { id:'alimente', icon:'🍽', label:'Alimente' },
          { id:'antrenament', icon:'💪', label:'Sport' },
          { id:'progres', icon:'📊', label:'Progres' },
          { id:'profil', icon:'👤', label:'Profil' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn-tap"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', minWidth: '52px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: tab === t.id ? currentDay?.bg || 'linear-gradient(135deg,#f97316,#ef4444)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', transition: 'all 0.2s' }}>
              {t.icon}
            </div>
            <span style={{ fontSize: '10px', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? th.accent : th.text3, transition: 'all 0.2s' }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERLAYS ── */}
      {gymMode && <GymMode workouts={workouts} setWorkouts={setWorkouts} onClose={() => setGymMode(false)} onSendToCoach={sendMessage} profile={profile} th={th} />}
      {showFoodPicker && <FoodPickerModal th={th} darkMode={darkMode} customFoods={customFoods} setCustomFoods={(cf) => { setCustomFoods(cf); lsSave(K.customFoods, cf); }} onAddMeal={addMeal} onClose={() => setShowFoodPicker(false)} onSendToCoach={sendMessage} />}
      {toast && <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: darkMode ? '#1e293b' : '#fff', color: th.text, fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '100px', border: `1px solid ${th.border}`, zIndex: 100, whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', animation: 'fadeUp 0.3s ease' }}>{toast}</div>}
    </div>
  );
}
// ─── AZI TAB ──────────────────────────────────────────────────────────────────
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
function AlimenteTab({ th, customFoods, setCustomFoods, onAddMeal }) {
  const [cat, setCat] = useState('all');
  const [quantities, setQuantities] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeSection, setActiveSection] = useState('alimente'); // alimente | search | templates
  const searchTimer = useRef(null);
  const allFoods = [...FOODS, ...customFoods].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const filtered = cat === 'all' ? allFoods : allFoods.filter(f => f.cat === cat);
  const setQty = (id, val) => setQuantities(q => ({ ...q, [id]: val }));

  const totals = Object.entries(quantities).reduce((acc, [id, qty]) => {
    if (!qty || isNaN(qty) || parseFloat(qty) <= 0) return acc;
    const food = allFoods.find(f => f.id === id);
    if (!food) return acc;
    const m = calcMacros(food, parseFloat(qty));
    return { kcal: acc.kcal + m.kcal, p: Math.round((acc.p + m.p)*10)/10, c: Math.round((acc.c + m.c)*10)/10, fat: Math.round((acc.fat + m.fat)*10)/10, fiber: Math.round((acc.fiber + m.fiber)*10)/10 };
  }, { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0 });

  const hasItems = Object.values(quantities).some(q => q && parseFloat(q) > 0);

  const addToLog = () => {
    const items = Object.entries(quantities).filter(([, q]) => q && parseFloat(q) > 0);
    if (!items.length) return;
    let total = { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0, name: '', emoji: '🍽' };
    const names = [];
    items.forEach(([id, qty]) => {
      const food = allFoods.find(f => f.id === id);
      if (!food) return;
      const m = calcMacros(food, parseFloat(qty));
      total.kcal += m.kcal;
      total.p = Math.round((total.p + m.p)*10)/10;
      total.c = Math.round((total.c + m.c)*10)/10;
      total.fat = Math.round((total.fat + m.fat)*10)/10;
      total.fiber = Math.round((total.fiber + m.fiber)*10)/10;
      names.push(`${food.name} ${qty}${food.unit}`);
    });
    total.name = names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length-2}` : '');
    onAddMeal(total);
    setQuantities({});
  };

  const searchFood = async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); setSearchDone(false); return; }
    setSearching(true); setSearchDone(false);
    try {
      const reply = await callAI(
        [{ role: 'user', content: query }],
        `Expert nutritie. Returneaza DOAR JSON array cu 1-4 variante ale alimentului cerut. Format strict:
[{"name":"Nume aliment","emoji":"🍽","kcal":175,"p":18,"c":8,"fat":8,"fiber":0,"cat":"proteine"}]
Valori la 100g. cat = proteine|carbs|legume|fructe|grasimi|diverse. DOAR JSON, nimic altceva.`,
        600
      );
      const clean = reply.replace(/```json|```/g, '').trim();
      const results = JSON.parse(clean);
      setSearchResults(Array.isArray(results) ? results : []);
      setSearchDone(true);
    } catch { setSearchResults([]); setSearchDone(true); }
    finally { setSearching(false); }
  };

  const saveCustomFood = (food) => {
    const alreadyExists = customFoods.some(f => f.name.toLowerCase() === food.name.toLowerCase());
    if (alreadyExists) return;
    const newFood = { id: `custom_${Date.now()}`, name: food.name, emoji: food.emoji||'🍽', unit: 'g', unitG: 1, kcal: food.kcal, p: food.p, c: food.c, f: food.fat, fiber: food.fiber||0, cat: food.cat||'diverse' };
    const upd = [...customFoods, newFood].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    setCustomFoods(upd);
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '12px' }}>🍽 Alimente</div>
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[{id:'alimente',label:'📋 Lista'},{id:'search',label:'🤖 AI Search'},{id:'recent',label:'⏱ Recente'}].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id ? th.accent : th.border}`, background: activeSection===s.id ? `${th.accent}15` : 'transparent', color: activeSection===s.id ? th.accent : th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.label}</button>
          ))}
        </div>
        {/* Category filter - only for lista */}
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '12px' }}>
            {FOOD_CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{ padding: '6px 12px', borderRadius: '100px', border: `1.5px solid ${cat===c.id ? c.color : th.border}`, background: cat===c.id ? `${c.color}18` : 'transparent', color: cat===c.id ? c.color : th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeSection === 'alimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(food => (
              <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${quantities[food.id] ? th.accent + '40' : th.border}` }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{food.emoji || '🍽'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: th.text }}>{food.name}</div>
                  <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f||0}g / 100{food.unit}</div>
                </div>
                <input type="number" value={quantities[food.id] || ''} onChange={e => setQty(food.id, e.target.value)}
                  placeholder={food.unit} inputMode="decimal"
                  style={{ width: '68px', background: quantities[food.id] ? `${th.accent}10` : th.card2, border: `1.5px solid ${quantities[food.id] ? th.accent : th.border}`, borderRadius: '10px', padding: '8px 6px', color: th.text, fontSize: '14px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}/>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => searchFood(e.target.value), 700); }}
                placeholder="🤖 Caută orice: calamari, ciocolată Milka, supă de pui..."
                style={{ width: '100%', background: th.bg2, border: `2px solid ${searching ? th.accent : th.border}`, borderRadius: '14px', padding: '12px 16px', color: th.text, fontSize: '14px', outline: 'none', fontFamily: 'inherit', paddingRight: '40px', transition: 'border-color 0.2s' }}/>
              {searching && <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: th.accent, fontWeight: 700, animation: 'pulse 1s infinite' }}>AI⟳</div>}
            </div>

            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em' }}>🤖 REZULTATE AI (la 100g)</div>
                {searchResults.map((r, i) => {
                  const saved = customFoods.some(f => f.name === r.name);
                  return (
                    <div key={i} style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${saved ? '#10b98140' : th.border}`, display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '24px' }}>{r.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: th.text, marginBottom: '3px' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: th.text3 }}>🔥{r.kcal}kcal · P:{r.p}g · C:{r.c}g · G:{r.fat ?? r.f ?? 0}g{r.fiber ? ` · F:${r.fiber}g` : ''}</div>
                        <div style={{ fontSize: '10px', color: th.text3, marginTop: '2px' }}>
                          Categorie: <span style={{ color: FOOD_CATS.find(c => c.id === r.cat)?.color || th.accent }}>{FOOD_CATS.find(c => c.id === r.cat)?.label || r.cat}</span>
                        </div>
                      </div>
                      {saved
                        ? <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ Salvat</span>
                        : <button onClick={() => saveCustomFood(r)} style={{ padding: '7px 12px', background: `${th.accent}15`, border: `1px solid ${th.accent}40`, borderRadius: '10px', color: th.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Salvează</button>
                      }
                    </div>
                  );
                })}
              </div>
            )}
            {searchDone && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Încearcă mai specific: "piept pui fiert", "orez brun"</div>
            )}
            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: th.text2 }}>Caută orice aliment în română</div>
                <div style={{ fontSize: '12px', color: th.text3, marginTop: '6px' }}>AI-ul estimează macro-urile și îl salvează în categoria corectă automat</div>
              </div>
            )}
            {customFoods.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginTop: '8px' }}>SALVATE DE TINE ({customFoods.length})</div>
                {customFoods.map(food => (
                  <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '14px', border: `1px solid ${th.border}` }}>
                    <span style={{ fontSize: '22px' }}>{food.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{food.name}</div>
                      <div style={{ fontSize: '11px', color: th.text3 }}>{food.kcal}kcal · P:{food.p}g · C:{food.c}g · G:{food.f}g / 100g</div>
                    </div>
                    <button onClick={() => setCustomFoods(customFoods.filter(f => f.id !== food.id))} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', color: '#ef4444', padding: '5px 8px', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeSection === 'recent' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: th.text3, fontSize: '13px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏱</div>
            Istoricul alimentelor recent folosite va apărea aici.
          </div>
        )}
        <div style={{ height: '80px' }}/>
      </div>

      {/* FOOTER - add to log */}
      {hasItems && (
        <div style={{ padding: '12px 16px', background: th.bg2, borderTop: `1px solid ${th.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[{l:'Kcal',v:totals.kcal,c:'#f97316'},{l:'Prot',v:`${totals.p}g`,c:'#10b981'},{l:'Carbs',v:`${totals.c}g`,c:'#3b82f6'},{l:'Grăs',v:`${totals.fat}g`,c:'#f59e0b'},{l:'Fibre',v:`${totals.fiber}g`,c:'#8b5cf6'}].map(x => (
              <div key={x.l} style={{ flex: 1, textAlign: 'center', background: `${x.c}12`, border: `1px solid ${x.c}25`, borderRadius: '10px', padding: '5px 4px', minWidth: '48px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: x.c }}>{x.v}</div>
                <div style={{ fontSize: '10px', color: x.c, opacity: 0.7 }}>{x.l}</div>
              </div>
            ))}
          </div>
          <button onClick={addToLog} className="btn-tap"
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 4px 15px rgba(249,115,22,0.35)' }}>
            ◆ ADAUGĂ LA JURNAL
          </button>
        </div>
      )}
    </div>
  );
}
// ─── ANTRENAMENT TAB ──────────────────────────────────────────────────────────
function AntrenamentTab({ th, workouts, setWorkouts, profile, onSendToCoach, onOpenGymMode }) {
  const [mode, setMode] = useState('gym');
  const [selGroup, setSelGroup] = useState('piept');
  const [selEx, setSelEx] = useState(null);
  const [sets, setSets] = useState([]);
  const [cardioType, setCardioType] = useState('mers');
  const [cardioDur, setCardioDur] = useState('');
  const [cardioInt, setCardioInt] = useState('moderată');
  const [workType, setWorkType] = useState('munca_usoara');
  const [workDur, setWorkDur] = useState('');
  const key = todayKey();
  const todayW = workouts.days?.[key] || { exercises: [], cardio: [], work: [] };
  const w = parseFloat(profile?.weight) || 80;

  const addSet = () => setSets(s => [...s, { kg: '', reps: '' }]);
  const updSet = (i, f, v) => setSets(s => s.map((set, idx) => idx === i ? { ...set, [f]: v } : set));
  const rmSet = i => setSets(s => s.filter((_, idx) => idx !== i));

  const getPR = (exId) => {
    const all = Object.values(workouts.days || {}).flatMap(d => (d.exercises || []).filter(e => e.id === exId).flatMap(e => e.sets || []));
    if (!all.length) return null;
    return Math.max(...all.map(s => parseFloat(s.kg) || 0));
  };

  const saveEx = () => {
    if (!selEx || !sets.length) return;
    const valid = sets.filter(s => s.kg && s.reps && parseFloat(s.kg) > 0 && parseInt(s.reps) > 0);
    if (!valid.length) return;
    const ex = EXERCISES[selGroup].find(e => e.id === selEx);
    const vol = valid.reduce((a, s) => a + parseFloat(s.kg) * parseInt(s.reps), 0);
    const entry = { id: selEx, name: ex.name, group: selGroup, sets: valid, volume: Math.round(vol), time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], exercises: [...(nw.days[key].exercises||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setSets([]); setSelEx(null);
    onSendToCoach(`Forță: ${ex.name} — ${valid.map(s => `${s.kg}kg×${s.reps}`).join(', ')}`);
  };

  const saveCardio = () => {
    if (!cardioDur || parseInt(cardioDur) <= 0) return;
    const ct = CARDIO_TYPES.find(c => c.id === cardioType) || CARDIO_TYPES[0];
    const kcal = calcBurned(ct.met, parseInt(cardioDur), w);
    const entry = { id: cardioType, name: ct.name, icon: ct.icon, duration: parseInt(cardioDur), intensity: cardioInt, kcal, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], cardio: [...(nw.days[key].cardio||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setCardioDur('');
    onSendToCoach(`Cardio: ${ct.name} ${cardioDur}min (${cardioInt}) — ${kcal} kcal`);
  };

  const saveWork = () => {
    if (!workDur || parseInt(workDur) <= 0) return;
    const wt = WORK_TYPES.find(t => t.id === workType) || WORK_TYPES[0];
    const kcal = calcBurned(wt.met, parseInt(workDur), w);
    const entry = { id: workType, name: wt.name, icon: wt.icon, duration: parseInt(workDur), kcal, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setWorkouts(prev => {
      const nw = { ...prev }; if (!nw.days) nw.days = {}; if (!nw.days[key]) nw.days[key] = { exercises: [], cardio: [], work: [] };
      nw.days[key] = { ...nw.days[key], work: [...(nw.days[key].work||[]), entry] };
      lsSave(K.workouts, nw); return nw;
    }); setWorkDur('');
    onSendToCoach(`Muncă fizică: ${wt.name} ${workDur}min — ${kcal} kcal arse`);
  };

  const delEx = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],exercises:(nw.days[key].exercises||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };
  const delCardio = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],cardio:(nw.days[key].cardio||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };
  const delWork = (i) => { setWorkouts(prev => { const nw={...prev}; nw.days[key]={...nw.days[key],work:(nw.days[key].work||[]).filter((_,j)=>j!==i)}; lsSave(K.workouts,nw); return nw; }); };

  const inp = { background: th.card2, border: `1.5px solid ${th.border}`, borderRadius: '10px', padding: '10px', color: th.text, fontSize: '15px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: th.text }}>💪 Antrenament</div>
          <button onClick={onOpenGymMode} className="btn-tap"
            style={{ padding: '9px 16px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 3px 12px rgba(249,115,22,0.4)' }}>
            💪 GYM MODE
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px' }}>
          {[{id:'gym',label:'🏋 Sală'},{id:'cardio',label:'🏃 Cardio'},{id:'munca',label:'🔧 Muncă'}].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: `2px solid ${mode===m.id?'#f97316':th.border}`, background: mode===m.id ? 'rgba(249,115,22,0.1)' : 'transparent', color: mode===m.id ? '#f97316' : th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* GYM */}
        {mode === 'gym' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MUSCLE_GROUPS.map(g => (
                <button key={g.id} onClick={() => { setSelGroup(g.id); setSelEx(null); setSets([]); }}
                  style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${selGroup===g.id?g.color:th.border}`, background: selGroup===g.id?`${g.color}15`:'transparent', color: selGroup===g.id?g.color:th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '12px', border: `1px solid ${th.border}` }}>
              <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>ALEGE EXERCIȚIU</div>
              {EXERCISES[selGroup].map(ex => {
                const pr = getPR(ex.id);
                return (
                  <button key={ex.id} onClick={() => { setSelEx(ex.id); if (!sets.length) setSets([{kg:'',reps:''}]); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1.5px solid ${selEx===ex.id?'rgba(249,115,22,0.4)':th.border}`, background: selEx===ex.id?'rgba(249,115,22,0.08)':'transparent', cursor: 'pointer', marginBottom: '6px', textAlign: 'left' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: selEx===ex.id?'#f97316':th.text }}>{ex.name}</span>
                    {pr && <span style={{ fontSize: '11px', color: th.text3, background: th.card2, padding: '2px 8px', borderRadius: '6px' }}>PR: {pr}kg</span>}
                  </button>
                );
              })}
            </div>
            {selEx && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f97316', marginBottom: '12px' }}>{EXERCISES[selGroup].find(e=>e.id===selEx)?.name}</div>
                {sets.map((set, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="number" value={set.kg} onChange={e => updSet(i,'kg',e.target.value)} placeholder="kg" style={inp}/>
                    <input type="number" value={set.reps} onChange={e => updSet(i,'reps',e.target.value)} placeholder="reps" style={inp}/>
                    <button onClick={() => rmSet(i)} style={{ width: '36px', height: '42px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <button onClick={addSet} style={{ padding: '10px', background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', color: th.text2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>+ Set</button>
                  <button onClick={saveEx} style={{ padding: '10px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(249,115,22,0.3)' }}>SALVEAZĂ ◆</button>
                </div>
              </div>
            )}
            {todayW.exercises?.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 SESIUNE AZI</div>
                {todayW.exercises.map((ex, i) => {
                  const mg = MUSCLE_GROUPS.find(g => g.id === ex.group);
                  return (
                    <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: th.card, borderRadius: '10px', borderLeft: `3px solid ${mg?.color||'#f97316'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: th.text }}>{ex.name}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: th.text3 }}>{ex.time}</span>
                          <button onClick={() => delEx(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '2px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {ex.sets.map((s, j) => <span key={j} style={{ fontSize: '12px', color: th.text2, background: th.card2, padding: '3px 8px', borderRadius: '6px' }}>{s.kg}kg×{s.reps}</span>)}
                        <span style={{ fontSize: '11px', color: th.text3, marginLeft: 'auto' }}>Vol: {ex.volume}kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CARDIO */}
        {mode === 'cardio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CARDIO_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setCardioType(ct.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '100px', border: `1.5px solid ${cardioType===ct.id?ct.color:th.border}`, background: cardioType===ct.id?`${ct.color}15`:'transparent', color: cardioType===ct.id?ct.color:th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  <span>{ct.icon}</span>{ct.name}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>DURATĂ (min)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[15,20,30,45,60,90].map(min => (
                    <button key={min} onClick={() => setCardioDur(String(min))}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${cardioDur===String(min)?'#10b981':th.border}`, background: cardioDur===String(min)?'rgba(16,185,129,0.12)':th.card2, color: cardioDur===String(min)?'#10b981':th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{min}</button>
                  ))}
                </div>
                <input type="number" value={cardioDur} onChange={e => setCardioDur(e.target.value)} placeholder="sau scrie manual..." style={{ width: '100%', ...inp, textAlign: 'left', padding: '10px 14px' }}/>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>INTENSITATE</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['ușoară','moderată','intensă'].map(int => (
                    <button key={int} onClick={() => setCardioInt(int)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1.5px solid ${cardioInt===int?'#10b981':th.border}`, background: cardioInt===int?'rgba(16,185,129,0.12)':th.card2, color: cardioInt===int?'#10b981':th.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{int}</button>
                  ))}
                </div>
              </div>
              {cardioDur && parseInt(cardioDur) > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px', fontWeight: 700 }}>ESTIMAT ARS</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', fontFamily: "'Barlow Condensed',sans-serif" }}>{calcBurned(CARDIO_TYPES.find(ct2 => ct2.id === cardioType)?.met || 3.5, parseInt(cardioDur), w)} kcal</div>
                </div>
              )}
              <button onClick={saveCardio} disabled={!cardioDur||parseInt(cardioDur)<=0}
                style={{ padding: '14px', background: cardioDur&&parseInt(cardioDur)>0?'linear-gradient(135deg,#10b981,#059669)':th.card2, border: 'none', borderRadius: '12px', color: cardioDur&&parseInt(cardioDur)>0?'#fff':th.text3, fontSize: '15px', fontWeight: 800, cursor: cardioDur&&parseInt(cardioDur)>0?'pointer':'not-allowed', fontFamily: 'inherit' }}>◆ SALVEAZĂ CARDIO</button>
            </div>
            {todayW.cardio?.length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 CARDIO AZI</div>
                {todayW.cardio.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{c.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{c.name}</div><div style={{ fontSize: '11px', color: th.text3 }}>{c.duration}min · {c.intensity}</div></div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{c.kcal} kcal</span>
                    <button onClick={() => delCardio(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MUNCA FIZICA */}
        {mode === 'munca' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: th.text2 }}>
              💡 Muncă fizică = activitate zilnică suplimentară (nu sport). Contribuie la totalul caloric ars.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {WORK_TYPES.map(wt => (
                <button key={wt.id} onClick={() => setWorkType(wt.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', border: `2px solid ${workType===wt.id?'#f97316':th.border}`, background: workType===wt.id?'rgba(249,115,22,0.08)':'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '24px' }}>{wt.icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: workType===wt.id?'#f97316':th.text }}>{wt.name}</div>
                    <div style={{ fontSize: '12px', color: th.text3 }}>{wt.desc} · MET {wt.met}</div>
                  </div>
                  {workType === wt.id && <span style={{ marginLeft: 'auto', color: '#f97316', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ background: th.bg2, borderRadius: '14px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em' }}>DURATĂ (minute)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[30,60,90,120,180,240].map(min => (
                    <button key={min} onClick={() => setWorkDur(String(min))}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${workDur===String(min)?'#f97316':th.border}`, background: workDur===String(min)?'rgba(249,115,22,0.12)':th.card2, color: workDur===String(min)?'#f97316':th.text2, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{min}</button>
                  ))}
                </div>
                <input type="number" value={workDur} onChange={e => setWorkDur(e.target.value)} placeholder="sau scrie manual..." style={{ width: '100%', ...inp, textAlign: 'left', padding: '10px 14px' }}/>
              </div>
              {workDur && parseInt(workDur) > 0 && (
                <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#f97316', marginBottom: '4px', fontWeight: 700 }}>ESTIMAT ARS</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#f97316', fontFamily: "'Barlow Condensed',sans-serif" }}>{calcBurned(WORK_TYPES.find(t => t.id === workType)?.met || 2.5, parseInt(workDur), w)} kcal</div>
                </div>
              )}
              <button onClick={saveWork} disabled={!workDur||parseInt(workDur)<=0}
                style={{ padding: '14px', background: workDur&&parseInt(workDur)>0?'linear-gradient(135deg,#f97316,#ef4444)':th.card2, border: 'none', borderRadius: '12px', color: workDur&&parseInt(workDur)>0?'#fff':th.text3, fontSize: '15px', fontWeight: 800, cursor: workDur&&parseInt(workDur)>0?'pointer':'not-allowed', fontFamily: 'inherit' }}>◆ SALVEAZĂ ACTIVITATE</button>
            </div>
            {(todayW.work||[]).length > 0 && (
              <div style={{ background: th.bg2, borderRadius: '14px', padding: '14px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>📋 ACTIVITATE AZI</div>
                {(todayW.work||[]).map((w2, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{w2.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{w2.name}</div><div style={{ fontSize: '11px', color: th.text3 }}>{w2.duration}min</div></div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#f97316' }}>{w2.kcal} kcal</span>
                    <button onClick={() => delWork(i)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ height: '20px' }}/>
      </div>
    </div>
  );
}

// ─── PROGRES TAB ──────────────────────────────────────────────────────────────
function ProgresTab({ th, stats, setStats, workouts, profile }) {
  const [activeChart, setActiveChart] = useState('greutate');
  const [newWeight, setNewWeight] = useState('');
  const key = todayKey();

  const weightEntries = Object.entries(stats.weight || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-30);
  const calEntries = Object.entries(stats.daily || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const currentWeight = stats.weight?.[key] || stats.weight?.[Object.keys(stats.weight||{}).sort().pop()] || null;
  const startWeight = parseFloat(profile?.weight) || null;
  const targetWeight = parseFloat(profile?.targetWeight) || null;
  const lostKg = startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : null;

  const saveWeight = () => {
    if (!newWeight || parseFloat(newWeight) <= 0) return;
    const val = parseFloat(newWeight);
    setStats(prev => {
      const ns = { ...prev, weight: { ...(prev.weight||{}), [key]: val } };
      lsSave(K.stats, ns);
      return ns;
    });
    setNewWeight('');
  };

  const mini = (entries, key2, color, max) => {
    if (entries.length < 2) return null;
    const vals = entries.map(([, v]) => v[key2] || 0);
    const mn = Math.min(...vals) * 0.98, mx = max || Math.max(...vals) * 1.02;
    const pts = entries.map(([, v], i) => {
      const x = (i / (entries.length-1)) * 100;
      const y = 100 - ((( v[key2] || 0) - mn) / (mx - mn)) * 100;
      return `${x},${Math.max(0, Math.min(100, y))}`;
    });
    return (
      <svg viewBox="0 0 100 50" style={{ width: '100%', height: '60px' }} preserveAspectRatio="none">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '16px' }}>📊 Progres</div>

      {/* WEIGHT QUICK INPUT */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', marginBottom: '12px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>⚖️ Greutate azi</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={currentWeight ? `${currentWeight} kg` : 'ex: 95.8'} style={{ flex: 1, background: th.card2, border: `1.5px solid ${newWeight?'#f97316':th.border}`, borderRadius: '10px', padding: '10px 14px', color: th.text, fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}/>
          <button onClick={saveWeight} style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>SALVEAZĂ</button>
        </div>
        {lostKg !== null && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1, background: lostKg > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: lostKg > 0 ? '#10b981' : '#ef4444' }}>{lostKg > 0 ? '-' : '+'}{Math.abs(lostKg)}kg</div>
              <div style={{ fontSize: '10px', color: th.text3 }}>față de start</div>
            </div>
            {targetWeight && currentWeight && (
              <div style={{ flex: 1, background: 'rgba(139,92,246,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6' }}>{Math.abs(Math.round((currentWeight - targetWeight)*10)/10)}kg</div>
                <div style={{ fontSize: '10px', color: th.text3 }}>până la țintă</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[{id:'greutate',label:'⚖️ Greutate'},{id:'calorii',label:'🔥 Calorii'},{id:'proteine',label:'💪 Proteine'}].map(c => (
          <button key={c.id} onClick={() => setActiveChart(c.id)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `1.5px solid ${activeChart===c.id?'#f97316':th.border}`, background: activeChart===c.id?'rgba(249,115,22,0.1)':'transparent', color: activeChart===c.id?'#f97316':th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{c.label}</button>
        ))}
      </div>

      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', marginBottom: '12px', border: `1px solid ${th.border}` }}>
        {activeChart === 'greutate' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Greutate (ultimele 30 zile)</div>
            {weightEntries.length > 1 ? (
              <>
                <svg viewBox="0 0 300 80" style={{ width: '100%', height: '80px' }} preserveAspectRatio="none">
                  {(() => {
                    const vals = weightEntries.map(([, v]) => v);
                    const mn = Math.min(...vals) - 0.5, mx = Math.max(...vals) + 0.5;
                    const pts = weightEntries.map(([, v], i) => `${(i/(weightEntries.length-1))*300},${80-((v-mn)/(mx-mn))*70}`);
                    return <>
                      <polyline points={pts.join(' ')} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      {weightEntries.map(([, v], i) => <circle key={i} cx={(i/(weightEntries.length-1))*300} cy={80-((v-mn)/(mx-mn))*70} r="4" fill="#f97316"/>)}
                    </>;
                  })()}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: th.text3 }}>
                  <span>{weightEntries[0]?.[0]?.slice(5)}</span>
                  <span style={{ fontWeight: 700, color: '#f97316' }}>{weightEntries[weightEntries.length-1]?.[1]} kg</span>
                  <span>{weightEntries[weightEntries.length-1]?.[0]?.slice(5)}</span>
                </div>
              </>
            ) : <div style={{ textAlign: 'center', padding: '20px', color: th.text3, fontSize: '13px' }}>Înregistrează greutatea zilnic pentru a vedea graficul.</div>}
          </>
        )}
        {activeChart === 'calorii' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Calorii (ultimele 14 zile)</div>
            {mini(calEntries, 'calories', '#ef4444')}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {calEntries.slice(-7).map(([date, d]) => (
                <div key={date} style={{ textAlign: 'center', flex: 1, minWidth: '36px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{d.calories || 0}</div>
                  <div style={{ fontSize: '10px', color: th.text3 }}>{date.slice(8)}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {activeChart === 'proteine' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '8px' }}>Proteine (ultimele 14 zile)</div>
            {mini(calEntries, 'protein', '#10b981')}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {calEntries.slice(-7).map(([date, d]) => (
                <div key={date} style={{ textAlign: 'center', flex: 1, minWidth: '36px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{d.protein || 0}g</div>
                  <div style={{ fontSize: '10px', color: th.text3 }}>{date.slice(8)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* SPORT HISTORY */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>📅 Activitate sportivă (7 zile)</div>
        {Object.entries(workouts.days || {}).sort((a,b) => b[0].localeCompare(a[0])).slice(0,7).map(([date, day]) => {
          const exCount = day.exercises?.length || 0;
          const cardioKcal = (day.cardio||[]).reduce((a,c) => a+c.kcal, 0);
          const workKcal = (day.work||[]).reduce((a,w) => a+w.kcal, 0);
          if (!exCount && !cardioKcal && !workKcal) return null;
          return (
            <div key={date} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}`, gap: '10px' }}>
              <div style={{ fontSize: '12px', color: th.text3, minWidth: '40px' }}>{date.slice(5)}</div>
              <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {exCount > 0 && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🏋 {exCount} ex.</span>}
                {cardioKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🏃 {cardioKcal}kcal</span>}
                {workKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>🔧 {workKcal}kcal</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: '20px' }}/>
    </div>
  );
}

// ─── PROFIL TAB ───────────────────────────────────────────────────────────────
function ProfilTab({ th, profile, saveProfile, supplements, setSupplements, sendMessage }) {
  const [form, setForm] = useState({ ...profile });
  const [activeSection, setActiveSection] = useState('date');
  const [newSupl, setNewSupl] = useState({ name: '', emoji: '💊', time: '08:00', note: '' });
  const [analyzingSupl, setAnalyzingSupl] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const macros = calcTDEE(form);

  const inp = { background: th.card2, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '10px 14px', color: th.text, fontSize: '15px', outline: 'none', fontFamily: 'inherit', width: '100%' };

  const analyzeAndAddSupl = async () => {
    if (!newSupl.name.trim()) return;
    setAnalyzingSupl(true);
    try {
      const reply = await callAI(
        [{ role: 'user', content: `Analizează suplimentul: ${newSupl.name}. Spune-mi: 1) La ce oră optimă se ia (format HH:MM), 2) Cu sau fără mâncare, 3) Beneficii principale (maxim 8 cuvinte), 4) Interacțiuni cu: ${supplements.map(s=>s.name).join(', ')}. Răspunde în format JSON: {"time":"HH:MM","note":"descriere scurta","safe":true/false,"warning":"null sau avertisment"}` }],
        'Expert farmacie și nutriție. Răspunde DOAR cu JSON valid, fără text extra.',
        500
      );
      const clean = reply.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(clean);
      const newS = {
        id: `custom_${Date.now()}`,
        name: newSupl.name,
        emoji: newSupl.emoji,
        time: analysis.time || newSupl.time,
        note: analysis.note || newSupl.note,
        days: [1,2,3,4,5,6,7],
        custom: true,
      };
      setSupplements([...supplements, newS]);
      setNewSupl({ name: '', emoji: '💊', time: '08:00', note: '' });
      if (analysis.warning && analysis.warning !== 'null') {
        sendMessage(`Am adăugat ${newSupl.name}. AI a detectat: ${analysis.warning}`);
      }
    } catch {
      const newS = { id: `custom_${Date.now()}`, name: newSupl.name, emoji: newSupl.emoji, time: newSupl.time, note: newSupl.note || 'Cu masă', days: [1,2,3,4,5,6,7], custom: true };
      setSupplements([...supplements, newS]);
      setNewSupl({ name: '', emoji: '💊', time: '08:00', note: '' });
    }
    setAnalyzingSupl(false);
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', background: th.bg2, borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '12px' }}>👤 Profil</div>
        <div style={{ display: 'flex', gap: '6px', paddingBottom: '12px' }}>
          {[{id:'date',label:'📋 Date'},{id:'suplimente',label:'💊 Suplimente'},{id:'obiective',label:'🎯 Obiective'}].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 14px', borderRadius: '100px', border: `1.5px solid ${activeSection===s.id?'#8b5cf6':th.border}`, background: activeSection===s.id?'rgba(139,92,246,0.1)':'transparent', color: activeSection===s.id?'#8b5cf6':th.text2, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeSection === 'date' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>👤 DATE PERSONALE</div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>NUME</div>
                <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Numele tău" style={inp}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[{k:'age',l:'VÂRSTĂ',p:'ani'},{k:'height',l:'ÎNĂLȚIME',p:'cm'},{k:'weight',l:'GREUTATE',p:'kg'}].map(({k,l,p}) => (
                  <div key={k}>
                    <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>{l}</div>
                    <input type="number" value={form[k]} onChange={e => upd(k, e.target.value)} placeholder={p} style={{ ...inp, padding: '10px 8px', textAlign: 'center' }}/>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>GREUTATE DORITĂ</div>
                  <input type="number" value={form.targetWeight} onChange={e => upd('targetWeight', e.target.value)} placeholder="kg" style={{ ...inp, borderColor: form.targetWeight ? 'rgba(16,185,129,0.4)' : th.border }}/>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '6px' }}>SEX</div>
                  <select value={form.sex} onChange={e => upd('sex', e.target.value)} style={inp}>
                    <option value="male">Masculin</option>
                    <option value="female">Feminin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TDEE PREVIEW */}
            {macros && (
              <div style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.08),rgba(239,68,68,0.08))', borderRadius: '16px', padding: '14px', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#f97316', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>⚡ CALCULAT MIFFLIN-ST JEOR</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                  {[{l:'BMR',v:macros.bmr,unit:'kcal'},{l:'TDEE',v:macros.tdee,unit:'kcal'},{l:'TARGET',v:macros.base,unit:'kcal'},{l:'PROT MIN',v:macros.protein,unit:'g'}].map(x => (
                    <div key={x.l} style={{ textAlign: 'center', background: 'rgba(249,115,22,0.08)', borderRadius: '10px', padding: '8px 4px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#f97316' }}>{x.v}</div>
                      <div style={{ fontSize: '9px', color: '#f97316', opacity: 0.6 }}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TIP CORP + OBIECTIV */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>🏃 TIP CORP & OBIECTIV</div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>TIP DE CORP</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[{v:'ectomorf',l:'Ectomorf',d:'Slab natural, metabolism rapid',i:'🦴'},{v:'mezomorf',l:'Mezomorf',d:'Atletico, răspunde bine la antrenament',i:'💪'},{v:'endomorf',l:'Endomorf',d:'Tinde să acumuleze grăsime',i:'🔥'}].map(bt => (
                    <button key={bt.v} onClick={() => upd('bodyType', bt.v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: `2px solid ${form.bodyType===bt.v?'#8b5cf6':th.border}`, background: form.bodyType===bt.v?'rgba(139,92,246,0.08)':th.card, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: '20px' }}>{bt.i}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 700, color: form.bodyType===bt.v?'#8b5cf6':th.text }}>{bt.l}</div><div style={{ fontSize: '11px', color: th.text3 }}>{bt.d}</div></div>
                      {form.bodyType === bt.v && <span style={{ color: '#8b5cf6' }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>OBIECTIV</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[{v:'slabit',l:'Slăbit',i:'🔻',d:'Pierdere grăsime'},{v:'recompozitie',l:'Recompozitie',i:'⚡',d:'Slăbit + masă'},{v:'masa',l:'Masă',i:'📈',d:'Creștere musculară'},{v:'mentinere',l:'Menținere',i:'⚖️',d:'Greutate stabilă'}].map(g => (
                    <button key={g.v} onClick={() => upd('goal', g.v)}
                      style={{ padding: '12px', borderRadius: '12px', border: `2px solid ${form.goal===g.v?'#10b981':th.border}`, background: form.goal===g.v?'rgba(16,185,129,0.08)':th.card, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: '22px', marginBottom: '4px' }}>{g.i}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: form.goal===g.v?'#10b981':th.text }}>{g.l}</div>
                      <div style={{ fontSize: '11px', color: th.text3 }}>{g.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, marginBottom: '8px' }}>NIVEL ACTIVITATE</div>
                {[{v:'sedentar',l:'Sedentar',d:'Birou, fără sport'},{v:'usor',l:'Ușor activ',d:'1-3 zile/săpt'},{v:'moderat',l:'Moderat',d:'3-5 zile/săpt'},{v:'activ',l:'Activ',d:'6-7 zile/săpt'},{v:'foarte_activ',l:'Extrem activ',d:'2x/zi'}].map(a => (
                  <button key={a.v} onClick={() => upd('activity', a.v)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '9px 12px', borderRadius: '10px', border: `1.5px solid ${form.activity===a.v?'#f59e0b':th.border}`, background: form.activity===a.v?'rgba(245,158,11,0.08)':th.card, cursor: 'pointer', marginBottom: '6px', textAlign: 'left' }}>
                    <div><span style={{ fontSize: '13px', fontWeight: 700, color: form.activity===a.v?'#f59e0b':th.text }}>{a.l}</span><span style={{ fontSize: '12px', color: th.text3, marginLeft: '8px' }}>{a.d}</span></div>
                    {form.activity === a.v && <span style={{ color: '#f59e0b' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => saveProfile(form)}
              style={{ padding: '16px', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '16px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
              ◆ SALVEAZĂ PROFILUL
            </button>
            <div style={{ height: '10px' }}/>
          </div>
        )}

        {activeSection === 'suplimente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ADD NEW */}
            <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6', marginBottom: '10px' }}>➕ ADAUGĂ SUPLIMENT</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={newSupl.emoji} onChange={e => setNewSupl(s => ({...s, emoji: e.target.value}))} style={{ ...inp, width: '52px', textAlign: 'center', fontSize: '20px', padding: '8px' }}/>
                <input value={newSupl.name} onChange={e => setNewSupl(s => ({...s, name: e.target.value}))} placeholder="Nume supliment..." style={{ ...inp, flex: 1 }}/>
              </div>
              <button onClick={analyzeAndAddSupl} disabled={!newSupl.name.trim() || analyzingSupl}
                style={{ width: '100%', padding: '11px', background: newSupl.name.trim() ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : th.card2, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: newSupl.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {analyzingSupl ? '🤖 AI analizează timing & interacțiuni...' : '🤖 Analizează cu AI & Adaugă'}
              </button>
            </div>

            {/* SUPPLEMENTS LIST */}
            {Object.entries(supplements.reduce((acc, s) => { const t = s.time.substring(0,5); if (!acc[t]) acc[t] = []; acc[t].push(s); return acc; }, {})).sort().map(([time, supls]) => (
              <div key={time}>
                <div style={{ fontSize: '12px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', paddingLeft: '4px' }}>{time}</div>
                {supls.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: th.bg2, borderRadius: '12px', marginBottom: '6px', border: `1px solid ${s.custom ? 'rgba(139,92,246,0.2)' : th.border}` }}>
                    <span style={{ fontSize: '20px' }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: th.text }}>{s.name}</div>
                      {s.note && <div style={{ fontSize: '11px', color: th.text3 }}>{s.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: th.text3 }}>{s.time}</span>
                      {s.custom && <button onClick={() => setSupplements(supplements.filter(x => x.id !== s.id))} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '3px 7px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeSection === 'obiective' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {macros && (
              <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '12px' }}>🎯 Macro-uri calculate</div>
                {[
                  { label: 'Zi antrenament', macros: getDayMacros(profile, 'antrenament'), color: '#f97316', icon: '⚡' },
                  { label: 'Zi intensă', macros: getDayMacros(profile, 'intens'), color: '#3b82f6', icon: '🔥' },
                  { label: 'Repaus', macros: getDayMacros(profile, 'repaus'), color: '#8b5cf6', icon: '🌙' },
                ].map(d => d.macros && (
                  <div key={d.label} style={{ marginBottom: '10px', padding: '12px', background: `${d.color}08`, borderRadius: '12px', border: `1px solid ${d.color}25` }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: d.color, marginBottom: '6px' }}>{d.icon} {d.label}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: th.text2 }}>
                      <span>🔥 {d.macros.kcal}kcal</span>
                      <span>P: {d.macros.protein}g</span>
                      <span>C: {d.macros.carbs}g</span>
                      <span>G: {d.macros.fat}g</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ height: '20px' }}/>
      </div>
    </div>
  );
}

// ─── FOOD PICKER MODAL ────────────────────────────────────────────────────────
function FoodPickerModal({ th, darkMode, customFoods, setCustomFoods, onAddMeal, onClose, onSendToCoach }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: th.bg2, borderRadius: '24px 24px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: `1px solid ${th.border}`, borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: th.text }}>🍽 Adaugă masă</div>
          <button onClick={onClose} style={{ background: th.card2, border: 'none', borderRadius: '10px', color: th.text2, padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AlimenteTab th={th} customFoods={customFoods} setCustomFoods={setCustomFoods} onAddMeal={(meal) => { onAddMeal(meal); onClose(); }}/>
        </div>
      </div>
    </div>
  );
}
// ─── GYM MODE ─────────────────────────────────────────────────────────────────
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
