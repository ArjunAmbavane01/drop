"use client";

import { useState } from "react";
import { Copy, Eraser, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QuickTextPanel({
  value,
  onChange,
  onCopy,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col flex-1 h-full gap-3">
      {/* Top action bar without harsh dividers */}
      <div className="flex items-center justify-end gap-2 px-0.5">
        <Button
          variant="secondary"
          size="xs"
          onClick={handleCopy}
          className="gap-1.5 text-xs font-medium cursor-pointer"
          title="Copy text to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 font-medium transition-colors cursor-pointer"
          title="Clear text"
        >
          <Eraser className="h-3.5 w-3.5" />
          <span>Clear</span>
        </Button>
      </div>

      {/* Writing surface with subtle border and comfortable padding */}
      <div className="flex-1 flex flex-col rounded-xl border border-border/70 bg-card/30 dark:bg-card/15 p-4 sm:p-5 focus-within:border-foreground/25 focus-within:ring-1 focus-within:ring-foreground/10 transition-all min-h-[420px] md:min-h-[500px]">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type or paste anything here to sync with the room in real-time..."
          className="w-full h-full flex-1 resize-none border-0 bg-transparent p-0 text-sm sm:text-base leading-relaxed text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/45"
        />
      </div>
    </div>
  );
}
