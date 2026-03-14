// ─── app-wide constants ──────────────────────────────────────────────────────

/** Daily macro targets for Mihai */
export const MACROS_TARGET = {
  calories: 2200,
  protein:  180,   // g
  carbs:    200,   // g
  fat:      70,    // g
  fiber:    30,    // g
  water:    3000,  // ml
};

/** Profile */
export const USER_PROFILE = {
  name:    "Mihai",
  age:     45,
  height:  188,   // cm
  weight:  96,    // kg (current)
  target:  89,    // kg
};

/** Workout types for WorkoutTab */
export const WORKOUT_TYPES = [
  { id: "weights",  label: "Forță",     emoji: "🏋️" },
  { id: "running",  label: "Alergare",  emoji: "🏃" },
  { id: "cycling",  label: "Ciclism",   emoji: "🚴" },
  { id: "walking",  label: "Mers",      emoji: "🚶" },
  { id: "hiit",     label: "HIIT",      emoji: "⚡" },
  { id: "swimming", label: "Înot",      emoji: "🏊" },
  { id: "yoga",     label: "Yoga",      emoji: "🧘" },
  { id: "other",    label: "Alt sport", emoji: "🏅" },
];

/** Wellbeing score labels */
export const WELLBEING_LABELS = {
  sleep:   ["Prost", "Mediu", "Bun", "Excelent"],
  energy:  ["Epuizat", "Scăzut", "Normal", "Ridicat"],
  mood:    ["Deprimat", "Neutru", "Bun", "Excelent"],
  stress:  ["Foarte stres", "Stres", "OK", "Relaxat"],
};

/** Chart colors */
export const CHART_COLORS = {
  protein:  "#6c63ff",
  carbs:    "#43d9ad",
  fat:      "#ff6584",
  calories: "#ffb347",
  water:    "#4fc3f7",
};

/** Streak storage key */
export const STREAK_KEY = "streak";
