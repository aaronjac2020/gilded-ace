import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MOD } from "../../lib/cn";
import { commandStore, shortcutsStore, useShortcutsOpen } from "../../lib/uiStore";
import { useFilters } from "../../lib/urlState";
import { Keys } from "../ui/kbd";
import { MONTHS, NAV } from "./nav";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** Global keys: ⌘K, G then a screen key, [ ] months, ? sheet. Esc is handled by each overlay. */
export function useGlobalKeys() {
  const nav = useNavigate();
  const { search } = useLocation();
  const [f, setF] = useFilters();
  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commandStore.set(!commandStore.get());
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || commandStore.get()) return;
      const k = e.key.toLowerCase();
      if (Date.now() - g < 1200) {
        g = 0;
        const n = NAV.find((x) => x.key === k);
        if (n) {
          const keep = new URLSearchParams(search);
          keep.delete("machine");
          keep.delete("focus");
          nav({ pathname: n.to, search: keep.toString() });
        }
        return;
      }
      if (k === "g") g = Date.now();
      else if (e.key === "?") shortcutsStore.set(true);
      else if (e.key === "[" || e.key === "]") {
        const i = MONTHS.indexOf(f.period);
        const j = i < 0 ? (e.key === "]" ? 0 : MONTHS.length - 1) : i + (e.key === "]" ? 1 : -1);
        if (MONTHS[j]) setF({ period: MONTHS[j] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, search, f.period, setF]);
}

const ROWS: [string, string[]][] = [
  ["Open command menu", [MOD, "K"]],
  ...NAV.map((n): [string, string[]] => [`Go to ${n.label}`, ["G", n.key.toUpperCase()]]),
  ["Previous / next month", ["[", "]"]],
  ["Play / pause months", ["Space"]],
  ["Step month (playback)", [",", "."]],
  ["Move in a list", ["J", "K"]],
  ["Open selected row", ["↵"]],
  ["Step machines in drawer", ["←", "→"]],
  ["Close overlay", ["Esc"]],
  ["Show this sheet", ["?"]],
];

export function ShortcutsSheet() {
  const open = useShortcutsOpen();
  return (
    <Dialog.Root open={open} onOpenChange={shortcutsStore.set}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-surface-3 p-5 shadow-float data-[state=open]:animate-fade-up"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-fg">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close className="focus-ring rounded-sm p-1 text-fg-subtle hover:text-fg" aria-label="Close">
              <X size={14} aria-hidden />
            </Dialog.Close>
          </div>
          <dl className="divide-y divide-divider">
            {ROWS.map(([k, keys]) => (
              <div key={k} className="flex h-9 items-center justify-between text-sm">
                <dt className="text-fg-muted">{k}</dt>
                <dd>
                  <Keys keys={keys} />
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
