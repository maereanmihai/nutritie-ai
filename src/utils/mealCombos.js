// ─── Meal Combos — predicție mese complete cu auto-porție ────────────────────
const MEAL_COMBOS_KEY = 'ha_meal_combos_v1';
const MAX_COMBOS = 300;

export function saveMealCombo({ foods, dayType }) {
  try {
    if (!foods?.length) return;
    const combos = JSON.parse(localStorage.getItem(MEAL_COMBOS_KEY) || '[]');
    combos.push({
      foods,   // [{ foodId, qty }]
      dayType: dayType || null,
      hour: new Date().getHours(),
      dow:  new Date().getDay(),
      ts:   Date.now(),
    });
    localStorage.setItem(MEAL_COMBOS_KEY, JSON.stringify(combos.slice(-MAX_COMBOS)));
  } catch {}
}

function comboTotals(comboFoods, foodMap) {
  return comboFoods.reduce((acc, item) => {
    const food = foodMap.get(item.foodId);
    if (!food) return acc;
    const divisor = food.unit === 'buc' ? (food.unitG || 100) : 100;
    const f = item.qty / divisor;
    acc.kcal  += Math.round((food.kcal || 0) * f);
    acc.p     += (food.p || 0) * f;
    acc.c     += (food.c || 0) * f;
    acc.fat   += (food.f || food.fat || 0) * f;
    acc.fiber += (food.fiber || 0) * f;
    return acc;
  }, { kcal: 0, p: 0, c: 0, fat: 0, fiber: 0 });
}

function getScaleFactor(totals, remaining) {
  const candidates = [];
  if (totals.p   > 0 && remaining.p   > 0) candidates.push(remaining.p   / totals.p);
  if (totals.c   > 0 && remaining.c   > 0) candidates.push(remaining.c   / totals.c);
  if (totals.fat > 0 && remaining.fat > 0) candidates.push(remaining.fat / totals.fat);
  if (!candidates.length) return 1;
  const raw = Math.min(...candidates);
  return Math.max(0.6, Math.min(1.4, raw)); // conservator: 0.6x – 1.4x
}

export function getMealComboPredictions(foodMap, dayType, remaining) {
  try {
    const combos  = JSON.parse(localStorage.getItem(MEAL_COMBOS_KEY) || '[]');
    const hourNow = new Date().getHours();

    return combos
      .map(combo => {
        let score = 1;
        const daysAgo  = (Date.now() - combo.ts) / 86400000;
        if      (daysAgo < 3)  score += 4;
        else if (daysAgo < 7)  score += 3;
        else if (daysAgo < 14) score += 2;
        else if (daysAgo < 30) score += 1;

        const hourDiff = Math.abs(hourNow - combo.hour);
        if      (hourDiff <= 1) score += 4;
        else if (hourDiff <= 2) score += 3;
        else if (hourDiff <= 4) score += 1;

        if (dayType && combo.dayType === dayType) score += 3;
        return { ...combo, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(combo => {
        const validFoods = combo.foods.filter(item => foodMap.has(item.foodId));
        if (!validFoods.length) return null;

        const baseTotals = comboTotals(validFoods, foodMap);
        const scale      = remaining ? getScaleFactor(baseTotals, remaining) : 1;

        const adjustedFoods = validFoods.map(item => ({
          ...item,
          qty: Math.round(item.qty * scale),
        }));

        const totals = comboTotals(adjustedFoods, foodMap);
        const names  = adjustedFoods
          .map(item => foodMap.get(item.foodId)?.name)
          .filter(Boolean);

        return {
          foods: adjustedFoods,
          score: combo.score,
          title: names.slice(0, 2).join(' + ') + (names.length > 2 ? ` +${names.length - 2}` : ''),
          kcal:  totals.kcal,
          p:     Math.round(totals.p    * 10) / 10,
          c:     Math.round(totals.c    * 10) / 10,
          fat:   Math.round(totals.fat  * 10) / 10,
          fiber: Math.round(totals.fiber * 10) / 10,
        };
      })
      .filter(Boolean);
  } catch { return []; }
}
