import { useState, lazy, Suspense } from "react";
import Layout from "./components/Layout";

const Dashboard    = lazy(() => import("./modules/Dashboard"));
const EquityScoring = lazy(() => import("./modules/EquityScoring"));
const RidershipDemand = lazy(() => import("./modules/RidershipDemand"));
const DisruptionSim = lazy(() => import("./modules/DisruptionSim"));
const ServiceGap   = lazy(() => import("./modules/ServiceGap"));

const MODULE_MAP = {
  dashboard:   Dashboard,
  equity:      EquityScoring,
  ridership:   RidershipDemand,
  disruption:  DisruptionSim,
  servicegap:  ServiceGap,
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-label="Loading module">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const ActiveComponent = MODULE_MAP[activeModule] ?? Dashboard;

  return (
    <Layout active={activeModule} onNavigate={setActiveModule}>
      <Suspense fallback={<LoadingSpinner />}>
        <ActiveComponent />
      </Suspense>
    </Layout>
  );
}
