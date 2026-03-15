async function callAI(messages, system, maxTokens = 1200) {
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system, messages })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${txt}`);
  }
  const d = await res.json();
  return d.content?.[0]?.text || '';
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

export { callAI };
