"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface ElasticStackItem {
  id: string | number;
  image?: string;
  name?: string;
  isOnline?: boolean;
}

export interface ElasticStackProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ElasticStackItem[];
  itemSize?: number;
  overlap?: number;
  pushForce?: number;
}

export function ElasticStack({
  items,
  itemSize = 28,
  overlap = 8,
  pushForce = 6,
  className,
  ...props
}: ElasticStackProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn("flex items-center justify-center cursor-pointer py-1 select-none", className)}
      onMouseLeave={() => setHoveredIndex(null)}
      {...props}
    >
      {items.map((item, i) => {
        let translateX = 0;
        let scale = 1;
        const isHovered = hoveredIndex === i;

        if (hoveredIndex !== null) {
          if (i > hoveredIndex) {
            translateX = Math.min(pushForce * (i - hoveredIndex), overlap * 1.5);
          } else if (i < hoveredIndex) {
            translateX = -Math.min(pushForce * (hoveredIndex - i), overlap * 1.5);
          } else {
            scale = 1.25;
          }
        }

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <div
                  onMouseEnter={() => setHoveredIndex(i)}
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-transform duration-300 ease-out bg-neutral-100 dark:bg-neutral-800",
                    "border-2 border-background shadow-xs",
                    isHovered ? "shadow-md" : "",
                    item.isOnline ? "opacity-100" : "grayscale opacity-60"
                  )}
                  style={{
                    width: itemSize,
                    height: itemSize,
                    marginLeft: i === 0 ? 0 : -overlap,
                    transform: `translateX(${translateX}px) scale(${scale})`,
                    zIndex: isHovered ? 40 : i + 1,
                  }}
                >
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name || `Avatar ${i}`}
                      className="w-full h-full object-cover rounded-full pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full flex items-center justify-center font-semibold text-[10px] text-neutral-500 dark:text-neutral-400 pointer-events-none">
                      {item.name ? item.name.charAt(0).toUpperCase() : i + 1}
                    </div>
                  )}
                </div>
              }
            />
            <TooltipContent className="text-xs">
              {item.name || `User ${item.id}`} {item.isOnline ? "(Online)" : "(Offline)"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default ElasticStack;
