import { useQuery } from "@tanstack/react-query";
import {
  NETWORK,
  hourlyRidership,
  dailyRidership,
  yearlyGrowth,
  routeComparison,
  neighborhoodHeatmap,
  disruptions,
  notifications,
  predictionTimeline,
  aiCards,
  HOODS,
  generateVehicles,
  kpiSnapshot,
  incidents,
  fleet,
  odPairs,
  safetyEvents,
  weatherImpact,
  budgetByRoute,
  bunching,
} from "./data";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  network: async () => (await wait(50), NETWORK),
  kpis: async () => (await wait(80), kpiSnapshot()),
  hourly: async () => (await wait(120), hourlyRidership()),
  daily: async () => (await wait(120), dailyRidership()),
  yearly: async () => (await wait(120), yearlyGrowth()),
  routeCompare: async () => (await wait(100), routeComparison()),
  heatmap: async () => (await wait(150), neighborhoodHeatmap()),
  disruptions: async () => (await wait(80), disruptions()),
  notifications: async () => (await wait(50), notifications),
  predictions: async () => (await wait(120), predictionTimeline()),
  aiCards: async () => (await wait(80), aiCards),
  hoods: async () => (await wait(80), HOODS),
  vehicles: async () => (await wait(80), generateVehicles()),
  incidents: async () => (await wait(100), incidents()),
  fleet: async () => (await wait(100), fleet()),
  odPairs: async () => (await wait(100), odPairs()),
  safety: async () => (await wait(100), safetyEvents()),
  weather: async () => (await wait(100), weatherImpact()),
  budget: async () => (await wait(100), budgetByRoute()),
  bunching: async () => (await wait(100), bunching()),
};

export const useKpis = () => useQuery({ queryKey: ["kpis"], queryFn: mockApi.kpis, refetchInterval: 8000 });
export const useNetwork = () => useQuery({ queryKey: ["network"], queryFn: mockApi.network });
export const useHourly = () => useQuery({ queryKey: ["hourly"], queryFn: mockApi.hourly });
export const useDaily = () => useQuery({ queryKey: ["daily"], queryFn: mockApi.daily });
export const useYearly = () => useQuery({ queryKey: ["yearly"], queryFn: mockApi.yearly });
export const useRouteCompare = () => useQuery({ queryKey: ["routeCompare"], queryFn: mockApi.routeCompare });
export const useHeatmap = () => useQuery({ queryKey: ["heatmap"], queryFn: mockApi.heatmap });
export const useDisruptions = () => useQuery({ queryKey: ["disruptions"], queryFn: mockApi.disruptions });
export const useNotifications = () => useQuery({ queryKey: ["notifications"], queryFn: mockApi.notifications });
export const usePredictions = () => useQuery({ queryKey: ["predictions"], queryFn: mockApi.predictions });
export const useAiCards = () => useQuery({ queryKey: ["aiCards"], queryFn: mockApi.aiCards });
export const useHoods = () => useQuery({ queryKey: ["hoods"], queryFn: mockApi.hoods });
export const useVehicles = () =>
  useQuery({ queryKey: ["vehicles"], queryFn: mockApi.vehicles, refetchInterval: 3000 });
export const useIncidents = () => useQuery({ queryKey: ["incidents"], queryFn: mockApi.incidents, refetchInterval: 10000 });
export const useFleet = () => useQuery({ queryKey: ["fleet"], queryFn: mockApi.fleet });
export const useOdPairs = () => useQuery({ queryKey: ["odPairs"], queryFn: mockApi.odPairs });
export const useSafety = () => useQuery({ queryKey: ["safety"], queryFn: mockApi.safety });
export const useWeather = () => useQuery({ queryKey: ["weather"], queryFn: mockApi.weather });
export const useBudget = () => useQuery({ queryKey: ["budget"], queryFn: mockApi.budget });
export const useBunching = () => useQuery({ queryKey: ["bunching"], queryFn: mockApi.bunching, refetchInterval: 8000 });
