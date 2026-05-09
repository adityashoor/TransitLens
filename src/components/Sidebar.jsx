const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "equity",
    label: "Equity Scoring",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 3" strokeLinecap="round" />
        <path d="M8 12h1M15 12h1M12 8v1M12 15v1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "ridership",
    label: "Ridership Demand",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
        <polyline points="3,17 9,11 13,15 21,7" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="15,7 21,7 21,13" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "disruption",
    label: "Disruption Sim",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "servicegap",
    label: "Service Gap",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
        <circle cx="12" cy="12" r="9" />
        <path d="M2 12h3M19 12h3M12 2v3M12 19v3" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-[1.2px] px-4 pt-5 pb-1.5 text-white/30 select-none";

export default function Sidebar({ active, onNavigate, collapsed, onToggle }) {
  return (
    <aside
      style={{ background: "var(--sidebar-grad)", minHeight: "100vh" }}
      className={`flex flex-col transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[240px]"} shrink-0 relative z-20`}
      aria-label="Main navigation"
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 px-4 py-4 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}
        style={{ minHeight: 64 }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #6259ca, #8780e0)" }}
          aria-hidden="true"
        >
          TL
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-semibold text-[15px] leading-tight tracking-tight">TransitLens</p>
            <p className="text-white/40 text-[10px]">TD2026 · Toronto</p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 overflow-x-hidden" aria-label="Module navigation">
        {!collapsed && <p className={SECTION_LABEL}>Analytics</p>}

        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-[10px] text-[13px] font-medium transition-all duration-150 relative group
                ${isActive
                  ? "nav-item-active text-white"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.05]"
                }
                ${collapsed ? "justify-center" : ""}
              `}
            >
              {/* Active left bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                  style={{ background: "var(--primary-light)" }}
                  aria-hidden="true"
                />
              )}
              <span className={isActive ? "text-white" : "text-white/50 group-hover:text-white/80"}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Toggle collapse button ── */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors text-[12px] font-medium ${collapsed ? "justify-center" : ""}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
            {collapsed
              ? <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
