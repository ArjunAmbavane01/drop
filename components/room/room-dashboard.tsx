"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Eraser } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  leaveRoomAction,
  clearRoomAction,
  saveTextAction,
  registerPublicKeyAction,
  getMissingWrapsAction,
  uploadWrappedKeysAction,
} from "@/server/rooms/actions";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useRoomEvents } from "@/hooks/use-room-events";
import type { RoomEvent, RoomMember, RoomSnapshot } from "@/types/rooms";
import { FilesPanel } from "@/components/room/files-panel";
import { QuickTextPanel } from "@/components/room/quick-text-panel";
import { RoomHeader } from "@/components/room/room-header";
import { ensureDeviceKeyRegistered, syncMissingFileKeys } from "@/lib/e2ee";
import { useDirectTransfer } from "@/hooks/use-direct-transfer";
import { DirectConnectDialog, IncomingDirectRequestDialog } from "@/components/room/files/direct-transfer-dialogs";
import { Spinner } from "../ui/spinner";

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
  const [isDirectDialogOpen, setIsDirectDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const isOwner = snapshot.room.ownerId === currentUser.id;
  const directTransfer = useDirectTransfer(snapshot.room.id, currentUser);

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
          if (snapshot.files.length > 0) {
            void syncMissingFileKeys(snapshot.room.id, getMissingWrapsAction, uploadWrappedKeysAction);
          }
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
  }, [snapshot.room.id, snapshot.files.length]);

  useRoomEvents(snapshot.room.id, snapshot.lastEventId, handleEvent, setOnlineUserIds);

  useEffect(() => {
    async function initE2ee() {
      try {
        await ensureDeviceKeyRegistered(registerPublicKeyAction);
        if (snapshot.files.length > 0) {
          await syncMissingFileKeys(snapshot.room.id, getMissingWrapsAction, uploadWrappedKeysAction);
        }
      } catch (err) {
        console.error("Failed to initialize E2EE keys:", err);
      }
    }
    void initE2ee();
  }, [snapshot.room.id, snapshot.files.length]);

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
    setIsClearing(true);

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
      toast.error(
        error instanceof Error ? error.message : "Unable to clear the room."
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-background flex flex-col justify-stretch">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:py-8 justify-start min-h-0">
        <RoomHeader
          room={snapshot.room}
          members={snapshot.members}
          isOwner={isOwner}
          onLeave={handleLeaveRoom}
          onClearRoom={handleClearSession}
          isClearing={isClearing}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
        />

        <div className="flex flex-col flex-1 gap-2 min-h-0">
          {/* Action level / row containing Tabs and contextual actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("text")}
                className={`relative px-3 py-1 text-sm uppercase cursor-pointer ${activeTab === "text"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors duration-300"
                  }`}
              >
                {activeTab === "text" && (
                  <motion.span
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-md border border-foreground/60"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Text</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("files")}
                className={`relative px-2.5 py-1 text-sm uppercase cursor-pointer ${activeTab === "files"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors duration-300"
                  }`}
              >
                {activeTab === "files" && (
                  <motion.span
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded border border-foreground/60"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Files</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Contextual actions for Text tab */}
              {activeTab === "text" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyText}
                    title="Copy text to clipboard"
                  >
                    {copied ? (
                      <Check className="text-emerald-500" />
                    ) : (
                      <Copy />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearText}
                    className="hover:text-destructive hover:bg-destructive/10"
                    title="Clear text"
                  >
                    <Eraser />
                    <span>Clear text</span>
                  </Button>
                </>
              )}

              {
                activeTab !== "text" && (directTransfer.pendingConnection?.status === "connected" ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <Tooltip>
                      <TooltipTrigger render={<span className="flex min-w-0 max-w-56 items-center gap-2 text-sm font-medium text-foreground sm:max-w-76" />}>
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" />
                        <span className="truncate">{directTransfer.pendingConnection.device.name}</span>
                      </TooltipTrigger>
                      <TooltipContent>{directTransfer.pendingConnection.device.name}</TooltipContent>
                    </Tooltip>
                    <Button variant="ghost" size="sm" onClick={directTransfer.disconnect} className="text-destructive bg-destructive/10 hover:bg-destructive/30 hover:text-destructive">
                      Disconnect
                    </Button>
                  </div>
                ) : directTransfer.pendingConnection ? (
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-0 max-w-64 items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-3.5 shrink-0" />
                      <span className="truncate">
                        Connecting to {directTransfer.pendingConnection.device.name}
                      </span>
                    </div>
                    <Button variant="destructive" size="sm" onClick={directTransfer.disconnect}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setIsDirectDialogOpen(true)}>
                    <span className="size-1.5 rounded-full bg-emerald-600" /> Direct connect
                  </Button>
                )
                )
              }
            </div>
          </div>

          {/* Panel display */}
          <div className="flex-1 flex flex-col justify-stretch pt-2 min-h-0">
            <div className={activeTab === "text" ? "flex-1 flex flex-col min-h-0" : "hidden flex-1 flex-col min-h-0"}>
              <QuickTextPanel
                value={textValue}
                onChange={handleTextChange}
              />
            </div>
            <div className={activeTab === "files" ? "flex-1 flex flex-col min-h-0" : "hidden flex-1 flex-col min-h-0"}>
              <FilesPanel
                roomId={snapshot.room.id}
                files={snapshot.files}
                directMode={directTransfer.directMode}
                directConnection={directTransfer.pendingConnection}
                onDirectGroup={directTransfer.handleDirectGroup}
                onDirectCancel={directTransfer.handleDirectCancel}
                onRetrySentTransfer={directTransfer.retrySentTransfer}
                receivedTransfers={directTransfer.receivedTransfers}
                sentTransfers={directTransfer.sentTransfers}
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
            </div>
          </div>
        </div>
      </div>
      <IncomingDirectRequestDialog
        request={directTransfer.incomingRequest}
        onAccept={directTransfer.acceptRequest}
        onDecline={directTransfer.declineRequest}
      />
      <DirectConnectDialog
        open={isDirectDialogOpen}
        devices={directTransfer.devices}
        error={directTransfer.signalingError}
        onOpenChange={setIsDirectDialogOpen}
        onConnect={directTransfer.connectTo}
      />
    </main>
  );
}
