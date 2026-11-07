import { LazyMotion, m } from "framer-motion";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "sonner";
import { cn } from "../lib/cn";
import { useCommandOpen, useTour } from "../lib/uiStore";
import { navFor } from "./shell/nav";
import { ShortcutsSheet, useGlobalKeys } from "./shell/Shortcuts";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";

// Overlays load on first use so the entry chunk stays small; they stay mounted afterwards for exit animations.
const MachineDrawer = lazy(() =>
  import("./MachineDrawer").then((x) => ({ default: x.MachineDrawer })),
);
const CommandMenu = lazy(() =>
  import("./shell/CommandMenu").then((x) => ({ default: x.CommandMenu })),
);
const Tour = lazy(() =>
  import("./shell/Tour").then((x) => ({ default: x.Tour })),
);
const motionFeatures = () => import("framer-motion").then((x) => x.domMax);

function useSticky(on: boolean) {
  const [seen, setSeen] = useState(on);
  useEffect(() => {
    if (on) setSeen(true);
  }, [on]);
  return on || seen;
}
import { TooltipProvider } from "./ui/tooltip";

const SITE = "The Gilded Ace";

/** ?focus=<id>: scroll the anchor into view and pulse it gold once it renders. */
function useFocusAnchor() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const id = new URLSearchParams(search).get("focus");
    if (!id) return;
    let tries = 0;
    let raf = 0;
    const seek = () => {
      const el = document.getElementById(id);
      if (!el) {
        if (tries++ < 120) raf = requestAnimationFrame(seek);
        return;
      }
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      el.classList.remove("pulse-target");
      void el.offsetWidth;
      el.classList.add("pulse-target");
    };
    seek();
    return () => cancelAnimationFrame(raf);
  }, [pathname, search]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const drawerOn = useSticky(params.has("machine"));
  const commandOn = useSticky(useCommandOpen());
  const tourOn = useSticky(useTour() !== null);
  useGlobalKeys();
  useFocusAnchor();
  useEffect(() => {
    const n = navFor(pathname);
    document.title = n
      ? n.to === "/"
        ? `${SITE} · Floor review`
        : `${n.title} · ${SITE}`
      : `Not found · ${SITE}`;
  }, [pathname]);
  const bleed = pathname === "/floor";

  return (
    <LazyMotion features={motionFeatures}>
      <TooltipProvider>
        <div className="flex min-h-screen">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-gold focus:px-3 focus:py-1 focus:text-bg"
          >
            Skip to content
          </a>
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <m.main
              key={pathname}
              id="main"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "w-full flex-1 pb-16",
                bleed ? "" : "mx-auto max-w-content px-6",
              )}
            >
              {children}
            </m.main>
          </div>
        </div>
        <Suspense fallback={null}>
          {drawerOn && <MachineDrawer />}
          {commandOn && <CommandMenu />}
          {tourOn && <Tour />}
        </Suspense>
        <ShortcutsSheet />
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            classNames: {
              toast:
                "!bg-surface-3 !text-fg !ring-1 !ring-ring-strong !border-0 !rounded-lg !shadow-float !font-sans !text-sm",
              description: "!text-fg-muted",
              actionButton: "!bg-transparent !text-gold-soft !font-medium",
            },
          }}
        />
      </TooltipProvider>
    </LazyMotion>
  );
}
