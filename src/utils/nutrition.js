// ─── nutrition calculation helpers ──────────────────────────────────────────

/**
 * Sum macros from a list of food entries
 * Each food: { calories, protein, carbs, fat, fiber? }
 */
export function sumMacros(foods = []) {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories || 0),
      protein:  acc.protein  + (f.protein  || 0),
      carbs:    acc.carbs    + (f.carbs    || 0),
      fat:      acc.fat      + (f.fat      || 0),
      fiber:    acc.fiber    + (f.fiber    || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

/**
 * Calculate % of target reached
 */
export function macroPercent(value, target) {
  if (!target) return 0;
  return Math.min(Math.round((value / target) * 100), 999);
}

/**
 * Returns color class based on % of target
 */
export function macroStatus(percent) {
  if (percent < 60) return "low";
  if (percent > 110) return "over";
  return "ok";
}

/**
 * Estimate calories burned from workout
 * Simple MET-based formula: MET * weight_kg * duration_hours
 */
export function estimateCaloriesBurned(activityType, durationMin, weightKg = 96) {
  const MET = {
    walking:    3.5,
    running:    8.0,
    cycling:    6.0,
    swimming:   6.0,
    weights:    4.5,
    hiit:       8.5,
    yoga:       2.5,
    default:    4.0,
  };
  const met = MET[activityType] || MET.default;
  return Math.round(met * weightKg * (durationMin / 60));
}

/**
 * TDEE estimate (Mifflin-St Jeor + activity)
 * gender: 'male' | 'female'
 * activity: 1.2 (sedentary) → 1.9 (very active)
 */
export function calculateTDEE({ weight, height, age, gender = "male", activity = 1.55 }) {
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  return Math.round(bmr * activity);
}

/**
 * Calculate macro split from calories
 * Returns { protein_g, carbs_g, fat_g }
 * protein_pct + carbs_pct + fat_pct should = 100
 */
export function calcMacroSplit(calories, { proteinPct = 30, carbsPct = 40, fatPct = 30 } = {}) {
  return {
    protein_g: Math.round((calories * proteinPct) / 100 / 4),
    carbs_g:   Math.round((calories * carbsPct)   / 100 / 4),
    fat_g:     Math.round((calories * fatPct)      / 100 / 9),
  };
}

/**
 * Format number for display: 1500 → "1,500"
 */
export function fmtNum(n, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("ro-RO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Round to 1 decimal
 */
export function r1(n) {
  return Math.round(n * 10) / 10;
}
