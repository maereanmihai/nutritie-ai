// ─── Meal Signals — învață tiparele alimentare ───────────────────────────────
const MEAL_SIGNAL_KEY = 'ha_meal_signals_v1';
const MAX_SIGNALS = 500;

export function saveMealSignal({ foodId, qty, dayType }) {
  try {
    const signals = JSON.parse(localStorage.getItem(MEAL_SIGNAL_KEY) || '[]');
    signals.push({
      foodId, qty,
      dayType: dayType || null,
      hour: new Date().getHours(),
      dow:  new Date().getDay(),
      ts:   Date.now(),
    });
    localStorage.setItem(MEAL_SIGNAL_KEY, JSON.stringify(signals.slice(-MAX_SIGNALS)));
  } catch {}
}

export function getMealPredictions(allFoods, dayType) {
  try {
    const signals = JSON.parse(localStorage.getItem(MEAL_SIGNAL_KEY) || '[]');
    const hourNow = new Date().getHours();
    const scores  = new Map();

    for (const s of signals) {
      let score = 1;
      const daysAgo  = (Date.now() - s.ts) / 86400000;
      if      (daysAgo < 3)  score += 4;
      else if (daysAgo < 7)  score += 3;
      else if (daysAgo < 14) score += 2;
      else if (daysAgo < 30) score += 1;

      const hourDiff = Math.abs(hourNow - s.hour);
      if      (hourDiff <= 1) score += 4;
      else if (hourDiff <= 2) score += 3;
      else if (hourDiff <= 4) score += 1;

      if (dayType && s.dayType === dayType) score += 3;
      scores.set(s.foodId, (scores.get(s.foodId) || 0) + score);
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([foodId]) => allFoods.find(f => f.id === foodId))
      .filter(Boolean);
  } catch { return []; }
}
