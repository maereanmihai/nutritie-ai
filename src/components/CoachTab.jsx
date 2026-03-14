import { useState, useRef, useEffect } from "react";
import { parseMarkdown } from "../utils/markdown";
import { getTodayKey } from "../utils/date";
import { loadDay } from "../utils/storage";
import { MACROS_TARGET } from "../config/constants";

function buildSystemPrompt() {
  return `Ești NutriCoach — asistentul personal de nutriție și fitness al lui Mihai.
Răspunzi DOAR în română, concis și direct.
Profilul utilizatorului: bărbat, 45 ani, 188cm, ~96kg, țintă 89kg.
Obiective: remodelare corporală, creștere masă musculară, testosteron și libido, LDL redus de la 209 la 119.
Macros țintă zilnice: Calorii ${MACROS_TARGET.calories} kcal, Proteine ${MACROS_TARGET.protein}g, Carbohidrați ${MACROS_TARGET.carbs}g, Grăsimi ${MACROS_TARGET.fat}g.
Folosești date reale din ziua curentă când sunt furnizate în context.
Ești motivant, practic și bazat pe știință. Evită răspunsurile vagi. Folosești emoji și markdown.`;
}

function buildContextBlock(dayData) {
  if (!dayData) return "";
  const { foods = [], workouts = [] } = dayData;
  const totalCals = foods.reduce((s, f) => s + (f.calories || 0), 0);
  const totalProt = foods.reduce((s, f) => s + (f.protein || 0), 0);
  const totalCarbs = foods.reduce((s, f) => s + (f.carbs || 0), 0);
  const totalFat = foods.reduce((s, f) => s + (f.fat || 0), 0);
  const foodList = foods.length ? foods.map((f) => `- ${f.name}: ${f.calories} kcal`).join("\n") : "Niciun aliment înregistrat azi.";
  const workoutList = workouts.length ? workouts.map((w) => `- ${w.name} (${w.duration} min, ${w.calories_burned} kcal)`).join("\n") : "Niciun antrenament înregistrat azi.";
  return `\n\n[DATE AZI]\nAlimente:\n${foodList}\nTotal: ${totalCals} kcal | P: ${totalProt}g | C: ${totalCarbs}g | G: ${totalFat}g\n\nAntrenamente:\n${workoutList}`;
}

const SUGGESTIONS = [
  "Cum arată ziua mea azi?",
  "Ce ar trebui să mănânc la cină?",
  "Sunt în target cu macros?",
  "Sugerează un antrenament rapid",
  "Ce alimente cresc testosteronul?",
  "Analizează-mi progresul săptămânal",
];

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12, animation: "bubbleIn 0.25s ease" }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>
          🤖
        </div>
      )}
      <div
        style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isUser ? "var(--accent)" : "var(--card)", color: isUser ? "#fff" : "var(--text)", fontSize: 14, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
        dangerouslySetInnerHTML={{ __html: isUser ? msg.content : parseMarkdown(msg.content) }}
      />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
      <div style={{ padding: "10px 16px", background: "var(--card)", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: `dot 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function CoachTab() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Salut Mihai! Sunt NutriCoach. Pot analiza ce ai mâncat azi, sugera mese, sau răspunde la orice întrebare despre nutriție și antrenamente. Cum te pot ajuta?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);
    const todayData = loadDay(getTodayKey());
    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const contextBlock = buildContextBlock(todayData);
      const apiMessages = newMessages.map((m, i) => {
        if (i === newMessages.length - 1 && m.role === "user") return { role: "user", content: m.content + contextBlock };
        return m;
      });
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: buildSystemPrompt(), messages: apiMessages }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      const reply = data.content?.find((b) => b.type === "text")?.text || "Scuze, nu am putut genera un răspuns.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Eroare la conectarea cu AI-ul. Încearcă din nou.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", maxHeight: 700 }}>
      <style>{`
        @keyframes bubbleIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dot { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-5px); opacity:1; } }
        .coach-input:focus { outline:none; border-color:var(--accent) !important; }
        .chip-btn:hover { background:var(--accent) !important; color:#fff !important; }
      `}</style>

      {messages.length === 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip-btn" onClick={() => sendMessage(s)}
              style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0", scrollbarWidth: "thin" }}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {loading && <TypingIndicator />}
        {error && <div style={{ padding: "8px 12px", background: "#ff4d4d22", border: "1px solid #ff4d4d55", borderRadius: 8, color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>⚠️ {error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <textarea ref={inputRef} className="coach-input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Scrie o întrebare... (Enter = trimite)" rows={1}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.2s" }}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 18, cursor: "pointer", opacity: (!input.trim() || loading) ? 0.5 : 1, alignSelf: "flex-end" }}>
          ➤
        </button>
      </div>
    </div>
  );
}
