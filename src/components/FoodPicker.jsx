import { useState, useEffect } from "react";
import { getTodayKey } from "../utils/date";
import { loadDayOrInit, saveDay } from "../utils/storage";
import { sumMacros, macroPercent, fmtNum } from "../utils/nutrition";
import { MACROS_TARGET, CHART_COLORS } from "../config/constants";
import StatCard from "./common/StatCard";
import { SectionTitle, EmptyState } from "./common/index";

// ─── quick-add food presets ──────────────────────────────────────────────────
const PRESETS = [
  { name: "Ouă (2 buc)", calories: 144, protein: 12, carbs: 1, fat: 10 },
  { name: "Piept pui 150g", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { name: "Ovăz 50g", calories: 187, protein: 7, carbs: 32, fat: 4 },
  { name: "Orez 100g fiert", calories: 130, protein: 3, carbs: 28, fat: 0 },
  { name: "Broccoli 200g", calories: 68, protein: 6, carbs: 11, fat: 1 },
  { name: "Somon 150g", calories: 280, protein: 30, carbs: 0, fat: 17 },
  { name: "Iaurt grec 200g", calories: 130, protein: 18, carbs: 6, fat: 4 },
  { name: "Avocado ½", calories: 120, protein: 1, carbs: 6, fat: 11 },
  { name: "Banan", calories: 90, protein: 1, carbs: 23, fat: 0 },
  { name: "Proteină shake", calories: 120, protein: 25, carbs: 3, fat: 2 },
];

function MacroBar({ label, current, target, color }) {
  const pct = macroPercent(current, target);
  const over = pct > 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
        <span style={{ color: over ? "var(--warning)" : "var(--text)", fontWeight: 700 }}>
          {fmtNum(current)}g / {target}g
        </span>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            background: over ? "var(--warning)" : color,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function FoodPicker() {
  const todayKey = getTodayKey();
  const [dayData, setDayData] = useState(() => loadDayOrInit(todayKey));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  const foods = dayData.foods || [];
  const totals = sumMacros(foods);

  function persist(newData) {
    setDayData(newData);
    saveDay(todayKey, newData);
  }

  function addPreset(preset) {
    const updated = { ...dayData, foods: [...foods, { ...preset, id: Date.now() }] };
    persist(updated);
  }

  function addCustom() {
    if (!form.name || !form.calories) return;
    const entry = {
      id: Date.now(),
      name: form.name,
      calories: Number(form.calories) || 0,
      protein:  Number(form.protein)  || 0,
      carbs:    Number(form.carbs)    || 0,
      fat:      Number(form.fat)      || 0,
    };
    persist({ ...dayData, foods: [...foods, entry] });
    setForm({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setShowForm(false);
  }

  function removeFood(id) {
    persist({ ...dayData, foods: foods.filter((f) => f.id !== id) });
  }

  const calPct = macroPercent(totals.calories, MACROS_TARGET.calories);

  return (
    <div>
      {/* summary card */}
      <div
        style={{
          background: "var(--card)",
          borderRadius: 16,
          padding: 16,
          border: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Azi</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: calPct > 100 ? "var(--warning)" : "var(--accent)" }}>
            {fmtNum(totals.calories)} <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>/ {MACROS_TARGET.calories} kcal</span>
          </span>
        </div>
        <MacroBar label="Proteine" current={totals.protein} target={MACROS_TARGET.protein} color={CHART_COLORS.protein} />
        <MacroBar label="Carbohidrați" current={totals.carbs} target={MACROS_TARGET.carbs} color={CHART_COLORS.carbs} />
        <MacroBar label="Grăsimi" current={totals.fat} target={MACROS_TARGET.fat} color={CHART_COLORS.fat} />
      </div>

      {/* quick add presets */}
      <SectionTitle>Adaugă rapid</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => addPreset(p)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--text)",
              fontSize: 12,
              cursor: "pointer",
              transition: "border-color 0.2s",
              fontFamily: "inherit",
            }}
            onMouseOver={(e) => (e.target.style.borderColor = "var(--accent)")}
            onMouseOut={(e) => (e.target.style.borderColor = "var(--border)")}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px dashed var(--accent)",
            background: "transparent",
            color: "var(--accent)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Custom
        </button>
      </div>

      {/* custom form */}
      {showForm && (
        <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: "1px solid var(--border)", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { key: "name",     placeholder: "Denumire *", full: true },
              { key: "calories", placeholder: "Calorii *" },
              { key: "protein",  placeholder: "Proteine g" },
              { key: "carbs",    placeholder: "Carbo g" },
              { key: "fat",      placeholder: "Grăsimi g" },
            ].map(({ key, placeholder, full }) => (
              <input
                key={key}
                type={key === "name" ? "text" : "number"}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                style={{
                  gridColumn: full ? "1 / -1" : undefined,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            ))}
          </div>
          <button
            onClick={addCustom}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Adaugă
          </button>
        </div>
      )}

      {/* food list */}
      <SectionTitle>Mese azi ({foods.length})</SectionTitle>
      {foods.length === 0 ? (
        <EmptyState emoji="🍽️" title="Niciun aliment" subtitle="Adaugă prima masă din presets de mai sus" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {foods.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "var(--card)",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  P: {f.protein}g · C: {f.carbs}g · G: {f.fat}g
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 800, color: "var(--accent)" }}>{f.calories} kcal</span>
                <button
                  onClick={() => removeFood(f.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
