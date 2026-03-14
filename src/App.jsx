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
  { val: "antrenament", label: "ZI ANTR.", color: "#4ade80", desc: "2.150–2.250 kcal · Carbs 140–180g" },
  { val: "normal", label: "ZI NORM.", color: "#60a5fa", desc: "1.900–2.000 kcal · Carbs 110–140g" },
  { val: "repaus", label: "ZI REPAUS", color: "#f59e0b", desc: "1.700–1.800 kcal · Carbs 80–110g" },
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
  { label: "Energie/Libido", icon: "⚡", prefix: "Energie: " },
];

function renderMarkdown(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-|]+\|$/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headers = tableLines[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
      const rows = tableLines.slice(2).map(row =>
        row.split('|').filter(c => c.trim() !== '').map(c => c.trim())
      );
      result.push(
        <table key={i} style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: '14px' }}>
          <thead>
            <tr>{headers.map((h, j) => (
              <th key={j} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #1e2530', color: '#9ca3af', fontFamily: 'Space Mono, monospace', fontWeight: 700, letterSpacing: '0.05em' }}
                dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #111827' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '5px 10px', color: '#d1d5db' }}
                    dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      result.push(<h3 key={i} style={{ color: '#9ca3af', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '14px 0 6px', fontFamily: 'Space Mono, monospace' }}>{line.slice(4)}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      result.push(<h2 key={i} style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '16px 0 8px', fontFamily: 'Space Mono, monospace' }}>{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      result.push(<h1 key={i} style={{ color: '#4ade80', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '16px 0 8px', fontFamily: 'Space Mono, monospace' }}>{line.slice(2)}</h1>);
      i++; continue;
    }

    // Horizontal rule
    if (line.trim().match(/^---+$/)) {
      result.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #1e2530', margin: '12px 0' }} />);
      i++; continue;
    }

    // Lists
    if (line.match(/^[\-\*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[\-\*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      result.push(
        <ul key={i} style={{ margin: '6px 0', paddingLeft: '16px', listStyle: 'none' }}>
          {items.map((item, j) => (
            <li key={j} style={{ color: '#d1d5db', marginBottom: '3px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#4ade80', flexShrink: 0 }}>▸</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      result.push(
        <ol key={i} style={{ margin: '6px 0', paddingLeft: '20px' }}>
          {items.map((item, j) => (
            <li key={j} style={{ color: '#d1d5db', marginBottom: '3px' }}
              dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      result.push(<div key={i} style={{ height: '6px' }} />);
      i++; continue;
    }

    // Regular paragraph
    result.push(
      <p key={i} style={{ color: '#d1d5db', lineHeight: '1.7', margin: '3px 0', fontSize: '15px' }}
        dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
    i++;
  }

  return result;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e0d0">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#9ca3af">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#1e2530;padding:1px 5px;border-radius:3px;font-size:11px;color:#4ade80">$1</code>')
    .replace(/⚠️/g, '<span style="color:#f59e0b">⚠️</span>')
    .replace(/✅/g, '<span style="color:#4ade80">✅</span>')
    .replace(/❌/g, '<span style="color:#ef4444">❌</span>');
}

const STORAGE_KEY = 'nutritie_mihai_v2';

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages, dayType, date: new Date().toDateString()
    }));
  } catch {}
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    saveSession(messages, dayType);
  }, [messages, dayType]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const dayLabel = DAY_TYPES.find(d => d.val === dayType)?.label || '';
    const contextPrefix = `[Context: ${dayLabel} — ${currentDay?.desc}]\n`;
    const fullText = contextPrefix + text;

    const userMsg = { role: "user", content: text, display: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.role === 'user' ? (m === userMsg ? fullText : m.content) : m.content
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Eroare la răspuns.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Eroare de conexiune. Încearcă din nou." }]);
    }
    setLoading(false);
  }, [messages, loading, dayType, currentDay]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    showToast("Istoric șters");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0c0f",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color: "#e8e0d0",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0c0f; }
        ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 2px; }

        .header {
          border-bottom: 1px solid #1e2530;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #0d1017;
          position: sticky;
          top: 0;
          z-index: 10;
          gap: 12px;
          flex-wrap: wrap;
        }

        .logo {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #4ade80;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .logo span { color: #6b7280; font-weight: 400; }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .day-selector { display: flex; gap: 4px; }

        .day-btn {
          padding: 5px 10px;
          background: transparent;
          border: 1px solid #1e2530;
          border-radius: 3px;
          color: #6b7280;
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.08em;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .day-btn:hover { border-color: #374151; color: #9ca3af; }
        .day-btn.active-antr { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,0.08); }
        .day-btn.active-norm { border-color: #60a5fa; color: #60a5fa; background: rgba(96,165,250,0.08); }
        .day-btn.active-repaus { border-color: #f59e0b; color: #f59e0b; background: rgba(245,158,11,0.08); }

        .clear-btn {
          padding: 5px 10px;
          background: transparent;
          border: 1px solid #1e2530;
          border-radius: 3px;
          color: #6b7280;
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
        }
        .clear-btn:hover { border-color: #ef4444; color: #ef4444; }

        .day-info {
          font-size: 12px;
          color: #4b5563;
          letter-spacing: 0.05em;
          padding: 8px 16px;
          background: #0d1017;
          border-bottom: 1px solid #111827;
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .day-info-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .quick-bar {
          display: flex;
          gap: 6px;
          padding: 8px 16px;
          background: #0d1017;
          border-bottom: 1px solid #111827;
          overflow-x: auto;
          flex-wrap: nowrap;
          align-items: center;
        }
        .quick-bar::-webkit-scrollbar { height: 0; }

        .q-btn {
          padding: 5px 10px;
          background: #111827;
          border: 1px solid #1e2530;
          border-radius: 3px;
          color: #9ca3af;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .q-btn:hover { background: #1e2530; color: #e8e0d0; transform: translateY(-1px); }
        .q-btn.log { color: #6b7280; }
        .q-btn.log:hover { color: #9ca3af; }

        .divider { width: 1px; height: 18px; background: #1e2530; flex-shrink: 0; margin: 0 2px; }

        .messages {
          max-width: 860px;
          width: 100%;
          margin: 0 auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .msg-user {
          background: #0f1419;
          border: 1px solid #1e2530;
          border-left: 3px solid #374151;
          border-radius: 0 4px 4px 0;
          padding: 10px 14px;
        }

        .msg-assistant {
          background: #0d1017;
          border: 1px solid #111827;
          border-left: 3px solid #4ade80;
          border-radius: 0 4px 4px 0;
          padding: 12px 16px;
        }

        .msg-label {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
          margin-bottom: 8px;
        }
        .label-user { color: #374151; }
        .label-assistant { color: #4ade80; }

        .loading-dots {
          display: flex;
          gap: 6px;
          padding: 14px 18px;
          align-self: flex-start;
        }
        .dot {
          width: 6px; height: 6px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse 1.2s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .full-input-area {
          border-top: 1px solid #1e2530;
          background: #0d1017;
          padding-bottom: env(safe-area-inset-bottom);
          position: sticky;
          bottom: 0;
        }
        .input-area {
          padding: 12px 16px;
          display: flex;
          gap: 10px;
          max-width: 860px;
          width: 100%;
          margin: 0 auto;
          align-items: flex-end;
        }
        .input-wrap { flex: 1; }

        textarea {
          width: 100%;
          background: #0f1419;
          border: 1px solid #1e2530;
          border-radius: 4px;
          padding: 10px 14px;
          color: #e8e0d0;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 16px;
          resize: none;
          outline: none;
          min-height: 48px;
          max-height: 140px;
          transition: border-color 0.15s;
          line-height: 1.5;
        }
        textarea:focus { border-color: #374151; }
        textarea::placeholder { color: #374151; }

        .send-btn {
          padding: 10px 18px;
          background: #4ade80;
          color: #0a0c0f;
          border: none;
          border-radius: 4px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
          height: 44px;
          white-space: nowrap;
        }
        .send-btn:hover:not(:disabled) { background: #86efac; transform: translateY(-1px); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #374151;
          text-align: center;
          padding: 40px;
        }
        .empty-icon { font-size: 36px; opacity: 0.4; }
        .empty-title {
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #4b5563;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .empty-sub { font-size: 12px; color: #374151; line-height: 1.6; }

        .hint { font-size: 10px; color: #374151; margin-top: 4px; letter-spacing: 0.05em; }

        .session-badge {
          font-size: 10px;
          color: #4b5563;
          padding: 2px 8px;
          border: 1px solid #1e2530;
          border-radius: 2px;
        }

        .toast {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: #1e2530;
          color: #9ca3af;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          padding: 8px 16px;
          border-radius: 4px;
          border: 1px solid #374151;
          z-index: 100;
          animation: fadeIn 0.2s ease;
          letter-spacing: 0.05em;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="logo">
          NUTRIȚIE<span> / </span>MIHAI<span> — AI</span>
        </div>
        <div className="header-right">
          {messages.length > 0 && (
            <div className="session-badge">{messages.length / 2 | 0} schimburi azi</div>
          )}
          <div className="day-selector">
            {DAY_TYPES.map(d => (
              <button
                key={d.val}
                className={`day-btn ${dayType === d.val ? `active-${d.val === 'antrenament' ? 'antr' : d.val === 'normal' ? 'norm' : 'repaus'}` : ''}`}
                onClick={() => { setDayType(d.val); showToast(d.label + ' activat'); }}
              >
                {d.label}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <button className="clear-btn" onClick={clearHistory}>CLR</button>
          )}
        </div>
      </div>

      {/* Day info bar */}
      <div className="day-info">
        <div className="day-info-dot" style={{ background: currentDay?.color }} />
        <span style={{ color: currentDay?.color, fontWeight: 600 }}>{currentDay?.label}</span>
        <span>{currentDay?.desc}</span>
        <span style={{ marginLeft: 'auto' }}>
          {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* Quick Bar */}
      <div className="quick-bar">
        {QUICK_COMMANDS.map(q => (
          <button key={q.cmd} className="q-btn" onClick={() => sendMessage(q.cmd)}>
            {q.icon} {q.label}
          </button>
        ))}
        <div className="divider" />
        {QUICK_LOG.map(q => (
          <button key={q.prefix} className="q-btn log" onClick={() => {
            setInput(q.prefix);
            textareaRef.current?.focus();
          }}>
            {q.icon} {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <div className="empty-title">Protocol activ — 96 kg → 88–90 kg</div>
              <div className="empty-sub">
                Apasă <strong style={{ color: "#4ade80" }}>Start zi</strong> pentru a iniția protocolul zilnic<br />
                sau introdu o masă, activitate sau marker direct.
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "msg-user" : "msg-assistant"}>
              <div className={`msg-label ${m.role === "user" ? "label-user" : "label-assistant"}`}>
                {m.role === "user" ? "▸ MIHAI" : "◆ ASISTENT"}
              </div>
              {m.role === "assistant" ? (
                <div>{renderMarkdown(m.content)}</div>
              ) : (
                <div style={{ color: '#d1d5db', fontSize: '16px', lineHeight: '1.6' }}>{m.display || m.content}</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg-assistant" style={{ padding: '14px 16px' }}>
              <div className="msg-label label-assistant">◆ ASISTENT</div>
              <div className="loading-dots" style={{ padding: 0 }}>
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="full-input-area">
          <div className="input-area">
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "44px";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                }}
                onKeyDown={handleKey}
                placeholder="Masă: 3 ouă, 100g piept pui, 30g ovăz..."
                disabled={loading}
                rows={1}
              />
              <div className="hint">Enter → trimite &nbsp;·&nbsp; Shift+Enter → linie nouă</div>
            </div>
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              SEND →
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
