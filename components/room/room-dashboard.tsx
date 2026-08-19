"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Eraser } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  leaveRoomAction,
  clearRoomAction,
  saveTextAction,
} from "@/server/rooms/actions";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useRoomEvents } from "@/hooks/use-room-events";
import type { RoomEvent, RoomMember, RoomSnapshot } from "@/types/rooms";
import { FilesPanel } from "@/components/room/files-panel";
import { QuickTextPanel } from "@/components/room/quick-text-panel";
import { RoomHeader } from "@/components/room/room-header";

export function RoomDashboard({
  initialSnapshot,
  currentUser,
}: {
  initialSnapshot: RoomSnapshot;
  currentUser: RoomMember;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [textValue, setTextValue] = useState(initialSnapshot.text.value);
  const [activeTab, setActiveTab] = useState<"text" | "files">("text");
  const [copied, setCopied] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const isOwner = snapshot.room.ownerId === currentUser.id;

  const textValueRef = useRef(initialSnapshot.text.value);
  const saveSequenceRef = useRef(0);
  const lastAckedSaveRef = useRef(0);
  const lastRemoteTextRef = useRef(initialSnapshot.text.value);
  const localRevisionRef = useRef(0);
  const remoteRevisionRef = useRef(0);



  const persistText = useDebouncedCallback(async (nextText: string, revision: number) => {
    const saveId = ++saveSequenceRef.current;

    try {
      await saveTextAction(snapshot.room.id, { text: nextText });

      if (saveId > lastAckedSaveRef.current) lastAckedSaveRef.current = saveId;

      if (revision >= remoteRevisionRef.current) {
        remoteRevisionRef.current = revision;
        lastRemoteTextRef.current = nextText;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save text.");
    }
  }, 500);

  const handleEvent = useCallback((event: RoomEvent) => {
    setSnapshot((previous) => {
      switch (event.type) {
        case "text.updated": {
          const incomingValue = event.payload.value;
          const localValue = textValueRef.current;
          const localChangedSinceRemote = localValue !== lastRemoteTextRef.current;

          lastRemoteTextRef.current = incomingValue;

          if (!localChangedSinceRemote || incomingValue === localValue) {
            remoteRevisionRef.current = localRevisionRef.current;
            textValueRef.current = incomingValue;
            setTextValue(incomingValue);
          }

          return { ...previous, text: event.payload };
        }
        case "file.created":
          return previous.files.some((file) => file.id === event.payload.file.id)
            ? previous
            : { ...previous, files: [event.payload.file, ...previous.files] };
        case "file.renamed":
          return {
            ...previous,
            files: previous.files.map((file) =>
              file.id === event.payload.fileId ? { ...file, fileName: event.payload.fileName } : file,
            ),
          };
        case "file.deleted":
          return {
            ...previous,
            files: previous.files.filter((file) => file.id !== event.payload.fileId),
          };
        case "folder.renamed":
          return {
            ...previous,
            files: previous.files.map((file) =>
              file.uploadId === event.payload.uploadId
                ? { ...file, uploadName: event.payload.name }
                : file,
            ),
          };
        case "folder.deleted":
          return {
            ...previous,
            files: previous.files.filter((file) => file.uploadId !== event.payload.uploadId),
          };

        case "room.cleared":
          remoteRevisionRef.current = localRevisionRef.current;
          lastRemoteTextRef.current = "";
          textValueRef.current = "";
          setTextValue("");
          return {
            ...previous,
            text: {
              ...previous.text,
              value: "",
            },
            files: [],
          };
        case "member.joined":
          return previous.members.some((member) => member.id === event.payload.member.id)
            ? previous
            : { ...previous, members: [...previous.members, event.payload.member] };
        case "member.left":
          return {
            ...previous,
            members: previous.members.filter((member) => member.id !== event.payload.member.id),
          };
        default:
          return previous;
      }
    });
  }, []);

  useRoomEvents(snapshot.room.id, handleEvent, setOnlineUserIds);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === "1" || event.code === "Digit1" || event.code === "Numpad1")
      ) {
        event.preventDefault();
        setActiveTab("text");
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === "2" || event.code === "Digit2" || event.code === "Numpad2")
      ) {
        event.preventDefault();
        setActiveTab("files");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleTextChange(nextValue: string) {
    textValueRef.current = nextValue;
    setTextValue(nextValue);
    localRevisionRef.current += 1;
    persistText(nextValue, localRevisionRef.current);
  }

  async function handleCopyText() {
    await navigator.clipboard.writeText(textValueRef.current);
    setCopied(true);
    toast.success("Text copied.");
    setTimeout(() => setCopied(false), 1800);
  }

  function handleClearText() {
    handleTextChange("");
  }

  async function handleLeaveRoom() {
    try {
      await leaveRoomAction(snapshot.room.id);
      toast.success("You left the room.");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to leave room.");
    }
  }

  async function handleClearSession() {
    try {
      await clearRoomAction(snapshot.room.id);
      remoteRevisionRef.current = localRevisionRef.current;
      lastRemoteTextRef.current = "";
      textValueRef.current = "";
      setTextValue("");
      setSnapshot((previous) => ({
        ...previous,
        text: { ...previous.text, value: "" },
        files: [],
      }));
      toast.success("Room cleared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear the room.");
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col justify-stretch">
      <div className="mx-auto flex w-full max-w-3xl flex-col flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:py-8 justify-start">
        <RoomHeader
          room={snapshot.room}
          members={snapshot.members}
          isOwner={isOwner}
          onLeave={handleLeaveRoom}
          onClearRoom={handleClearSession}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
        />

        <div className="flex flex-col flex-1 mt-3 sm:mt-4">
          {/* Action level / row containing Tabs and contextual actions */}
          <div className="flex items-center justify-between pb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => setActiveTab("text")}
                className={`text-xs font-semibold uppercase transition-colors relative pb-1.5 cursor-pointer ${
                  activeTab === "text"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Text
                {activeTab === "text" && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("files")}
                className={`text-xs font-semibold uppercase transition-colors relative pb-1.5 cursor-pointer ${
                  activeTab === "files"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Files
                {activeTab === "files" && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            </div>

            {/* Contextual actions for Text tab */}
            {activeTab === "text" && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={handleCopyText}
                  className="gap-1.5 text-xs font-medium cursor-pointer"
                  title="Copy text to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleClearText}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 font-medium transition-colors cursor-pointer"
                  title="Clear text"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  <span>Clear text</span>
                </Button>
              </div>
            )}
          </div>

          {/* Panel display */}
          <div className="flex-1 flex flex-col justify-stretch pt-2 min-h-0">
            <AnimatePresence mode="wait">
              {activeTab === "text" ? (
                <motion.div
                  key="text-tab"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeInOut" }}
                  className="flex-1 flex flex-col"
                >
                  <QuickTextPanel
                    value={textValue}
                    onChange={handleTextChange}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="files-tab"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeInOut" }}
                  className="flex-1 flex flex-col"
                >
                  <FilesPanel
                    roomId={snapshot.room.id}
                    files={snapshot.files}
                    onFilesRefresh={(files) =>
                      setSnapshot((previous) => ({
                        ...previous,
                        files,
                      }))
                    }
                    onFileRename={(fileId, fileName) =>
                      setSnapshot((previous) => ({
                        ...previous,
                        files: previous.files.map((file) =>
                          file.id === fileId ? { ...file, fileName } : file,
                        ),
                      }))
                    }
                    onFileDelete={(fileId) =>
                      setSnapshot((previous) => ({
                        ...previous,
                        files: previous.files.filter((file) => file.id !== fileId),
                      }))
                    }
                    onFolderRename={(uploadId, name) =>
                      setSnapshot((previous) => ({
                        ...previous,
                        files: previous.files.map((file) =>
                          file.uploadId === uploadId ? { ...file, uploadName: name } : file,
                        ),
                      }))
                    }
                    onFolderDelete={(uploadId) =>
                      setSnapshot((previous) => ({
                        ...previous,
                        files: previous.files.filter((file) => file.uploadId !== uploadId),
                      }))
                    }
                    onBulkDelete={(deletedFileIds, deletedFolderIds) => {
                      const fileIdSet = new Set(deletedFileIds);
                      const folderIdSet = new Set(deletedFolderIds);
                      setSnapshot((previous) => ({
                        ...previous,
                        files: previous.files.filter(
                          (file) =>
                            !fileIdSet.has(file.id) &&
                            (!file.uploadId || !folderIdSet.has(file.uploadId))
                        ),
                      }));
                    }}
                    onRestoreFiles={(restoredFiles) => {
                      setSnapshot((previous) => ({
                        ...previous,
                        files: restoredFiles,
                      }));
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
