import { useState } from "react";
import { getTodayKey } from "../utils/date";
import { loadDayOrInit, saveDay } from "../utils/storage";
import { estimateCaloriesBurned } from "../utils/nutrition";
import { WORKOUT_TYPES } from "../config/constants";
import { SectionTitle, EmptyState } from "./common/index";

export default function WorkoutTab() {
  const todayKey = getTodayKey();
  const [dayData, setDayData] = useState(() => loadDayOrInit(todayKey));
  const [type, setType] = useState("weights");
  const [duration, setDuration] = useState(45);
  const [note, setNote] = useState("");

  const workouts = dayData.workouts || [];

  function persist(newData) {
    setDayData(newData);
    saveDay(todayKey, newData);
  }

  function addWorkout() {
    const wt = WORKOUT_TYPES.find((w) => w.id === type);
    const entry = {
      id: Date.now(),
      type,
      name: wt?.label || type,
      emoji: wt?.emoji || "🏅",
      duration: Number(duration),
      calories_burned: estimateCaloriesBurned(type, Number(duration)),
      note,
    };
    persist({ ...dayData, workouts: [...workouts, entry] });
    setNote("");
  }

  function removeWorkout(id) {
    persist({ ...dayData, workouts: workouts.filter((w) => w.id !== id) });
  }

  const totalBurned = workouts.reduce((s, w) => s + (w.calories_burned || 0), 0);
  const totalMin = workouts.reduce((s, w) => s + (w.duration || 0), 0);

  return (
    <div>
      {/* summary */}
      {workouts.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[
            { label: "Calorii arse", value: totalBurned, unit: "kcal", color: "var(--warning)" },
            { label: "Timp total", value: totalMin, unit: "min", color: "var(--accent3)" },
          ].map(({ label, value, unit, color }) => (
            <div
              key={label}
              style={{
                background: "var(--card)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid var(--border)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color }}>
                {value}
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 3 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* add workout form */}
      <div style={{ background: "var(--card)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>+ Adaugă antrenament</div>

        {/* type selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {WORKOUT_TYPES.map((w) => (
            <button
              key={w.id}
              onClick={() => setType(w.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${type === w.id ? "var(--accent)" : "var(--border)"}`,
                background: type === w.id ? "var(--accent)22" : "transparent",
                color: type === w.id ? "var(--accent)" : "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: type === w.id ? 700 : 400,
                transition: "all 0.15s",
              }}
            >
              {w.emoji} {w.label}
            </button>
          ))}
        </div>

        {/* duration */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>Durată</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{duration} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={180}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        {/* note */}
        <input
          type="text"
          placeholder="Notă opțională (ex: squat 80kg x 5)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 13,
            fontFamily: "inherit",
            marginBottom: 10,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        <button
          onClick={addWorkout}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
          }}
        >
          Salvează antrenament →
        </button>
      </div>

      {/* workout list */}
      <SectionTitle>Antrenamente azi ({workouts.length})</SectionTitle>
      {workouts.length === 0 ? (
        <EmptyState emoji="💪" title="Niciun antrenament" subtitle="Adaugă primul antrenament al zilei" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workouts.map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "var(--card)",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>{w.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {w.duration} min · {w.calories_burned} kcal arse
                    {w.note && ` · ${w.note}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeWorkout(w.id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
