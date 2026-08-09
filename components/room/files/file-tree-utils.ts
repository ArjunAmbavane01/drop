import type { RoomFile } from "@/types/rooms";
import type { FolderItem, TopLevelItem, TreeNode, UploadGroup } from "./types";

export function getFilePath(file: File): string {
  const relativePath = "webkitRelativePath" in file ? (file.webkitRelativePath as string) : "";
  return relativePath || file.name;
}

export function groupFilesForUpload(fileList: File[]): UploadGroup[] {
  const groups: Record<string, UploadGroup> = {};
  const result: UploadGroup[] = [];

  for (const file of fileList) {
    const relPath = getFilePath(file);

    if (relPath && relPath.includes("/")) {
      const parts = relPath.split("/");
      const rootFolder = parts[0];
      const subPath = parts.slice(1).join("/");

      if (!groups[rootFolder]) {
        groups[rootFolder] = {
          id: crypto.randomUUID(),
          name: rootFolder,
          type: "folder",
          files: [],
        };
      }
      groups[rootFolder].files.push({
        file,
        relativePath: subPath,
      });
    } else {
      result.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: "file",
        files: [{ file, relativePath: file.name }],
      });
    }
  }

  for (const rootFolder in groups) {
    result.push(groups[rootFolder]);
  }

  return result;
}

export function groupFilesAndFolders(files: RoomFile[]): TopLevelItem[] {
  const foldersMap: Record<string, FolderItem> = {};
  const items: TopLevelItem[] = [];

  for (const file of files) {
    if (file.uploadId) {
      if (!foldersMap[file.uploadId]) {
        foldersMap[file.uploadId] = {
          type: "folder",
          uploadId: file.uploadId,
          name: file.uploadName || "Untitled Folder",
          sizeBytes: 0,
          uploadedAt: file.uploadedAt,
          uploader: file.uploader,
          files: [],
        };
      }
      const folder = foldersMap[file.uploadId];
      folder.files.push(file);
      folder.sizeBytes += file.sizeBytes;
      if (new Date(file.uploadedAt) > new Date(folder.uploadedAt)) {
        folder.uploadedAt = file.uploadedAt;
      }
    } else {
      items.push({
        type: "file",
        file,
      });
    }
  }

  for (const uploadId in foldersMap) {
    items.push(foldersMap[uploadId]);
  }

  items.sort((a, b) => {
    const timeA = new Date(a.type === "folder" ? a.uploadedAt : a.file.uploadedAt).getTime();
    const timeB = new Date(b.type === "folder" ? b.uploadedAt : b.file.uploadedAt).getTime();
    return timeB - timeA;
  });

  return items;
}

export function buildTree(folderFiles: RoomFile[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const file of folderFiles) {
    const parts = file.fileName.split("/");
    let currentLevel = root;
    let accumulatedPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          relativePath: accumulatedPath,
          type: isLast ? "file" : "directory",
          children: {},
          file: isLast ? file : undefined,
        };
      }
      currentLevel = currentLevel[part].children;
    }
  }

  return root;
}
