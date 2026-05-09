import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children, active, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="main-frame">
        <Topbar active={active} />
        <main className="content" id="main-content">{children}</main>
        <footer className="border-t border-[var(--line)] bg-white/70 px-6 py-4 text-center text-[11px] text-[var(--muted)]">
          TransitLens uses open TTC GTFS, City of Toronto Open Data, PostGIS, FastAPI, and local ML predictions. No personal rider records are stored.
        </footer>
      </div>
    </div>
  );
}
