import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children, active, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex" style={{ minHeight: "100vh", background: "var(--body-bg)" }}>
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar active={active} />
        <main
          className="flex-1 p-6"
          id="main-content"
          tabIndex={-1}
          style={{ background: "var(--body-bg)" }}
        >
          {children}
        </main>
        <footer
          className="px-6 py-3 text-center text-[11px] border-t"
          style={{ color: "var(--text-light)", borderColor: "var(--border-color)", background: "#fff" }}
        >
          TransitLens · TD2026 Data Challenge · Toronto, Canada · Data: TTC GTFS, Statistics Canada, OSM · No PII
        </footer>
      </div>
    </div>
  );
}
