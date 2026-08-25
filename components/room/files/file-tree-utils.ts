import type { RoomFile } from "@/types/rooms";
import type { FolderItem, TopLevelItem, TreeNode, UploadGroup } from "./types";

export function getFilePath(file: File): string {
  return file.webkitRelativePath || file.name;
}

type AsyncGroupingOptions = {
  initialGroupId?: string;
  exclusionMatcher?: (path: string) => boolean;
  onGroupsDiscovered: (groups: UploadGroup[]) => void;
  onGroupsUpdated: (groups: UploadGroup[]) => void;
};

function yieldToMainThread() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Groups a large picker result in small chunks so React can paint and handle
 * input between chunks. The first group can reuse an already-visible queue id.
 */
export async function groupFilesForUploadAsync(
  fileList: File[] | FileList,
  options: AsyncGroupingOptions,
): Promise<UploadGroup[]> {
  const groups = new Map<string, UploadGroup>();
  const initialFilePath = fileList[0] ? getFilePath(fileList[0]) : "";
  const initialRoot = initialFilePath.includes("/")
    ? initialFilePath.substring(0, initialFilePath.indexOf("/"))
    : initialFilePath;
  const discoveredGroups: UploadGroup[] = [];
  const updatedGroups = new Set<UploadGroup>();

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const relPath = getFilePath(file);
    const firstSlash = relPath.indexOf("/");
    let group: UploadGroup;
    let isNewGroup = false;

    if (firstSlash !== -1) {
      const rootFolder = relPath.substring(0, firstSlash);
      group = groups.get(rootFolder) as UploadGroup;
      if (!group) {
        isNewGroup = true;
        group = {
          id: rootFolder === initialRoot && options.initialGroupId
            ? options.initialGroupId
            : crypto.randomUUID(),
          name: rootFolder,
          type: "folder",
          fileCount: 0,
          totalBytes: 0,
          files: [],
        };
        groups.set(rootFolder, group);
      }
      const relativePath = relPath.substring(firstSlash + 1);
      if (options.exclusionMatcher?.(relativePath)) {
        group.skippedCount = (group.skippedCount ?? 0) + 1;
      } else {
        group.files.push({ file, relativePath });
        group.fileCount = (group.fileCount ?? 0) + 1;
        group.totalBytes = (group.totalBytes ?? 0) + file.size;
      }
    } else {
      isNewGroup = true;
      group = {
        id: i === 0 && options.initialGroupId ? options.initialGroupId : crypto.randomUUID(),
        name: file.name,
        type: "file",
        fileCount: 1,
        totalBytes: file.size,
        files: [{ file, relativePath: file.name }],
      };
      groups.set(`${i}:${file.name}`, group);
    }

    updatedGroups.add(group);

    if (isNewGroup) {
      discoveredGroups.push({ ...group, files: [...group.files] });
    }

    if ((i + 1) % 500 === 0) {
      if (discoveredGroups.length > 0) {
        options.onGroupsDiscovered(discoveredGroups.splice(0));
      }
      options.onGroupsUpdated(Array.from(updatedGroups));
      updatedGroups.clear();
      await yieldToMainThread();
    }
  }

  if (discoveredGroups.length > 0) {
    options.onGroupsDiscovered(discoveredGroups);
  }
  if (updatedGroups.size > 0) {
    options.onGroupsUpdated(Array.from(updatedGroups));
  }
  const grouped = Array.from(groups.values());
  return grouped;
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
