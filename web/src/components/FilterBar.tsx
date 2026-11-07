import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { load, rows, type Columnar } from "../lib/data";
import { useFilters } from "../lib/urlState";

type Floor = { banks: Columnar; zones: Columnar };

export function FilterBar() {
  const [f, set] = useFilters();
  const [floor, setFloor] = useState<Floor | null>(null);
  useEffect(() => {
    load<Floor>("floor.json").then(setFloor);
  }, []);
  const zones = useMemo(() => (floor ? rows<{ zone_id: string; name: string }>(floor.zones) : []), [floor]);
  const banks = useMemo(
    () => (floor ? rows<{ bank_id: string; zone_id: string }>(floor.banks).filter((b) => !f.zone || b.zone_id === f.zone) : []),
    [floor, f.zone],
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Zone" className="select" value={f.zone ?? ""} onChange={(e) => set({ zone: e.target.value || null, bank: null })}>
        <option value="">All zones</option>
        {zones.map((z) => (
          <option key={z.zone_id} value={z.zone_id}>
            {z.name}
          </option>
        ))}
      </select>
      <select aria-label="Bank" className="select" value={f.bank ?? ""} onChange={(e) => set({ bank: e.target.value || null })}>
        <option value="">All banks</option>
        {banks.map((b) => (
          <option key={b.bank_id} value={b.bank_id}>
            {b.bank_id}
          </option>
        ))}
      </select>
      {(f.zone || f.bank) && (
        <div className="flex items-center gap-1">
          {f.zone && <Pill label={`Zone ${f.zone}`} onClear={() => set({ zone: null, bank: null })} />}
          {f.bank && <Pill label={`Bank ${f.bank}`} onClear={() => set({ bank: null })} />}
          <button type="button" className="btn-ghost" onClick={() => set({ zone: null, bank: null })}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-xs text-gold-soft" data-filter-pill>
      {label}
      <button type="button" aria-label={`Clear ${label}`} onClick={onClear} className="focus-ring rounded-full">
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}
