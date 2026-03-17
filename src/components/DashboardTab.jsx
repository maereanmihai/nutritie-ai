import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME ───────────────────────────────────────────────────────────────────
const th = {
  bg:       "#070a12",
  bg2:      "#0d1220",
  bg3:      "#111827",
  card:     "rgba(255,255,255,0.04)",
  cardHov:  "rgba(255,255,255,0.07)",
  border:   "rgba(255,255,255,0.07)",
  accent:   "#3b82f6",
  accentG:  "linear-gradient(135deg,#3b82f6,#6366f1)",
  green:    "#10b981",
  orange:   "#f97316",
  yellow:   "#fbbf24",
  red:      "#ef4444",
  text:     "#f1f5f9",
  text2:    "#94a3b8",
  text3:    "#64748b",
  protein:  "#3b82f6",
  carbs:    "#f97316",
  fat:      "#fbbf24",
  cal:      "#10b981",
};

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0];

function getTodayData() {
  try {
    // Try multiple storage keys used by existing app
    const keys = ["healthagent_data", "nutritie_mihai_v3", "health_agent_v1"];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.date === TODAY || d.date === new Date().toDateString()) return d;
      }
    }
    // Try daily log by date
    const dayRaw = localStorage.getItem(`day_${TODAY}`);
    if (dayRaw) return JSON.parse(dayRaw);
  } catch {}
  return null;
}

function getProfile() {
  try {
    const raw = localStorage.getItem("user_profile") || localStorage.getItem("health_profile");
    if (raw) return JSON.parse(raw);
  } catch {}
  // Mihai's defaults
  return {
    name: "Mihai",
    dayType: "normal",
    targets: { calories: 2400, protein: 185, carbs: 220, fat: 75 },
    weight: 85,
    goal: "recompoziție corporală",
  };
}

function getWorkouts() {
  try {
    const raw = localStorage.getItem(`workouts_${TODAY}`) || localStorage.getItem("gym_sessions");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function getMealEntries() {
  try {
    const raw = localStorage.getItem(`meals_${TODAY}`);
    if (raw) return JSON.parse(raw);
    const todayData = getTodayData();
    if (todayData?.meals) return todayData.meals;
    if (todayData?.foods) return todayData.foods;
  } catch {}
  return [];
}

function calcMacros(entries) {
  return entries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || e.kcal || 0),
    protein:  acc.protein  + (e.protein  || e.prot  || 0),
    carbs:    acc.carbs    + (e.carbs    || e.carb   || 0),
    fat:      acc.fat      + (e.fat      || e.fats   || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── MACRO RING SVG ───────────────────────────────────────────────────────────
function MacroRing({ value, target, color, label, unit = "g", size = 80, strokeW = 7 }) {
  const pct = Math.min(1, target > 0 ? value / target : 0);
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(dash), 100);
    return () => clearTimeout(t);
  }, [dash]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* track */}
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW}
          />
          {/* progress */}
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${animated} ${circ}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: th.text, lineHeight: 1 }}>
            {Math.round(value)}
          </span>
          <span style={{ fontSize: 9, color: th.text3, fontWeight: 600, letterSpacing: ".03em" }}>
            /{target}{unit}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: color, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, color, icon }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(score), 150); return () => clearTimeout(t); }, [score]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: th.text2, display: "flex", alignItems: "center", gap: 5 }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
        <div style={{
          height: "100%", width: `${w}%`, borderRadius: 99,
          background: color, transition: "width 1.1s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>
    </div>
  );
}

// ─── PULSE DOT ────────────────────────────────────────────────────────────────
function PulseDot({ color = th.green }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: .6,
        animation: "ping 1.5s cubic-bezier(0,0,.2,1) infinite",
      }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  );
}

// ─── QUICK ACTION BUTTON ──────────────────────────────────────────────────────
function QuickAction({ icon, label, color, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, padding: "12px 8px", border: `1px solid ${hov ? color + "50" : th.border}`,
        borderRadius: 14, background: hov ? color + "12" : th.card,
        cursor: "pointer", transition: "all .2s",
        transform: hov ? "translateY(-2px)" : "none",
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 10, color: hov ? color : th.text2, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>
        {label}
      </span>
    </button>
  );
}

