import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import Verdict from "./screens/Verdict";

const FloorMap = lazy(() => import("./screens/FloorMap"));
const Demand = lazy(() => import("./screens/Demand"));
const Downtime = lazy(() => import("./screens/Downtime"));
const Players = lazy(() => import("./screens/Players"));
const Comps = lazy(() => import("./screens/Comps"));
const ModelLab = lazy(() => import("./screens/ModelLab"));
const BudgetPlan = lazy(() => import("./screens/BudgetPlan"));
const Methodology = lazy(() => import("./screens/Methodology"));

export function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-32 animate-pulse bg-surface-2/60" />
      ))}
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Verdict />} />
          <Route path="/floor" element={<FloorMap />} />
          <Route path="/demand" element={<Demand />} />
          <Route path="/downtime" element={<Downtime />} />
          <Route path="/players" element={<Players />} />
          <Route path="/comps" element={<Comps />} />
          <Route path="/model" element={<ModelLab />} />
          <Route path="/plan" element={<BudgetPlan />} />
          <Route path="/method" element={<Methodology />} />
          <Route path="*" element={<Verdict />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
