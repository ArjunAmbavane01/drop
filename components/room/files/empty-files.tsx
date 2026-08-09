import { File } from "lucide-react";

export function EmptyFiles() {
  return (
    <div className="rounded-xl border border-border/50 border-dashed py-12 text-center flex flex-col items-center justify-center">
      <File className="h-7 w-7 text-muted-foreground/30 mb-2" />
      <p className="text-xs font-medium text-muted-foreground">No files in this room yet</p>
      <p className="text-[11px] text-muted-foreground/50 mt-0.5">Uploaded files appear here for everyone</p>
    </div>
  );
}
