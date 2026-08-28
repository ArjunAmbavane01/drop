import { File } from "lucide-react";

export function EmptyFiles() {
  return (
    <div className="space-y-2 rounded-xl border border-border/50 border-dashed py-12 text-center flex flex-col items-center justify-center">
      <File className="size-7 text-muted-foreground" />
      <p className="font-medium text-muted-foreground">No files in this room yet</p>
      <p className="text-sm text-muted-foreground/50">Uploaded files appear here for everyone</p>
    </div>
  );
}
