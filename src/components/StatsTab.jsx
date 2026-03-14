import { useState } from "react";
import { getLastNDays, formatDateLabel, isToday } from "../utils/date";
import { loadDay } from "../utils/storage";
import { sumMacros, fmtNum } from "../utils/nutrition";
import { MACROS_TARGET, CHART_COLORS } from "../config/constants";
import { SectionTitle, EmptyState } from "./common/index";
import { LineChart } from "./common/index";
import StatCard from "./common/StatCard";

function DayRow({ dateKey }) {
  const data = loadDay(dateKey);
  const foods = data?.foods || [];
  const workouts = data?.workouts || [];
  const totals = sumMacros(foods);
  const today = isToday(dateKey);

  return (
    <div
      style={{
        padding: "10px 14px",
        background: today ? "var(--accent)11" : "var(--card)",
        borderRadius: 10,
        border: `1px solid ${today ? "var(--accent)44" : "var(--border)"}`,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 13, color: today ? "var(--accent)" : "var(--text)" }}>
            {today ? "Azi" : formatDateLabel(dateKey)}
          </span>
          {workouts.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent3)" }}>
              💪 {workouts.length} antrenament{workouts.length > 1 ? "e" : ""}
            </span>
          )}
        </div>
        <span style={{ fontWeight: 800, color: totals.calories > 0 ? "var(--text)" : "var(--text-muted)" }}>
          {totals.calories > 0 ? `${fmtNum(totals.calories)} kcal` : "—"}
        </span>
      </div>
      {totals.calories > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
          P: {fmtNum(totals.protein)}g · C: {fmtNum(totals.carbs)}g · G: {fmtNum(totals.fat)}g
        </div>
      )}
    </div>
  );
}

export default function StatsTab() {
  const [range, setRange] = useState(7);
  const days = getLastNDays(range);

  const dayDataList = days.map((key) => ({
    key,
    data: loadDay(key),
  }));

  const daysWithData = dayDataList.filter((d) => d.data && (d.data.foods?.length > 0 || d.data.workouts?.length > 0));

  // Calculate averages
  const daysWithFood = dayDataList.filter((d) => d.data?.foods?.length > 0);
  const avgCalories =
    daysWithFood.length > 0
      ? Math.round(daysWithFood.reduce((s, d) => s + sumMacros(d.data.foods).calories, 0) / daysWithFood.length)
      : 0;
  const avgProtein =
    daysWithFood.length > 0
      ? Math.round(daysWithFood.reduce((s, d) => s + sumMacros(d.data.foods).protein, 0) / daysWithFood.length)
      : 0;

  const totalWorkouts = dayDataList.reduce((s, d) => s + (d.data?.workouts?.length || 0), 0);

  // Chart data
  const calorieData = days.map((key) => {
    const d = loadDay(key);
    return d?.foods ? sumMacros(d.foods).calories : 0;
  });

  const proteinData = days.map((key) => {
    const d = loadDay(key);
    return d?.foods ? sumMacros(d.foods).protein : 0;
  });

  return (
    <div>
      {/* range selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[7, 14, 30].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${range === r ? "var(--accent)" : "var(--border)"}`,
              background: range === r ? "var(--accent)" : "transparent",
              color: range === r ? "#fff" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: range === r ? 700 : 400,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {r} zile
          </button>
        ))}
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard
          label="Kcal medii/zi"
          value={avgCalories || "—"}
          unit={avgCalories ? "kcal" : ""}
          percent={avgCalories ? Math.round((avgCalories / MACROS_TARGET.calories) * 100) : null}
          color="var(--warning)"
        />
        <StatCard
          label="Proteine medii"
          value={avgProtein || "—"}
          unit={avgProtein ? "g" : ""}
          percent={avgProtein ? Math.round((avgProtein / MACROS_TARGET.protein) * 100) : null}
          color={CHART_COLORS.protein}
        />
        <StatCard
          label="Zile logate"
          value={daysWithData.length}
          unit={`/ ${range}`}
          percent={Math.round((daysWithData.length / range) * 100)}
          color="var(--accent3)"
        />
        <StatCard
          label="Antrenamente"
          value={totalWorkouts}
          unit="total"
          color="var(--accent)"
        />
      </div>

      {/* charts */}
      {calorieData.some((v) => v > 0) && (
        <>
          <SectionTitle>Calorii zilnice</SectionTitle>
          <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: "1px solid var(--border)", marginBottom: 10 }}>
            <LineChart data={calorieData} color={CHART_COLORS.calories} height={70} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>{formatDateLabel(days[0]).split(",")[0]}</span>
              <span>Azi</span>
            </div>
          </div>

          <SectionTitle>Proteine zilnice</SectionTitle>
          <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
            <LineChart data={proteinData} color={CHART_COLORS.protein} height={60} />
          </div>
        </>
      )}

      {/* day by day */}
      <SectionTitle>Istoric zile</SectionTitle>
      {daysWithData.length === 0 ? (
        <EmptyState emoji="📊" title="Nicio dată încă" subtitle="Începe să loghezi mese și antrenamente" />
      ) : (
        <div>
          {[...days].reverse().map((key) => (
            <DayRow key={key} dateKey={key} />
          ))}
        </div>
      )}
    </div>
  );
}
