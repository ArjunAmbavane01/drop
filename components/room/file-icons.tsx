import React from "react";
import {
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  Code,
  FileCode2,
  FileSpreadsheet,
  FileText as GenericFile,
} from "lucide-react";

// Centralized mapping from file extension (lowercase, no dot) to an SVG component or placeholder
export const FileIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Documents
  txt: FileText,
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  csv: FileSpreadsheet,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  md: FileText,
  
  // Archives
  zip: FileArchive,
  rar: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  
  // Media
  mp3: FileAudio,
  wav: FileAudio,
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  
  // Code files
  js: Code,
  ts: Code,
  jsx: Code,
  tsx: Code,
  html: Code,
  css: Code,
  json: FileCode2,
  py: Code,
  go: Code,
  rs: Code,
  sh: Code,
};

export function getFileIcon(fileName: string, className?: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const IconComponent = FileIconMap[ext] || GenericFile;
  return <IconComponent className={className} />;
}
