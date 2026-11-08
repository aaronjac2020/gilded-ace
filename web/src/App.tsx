import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { REDIRECTS } from "./components/shell/nav";
import { ScreenSkeleton } from "./components/ui/skeleton";
import Question from "./screens/Question";

const Why = lazy(() => import("./screens/Why"));
const Floor = lazy(() => import("./screens/Floor"));
const Guests = lazy(() => import("./screens/Guests"));
const BudgetPlan = lazy(() => import("./screens/BudgetPlan"));
const Evidence = lazy(() => import("./screens/Evidence"));
const NotFound = lazy(() => import("./screens/NotFound"));

/** Old route -> its chapter, keeping ?period=&zone=&bank=&machine=&focus= and #hash. */
function Redirect({ from }: { from: string }) {
  const { search, hash } = useLocation();
  const r = REDIRECTS[from];
  const focus = new URLSearchParams(search).get("focus");
  const to = (focus && r.focus?.[focus]) || r.to;
  return <Navigate replace to={{ pathname: to, search, hash }} />;
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<ScreenSkeleton />}>
        <Routes>
          <Route path="/" element={<Question />} />
          <Route path="/why" element={<Why />} />
          <Route path="/floor" element={<Floor />} />
          <Route path="/guests" element={<Guests />} />
          <Route path="/plan" element={<BudgetPlan />} />
          <Route path="/evidence" element={<Evidence />} />
          {Object.keys(REDIRECTS).map((p) => (
            <Route key={p} path={p} element={<Redirect from={p} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
