// ─── date utilities ──────────────────────────────────────────────────────────

/**
 * Returns today's key in format "YYYY-MM-DD"
 */
export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns a human-readable date label
 * e.g. "Luni, 14 martie"
 */
export function formatDateLabel(dateKey) {
  const date = new Date(dateKey + "T12:00:00");
  return date.toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Returns last N day keys (including today), most recent last
 */
export function getLastNDays(n = 7) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/**
 * Returns week label e.g. "S11 · 10–16 mar"
 */
export function getWeekLabel(dateKey) {
  const date = new Date(dateKey + "T12:00:00");
  const week = getWeekNumber(date);
  const mon = new Date(date);
  mon.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
  return `S${week} · ${fmt(mon)}–${fmt(sun)}`;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * Returns true if dateKey is today
 */
export function isToday(dateKey) {
  return dateKey === getTodayKey();
}
