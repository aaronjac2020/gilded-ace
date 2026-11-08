import { cn } from "../../lib/cn";
import { CardShuffle } from "../theme/PlayingCard";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Screen loading state: nothing for 300ms, then a three-card shuffle. */
export function ScreenSkeleton() {
  return <CardShuffle />;
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
    <div role="alert" className="card m-6 flex items-center justify-between gap-3 p-6 text-sm">
      <span className="text-fg-muted">
        Could not load {what}. <span className="mono text-xs text-fg-subtle">{error}</span>
      </span>
      <Button size="sm" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
