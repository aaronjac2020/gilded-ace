import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { VerdictChip } from "./VerdictChip";

/** Right-side drawer with one machine's verdict, reason and key numbers. */
export function MachineDrawer({ row, onClose }: { row: ScoreRow | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!row) return;
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [row, onClose]);

  return (
    <AnimatePresence>
      {row && (
        <motion.aside
          key={row.machine_id}
          role="dialog"
          aria-modal="false"
          aria-label={`Machine ${row.machine_id}`}
          data-testid="machine-drawer"
          initial={reduce ? false : { x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { x: 420, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed right-0 top-0 z-40 h-screen w-[400px] overflow-y-auto border-l border-rule bg-surface p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                {row.zone_id} · {row.bank_id} · {row.location_id}
              </p>
              <h2 className="font-display text-2xl font-semibold">{row.machine_id}</h2>
              <p className="text-sm text-muted">
                {row.theme} · {row.config_id} · {String(row.volatility_class ?? "")} volatility
              </p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close drawer" className="btn-ghost">
              <X size={14} aria-hidden />
            </button>
          </div>
          <VerdictChip verdict={row.verdict} size="md" />
          <p className="mt-2 text-sm leading-relaxed text-ink">{row.verdict_reason}</p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat k="House win" v={fmt.usd(row.house_win_usd)} />
            <Stat k="Theo (expected win)" v={fmt.usd(row.theo_usd)} />
            <Stat k="Luck residual" v={`${fmt.usd(row.luck_resid_usd)} (z ${fmt.num(row.luck_z, 1)})`} />
            <Stat k="Downtime lost theo" v={`${fmt.usd(row.lost_theo_usd)}`} />
            <Stat k="Hold observed" v={`${fmt.pct(row.hold_obs)} (90% ${fmt.pct(row.hold_ci_lo)}–${fmt.pct(row.hold_ci_hi)})`} />
            <Stat k="Hold configured" v={fmt.pct(row.hold_expected)} />
            <Stat k="Coin-in / avail hr" v={fmt.usd(row.coin_in_per_avail_hr)} />
            <Stat k="Location expects" v={`${fmt.usd(row.location_expected_per_hr)}/hr`} />
            <Stat k="Machine effect (shrunk)" v={`${fmt.num(row.machine_effect_shrunk)} (${fmt.num(row.effect_shrunk_lo)}–${fmt.num(row.effect_shrunk_hi)})`} />
            <Stat k="Availability" v={`${fmt.pct(row.availability)} · ${row.days_on_floor} days`} />
          </dl>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-rule bg-surface-2 p-2">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="tabular-nums text-ink">{v}</dd>
    </div>
  );
}
