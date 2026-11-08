import * as DM from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Check, ChevronDown, Command as CommandIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { cn, MOD } from "../../lib/cn";
import { commandStore } from "../../lib/uiStore";
import { useFilters } from "../../lib/urlState";
import { Monogram } from "./Monogram";
import { NAV, navFor, nextFor, PERIOD_MENU } from "./nav";
import { Lead } from "../ui/more";

const red = (card: string) => /[♥♦]/.test(card);

/** Chapter stepper: card-index tabs across the top. Carries period/zone/bank between chapters. */
export function Stepper() {
  const { pathname, search } = useLocation();
  const keep = new URLSearchParams(search);
  keep.delete("machine");
  keep.delete("focus");
  const qs = keep.toString();
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-bg/95 backdrop-blur-sm" data-testid="stepper">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-6 px-6">
        <Link
          to={{ pathname: "/", search: qs }}
          className="focus-ring flex shrink-0 items-center gap-2.5 rounded-md"
          aria-label="The Gilded Ace, home"
        >
          <Monogram size={30} />
          <span className="display hidden text-[17px] text-fg min-[1600px]:inline">The Gilded Ace</span>
        </Link>
        <nav aria-label="Chapters" className="flex min-w-0 flex-1 items-stretch justify-center gap-1">
          {NAV.map((n) => {
            const on = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={{ pathname: n.to, search: qs }}
                aria-current={on ? "page" : undefined}
                data-chapter={n.to}
                className={cn(
                  "focus-ring group flex h-12 shrink-0 items-center gap-2 rounded-[10px] border px-2.5 transition-[background-color,border-color,transform] duration-hover ease-out",
                  on
                    ? "border-maroon/40 bg-surface-1 shadow-card"
                    : "border-transparent hover:-translate-y-0.5 hover:border-divider hover:bg-surface-1/60",
                )}
              >
                <span
                  className={cn(
                    "serif flex h-9 w-[26px] shrink-0 items-center justify-center rounded-[5px] border text-[15px] font-semibold leading-none",
                    on ? "border-maroon/30 bg-card" : "border-divider bg-card/70",
                    red(n.card) ? "text-suit-red" : "text-ink",
                  )}
                  aria-hidden
                >
                  {n.card.slice(0, -1)}
                  <span className="sr-only">{n.card}</span>
                </span>
                <span className={cn("whitespace-nowrap text-[15px] font-semibold", on ? "text-fg" : "text-fg-muted group-hover:text-fg")}>
                  {n.n && <span className={cn("mr-1.5 tabular-nums", on ? "text-maroon" : "text-fg-subtle")}>{n.n}</span>}
                  {n.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => commandStore.set(true)}
          className="focus-ring hidden h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-fg-muted ring-1 ring-inset ring-ring hover:text-fg hover:ring-ring-strong lg:flex"
          aria-label="Search chapters, machines and claims"
          data-testid="open-command"
        >
          <CommandIcon size={15} aria-hidden /> <span>Search</span>
          <kbd className="text-[13px] text-fg-muted">{MOD}K</kbd>
        </button>
      </div>
    </header>
  );
}

/** "Showing Jan–Jun 2025 ▾" — the only period control (chapters 1-4). */
export function PeriodMenu() {
  const [f, set] = useFilters();
  const label = PERIOD_MENU.find(([k]) => k === f.period)?.[1] ?? f.period;
  const item =
    "flex h-9 cursor-default select-none items-center gap-2 rounded-sm px-3 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg";
  return (
    <DM.Root>
      <DM.Trigger
        className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-surface-1 px-3.5 text-sm text-fg-muted shadow-card ring-1 ring-inset ring-ring hover:text-fg hover:ring-ring-strong"
        data-testid="period-menu"
      >
        Showing <span className="font-semibold text-fg">{label}</span>
        <ChevronDown size={15} aria-hidden />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="float z-50 min-w-56 p-1 data-[state=open]:animate-fade-up">
          {PERIOD_MENU.map(([k, l], i) => (
            <div key={k}>
              {i === 3 && <DM.Separator className="my-1 h-px bg-divider" />}
              <DM.Item className={item} onSelect={() => set({ period: k })} data-period={k}>
                <span className="w-4">{f.period === k && <Check size={14} aria-hidden />}</span>
                {l}
                {k === "train" && <span className="ml-auto text-[13px] text-fg-subtle">model built</span>}
                {k === "test" && <span className="ml-auto text-[13px] text-fg-subtle">model checked</span>}
              </DM.Item>
            </div>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

/** Active bank/zone filter: "Showing bank B-01 ✕". */
export function FilterPill() {
  const [f, set] = useFilters();
  const items = [f.bank && (["bank", f.bank] as const), f.zone && (["zone", f.zone] as const)].filter(Boolean) as (readonly [
    "bank" | "zone",
    string,
  ])[];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="filter-pill">
      {items.map(([k, v]) => (
        <button
          key={k}
          type="button"
          onClick={() => set({ [k]: null })}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-full bg-maroon px-3.5 text-sm font-semibold text-card shadow-card hover:bg-maroon-bright"
          aria-label={`Clear ${k} filter ${v}`}
        >
          Showing {k} <span className="font-mono text-[13px]">{v}</span>
          <X size={14} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Eyebrow ("Chapter 3 · The floor · Jan–Jun 2025") → headline → sentence, with the period menu on chapters 1-4. */
export function ChapterHeader({
  eyebrow,
  title,
  sentence,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  sentence?: ReactNode;
  children?: ReactNode;
}) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const n = navFor(pathname);
  const period = params.get("period") ?? "full";
  const per = PERIOD_MENU.find(([k]) => k === period)?.[1] ?? period;
  const auto = n ? [n.n ? `Chapter ${n.n}` : null, n.label, n.period ? per : null].filter(Boolean).join(" · ") : "";
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-[820px]">
          <p className="chapter-eyebrow">{eyebrow ?? auto}</p>
          <h1 className="display mt-3 text-[48px] leading-[1.05] text-fg" data-copy="headline" data-testid="assertion-title">
            {title}
          </h1>
          {sentence && (
            <Lead className="mt-4 max-w-[680px] text-lg text-fg-muted" data-copy="sentence">
              {sentence}
            </Lead>
          )}
        </div>
        {n?.period && (
          <div className="flex flex-col items-end gap-3 pt-1">
            <PeriodMenu />
            <FilterPill />
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

/**
 * Every chapter's skeleton: eyebrow → headline → sentence → dominant visual → sections → Next.
 * Without `title`, the first embedded screen supplies the header (see ChapterPart in ui/hero-band).
 * `data-copy` marks what scripts/copy-budget.mjs counts.
 */
export function Chapter({
  eyebrow,
  title,
  sentence,
  visual,
  children,
  testId,
}: {
  eyebrow?: string;
  title?: ReactNode;
  sentence?: ReactNode;
  visual?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  const { pathname } = useLocation();
  return (
    <article className="mx-auto max-w-content px-6 pb-24 pt-10" data-testid={testId} data-chapter-page={pathname}>
      {title && <ChapterHeader eyebrow={eyebrow} title={title} sentence={sentence} />}
      {visual && <div className="mt-8">{visual}</div>}
      {children}
      <NextChapter />
    </article>
  );
}

/** Section heading block: title (≤6 words) + "Answers Q2" tag + one sentence (≤15 words). */
export function SectionHeader({
  id,
  title,
  answers,
  sentence,
  aside,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  answers?: string;
  sentence?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header id={id} className={cn("mt-24 scroll-mt-28", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[760px]">
          <h2 className="display flex flex-wrap items-baseline gap-x-3 text-[28px] leading-tight text-fg">
            <span data-copy="section-title">{title}</span>
            {answers && <span className="answers-tag">Answers {answers}</span>}
          </h2>
          {sentence && (
            <Lead className="mt-2 text-base text-fg-muted" data-copy="section-sentence">
              {sentence}
            </Lead>
          )}
        </div>
        {aside}
      </div>
      {children && <div className="mt-8">{children}</div>}
    </header>
  );
}

export function Section({
  id,
  title,
  answers,
  sentence,
  children,
  aside,
  className,
}: {
  id?: string;
  title: ReactNode;
  answers?: string;
  sentence?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mt-24 scroll-mt-28", className)} aria-label={typeof title === "string" ? title : undefined}>
      <SectionHeader className="mb-8 mt-0" title={title} answers={answers} sentence={sentence} aside={aside} />
      {children}
    </section>
  );
}

export function NextChapter() {
  const { pathname, search } = useLocation();
  const n = nextFor(pathname);
  if (!n) return null;
  const keep = new URLSearchParams(search);
  keep.delete("machine");
  keep.delete("focus");
  return (
    <div className="mt-24 flex justify-end border-t border-divider pt-10">
      <Link
        to={{ pathname: n.to, search: keep.toString() }}
        className="focus-ring group inline-flex h-14 items-center gap-3 rounded-[10px] bg-surface-1 px-6 shadow-card ring-1 ring-inset ring-ring transition-transform duration-hover hover:-translate-y-1"
        data-testid="next-chapter"
      >
        <span className={cn("serif text-xl font-semibold", red(n.card) ? "text-suit-red" : "text-ink")} aria-hidden>
          {n.card}
        </span>
        <span className="text-base font-semibold text-fg">Next: {n.label}</span>
        <ArrowRight size={18} className="text-maroon transition-transform duration-hover group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}

/** One line tying a context chapter (floor, guests) back to the manager's cut list. */
export function Bridge({ children }: { children: ReactNode }) {
  return (
    <p className="mt-12 max-w-[760px] border-l-2 border-maroon pl-4 text-[17px] text-fg" data-testid="bridge">
      {children}
    </p>
  );
}
