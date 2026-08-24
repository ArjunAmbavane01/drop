import React from "react";
import {
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  FileText as GenericFile,
} from "lucide-react";
import { Golang } from "../ui/svgs/golang";
import { MicrosoftExcel } from "../ui/svgs/microsoftExcel";
import { MicrosoftWord } from "../ui/svgs/microsoftWord";
import { Rust } from "../ui/svgs/rust";
import { Powershell } from "../ui/svgs/powershell";
import { Javascript } from "../ui/svgs/javascript";
import { Typescript } from "../ui/svgs/typescript";
import { ReactLight } from "../ui/svgs/reactLight";
import { Html5 } from "../ui/svgs/html5";
import { Python } from "../ui/svgs/python";
import { Pdf } from "../ui/svgs/pdf";
import { Bash } from "../ui/svgs/bash";
import { useTheme } from "next-themes";
import { SvgWordmark } from "../ui/svgs/svgWordmark";
import { ReactDark } from "../ui/svgs/reactDark";
import { BashDark } from "../ui/svgs/bashDark";
import { Json } from "../ui/svgs/json";
import { Mdx } from "../ui/svgs/markdown";
import { MdxDark } from "../ui/svgs/markdownDark";
import { Css } from "../ui/svgs/css";
import { Sass } from "../ui/svgs/sass";

type FileIcon =
  | React.ComponentType<React.SVGProps<SVGSVGElement>>
  | {
    light: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    dark: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  };

// Centralized mapping from file extension to an SVG component or placeholder
export const FileIconMap: Record<string, FileIcon> = {
  // Documents
  txt: FileText,
  pdf: Pdf,
  docx: MicrosoftWord,
  csv: MicrosoftExcel,
  xlsx: MicrosoftExcel,
  md: {
    light: Mdx,
    dark: MdxDark
  },

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
  js: Javascript,
  ts: Typescript,
  jsx: {
    light: ReactLight,
    dark: ReactDark
  },
  tsx: {
    light: ReactLight,
    dark: ReactDark
  },
  html: Html5,
  css: Css,
  scss: Sass,
  json: Json,
  svg: SvgWordmark,
  py: Python,
  go: Golang,
  rs: Rust,
  ps1: Powershell,
  sh: {
    light: Bash,
    dark: BashDark
  },
  bash: {
    light: Bash,
    dark: BashDark
  },
};


export function FileIcon({
  fileName,
  className,
}: {
  fileName: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const icon = FileIconMap[ext];

  if (!icon) {
    return <GenericFile className={className} />;
  }

  const IconComponent =
    icon && "light" in icon
      ? icon[resolvedTheme === "dark" ? "dark" : "light"]
      : icon;

  return <IconComponent className={className} />;
}
