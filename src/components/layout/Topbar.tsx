import { Bell, Search, Sun, Moon, Activity } from "lucide-react";
import { useUI } from "../../store/ui";
import { useNotifications } from "../../mock/api";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";

export function Topbar() {
  const { theme, setTheme, setCommandOpen } = useUI();
  const { data: notes = [] } = useNotifications();

  return (
    <header className="h-16 border-b border-border bg-background/40 backdrop-blur-xl sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
          <Activity className="size-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-gradient">TransitLens</span>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="relative w-full h-10 pl-9 pr-16 rounded-xl bg-surface/60 border border-border text-sm text-left text-muted-foreground hover:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Open command palette"
        >
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          Search routes, stops, neighbourhoods…
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg bg-surface/60 border border-border text-xs">
          <span className="size-2 rounded-full bg-warn" />
          <span className="text-muted-foreground">Demo mode - partial API data</span>
        </div>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-9 rounded-lg bg-surface/60 border border-border flex items-center justify-center hover:bg-surface transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="relative size-9 rounded-lg bg-surface/60 border border-border flex items-center justify-center hover:bg-surface transition-colors">
              <Bell className="size-4" />
              {notes.length > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive animate-pulse-glow" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 glass-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="font-semibold text-sm">Notifications</div>
              <span className="text-[10px] text-muted-foreground">{notes.length} new</span>
            </div>
            <ul className="max-h-80 overflow-y-auto scrollbar-thin">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface/40">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 size-2 rounded-full shrink-0",
                        n.type === "ai" && "bg-primary",
                        n.type === "alert" && "bg-destructive",
                        n.type === "warn" && "bg-warn",
                        n.type === "info" && "bg-cyan",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{n.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-border">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-primary-foreground">
            AK
          </div>
        </div>
      </div>
    </header>
  );
}
