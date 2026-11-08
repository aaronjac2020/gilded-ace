import { LazyMotion, m, useReducedMotion } from "framer-motion";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "sonner";
import { useCommandOpen, useTour } from "../lib/uiStore";
import { navFor } from "./shell/nav";
import { Stepper } from "./shell/Chapter";
import { ShortcutsSheet, useGlobalKeys } from "./shell/Shortcuts";
import { TooltipProvider } from "./ui/tooltip";

// Overlays load on first use so the entry chunk stays small; they stay mounted afterwards for exit animations.
const MachineDrawer = lazy(() => import("./MachineDrawer").then((x) => ({ default: x.MachineDrawer })));
const CommandMenu = lazy(() => import("./shell/CommandMenu").then((x) => ({ default: x.CommandMenu })));
const Tour = lazy(() => import("./shell/Tour").then((x) => ({ default: x.Tour })));
const motionFeatures = () => import("framer-motion").then((x) => x.domMax);

function useSticky(on: boolean) {
  const [seen, setSeen] = useState(on);
  useEffect(() => {
    if (on) setSeen(true);
  }, [on]);
  return on || seen;
}

const SITE = "The Gilded Ace";

/** ?focus=<id> (or #id): scroll the anchor into view and pulse it once it renders. */
function useFocusAnchor() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    const id = new URLSearchParams(search).get("focus") ?? (hash ? decodeURIComponent(hash.slice(1)) : null);
    if (!id) return;
    let tries = 0;
    let raf = 0;
    const seek = () => {
      const el = document.getElementById(id);
      if (!el) {
        if (tries++ < 120) raf = requestAnimationFrame(seek);
        return;
      }
      if (el.tagName === "DETAILS") (el as HTMLDetailsElement).open = true;
      el.closest("details")?.setAttribute("open", "");
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      el.classList.remove("pulse-target");
      void el.offsetWidth;
      el.classList.add("pulse-target");
    };
    seek();
    return () => cancelAnimationFrame(raf);
  }, [pathname, search, hash]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const reduce = useReducedMotion();
  const drawerOn = useSticky(params.has("machine"));
  const commandOn = useSticky(useCommandOpen());
  const tourOn = useSticky(useTour() !== null);
  useGlobalKeys();
  useFocusAnchor();
  useEffect(() => {
    const n = navFor(pathname);
    document.title = n ? (n.to === "/" ? `${SITE} · Slot floor review` : `${n.title} · ${SITE}`) : `${SITE}`;
  }, [pathname]);

  return (
    <LazyMotion features={motionFeatures}>
      <TooltipProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-maroon focus:px-3 focus:py-1 focus:text-card"
        >
          Skip to content
        </a>
        <Stepper />
        <m.main
          key={pathname}
          id="main"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-[calc(100vh-72px)] w-full"
        >
          {children}
        </m.main>
        <Suspense fallback={null}>
          {drawerOn && <MachineDrawer />}
          {commandOn && <CommandMenu />}
          {tourOn && <Tour />}
        </Suspense>
        <ShortcutsSheet />
        <Toaster
          position="bottom-center"
          theme="light"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-1 !text-fg !border !border-divider !rounded-[10px] !shadow-float !font-sans !text-sm",
              description: "!text-fg-muted",
              actionButton: "!bg-maroon !text-card !font-semibold",
            },
          }}
        />
      </TooltipProvider>
    </LazyMotion>
  );
}
