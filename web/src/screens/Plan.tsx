import { useMemo } from "react";
import { ReasonStamp, reasonOf, useReasons } from "../components/Reason";
import { Chapter, Section } from "../components/shell/Chapter";
import { ChapterPart } from "../components/ui/hero-band";
import { rows } from "../lib/data";
import type { Columnar } from "../lib/data";
import { useMachineParam } from "../lib/uiStore";
import { managerList, useJson } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import BudgetPlan from "./BudgetPlan";

type Line = { name: string; targets: string };

/** Chapter 5 · The plan: the $100k allocation, then what it means for each machine on the manager's cut list. */
export default function Plan() {
  return (
    <Chapter testId="chapter-plan">
      <ChapterPart lead>
        <BudgetPlan />
      </ChapterPart>
      <CutList />
    </Chapter>
  );
}

/** Each cut-list machine (full period, the plan's window) → the plan line that targets it, if any. */
function CutList() {
  const [f] = useFilters();
  const { rows: sc, flags } = useReasons({ ...f, period: "full", zone: null, bank: null });
  const budget = useJson<{ recommended: Columnar }>("budget.json").data;
  const mgr = useMemo(() => managerList(sc), [sc]);
  const [, open] = useMachineParam();
  if (!budget || !flags || !mgr.length) return null;
  const lines = rows<Line>(budget.recommended);
  const hits = (l: Line, id: string) => l.targets.split(/,\s*/).includes(id);
  // Machine-specific lines first (inspect, move); a zone line only covers the machines that sit in it.
  const action = (r: (typeof mgr)[number], weak: boolean) => {
    const m = lines.find((l) => hits(l, r.machine_id));
    if (m) return m.name;
    const z = lines.find((l) => hits(l, r.zone_id));
    if (z)
      return weak
        ? `Replace if still weak at the 30-day re-rank. Its zone, ${r.zone_id}, gets new signage now.`
        : `Keep it. Its zone, ${r.zone_id}, gets new signage.`;
    return weak ? "Replace if still weak at the 30-day re-rank." : "Keep it. No spend needed.";
  };
  const ids = mgr.map((r) => r.machine_id);

  return (
    <Section
      id="cut-list"
      title="What happens to the cut list"
      answers="Q6"
      sentence="Cut none now. Re-rank the ten after the 30-day checks."
    >
      <ul className="card divide-y divide-divider" data-testid="plan-cut-list">
        {mgr.map((r) => {
          const why = reasonOf(flags, r.machine_id);
          return (
            <li key={r.machine_id}>
              <button
                type="button"
                onClick={() => open(r.machine_id, ids)}
                className="focus-ring flex w-full flex-wrap items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-2"
                data-machine-row={r.machine_id}
              >
                <span className="w-16 font-mono text-[13px] font-semibold">{r.machine_id}</span>
                <span className="w-44">
                  <ReasonStamp reason={why} size="sm" />
                </span>
                <span className="text-[15px] text-fg">{action(r, why === "weak")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
