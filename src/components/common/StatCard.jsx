export default function StatCard({ label, value, unit, percent, color, icon }) {
  const pct = Math.min(percent || 0, 100);
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 12,
        padding: "12px 14px",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
          {label}
        </span>
        <span style={{ fontSize: 11, color: color || "var(--accent)", fontWeight: 700 }}>
          {percent != null ? `${pct}%` : ""}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 3 }}>{unit}</span>}
      </div>
      {percent != null && (
        <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: color || "var(--accent)",
              borderRadius: 2,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
