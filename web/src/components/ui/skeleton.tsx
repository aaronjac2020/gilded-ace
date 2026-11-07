import { cn } from "../../lib/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Layout-shaped placeholder for a screen: hero band + first row of tiles. Same heights as the real thing. */
export function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="px-6 pt-10 md:px-10">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-11 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-8 flex gap-10">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-10 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-12 grid grid-cols-12 gap-6">
        <Skeleton className="col-span-12 h-80 lg:col-span-8" />
        <Skeleton className="col-span-12 h-80 lg:col-span-4" />
      </div>
    </div>
  );
}

export function EmptyState({ text, onClear }: { text: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-fg-muted">{text}</p>
      {onClear && (
        <Button size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ what, error }: { what: string; error: string }) {
  return (
    <div role="alert" className="card m-6 flex items-center justify-between gap-3 p-5 text-sm">
      <span className="text-fg-muted">
        Could not load {what}. <span className="mono text-xs text-fg-subtle">{error}</span>
      </span>
      <Button size="sm" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
