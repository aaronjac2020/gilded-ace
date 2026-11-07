export function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-32 animate-pulse bg-surface-2/60" />
      ))}
    </div>
  );
}

export function ErrorNote({ what, error }: { what: string; error: string }) {
  return (
    <p role="alert" className="card p-4 text-sm text-verdict-downtime">
      Could not load {what}: {error}
    </p>
  );
}
