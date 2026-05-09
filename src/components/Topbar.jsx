const MODULE_TITLES = {
  dashboard:  { title: "Dashboard",             crumb: "Home" },
  equity:     { title: "Equity Scoring",         crumb: "Analytics" },
  ridership:  { title: "Ridership Demand",       crumb: "Analytics" },
  disruption: { title: "Disruption Simulation",  crumb: "Analytics" },
  servicegap: { title: "Service Gap Analysis",   crumb: "Analytics" },
};

export default function Topbar({ active }) {
  const { title, crumb } = MODULE_TITLES[active] ?? MODULE_TITLES.dashboard;

  return (
    <header
      className="flex items-center justify-between px-6 bg-white border-b sticky top-0 z-10"
      style={{ borderColor: "var(--border-color)", height: 64 }}
    >
      {/* Breadcrumb */}
      <div>
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <li>
              <span>Home</span>
            </li>
            <li aria-hidden="true">
              <svg viewBox="0 0 6 10" fill="none" className="w-1.5 h-2.5 opacity-40">
                <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </li>
            <li>{crumb}</li>
            {crumb !== title && (
              <>
                <li aria-hidden="true">
                  <svg viewBox="0 0 6 10" fill="none" className="w-1.5 h-2.5 opacity-40">
                    <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </li>
                <li style={{ color: "var(--primary)" }} className="font-medium">{title}</li>
              </>
            )}
          </ol>
        </nav>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg outline-none transition-all"
            style={{
              background: "var(--body-bg)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              width: 180,
            }}
            onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.boxShadow = "0 0 0 3px var(--primary-01)"; }}
            onBlur={(e)  => { e.target.style.borderColor = "var(--border-color)"; e.target.style.boxShadow = "none"; }}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--text-muted)" }}>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        </div>

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: "var(--body-bg)", border: "1px solid var(--border-color)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[17px] h-[17px]" style={{ color: "var(--text-muted)" }}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full border-2 border-white"
            style={{ background: "var(--danger)" }}
            aria-hidden="true"
          />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-light))" }}
            aria-hidden="true"
          >
            TL
          </div>
          <div className="hidden md:block">
            <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Admin</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>TD2026</p>
          </div>
        </div>
      </div>
    </header>
  );
}
