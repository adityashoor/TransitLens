import { useState } from "react";
import Layout from "./components/Layout";
import Dashboard from "./modules/Dashboard";
import EquityScoring from "./modules/EquityScoring";
import RidershipDemand from "./modules/RidershipDemand";
import DisruptionSim from "./modules/DisruptionSim";
import ServiceGap from "./modules/ServiceGap";

const MODULE_MAP = {
  dashboard:   Dashboard,
  equity:      EquityScoring,
  ridership:   RidershipDemand,
  disruption:  DisruptionSim,
  servicegap:  ServiceGap,
};

export default function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const ActiveComponent = MODULE_MAP[activeModule] ?? Dashboard;

  return (
    <Layout active={activeModule} onNavigate={setActiveModule}>
      <ActiveComponent />
    </Layout>
  );
}
