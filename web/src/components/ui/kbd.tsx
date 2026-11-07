import { cn } from "../../lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-surface-2 px-1 font-mono text-2xs text-fg-muted ring-1 ring-inset ring-ring",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </span>
  );
}
