"use client";

import { Copy, Trash2 } from "lucide-react";
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
  return (
    <div className="flex flex-col h-full min-h-[400px] flex-1">
      {/* Small Toolbar at the top */}
      <div className="flex items-center justify-between border-b border-border py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Autosave enabled
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Large editor area */}
      <div className="flex-1 pt-4 pb-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type or paste anything here to sync with the room..."
          className="w-full h-full min-h-[350px] md:min-h-[480px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}