// ─── AI COACH CARD ────────────────────────────────────────────────────────────
function AICoachCard({ profile, macros, targets, workouts }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const calPct = targets.calories > 0 ? Math.round((macros.calories / targets.calories) * 100) : 0;
  const protPct = targets.protein > 0 ? Math.round((macros.protein / targets.protein) * 100) : 0;

  const fetchCoach = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    const prompt = `Ești NutriCoach pentru ${profile.name || "utilizator"}.
Date de azi (${TODAY}):
- Tip zi: ${profile.dayType || "normal"}
- Obiectiv: ${profile.goal || "recompoziție corporală"}
- Calorii: ${Math.round(macros.calories)} din ${targets.calories} kcal (${calPct}%)
- Proteină: ${Math.round(macros.protein)}g din ${targets.protein}g (${protPct}%)
- Carbs: ${Math.round(macros.carbs)}g din ${targets.carbs}g
- Grăsimi: ${Math.round(macros.fat)}g din ${targets.fat}g
- Antrenamente azi: ${workouts.length > 0 ? workouts.map(w => w.name || w.type || "sesiune").join(", ") : "niciunul încă"}

Dă-i un mesaj de coach SCURT (max 4 propoziții), direct, concret. Spune: ce a făcut bine, ce trebuie ajustat azi, și un sfat specific pentru restul zilei. Fii energizant, nu generic.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setMsg(data.content?.[0]?.text || "Coach momentan indisponibil.");
      setLoaded(true);
    } catch {
      setMsg("Coach momentan indisponibil. Verifică conexiunea.");
    }
    setLoading(false);
  }, [loaded, loading, profile, macros, targets, workouts, calPct, protPct]);

  useEffect(() => {
    const timer = setTimeout(fetchCoach, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.06) 100%)",
      border: "1px solid rgba(59,130,246,0.2)",
      borderRadius: 18, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg,#3b82f6,#6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, boxShadow: "0 0 12px rgba(99,102,241,0.4)",
        }}>🤖</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: th.text, letterSpacing: ".04em" }}>
            AI DAILY COACH
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <PulseDot color={loaded ? th.green : th.accent} />
            <span style={{ fontSize: 10, color: th.text3 }}>
              {loading ? "Analizez ziua ta..." : loaded ? "Actualizat acum" : "Se încarcă..."}
            </span>
          </div>
        </div>
        <button
          onClick={() => { setLoaded(false); setMsg(""); fetchCoach(); }}
          style={{
            marginLeft: "auto", padding: "4px 10px", borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.3)",
            background: "transparent", color: th.accent,
            fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: ".04em",
          }}
        >↺ REFRESH</button>
      </div>

      {loading && (
        <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 0" }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: "50%", background: th.accent,
              display: "inline-block",
              animation: `dot 1.2s ${i*0.2}s infinite ease-in-out`,
            }}/>
          ))}
        </div>
      )}

      {msg && (
        <p style={{ fontSize: 14, color: th.text, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          "{msg}"
        </p>
      )}

      {!loading && !msg && (
        <p style={{ fontSize: 13, color: th.text3, margin: 0 }}>
          Coach-ul tău AI se pregătește...
        </p>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardTab({ onNavigate }) {
  const [profile]  = useState(getProfile);
  const [meals]    = useState(getMealEntries);
  const [workouts] = useState(getWorkouts);
  const macros  = calcMacros(meals);
  const targets = profile.targets || { calories: 2400, protein: 185, carbs: 220, fat: 75 };

  const calRemaining = Math.max(0, targets.calories - macros.calories);
  const calPct       = Math.min(100, targets.calories > 0 ? (macros.calories / targets.calories) * 100 : 0);

  // Derived scores (heuristic, real data would come from engines)
  const nutritionScore = Math.round(
    (Math.min(1, macros.protein / targets.protein) * 50) +
    (Math.min(1, macros.calories / targets.calories) * 50)
  );
  const recoveryScore = workouts.length > 0 ? 72 : 88;
  const energyScore   = Math.min(100, Math.round(calPct * 0.7 + nutritionScore * 0.3));

  const dayTypeLabel = {
    training: "🏋️ ZI ANTRENAMENT",
    normal:   "⚡ ZI NORMALĂ",
    rest:     "💤 ZI ODIHNĂ",
  }[profile.dayType] || "⚡ ZI NORMALĂ";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bună dimineața" : hour < 17 ? "Bună ziua" : "Bună seara";

  return (
    <div style={{ padding: "0 0 100px" }}>
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
        @keyframes dot  { 0%,80%,100%{transform:scale(0.6);opacity:.5} 40%{transform:scale(1);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ padding: "20px 20px 0", animation: "fadeUp .5s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: th.text3, fontWeight: 600 }}>
              {greeting},
            </p>
            <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 900, color: th.text, letterSpacing: "-.02em" }}>
              {profile.name || "Mihai"} 👋
            </h1>
          </div>
          <div style={{
            padding: "6px 12px", borderRadius: 99,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.25)",
            fontSize: 11, fontWeight: 800, color: th.accent,
            letterSpacing: ".06em",
          }}>
            {dayTypeLabel}
          </div>
        </div>

        {/* Date */}
        <p style={{ margin: "6px 0 0", fontSize: 12, color: th.text3 }}>
          {new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* ── CALORIE HERO ── */}
      <div style={{ margin: "16px 16px 0", animation: "fadeUp .5s .05s ease both" }}>
        <div style={{
          background: "linear-gradient(135deg,rgba(16,185,129,0.12) 0%,rgba(59,130,246,0.08) 100%)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20, padding: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Calorii azi
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: th.cal, lineHeight: 1 }}>
                  {Math.round(macros.calories)}
                </span>
                <span style={{ fontSize: 14, color: th.text3 }}>
                  / {targets.calories} kcal
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: th.text2 }}>
                {calRemaining > 0
                  ? `Rămân ${Math.round(calRemaining)} kcal`
                  : `Depășit cu ${Math.round(-calRemaining)} kcal`}
              </p>
            </div>

            {/* Big calorie ring */}
            <div style={{ position: "relative", width: 80, height: 80 }}>
              {(() => {
                const r = 34, sw = 7, circ = 2*Math.PI*r;
                return (
                  <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
                    <circle cx={40} cy={40} r={r} fill="none" stroke={th.cal}
                      strokeWidth={sw} strokeLinecap="round"
                      strokeDasharray={`${(calPct/100)*circ} ${circ}`}
                      style={{ transition: "stroke-dasharray 1.3s cubic-bezier(.4,0,.2,1)", filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }}
                    />
                  </svg>
                );
              })()}
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: th.cal,
              }}>
                {Math.round(calPct)}%
              </div>
            </div>
          </div>

          {/* Macro mini rings */}
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <MacroRing value={macros.protein} target={targets.protein} color={th.protein} label="Proteină" size={72} strokeW={6}/>
            <MacroRing value={macros.carbs}   target={targets.carbs}   color={th.carbs}   label="Carbs"    size={72} strokeW={6}/>
            <MacroRing value={macros.fat}     target={targets.fat}     color={th.fat}      label="Grăsimi"  size={72} strokeW={6}/>
          </div>
        </div>
      </div>

      {/* ── AI COACH ── */}
      <div style={{ margin: "12px 16px 0", animation: "fadeUp .5s .1s ease both" }}>
        <AICoachCard profile={profile} macros={macros} targets={targets} workouts={workouts}/>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ margin: "12px 16px 0", animation: "fadeUp .5s .15s ease both" }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Acțiuni rapide
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <QuickAction icon="🍽️" label="Adaugă masă"      color={th.cal}     onClick={() => onNavigate?.("meals")}   />
          <QuickAction icon="🏋️" label="Start workout"    color={th.protein} onClick={() => onNavigate?.("gym")}     />
          <QuickAction icon="📊" label="Loghează greutate" color={th.carbs}   onClick={() => onNavigate?.("stats")}  />
          <QuickAction icon="💬" label="Coach AI"          color="#a78bfa"    onClick={() => onNavigate?.("coach")}  />
        </div>
      </div>

      {/* ── STATUS SCORES ── */}
      <div style={{ margin: "12px 16px 0", animation: "fadeUp .5s .2s ease both" }}>
        <div style={{
          background: th.card, border: `1px solid ${th.border}`,
          borderRadius: 18, padding: "16px 18px",
        }}>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            Status corp
          </p>
          <ScoreBar label="Nutriție"  score={nutritionScore} color={th.cal}     icon="🥗"/>
          <ScoreBar label="Energie"   score={energyScore}    color={th.accent}  icon="⚡"/>
          <ScoreBar label="Recuperare" score={recoveryScore} color={th.green}   icon="💪"/>
        </div>
      </div>

      {/* ── NEXT MEAL & WORKOUT ── */}
      <div style={{ margin: "12px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animation: "fadeUp .5s .25s ease both" }}>
        {/* Next meal */}
        <div style={{
          background: th.card, border: `1px solid ${th.border}`,
          borderRadius: 16, padding: "14px",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            🍽️ Mese azi
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: th.text }}>
            {meals.length}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: th.text3 }}>
            {meals.length === 0 ? "Prima masă?" : meals.length < 3 ? "Continuă planul" : "Pe drumul cel bun!"}
          </p>
        </div>

        {/* Workout status */}
        <div style={{
          background: th.card, border: `1px solid ${th.border}`,
          borderRadius: 16, padding: "14px",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            🏋️ Antrenament
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: workouts.length > 0 ? th.green : th.text }}>
            {workouts.length > 0 ? "✓ Azi" : "—"}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: th.text3 }}>
            {workouts.length > 0
              ? `${workouts.length} sesiune${workouts.length > 1 ? "i" : ""}`
              : profile.dayType === "rest" ? "Zi de odihnă" : "Planifică sesiunea"}
          </p>
        </div>
      </div>

      {/* ── HORMONAL / RECOVERY CONTEXT ── */}
      <div style={{ margin: "12px 16px 0", animation: "fadeUp .5s .3s ease both" }}>
        <div style={{
          background: "linear-gradient(135deg,rgba(167,139,250,0.07),rgba(99,102,241,0.05))",
          border: "1px solid rgba(167,139,250,0.15)",
          borderRadius: 16, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>
            {energyScore >= 80 ? "🔋" : energyScore >= 60 ? "⚡" : "😴"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 800, color: th.text }}>
              {energyScore >= 80 ? "Energie excelentă" : energyScore >= 60 ? "Energie moderată" : "Energie redusă"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: th.text3, lineHeight: 1.5 }}>
              {energyScore >= 80
                ? "Condiții optime pentru antrenament intens și progres"
                : energyScore >= 60
                ? "Menținu intensitatea. Fii atent la recuperare"
                : "Prioritizează odihna și nutriția astăzi"}
            </p>
          </div>
          <div style={{
            fontSize: 18, fontWeight: 900, color: energyScore >= 80 ? th.green : energyScore >= 60 ? th.yellow : th.orange,
          }}>
            {energyScore}
          </div>
        </div>
      </div>

      {/* ── DAILY SUMMARY ── */}
      <div style={{ margin: "12px 16px 0", animation: "fadeUp .5s .35s ease both" }}>
        <div style={{
          background: th.card, border: `1px solid ${th.border}`,
          borderRadius: 16, padding: "14px 16px",
        }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: th.text3, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            📋 Sumar macro
          </p>
          {[
            { label: "Calorii",   val: Math.round(macros.calories),  tgt: targets.calories, unit: "kcal", color: th.cal     },
            { label: "Proteină",  val: Math.round(macros.protein),   tgt: targets.protein,  unit: "g",    color: th.protein },
            { label: "Carbohidrați", val: Math.round(macros.carbs), tgt: targets.carbs,    unit: "g",    color: th.carbs   },
            { label: "Grăsimi",   val: Math.round(macros.fat),       tgt: targets.fat,      unit: "g",    color: th.fat     },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: th.text2, width: 110 }}>{row.label}</span>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, margin: "0 10px" }}>
                <div style={{
                  height: "100%", borderRadius: 99, background: row.color,
                  width: `${Math.min(100, row.tgt > 0 ? (row.val / row.tgt) * 100 : 0)}%`,
                  transition: "width 1s ease", boxShadow: `0 0 6px ${row.color}50`,
                }}/>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: row.color, minWidth: 70, textAlign: "right" }}>
                {row.val}/{row.tgt}{row.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
