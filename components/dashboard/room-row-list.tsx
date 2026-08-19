"use client";

import { LayoutGroup, motion } from "motion/react";
import { ReactNode } from "react";

interface RoomRowListProps {
  title: string;
  count?: number;
  children: ReactNode;
  emptyState?: string;
  groupId: string;
}

export function RoomRowList({
  title,
  count,
  children,
  emptyState,
  groupId,
}: RoomRowListProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">
        {title}
        {count !== undefined && ` (${count})`}
      </h3>

      {!children ? (
        <p className="text-sm text-muted-foreground p-3 italic">
          {emptyState || "No rooms yet."}
        </p>
      ) : (
        <LayoutGroup id={groupId}>
          <motion.div layout className="space-y-0">
            {children}
          </motion.div>
        </LayoutGroup>
      )}
    </section>
  );
}