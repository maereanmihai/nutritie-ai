import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `# ASISTENT PERSONAL — NUTRIȚIE, METABOLISM, PERFORMANȚĂ FIZICĂ & OPTIMIZARE HORMONALĂ

## IDENTITATE ȘI MISIUNE

Ești asistentul personal al lui Mihai pentru nutriție, metabolism, performanță fizică și optimizare hormonală.
Analizezi alimentația, suplimentele, somnul, hidratarea și activitatea fizică exclusiv pe baza dovezilor științifice (studii clinice, meta-analize, ghiduri medicale).
Nu faci presupuneri. Nu oferi opinii nevalidate. Nu repeți informații deja cunoscute. Nu pui întrebări inutile.
Răspunzi concis, tehnic și structurat. Folosești emoji-uri relevante pentru lizibilitate. Formatezi cu markdown.

## PROFIL UTILIZATOR

| Parametru | Valoare |
|---|---|
| Nume | Mihai |
| Vârstă | 45 ani |
| Înălțime | 188 cm |
| Greutate curentă | ~96 kg |
| Greutate țintă | ~88–90 kg |
| Activitate de bază | Mers pe jos frecvent + antrenamente cu greutăți |
| TDEE estimat | 2.550–2.750 kcal/zi |

## OBIECTIVE PRIORITIZATE

**Prioritate 1 — Hormonal & sexual**
- Creșterea libidoului — obiectiv principal
- Optimizarea testosteronului total și liber (SHBG ↓, testosteron liber ↑)
- Îmbunătățirea erecției și circulației periferice (NO↑, PDE5i)

**Prioritate 2 — Compoziție corporală**
- Scăderea greutății corporale — accent pe grăsimea abdominală (viscerală)
- Creșterea masei musculare concomitent cu deficitul caloric (recompoziție)
- Creșterea forței pe exerciții compuse

**Prioritate 3 — Metabolic & cardiovascular**
- Scăderea LDL < 100 mg/dL pe termen mediu (baseline: 209 → 119 mg/dL, progres activ)
- Susținerea și diversificarea microbiomului intestinal
- Sensibilitate optimă la insulină, trigliceride ↓

**Prioritate 4 — Performanță & cogniție**
- Creșterea rezistenței aerobe și anaerobe
- Creșterea forței musculare (progres liniar sau ondulat)
- Claritate mentală, focus susținut, energie stabilă

## ȚINTE NUTRIȚIONALE ZILNICE

| Macro | Țintă |
|---|---|
| **Calorii** | Deficit ~500–600 kcal față de TDEE zilnic |
| **Proteine** | ≥150 g (ideal 160–180 g) |
| **Carbohidrați** | 100–140 g zi repaus / 140–180 g zi antrenament |
| **Grăsimi** | 55–75 g |
| **Fibre** | ≥30 g |
| **Hidratare** | ≥3,4 L |

**Distribuție proteine per masă:** 35–45 g × 4 mese

## CICLIZAREA MACRO

| Tip zi | Calorii țintă | Carbohidrați | Proteine | Grăsimi |
|---|---|---|---|---|
| **Zi antrenament** | 2.150–2.250 kcal | 140–180 g | 165–180 g | 60–75 g |
| **Zi activitate normală** | 1.900–2.000 kcal | 110–140 g | 160–175 g | 60–70 g |
| **Zi repaus complet** | 1.700–1.800 kcal | 80–110 g | 155–170 g | 60–70 g |

## SUPLIMENTE — PROTOCOL ACTIV

- **L-Carnitină** — Dimineața sau pre-antrenament, cu carbohidrați
- **Magneziu bisglicinat** — Seara, cu 60–90 min înainte de somn
- **Zinc** — Seara, departe de semințe dovleac și nuci braziliene
- **Vitamax** — Dimineața cu masă (zilele active — o zi da/una nu)
- **Coenzima Q10** — Dimineața cu masă care conține grăsimi
- **Vitamina D3** — Dimineața cu masă care conține grăsimi
- **Omega-3** — Cu masă principală (prânz sau cină)
- **Boron** — Cu masă, dimineața (max 10 mg/zi)
- **Centrum Energy** — Dimineața cu masă (zilele fără Vitamax)
- **Ghimbir (pastile)** — Cu masă sau pre-antrenament
- **Creatină monohidrat** — Post-antrenament sau oricând consistent (3–5 g/zi)
- **Citrulină malat** — Pre-antrenament cu 30–45 min (6–8 g/zi)

## COMENZI RAPIDE

- **Start zi** → Protocol complet: macro țintă (tip zi), fereastra alimentară, suplimente, reminder hidratare
- **Masă: [alimente + cantități]** → Calculează macro, running total, alertă dacă e cazul
- **Activitate: [tip + durată]** → Estimează consum energetic, ajustează TDEE zilnic
- **Total zi** → Raport complet + deficit + analiză
- **Somn: [ore] [calitate 1–10]** → Înregistrează, corelează cu recuperare și testosteron
- **Greutate: [X kg] / Talie: [X cm]** → Înregistrează progres, detectează stagnare
- **Forță: [exercițiu + greutate + reps]** → Tracking progres neuromuscular
- **Energie: [1–10] / Libido: [1–10]** → Înregistrează markeri hormonali subiectivi
- **Analiză săptămână** → Progres compozit + ajustări recomandate

## REGULI ABSOLUTE

1. Nu pui întrebări inutile
2. Nu repeți informații deja stabilite în profil
3. Nu faci presupuneri despre activitate sau alimentație neraportată
4. Nu adaugi sugestii nesolicitate
5. Nu reduci proteinele sub 150 g indiferent de context
6. Nuci braziliene: semnalezi întotdeauna limita de 1–2 buc/zi
7. Toate afirmațiile nutriționale și fiziologice sunt susținute de referință științifică când sunt introduse prima dată
8. Somnul sub 6 ore = alertă automată impact testosteron (Leproult & Van Cauter, 2011)
9. LDL monitorizat indirect prin aport de grăsimi saturate și fibre solubile zilnic`;

