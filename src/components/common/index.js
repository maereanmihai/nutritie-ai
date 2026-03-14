// SectionTitle.jsx
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 10px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

// MetricBadge.jsx
export function MetricBadge({ label, value, color }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 20,
        background: (color || "var(--accent)") + "22",
        color: color || "var(--accent)",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{label}:</span>}
      {value}
    </span>
  );
}

// EmptyState.jsx
export function EmptyState({ emoji = "📭", title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
      {title && <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 13 }}>{subtitle}</div>}
    </div>
  );
}

// StreakBadge.jsx
export function StreakBadge({ streak = 0 }) {
  if (!streak) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 20,
        background: "linear-gradient(135deg, #ff9800, #ff6584)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      🔥 {streak} zile la rând
    </div>
  );
}

// LineChart.jsx — minimal SVG sparkline
export function LineChart({ data = [], color = "var(--accent)", height = 60, label = "" }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300;
  const h = height;
  const pad = 4;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const polyline = pts.join(" ");
  const area = `${pad},${h} ` + polyline + ` ${w - pad},${h}`;

  return (
    <div>
      {label && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
        <defs>
          <linearGradient id={`grad_${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#grad_${label})`} />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* last point dot */}
        {pts.length > 0 && (
          <circle
            cx={pts[pts.length - 1].split(",")[0]}
            cy={pts[pts.length - 1].split(",")[1]}
            r="3"
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}
