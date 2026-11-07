import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { filterQuery, type Filters } from "../lib/urlState";

/** Deep link to the chart (focus anchor) + filter state that backs a claim. */
export function EvidenceLink({
  to,
  focus,
  filters = {},
  label = "See evidence",
}: {
  to: string;
  focus?: string;
  filters?: Partial<Filters> & { machine?: string };
  label?: string;
}) {
  const href = `${to}${filterQuery({ ...filters, focus })}`;
  return (
    <Link to={href} className="focus-ring inline-flex items-center gap-0.5 text-xs font-medium text-gold-soft hover:text-gold" data-evidence={focus}>
      {label}
      <ArrowUpRight size={12} aria-hidden />
    </Link>
  );
}
