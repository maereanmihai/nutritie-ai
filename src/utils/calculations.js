import { DAY_TYPES } from '../constants/dayTypes';

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


export { calcTDEE, buildSystemPrompt, getDayMacros, calcMacros, calcBurned, fmt, calcStreak };