const DAY_TYPES = [
  { val: "antrenament", label: "ANTRENAMENT", labelShort: "ANTR", icon: "⚡", gradient: "linear-gradient(135deg,#f97316,#ef4444)", color: "#f97316", glow: "rgba(249,115,22,0.4)", desc: "2.150–2.250 kcal · Carbs 140–180g" },
  { val: "normal", label: "ZI ACTIVĂ", labelShort: "ACTIV", icon: "🔥", gradient: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#3b82f6", glow: "rgba(59,130,246,0.4)", desc: "1.900–2.000 kcal · Carbs 110–140g" },
  { val: "repaus", label: "REPAUS", labelShort: "REPAUS", icon: "🌙", gradient: "linear-gradient(135deg,#8b5cf6,#ec4899)", color: "#8b5cf6", glow: "rgba(139,92,246,0.4)", desc: "1.700–1.800 kcal · Carbs 80–110g" },
];

const QUICK_COMMANDS = [
  { label: "Start zi", icon: "🌅", cmd: "Start zi" },
  { label: "Total zi", icon: "📊", cmd: "Total zi" },
  { label: "Analiză săpt.", icon: "📈", cmd: "Analiză săptămână" },
];

const QUICK_LOG = [
  { label: "Masă", icon: "🍽️", prefix: "Masă: " },
  { label: "Activitate", icon: "💪", prefix: "Activitate: " },
  { label: "Somn", icon: "😴", prefix: "Somn: " },
  { label: "Greutate", icon: "⚖️", prefix: "Greutate: " },
  { label: "Forță", icon: "🏋️", prefix: "Forță: " },
  { label: "Energie", icon: "⚡", prefix: "Energie: " },
];

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f1f5f9;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#94a3b8">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(249,115,22,0.15);padding:2px 6px;border-radius:4px;font-size:13px;color:#fb923c;font-family:monospace">$1</code>');
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-|]+\|$/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tableLines.push(lines[i]); i++; }
      const headers = tableLines[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
      const rows = tableLines.slice(2).map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
      result.push(
        <div key={i} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead><tr>{headers.map((h, j) => <th key={j} style={{ textAlign: 'left', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }} dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />)}</tr></thead>
            <tbody>{rows.map((row, ri) => <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.map((cell, ci) => <td key={ci} style={{ padding: '8px 12px', color: '#e2e8f0', fontSize: '14px' }} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (line.startsWith('### ')) { result.push(<h3 key={i} style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '16px 0 8px', fontWeight: 700 }}>{line.slice(4)}</h3>); i++; continue; }
    if (line.startsWith('## ')) { result.push(<h2 key={i} style={{ color: '#475569', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '18px 0 8px', fontWeight: 700 }}>{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith('# ')) { result.push(<h1 key={i} style={{ fontSize: '17px', fontWeight: 800, margin: '16px 0 10px', background: 'linear-gradient(90deg,#f97316,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{line.slice(2)}</h1>); i++; continue; }
    if (line.trim().match(/^---+$/)) { result.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '14px 0' }} />); i++; continue; }
    if (line.match(/^[\-\*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[\-\*] /)) { items.push(lines[i].slice(2)); i++; }
      result.push(<ul key={i} style={{ margin: '8px 0', paddingLeft: 0, listStyle: 'none' }}>{items.map((item, j) => <li key={j} style={{ color: '#cbd5e1', marginBottom: '6px', display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '15px', lineHeight: '1.55' }}><span style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0, fontWeight: 800, marginTop: '1px' }}>▸</span><span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} /></li>)}</ul>);
      continue;
    }
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      result.push(<ol key={i} style={{ margin: '8px 0', paddingLeft: '20px' }}>{items.map((item, j) => <li key={j} style={{ color: '#cbd5e1', marginBottom: '5px', fontSize: '15px', lineHeight: '1.55' }} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />)}</ol>);
      continue;
    }
    if (line.trim() === '') { result.push(<div key={i} style={{ height: '8px' }} />); i++; continue; }
    result.push(<p key={i} style={{ color: '#cbd5e1', lineHeight: '1.7', margin: '3px 0', fontSize: '15px' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    i++;
  }
  return result;
}

const STORAGE_KEY = 'nutritie_mihai_v3';

function loadSession() {
  try {
    const today = new Date().toDateString();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], dayType: 'normal', date: today };
    const data = JSON.parse(raw);
    if (data.date !== today) return { messages: [], dayType: 'normal', date: today };
    return data;
  } catch { return { messages: [], dayType: 'normal', date: new Date().toDateString() }; }
}

function saveSession(messages, dayType) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, dayType, date: new Date().toDateString() })); } catch {}
}

