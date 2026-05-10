import { Icon } from "./ui";

const navItems = [
  ["dashboard", "Overview", "dashboard"],
  ["equity", "Equity Scoring", "equity"],
  ["ridership", "Ridership Demand", "chart"],
  ["disruption", "Disruption Lab", "bolt"],
  ["servicegap", "Network Map", "map"],
];

export default function Sidebar({ active, onNavigate, collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Primary">
      <div className="flex h-[68px] items-center gap-3 border-b border-white/10 px-5">
        <div className="brand-mark">TL</div>
        {!collapsed && (
          <div>
            <p className="text-[15px] font-extrabold leading-tight">TransitLens</p>
            <p className="text-[11px] font-medium text-white/42">Toronto intelligence</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 pt-5">
        {!collapsed && <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">Workspace</p>}
        <nav className="space-y-1">
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-button ${active === id ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
              onClick={() => onNavigate(id)}
              aria-current={active === id ? "page" : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        {!collapsed && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <p className="text-xs font-bold">Backend online</p>
            <p className="mt-1 text-[11px] text-white/48">FastAPI, PostGIS, ML, graph simulator</p>
          </div>
        )}
        <button className="nav-button rounded-xl" onClick={onToggle}>
          <span className="text-lg leading-none">{collapsed ? ">" : "<"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
