// ─── Safe JSON parser ─────────────────────────────────────────────────────────
export function safeParseJson(text, fallback = null) {
  try {
    if (!text) return fallback;
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.warn('JSON parse failed:', e);
    return fallback;
  }
}
