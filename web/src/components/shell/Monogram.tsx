/** Original "GA" monogram: geometric G and A strokes inside a rounded card. */
export function Monogram({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" className="fill-maroon stroke-maroon-bright" />
      <path d="M14 11.5h-3.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 2.5 2.5H14v-4.5h-2.5" fill="none" className="stroke-[#E3B36A]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 20.5l3.5-9 3.5 9M18.4 17h4.2" fill="none" className="stroke-[#E3B36A]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
