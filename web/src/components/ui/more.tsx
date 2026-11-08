import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const ABBR = /(?:\bvs|\be\.g|\bi\.e|\bapprox|\bNo|\bSt|\bCh)\.$/;

/** Index just past the first sentence end in `s`, or -1. Abbreviations and decimals don't count. */
function firstEnd(s: string): number {
  const re = /[.!?](?=\s+[A-Z0-9$(“"])/g;
  for (let m = re.exec(s); m; m = re.exec(s)) if (!ABBR.test(s.slice(0, m.index + 1))) return m.index + 1;
  return -1;
}

/** Children with fragments flattened, so a `<>…</>` sentence splits like plain children. */
function flat(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((n) =>
    isValidElement(n) && n.type === Fragment ? flat((n as ReactElement<{ children?: ReactNode }>).props.children) : [n],
  );
}

/** Split prose content after its first sentence; only plain-text children are cut, elements stay whole. */
export function splitFirst(children: ReactNode): [ReactNode[], ReactNode[]] {
  const nodes = flat(children);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n !== "string") continue;
    // A sentence can also end at the edge of a text node, before an interpolated value.
    const edge = /[.!?]\s+$/.test(n) && i < nodes.length - 1 && !ABBR.test(n.trimEnd()) ? n.trimEnd().length : -1;
    const at = firstEnd(n) >= 0 ? firstEnd(n) : edge;
    if (at < 0) continue;
    const tail = n.slice(at).trim();
    const rest = [...(tail ? [tail] : []), ...nodes.slice(i + 1)];
    if (!rest.some((r) => (typeof r === "string" ? r.trim() : true))) break;
    return [[...nodes.slice(0, i), n.slice(0, at)], rest];
  }
  return [nodes, []];
}

/** The rest of a paragraph, folded behind "Show the evidence". */
export function Evidence({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <details className={cn("mt-2 text-sm text-fg-muted", className)}>
      <summary className="w-fit cursor-pointer text-sm font-medium text-maroon hover:underline">Show the evidence</summary>
      <div className="mt-2 max-w-prose space-y-2">{children}</div>
    </details>
  );
}

/** A paragraph cut to its first sentence; the rest sits behind "Show the evidence". */
export function Lead({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  "data-copy"?: string;
  "data-testid"?: string;
}) {
  const [first, more] = splitFirst(children);
  return (
    <>
      <p className={className} {...rest}>
        {first}
      </p>
      {more.length > 0 && (
        <Evidence>
          <p>{more}</p>
        </Evidence>
      )}
    </>
  );
}
