"use client";

import { Textarea } from "@/components/ui/textarea";

export function QuickTextPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Writing surface with subtle border and comfortable padding */}
      <div className="flex-1 flex flex-col rounded-xl border border-border/70 bg-card/30 dark:bg-card/15 p-4 sm:p-5 focus-within:border-foreground/25 focus-within:ring-1 focus-within:ring-foreground/10 transition-all min-h-105 md:min-h-125">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Start typing or paste something here…"
          className="w-full h-full flex-1 resize-none border-0 bg-transparent p-0 text-sm sm:text-base leading-relaxed text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/45"
        />
      </div>
    </div>
  );
}
