export type DirectDevice = {
  deviceId: string;
  userId: string;
  name: string;
};

export type DirectTransferStatus =
  | "queued"
  | "transferring"
  | "complete"
  | "failed"
  | "cancelled";

export type DirectTransferDirection = "received" | "sent";

export type ReceivedDirectFile = {
  path: string;
  size: number;
  type: string;
  blob: Blob;
};

export type DirectTransfer = {
  id: string;
  direction: DirectTransferDirection;
  name: string;
  type: "file" | "folder";
  totalBytes: number;
  transferredBytes: number;
  fileCount: number;
  deviceName: string;
  createdAt: string;
  status: DirectTransferStatus;
  error?: string;
  speedBytesPerSecond?: number;
  files?: ReceivedDirectFile[];
};

export type DirectQueueControls = {
  update: (update: { status?: "preparing" | "uploading" | "complete" | "error"; progress?: number; uploadedBytes?: number; error?: string }) => void;
  complete: () => void;
  fail: (error: string) => void;
};

export type DirectSignalPayload =
  | { kind: "offer"; description: RTCSessionDescriptionInit }
  | { kind: "answer"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export type DirectServerMessage =
  | { type: "ready"; device: DirectDevice }
  | { type: "presence"; devices: DirectDevice[] }
  | { type: "connection-request"; requestId: string; from: DirectDevice }
  | { type: "connection-response"; requestId: string; accepted: boolean; from: DirectDevice }
  | { type: "signal"; fromDeviceId: string; payload: DirectSignalPayload }
  | { type: "peer-disconnected"; deviceId: string };

export type DirectClientMessage =
  | { type: "hello"; device: DirectDevice }
  | { type: "connection-request"; requestId: string; toDeviceId: string }
  | { type: "connection-response"; requestId: string; toDeviceId: string; accepted: boolean }
  | { type: "signal"; toDeviceId: string; payload: DirectSignalPayload }
  | { type: "disconnect"; toDeviceId: string };

export type DirectControlMessage =
  | {
    type: "transfer-start";
    transferId: string;
    name: string;
    transferType: "file" | "folder";
    fileCount: number;
    totalBytes: number;
  }
  | {
    type: "file-start";
    path: string;
    size: number;
    contentType: string;
  }
  | { type: "file-end" }
  | { type: "transfer-complete" }
  | { type: "transfer-cancelled"; reason?: string };
