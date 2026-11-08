import { Section } from "../components/shell/Chapter";
import { Chapter } from "../components/shell/Chapter";
import { ChapterPart } from "../components/ui/hero-band";
import { REASON_ICON } from "../components/Reason";
import { fmt } from "../lib/format";
import { REASON, REASON_ORDER, type Reason, type Rules, type VerdictRules } from "../lib/reasons";
import { useJson } from "../lib/useData";
import Methodology from "./Methodology";
import ModelLab from "./ModelLab";

/** Evidence: every claim with its query (lead), how each machine gets one reason, and how the models were checked. */
/** Plain-words rule for each reason; cutoffs come from meta.json so the text can't drift from the pipeline. */
function rule(k: Reason, r: Rules, v: VerdictRules): string {
  return {
    inspect: "Its real payback differs from its design by more than chance allows. Verify the hold first.",
    weak: "Even the generous end of its range draws less play than its spot and game predict.",
    setting: `Designed to keep ${fmt.pct(r.low_hold_design, 0)} or less of each bet (floor median ${fmt.pct(r.floor_median_hold, 0)}).`,
    downtime: `Among the ${fmt.pct(v.downtime_avail_quantile, 0)} least available, and downtime explains at least ${fmt.pct(v.downtime_gap_share, 0)} of its shortfall.`,
    location: `Play matches its spot, and the spot is in the quietest ${fmt.pct(v.location_quantile, 0)} of the floor.`,
    luck: `Guests won far more than usual (beyond ${v.luck_z} standard deviations) on a machine with normal play.`,
    none: "None of the above. Earned less, but within normal range.",
  }[k];
}

type Hash = { path: string; sha256: string; matches_release?: boolean };
type Fingerprint = {
  about: string;
  git_commit: string;
  data_release: { dataset: string; version: string; world_id: string };
  manifest_sha256: string;
  seed: number;
  inputs: Hash[];
  outputs: Hash[];
};

/** Reproducibility fingerprint (pipeline/fingerprint.py): hashes a rerun of `python run.py all` should match. */
function Reproduce() {
  const fp = useJson<Fingerprint>("fingerprint.json").data;
  if (!fp) return null;
  const ok = fp.inputs.filter((h) => h.matches_release).length;
  const list = (title: string, hs: Hash[]) => (
    <details className="card px-5 py-3">
      <summary className="cursor-pointer text-[15px] font-semibold text-fg">
        {title} ({hs.length})
      </summary>
      <ul className="mt-3 space-y-1 text-xs">
        {hs.map((h) => (
          <li key={h.path} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-divider py-1">
            <span className="truncate text-fg-muted">{h.path}</span>
            <span className="mono text-fg" title={h.sha256}>
              {h.sha256.slice(0, 16)}…
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
  return (
    <Section id="reproduce" title="Verify these results" sentence="Run python run.py all; your hashes should match these.">
      <dl className="grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-[180px_1fr]" data-testid="fingerprint">
        <dt className="text-fg-muted">Data release</dt>
        <dd className="text-fg">
          {fp.data_release.dataset}, v{fp.data_release.version} ({fp.data_release.world_id})
        </dd>
        <dt className="text-fg-muted">Inputs</dt>
        <dd className="text-fg">
          {fp.inputs.length} tables, {ok} of {fp.inputs.length} match the release manifest&rsquo;s SHA-256
        </dd>
        <dt className="text-fg-muted">Code commit</dt>
        <dd className="mono text-fg">{fp.git_commit.slice(0, 12)}</dd>
        <dt className="text-fg-muted">Seed</dt>
        <dd className="text-fg">{fp.seed}</dd>
      </dl>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {list("Input hashes", fp.inputs)}
        {list("Output hashes", fp.outputs)}
      </div>
    </Section>
  );
}

export default function Evidence() {
  const meta = useJson<{ rules: Rules; verdict_rules: VerdictRules }>("meta.json").data;
  return (
    <Chapter testId="chapter-evidence">
      <ChapterPart lead>
        <Methodology />
      </ChapterPart>
      <Section
        id="method"
        title="How each machine gets one reason"
        sentence="Reasons are checked in this order; the first that applies is the main reason."
      >
        <ol className="card grid gap-0 divide-y divide-divider" data-testid="reason-order">
          {REASON_ORDER.map((k, i) => {
            const Icon = REASON_ICON[k];
            return (
              <li key={k} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span className="w-6 text-[15px] font-semibold tabular-nums text-fg-muted">{i + 1}</span>
                <Icon size={18} aria-hidden style={{ color: REASON[k].color }} />
                <span className="w-56 text-[15px] font-semibold text-fg">{REASON[k].label}</span>
                {meta && <span className="min-w-0 flex-1 text-[15px] text-fg-muted">{rule(k, meta.rules, meta.verdict_rules)}</span>}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 max-w-prose text-base text-fg" data-testid="reason-order-why">
          Truly weak comes before the payback setting: a machine that draws less play than its spot predicts is weak regardless of its
          payback setting.
        </p>
      </Section>
      <ChapterPart id="model-checks" title="How the models were checked">
        <ModelLab part="evidence" />
      </ChapterPart>
      <Reproduce />
    </Chapter>
  );
}
