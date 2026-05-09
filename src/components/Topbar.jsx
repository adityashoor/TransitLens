import { api } from "../services/api";
import { Icon, Badge } from "./ui";

const titles = {
  dashboard: "Operations Overview",
  equity: "Equity Scoring",
  ridership: "Ridership Demand",
  disruption: "Disruption Lab",
  servicegap: "Network Map",
};

export default function Topbar({ active }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="text-[15px] font-extrabold text-[var(--ink)]">{titles[active] || titles.dashboard}</h1>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">Connected to {api.baseUrl}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <input className="input w-[230px] pl-9" placeholder="Search routes, stops, areas" aria-label="Search" />
        </div>
        <button className="button-ghost grid h-10 w-10 place-items-center p-0" aria-label="Notifications">
          <Icon name="bell" />
        </button>
        <Badge color="green">Live API</Badge>
      </div>
    </header>
  );
}
