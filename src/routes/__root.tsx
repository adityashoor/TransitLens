import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import appCss from "../styles.css?url";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/CommandPalette";
import { useUI } from "@/store/ui";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center glass-card rounded-2xl p-10">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Off the route map</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The destination doesn't exist on this network.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center glass-card rounded-2xl p-10">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TransitLens — AI Transit Intelligence for Toronto" },
      { name: "description", content: "Real-time transit analytics, AI ridership predictions, equity heatmaps, and disruption simulation for the TTC network." },
      { property: "og:title", content: "TransitLens" },
      { property: "og:description", content: "AI-powered transit intelligence platform." },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0c1320" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { reducedMotion, theme, highContrast } = useUI();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("high-contrast", highContrast);
  }, [theme, highContrast]);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
        <AppShell>
          <Outlet />
        </AppShell>
        <CommandPalette />
      </MotionConfig>
    </QueryClientProvider>
  );
}
