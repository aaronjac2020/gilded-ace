import * as T from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

export const Tabs = T.Root;
export const TabsContent = T.Content;

/** Linear-style underline tabs, 13px. */
export function TabsList({ tabs, className }: { tabs: { value: string; label: string }[]; className?: string }) {
  return (
    <T.List className={cn("flex gap-4 border-b border-divider", className)}>
      {tabs.map((t) => (
        <T.Trigger
          key={t.value}
          value={t.value}
          className="focus-ring -mb-px h-8 border-b border-transparent text-sm text-fg-muted transition-colors duration-hover hover:text-fg data-[state=active]:border-gold data-[state=active]:text-fg"
        >
          {t.label}
        </T.Trigger>
      ))}
    </T.List>
  );
}
