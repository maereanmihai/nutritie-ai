// ─── localStorage helpers ────────────────────────────────────────────────────

const PREFIX = "nutritie_";

/**
 * Save a day's data
 * @param {string} dateKey  "YYYY-MM-DD"
 * @param {object} data     { foods, workouts, water, wellbeing, ... }
 */
export function saveDay(dateKey, data) {
  try {
    localStorage.setItem(PREFIX + dateKey, JSON.stringify(data));
  } catch (e) {
    console.error("saveDay error:", e);
  }
}

/**
 * Load a day's data. Returns null if not found.
 */
export function loadDay(dateKey) {
  try {
    const raw = localStorage.getItem(PREFIX + dateKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Load or initialize a day with default empty structure
 */
export function loadDayOrInit(dateKey) {
  return (
    loadDay(dateKey) || {
      foods: [],
      workouts: [],
      water: 0,       // ml
      wellbeing: null, // { sleep, energy, mood, stress }
      notes: "",
    }
  );
}

/**
 * Delete a day's data
 */
export function deleteDay(dateKey) {
  localStorage.removeItem(PREFIX + dateKey);
}

/**
 * Get all stored day keys, sorted ascending
 */
export function getAllDayKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      keys.push(k.replace(PREFIX, ""));
    }
  }
  return keys.sort();
}

/**
 * Generic key-value store for app settings
 */
export function saveSetting(key, value) {
  localStorage.setItem(PREFIX + "setting_" + key, JSON.stringify(value));
}

export function loadSetting(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + "setting_" + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Export all data as JSON string
 */
export function exportAllData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      data[k] = localStorage.getItem(k);
    }
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON string (merge, not replace)
 */
export function importData(jsonString) {
  const data = JSON.parse(jsonString);
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
}
