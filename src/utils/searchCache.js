// ─── Search Cache — localStorage cu TTL 7 zile ───────────────────────────────
const SEARCH_CACHE_KEY = 'ha_food_search_cache_v1';
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 zile

function normalizeQuery(q) {
  return q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeCache(cache) {
  try { localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}

export function getCachedSearch(query) {
  const q = normalizeQuery(query);
  const entry = readCache()[q];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry;
}

export function setCachedSearch(query, results, source = 'unknown') {
  const q = normalizeQuery(query);
  const cache = readCache();
  cache[q] = { ts: Date.now(), source, results };
  // Păstrează doar ultimele 100 query-uri
  const entries = Object.entries(cache)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 100);
  writeCache(Object.fromEntries(entries));
}

export function clearSearchCache() {
  try { localStorage.removeItem(SEARCH_CACHE_KEY); } catch {}
}
