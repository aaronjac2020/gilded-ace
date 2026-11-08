import { EvidenceLink } from "../components/EvidenceLink";
import { DecoRule } from "../components/theme/Deco";
import { HeroBand } from "../components/ui/hero-band";
import { ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { useJson } from "../lib/useData";

type Claim = {
  id: string;
  title: string;
  claim: string;
  source: string;
  result: string;
  alternative: string;
  limitation: string;
  link: string;
};
type Claims = { claims: Claim[]; approved: string };

/** Verdict rules (pipeline/verdicts.py ORDER): first match wins. */
const RULES: [string, string][] = [
  ["Inspect hold", "Hold below the configured setting, same direction in both halves of the period, survives 10% false discovery rate."],
  ["Downtime", "Availability in the bottom decile and lost theo at least half the gap to the zone median."],
  ["Location", "Machine effect interval includes 1 and the spot's expected play is in the bottom quartile."],
  ["Luck", "House win at least 1.64 standard errors below theo, while theo per available hour is not in the bottom decile."],
  ["Truly weak", "Shrunk machine effect: upper 90% bound below 1 (draws less play than its spot and game predict)."],
  ["OK", "None of the above."],
];

function Evidence({ href }: { href: string }) {
  const [to, qs = ""] = href.split("?");
  const { focus, ...filters } = Object.fromEntries(new URLSearchParams(qs));
  return <EvidenceLink to={to} focus={focus} filters={filters} label="See it on the dashboard" />;
}

export default function Methodology() {
  const { data, error } = useJson<Claims>("claims.json");
  if (error) return <ErrorState what="claims" error={error} />;
  if (!data) return <ScreenSkeleton />;
  const [lead, ...rest] = data.claims;

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow="Methodology · claims appendix"
        title={`${data.claims.length} claims, each with its query, the alternative we tested and its limit`}
        sub="Synthetic data for the fictional Gilded Ace casino, Jan–Jun 2025. Rankings are fit on Jan–Apr and scored on May–Jun; nothing here describes a real property."
      />

      <section id={`claim-${lead.id}`} className="mt-16 scroll-mt-20" aria-label="Main claim">
        <Tile hero label="Claim 01 · the main finding" title={lead.title} footer={<Evidence href={lead.link} />}>
          <blockquote
            className="max-w-4xl border-l-2 border-gold pl-6 font-display text-xl leading-snug text-fg"
            data-testid="approved-claim"
          >
            {data.approved}
          </blockquote>
          <ClaimFacts c={lead} open />
        </Tile>
      </section>

      <DecoRule className="my-14" />

      <div className="grid grid-cols-12 items-start gap-8">
        <details id="decision-order" className="card col-span-12 scroll-mt-20 px-6 py-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-fg">
            Pipeline verdict order, used by claims 05 and 06 (first match wins)
          </summary>
          <ol className="mt-4 grid gap-x-10 gap-y-3 text-sm md:grid-cols-2">
            {RULES.map(([k, d], i) => (
              <li key={k} className="grid grid-cols-[24px_1fr] gap-2">
                <span className="mono text-gold-soft">{i + 1}</span>
                <span>
                  <span className="font-medium text-fg">{k}.</span> <span className="text-fg-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-fg-muted">
            Floor-wide verdicts from the pipeline. The story&rsquo;s reasons add the payback setting and check truly weak first; see{" "}
            <a href="#method" className="text-maroon hover:underline">
              how each machine gets one reason
            </a>
            .
          </p>
          <p className="mt-4 text-xs text-fg-subtle">
            Machine effect = coin-in per available hour ÷ what the spot and game predict, shrunk toward 1 by its bootstrap error. Intervals
            are 90%, from 2,000 bootstrap resamples.
          </p>
        </details>
        <div className="col-span-12 grid grid-cols-1 gap-8 lg:grid-cols-2" data-testid="claims">
          {rest.map((c, i) => (
            <section key={c.id} id={`claim-${c.id}`} className="scroll-mt-20">
              <Tile
                className="h-full"
                label={`Claim ${String(i + 2).padStart(2, "0")}`}
                title={c.title}
                footer={<Evidence href={c.link} />}
              >
                <p className="text-sm text-fg">{c.claim}</p>
                {c.id === "verdict-mix" && (
                  <p className="mt-3 text-sm text-fg-muted" data-testid="verdict-mix-note">
                    These are pipeline verdicts, where spot and luck are checked before truly weak. The story checks truly weak first, so
                    Chapter 1 counts 3 of the manager&rsquo;s 10 as truly weak, all milder than our 10 weakest.
                  </p>
                )}
                <ClaimFacts c={c} />
              </Tile>
            </section>
          ))}
        </div>
      </div>
      <p className="mt-10 max-w-prose text-xs text-fg-subtle">
        Same list as docs/claims_appendix.md, generated by pipeline/claims.py from the pipeline outputs.
      </p>
    </div>
  );
}

/** Pipeline counts arrive as a Python dict ("{'truly_weak': 60}"); show them as words. */
const readable = (s: string) =>
  s.replace(/\{([^{}]*)\}/g, (_, body: string) =>
    body.replace(/'(\w+)': (\d+)/g, (_m, k: string, n: string) => `${k.replace("_hold", "").replace("_", " ")} ${n}`),
  );

/** Result always shows; on the smaller cards the alternative, limitation and query fold behind one disclosure. */
function ClaimFacts({ c, open = false }: { c: Claim; open?: boolean }) {
  const rows: [string, string][] = [
    ["Result", readable(c.result)],
    ["Alternative tested", c.alternative],
    ["Limitation", c.limitation],
    ["Source", c.source],
  ];
  if (!open)
    return (
      <dl className="mt-6 max-w-[720px] space-y-3 text-[15px]">
        <div>
          <dt className="eyebrow">Result</dt>
          <dd className="mt-1 text-fg">{rows[0][1]}</dd>
        </div>
        <details>
          <summary className="eyebrow cursor-pointer">Alternative tested, limitation, query</summary>
          <div className="mt-2 space-y-3">
            {rows.slice(1).map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className={k === "Source" ? "mono mt-1 text-[13px] text-fg-muted" : "mt-1 text-fg"}>{v}</dd>
              </div>
            ))}
          </div>
        </details>
      </dl>
    );
  return (
    <dl className="mt-6 max-w-[720px] space-y-3 text-[15px]">
      {rows.map(([k, v]) =>
        k === "Source" ? (
          <div key={k}>
            <details>
              <summary className="eyebrow cursor-pointer">Source query</summary>
              <p className="mono mt-1 text-[13px] text-fg-muted">{v}</p>
            </details>
          </div>
        ) : (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 text-fg">{v}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
