export function Icon({ name, size, className = "w-4 h-4" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    map: <><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" /><path d="M9 3v15M15 6v15" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    equity: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7l1-7z" />,
    gap: <><circle cx="12" cy="12" r="9" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    route: <><path d="M6 3v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v6" /><circle cx="6" cy="3" r="2" /><circle cx="18" cy="21" r="2" /></>,
    "map-pin": <><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></>,
    people: <><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.7M16 3.2a4 4 0 0 1 0 7.6" /></>,
    stop: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...common}>{paths[name] || paths.dashboard}</svg>;
}

export function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="card-header">
      <div>
        <h3 className="text-[14px] font-bold text-[var(--ink)]">{title}</h3>
        {subtitle && <p className="mt-1 text-[12px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">TransitLens</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">{title}</h2>
        {subtitle && <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color = "brand" }) {
  return <span className={`badge ${color}`}>{children}</span>;
}

export function KPI({ label, value, hint, icon, tone = "brand" }) {
  const gradients = {
    brand: "linear-gradient(135deg, #6259ca, #756df0)",
    blue: "linear-gradient(135deg, #2563eb, #38bdf8)",
    green: "linear-gradient(135deg, #16a36b, #22c55e)",
    amber: "linear-gradient(135deg, #e7a21a, #f97316)",
    teal: "linear-gradient(135deg, #119e9a, #15c6b7)",
    red: "linear-gradient(135deg, #e5484d, #f97373)",
    purple: "linear-gradient(135deg, #7c3aed, #a855f7)",
    slate: "linear-gradient(135deg, #334155, #64748b)",
  };
  return (
    <div className="kpi" style={{ background: gradients[tone] || gradients.brand }}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
          {hint && <p className="mt-2 text-xs text-white/72">{hint}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/18">{icon}</div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
