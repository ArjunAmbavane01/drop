import type { RoomFile } from "@/types/rooms";

export type UploadGroup = {
  id: string;
  name: string;
  type: "file" | "folder";
  files: {
    file: File;
    relativePath: string;
  }[];
};

export type UploadState = {
  id: string;
  name: string;
  type: "file" | "folder";
  status: "uploading" | "complete" | "error";
  progress: number;
  totalBytes: number;
  uploadedBytes: number;
  error?: string;
  activeRequests: XMLHttpRequest[];
  abortControllers?: AbortController[];
  group: UploadGroup;
};

export interface TreeNode {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  file?: RoomFile;
  children: Record<string, TreeNode>;
}

export type FolderItem = {
  type: "folder";
  uploadId: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
  uploader: RoomFile["uploader"];
  files: RoomFile[];
};

export type FileItem = {
  type: "file";
  file: RoomFile;
};

export type TopLevelItem = FolderItem | FileItem;
