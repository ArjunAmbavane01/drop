"use client";

import { MAX_TEXT_LENGTH } from "@/lib/constants";

export function QuickTextPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const remaining = MAX_TEXT_LENGTH - value.length;
  const nearLimit = remaining < 5_000;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    if (next.length > MAX_TEXT_LENGTH) {
      onChange(next.slice(0, MAX_TEXT_LENGTH));
    } else {
      onChange(next);
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      {/* Writing surface with subtle border and comfortable padding */}
      <div className="flex-1 flex flex-col rounded-xl border border-border/70 bg-card/30 dark:bg-card/15 focus-within:border-foreground/25 focus-within:ring-1 focus-within:ring-foreground/10 transition-all h-[60vh] sm:h-[68vh] md:h-[75vh] max-h-[calc(100vh-180px)] min-h-[300px] sm:min-h-[480px] overflow-hidden">
        <textarea
          value={value}
          onChange={handleChange}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="Start typing or paste something here…"
          className="w-full h-full flex-1 resize-none border-0 bg-transparent p-4 sm:p-5 text-sm sm:text-base leading-relaxed text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/45 overflow-y-auto [field-sizing:normal] outline-none"
        />
        {nearLimit && (
          <p className={`text-right text-[10px] px-3 pb-1.5 select-none ${remaining <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {remaining <= 0 ? "Limit reached" : `${remaining.toLocaleString()} characters remaining`}
          </p>
        )}
      </div>
    </div>
  );
}