export default function App() {
  const session = loadSession();
  const [messages, setMessages] = useState(session.messages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dayType, setDayType] = useState(session.dayType || "normal");
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const currentDay = DAY_TYPES.find(d => d.val === dayType);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { saveSession(messages, dayType); }, [messages, dayType]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const contextPrefix = `[Context: ${currentDay?.label} — ${currentDay?.desc}]\n`;
    const fullText = contextPrefix + text;
    const userMsg = { role: "user", content: text, display: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.role === 'user' ? (m === userMsg ? fullText : m.content) : m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT, messages: apiMessages }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Eroare la răspuns.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Eroare de conexiune. Încearcă din nou." }]);
    }
    setLoading(false);
  }, [messages, loading, dayType, currentDay]);

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };
  const clearHistory = () => { setMessages([]); localStorage.removeItem(STORAGE_KEY); showToast("Istoric șters"); };

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", fontFamily: "'Inter','SF Pro Display',-apple-system,sans-serif", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        .header { padding: 0 16px; background: rgba(8,11,20,0.96); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 20; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .header-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; gap: 10px; flex-wrap: wrap; }
        .logo { font-family: 'Barlow Condensed',sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; background: linear-gradient(90deg,#f97316,#ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
        .logo-sub { font-size: 10px; color: #475569; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 500; margin-top: 2px; }
        .day-pills { display: flex; gap: 5px; }
        .day-pill { padding: 6px 11px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; border: 1.5px solid rgba(255,255,255,0.07); background: transparent; color: #475569; transition: all 0.2s; white-space: nowrap; font-family: 'Barlow Condensed',sans-serif; font-size: 13px; }
        .day-pill:hover { border-color: rgba(255,255,255,0.18); color: #94a3b8; }
        .day-pill.active { border-color: transparent; color: #fff; }
        .status-bar { display: flex; align-items: center; gap: 8px; padding: 8px 0 10px; overflow-x: auto; }
        .status-bar::-webkit-scrollbar { height: 0; }
        .status-badge { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
        .quick-bar { display: flex; gap: 6px; padding: 10px 16px; background: rgba(8,11,20,0.8); border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; align-items: center; }
        .quick-bar::-webkit-scrollbar { height: 0; }
        .q-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0; font-family: 'Inter',sans-serif; }
        .q-btn:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; transform: translateY(-1px); border-color: rgba(255,255,255,0.14); }
        .q-btn:active { transform: translateY(0); }
        .q-btn.primary { background: rgba(249,115,22,0.1); border-color: rgba(249,115,22,0.25); color: #fb923c; }
        .q-btn.primary:hover { background: rgba(249,115,22,0.18); border-color: rgba(249,115,22,0.45); box-shadow: 0 4px 15px rgba(249,115,22,0.18); }
        .sep { width: 1px; height: 20px; background: rgba(255,255,255,0.07); flex-shrink: 0; margin: 0 2px; }
        .messages-wrap { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .messages { max-width: 800px; width: 100%; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
        .msg-user { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px 16px 4px 16px; padding: 12px 16px; align-self: flex-end; max-width: 88%; }
        .msg-assistant { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px 16px 16px 16px; padding: 14px 18px; position: relative; overflow: hidden; }
        .msg-assistant::before { content:''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg,#f97316,#ef4444); }
        .msg-label { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; }
        .label-user { color: #334155; }
        .label-assistant { background: linear-gradient(90deg,#f97316,#ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .loading-bubble { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px 16px 16px 16px; padding: 16px 20px; display: flex; align-items: center; gap: 6px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg,#f97316,#ef4444); animation: bounce 1.2s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%,100% { transform: translateY(0) scale(0.8); opacity: 0.4; } 50% { transform: translateY(-5px) scale(1); opacity: 1; } }
        .input-wrap { border-top: 1px solid rgba(255,255,255,0.05); background: rgba(8,11,20,0.96); backdrop-filter: blur(20px); padding: 12px 16px; padding-bottom: max(12px, env(safe-area-inset-bottom)); position: sticky; bottom: 0; }
        .input-inner { max-width: 800px; margin: 0 auto; display: flex; gap: 10px; align-items: flex-end; }
        .textarea-wrap { flex: 1; }
        textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px 16px; color: #e2e8f0; font-family: 'Inter',sans-serif; font-size: 16px; resize: none; outline: none; min-height: 50px; max-height: 150px; transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.5; }
        textarea:focus { border-color: rgba(249,115,22,0.35); box-shadow: 0 0 0 3px rgba(249,115,22,0.07); }
        textarea::placeholder { color: #334155; }
        .send-btn { width: 50px; height: 50px; background: linear-gradient(135deg,#f97316,#ef4444); border: none; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 4px 15px rgba(249,115,22,0.3); font-size: 22px; color: white; font-weight: 700; }
        .send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(249,115,22,0.4); }
        .send-btn:active:not(:disabled) { transform: translateY(0); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 24px; text-align: center; }
        .empty-icon { font-size: 60px; animation: pulse-icon 2.5s ease-in-out infinite; }
        @keyframes pulse-icon { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(249,115,22,0.3)); } 50% { transform: scale(1.06); filter: drop-shadow(0 0 35px rgba(249,115,22,0.6)); } }
        .empty-title { font-family: 'Barlow Condensed',sans-serif; font-size: 24px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; background: linear-gradient(90deg,#f97316,#ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .empty-sub { font-size: 14px; color: #475569; line-height: 1.6; max-width: 280px; }
        .hint-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
        .hint-chip { padding: 6px 14px; background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.18); border-radius: 100px; font-size: 12px; color: #fb923c; font-weight: 600; }
        .clr-btn { padding: 5px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; color: #475569; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .clr-btn:hover { border-color: rgba(239,68,68,0.35); color: #ef4444; }
        .toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: rgba(15,20,35,0.96); color: #e2e8f0; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.1); z-index: 100; animation: slideUp 0.3s ease; white-space: nowrap; box-shadow: 0 8px 30px rgba(0,0,0,0.5); backdrop-filter: blur(20px); }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="logo">MIHAI PERFORMANCE</div>
            <div className="logo-sub">AI Nutrition Coach</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {messages.length > 0 && <button className="clr-btn" onClick={clearHistory}>CLR</button>}
            <div className="day-pills">
              {DAY_TYPES.map(d => (
                <button key={d.val} className={`day-pill ${dayType === d.val ? 'active' : ''}`}
                  style={dayType === d.val ? { background: d.gradient, boxShadow: `0 0 18px ${d.glow}` } : {}}
                  onClick={() => { setDayType(d.val); showToast(`${d.icon} ${d.label}`); }}>
                  {d.icon} {d.labelShort}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="status-bar">
          <div className="status-badge" style={{ background: `${currentDay?.color}18`, border: `1px solid ${currentDay?.color}35`, color: currentDay?.color }}>
            <span>{currentDay?.icon}</span>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '13px', letterSpacing: '0.05em' }}>{currentDay?.label}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ opacity: 0.8, fontSize: '12px' }}>{currentDay?.desc}</span>
          </div>
          <div className="status-badge" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#475569' }}>
            📅 {new Date().toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          {messages.length > 0 && (
            <div className="status-badge" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#475569' }}>
              💬 {Math.floor(messages.length / 2)} mesaje
            </div>
          )}
        </div>
      </div>

      {/* Quick Bar */}
      <div className="quick-bar">
        {QUICK_COMMANDS.map(q => <button key={q.cmd} className="q-btn primary" onClick={() => sendMessage(q.cmd)}>{q.icon} {q.label}</button>)}
        <div className="sep" />
        {QUICK_LOG.map(q => <button key={q.prefix} className="q-btn" onClick={() => { setInput(q.prefix); textareaRef.current?.focus(); }}>{q.icon} {q.label}</button>)}
      </div>

      {/* Messages */}
      <div className="messages-wrap">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔥</div>
              <div className="empty-title">96 kg → 88 kg</div>
              <div className="empty-sub">Selectează tipul zilei și apasă <strong style={{ color: '#fb923c' }}>Start zi</strong> pentru protocolul complet.</div>
              <div className="hint-chips">
                <span className="hint-chip">⚡ Antrenament</span>
                <span className="hint-chip">🔥 Zi activă</span>
                <span className="hint-chip">🌙 Repaus</span>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "msg-user" : "msg-assistant"}>
              <div className={`msg-label ${m.role === "user" ? "label-user" : "label-assistant"}`}>
                {m.role === "user" ? "▸ MIHAI" : "◆ AI COACH"}
              </div>
              {m.role === "assistant"
                ? <div>{renderMarkdown(m.content)}</div>
                : <div style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.5' }}>{m.display || m.content}</div>}
            </div>
          ))}
          {loading && <div className="loading-bubble"><div className="dot" /><div className="dot" /><div className="dot" /></div>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="input-wrap">
        <div className="input-inner">
          <div className="textarea-wrap">
            <textarea ref={textareaRef} value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "50px"; e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px"; }}
              onKeyDown={handleKey} placeholder="Masă: 3 ouă, 100g piept pui..." disabled={loading} rows={1} />
          </div>
          <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>↑</button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
