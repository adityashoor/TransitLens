/* ─────────────────────────────────────────────────────────
   Shared UI primitives — Spruha-style design system
   ───────────────────────────────────────────────────────── */

// ── Card ─────────────────────────────────────────────────
export function Card({ children, className = "", hover = false, style = {} }) {
  return (
    <div
      className={`bg-white rounded-[var(--card-radius)] ${hover ? "card-hover" : ""} ${className}`}
      style={{
        boxShadow: "var(--card-shadow)",
        border: "1px solid var(--border-color)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Card Header ──────────────────────────────────────────
export function CardHeader({ title, subtitle, action, icon, iconBg }) {
  return (
    <div
      className="flex items-start justify-between px-5 pt-4 pb-3"
      style={{ borderBottom: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: iconBg || "var(--primary)" }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 ml-3">{action}</div>}
    </div>
  );
}

// ── Stat Card (KPI card) ──────────────────────────────────
export function StatCard({ label, value, unit, change, changePct, icon, color, gradient }) {
  const gradients = {
    primary:   "linear-gradient(135deg, #6259ca, #8780e0)",
    secondary: "linear-gradient(135deg, #eb6f33, #f5a623)",
    success:   "linear-gradient(135deg, #19b159, #47d27b)",
    info:      "linear-gradient(135deg, #4ec2f0, #1da9e0)",
    warning:   "linear-gradient(135deg, #f7b731, #fbd170)",
    danger:    "linear-gradient(135deg, #f5334f, #ff6b7a)",
    teal:      "linear-gradient(135deg, #00b9b9, #00d8d8)",
  };
  const bg = gradient || gradients[color] || gradients.primary;

  return (
    <div
      className="card-hover rounded-[var(--card-radius)] p-5 text-white relative overflow-hidden"
      style={{ background: bg, boxShadow: `0 8px 24px ${getGlowColor(color)}` }}
    >
      {/* Decorative circles */}
      <span className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" aria-hidden="true" />
      <span className="absolute -right-1 top-8 w-12 h-12 rounded-full bg-white/10" aria-hidden="true" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-white/70 text-[11px] font-medium uppercase tracking-[0.8px] mb-1">{label}</p>
          <p className="text-[28px] font-bold leading-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
            {unit && <span className="text-[14px] font-medium ml-1 opacity-80">{unit}</span>}
          </p>
          {(change !== undefined || changePct !== undefined) && (
            <p className="text-[11px] mt-1.5 text-white/70">
              {changePct !== undefined && (
                <span className={`font-semibold text-white ${changePct >= 0 ? "text-white" : "text-red-200"}`}>
                  {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct)}%{" "}
                </span>
              )}
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-white">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function getGlowColor(color) {
  const map = {
    primary:   "rgba(98,89,202,0.28)",
    secondary: "rgba(235,111,51,0.28)",
    success:   "rgba(25,177,89,0.28)",
    info:      "rgba(78,194,240,0.28)",
    warning:   "rgba(247,183,49,0.28)",
    danger:    "rgba(245,51,79,0.28)",
    teal:      "rgba(0,185,185,0.28)",
  };
  return map[color] || "rgba(98,89,202,0.2)";
}

// ── Badge ────────────────────────────────────────────────
export function Badge({ children, color = "primary" }) {
  const styles = {
    primary:   { background: "var(--primary-01)",           color: "var(--primary)" },
    success:   { background: "rgba(25,177,89,0.1)",         color: "var(--success)" },
    danger:    { background: "rgba(245,51,79,0.1)",         color: "var(--danger)" },
    warning:   { background: "rgba(247,183,49,0.1)",        color: "#c88c00" },
    info:      { background: "rgba(78,194,240,0.1)",        color: "#1a8fb8" },
    secondary: { background: "rgba(235,111,51,0.1)",        color: "var(--secondary)" },
    teal:      { background: "rgba(0,185,185,0.1)",         color: "#008080" },
    muted:     { background: "var(--body-bg)",              color: "var(--text-muted)", border: "1px solid var(--border-color)" },
  };
  return (
    <span className="badge-pill" style={styles[color] || styles.primary}>
      {children}
    </span>
  );
}

// ── Button ───────────────────────────────────────────────
export function Btn({ children, variant = "primary", size = "md", onClick, className = "", disabled = false }) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-150 border cursor-pointer disabled:opacity-60";
  const sizes = {
    sm: "px-3 py-1 text-[11px]",
    md: "px-4 py-2 text-[12px]",
    lg: "px-5 py-2.5 text-[13px]",
  };
  const variants = {
    primary:   "text-white border-transparent",
    outline:   "bg-transparent",
    ghost:     "border-transparent bg-transparent",
  };

  const inlineStyle = variant === "primary"
    ? { background: "linear-gradient(135deg, var(--primary), var(--primary-light))", boxShadow: "0 4px 14px rgba(98,89,202,0.3)" }
    : variant === "outline"
    ? { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }
    : { color: "var(--primary)", borderColor: "transparent", background: "var(--primary-01)" };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={inlineStyle}
    >
      {children}
    </button>
  );
}

// ── Section Page Header ──────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Filter Pill Group ─────────────────────────────────────
export function PillGroup({ options, value, onChange }) {
  return (
    <div className="toggle-group" role="group">
      {options.map((opt) => (
        <button
          key={opt}
          className={`toggle-btn ${value === opt ? "active" : ""}`}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────
export function EmptyState({ icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3"
        style={{ background: "var(--primary-01)", color: "var(--primary)" }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="text-[11px] max-w-[200px]" style={{ color: "var(--text-muted)" }}>{body}</p>
    </div>
  );
}

// ── Tooltip-style info tag ───────────────────────────────
export function InfoTag({ children, color = "primary" }) {
  const colors = {
    primary: { bg: "var(--primary-01)",         text: "var(--primary)",   border: "var(--primary-02)" },
    success: { bg: "rgba(25,177,89,0.08)",       text: "var(--success)",   border: "rgba(25,177,89,0.2)" },
    danger:  { bg: "rgba(245,51,79,0.08)",       text: "var(--danger)",    border: "rgba(245,51,79,0.2)" },
    warning: { bg: "rgba(247,183,49,0.08)",      text: "#c88c00",          border: "rgba(247,183,49,0.25)" },
  };
  const c = colors[color] || colors.primary;
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] font-medium"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {children}
    </div>
  );
}
