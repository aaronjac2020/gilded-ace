import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { tourStore, useTour } from "../../lib/uiStore";
import { Button } from "../ui/button";
import { DealerButton } from "../theme/DealerButton";

type Step = { path: string; sel: string; title: string; body: string };

const STEPS: Step[] = [
  {
    path: "/",
    sel: "[data-testid=assertion-title]",
    title: "The answer comes first",
    body: "Every screen opens with its conclusion as the title. The numbers under it are the evidence.",
  },
  {
    path: "/",
    sel: "[data-testid=verdict-kpis]",
    title: "Change the period",
    body: "Pick a month in the top bar, or press [ and ]. Every number recomputes from that month's scorecard.",
  },
  {
    path: "/floor",
    sel: "[data-bank]",
    title: "Drill into a bank",
    body: "Click a bank on the floor. The filter follows you to Verdict and Downtime.",
  },
  {
    path: "/model",
    sel: "[data-testid=mae-table]",
    title: "Check the model",
    body: "Holdout error against a naive baseline, on months the model never saw.",
  },
  {
    path: "/plan",
    sel: "[data-testid=plan-lines]",
    title: "Follow the money",
    body: "Each plan line links to the evidence that justifies it. Press ⌘K any time to jump around.",
  },
];

/** Five-step judge tour: navigates, rings the target, and explains it in one sentence. */
export function Tour() {
  const step = useTour();
  const nav = useNavigate();
  const { pathname, search } = useLocation();
  const [box, setBox] = useState<DOMRect | null>(null);
  const s = step != null ? STEPS[step] : null;

  useEffect(() => {
    if (s && pathname !== s.path) nav({ pathname: s.path, search });
  }, [s, pathname, search, nav]);

  useLayoutEffect(() => {
    if (!s) return setBox(null);
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.querySelector(s.sel);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => setBox(el.getBoundingClientRect()), 260);
      } else if (tries++ < 60) raf = requestAnimationFrame(find);
    };
    setBox(null);
    find();
    const re = () => {
      const el = document.querySelector(s.sel);
      if (el) setBox(el.getBoundingClientRect());
    };
    window.addEventListener("resize", re);
    window.addEventListener("scroll", re, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", re);
      window.removeEventListener("scroll", re, true);
    };
  }, [s, pathname]);

  useEffect(() => {
    if (step == null) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && tourStore.set(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step]);

  if (!s || step == null) return null;
  const last = step === STEPS.length - 1;
  return (
    <>
      {box && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-lg ring-2 ring-gold transition-all duration-route ease-out"
          style={{
            left: box.left - 6,
            top: box.top - 6,
            width: box.width + 12,
            height: box.height + 12,
            boxShadow: "0 0 0 9999px rgb(10 9 9 / 0.55)",
          }}
        />
      )}
      <div role="dialog" aria-label="Judge tour" className="float fixed bottom-6 right-6 z-[61] w-[340px] p-4 animate-fade-up">
        <div className="flex items-center justify-between">
          <p className="label-sc flex items-center gap-2">
            <DealerButton label={`Step ${step + 1} of ${STEPS.length}`}>
              {step + 1}/{STEPS.length}
            </DealerButton>
            Tour
          </p>
          <button
            type="button"
            aria-label="End tour"
            className="focus-ring rounded-sm p-1 text-fg-subtle hover:text-fg"
            onClick={() => tourStore.set(null)}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-base font-semibold tracking-tight text-fg">{s.title}</p>
        <p className="mt-1 text-sm text-fg-muted">{s.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1 w-4 rounded-full ${i <= step ? "bg-gold" : "bg-surface-3"}`} />
            ))}
          </div>
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => tourStore.set(step - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={() => tourStore.set(last ? null : step + 1)}>
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </>
  );
}
