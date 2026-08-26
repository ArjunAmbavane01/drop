"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadGroup } from "@/components/room/files/types";
import { getIceServers } from "@/lib/direct-transfer/ice";
import { DirectPeerConnection } from "@/lib/direct-transfer/peer-connection";
import { sendUploadGroup } from "@/lib/direct-transfer/transfer";
import type {
  DirectClientMessage,
  DirectControlMessage,
  DirectDevice,
  DirectQueueControls,
  DirectServerMessage,
  DirectSignalPayload,
  DirectTransfer,
  ReceivedDirectFile,
} from "@/lib/direct-transfer/types";

type IncomingRequest = { requestId: string; from: DirectDevice };
type PendingConnection = { requestId: string; device: DirectDevice; status: "requesting" | "connecting" | "connected" };

function getDeviceName(userName: string) {
  if (typeof navigator === "undefined") return "This device";
  const platform = navigator.platform || "device";
  return `${userName}'s ${platform} browser`;
}

function getDeviceId() {
  const key = "drop-direct-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing && /^[a-zA-Z0-9_-]{8,96}$/.test(existing)) return existing;
  const next = crypto.randomUUID().replaceAll("-", "");
  window.localStorage.setItem(key, next);
  return next;
}

function isControlMessage(value: unknown): value is DirectControlMessage {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

export function useDirectTransfer(roomId: string, user: { id: string; name: string }) {
  const [device, setDevice] = useState<DirectDevice | null>(() => {
    if (typeof window === "undefined") return null;
    const deviceId = getDeviceId();
    return { deviceId, userId: user.id, name: getDeviceName(user.name) };
  });
  const [devices, setDevices] = useState<DirectDevice[]>([]);
  const [directMode, setDirectMode] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [receivedTransfers, setReceivedTransfers] = useState<DirectTransfer[]>([]);
  const [sentTransfers, setSentTransfers] = useState<DirectTransfer[]>([]);
  const [signalingError, setSignalingError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<DirectPeerConnection | null>(null);
  const transferAbortControllersRef = useRef(new Map<string, AbortController>());
  const transferGroupsRef = useRef(new Map<string, UploadGroup>());
  const transferControlsRef = useRef(new Map<string, DirectQueueControls>());
  const sendQueueRef = useRef(Promise.resolve());
  const acknowledgementWaitersRef = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>());
  const earlyAcknowledgementsRef = useRef(new Set<string>());
  const pendingReceiveRef = useRef<{ transfer: DirectTransfer; files: ReceivedDirectFile[]; current?: { path: string; size: number; type: string; chunks: ArrayBuffer[] } } | null>(null);
  const deviceRef = useRef<DirectDevice | null>(null);
  const pendingConnectionRef = useRef<PendingConnection | null>(null);

  useEffect(() => { deviceRef.current = device; }, [device]);
  useEffect(() => { pendingConnectionRef.current = pendingConnection; }, [pendingConnection]);

  const send = useCallback((message: DirectClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
  }, []);

  const resetPeer = useCallback((reason?: string) => {
    peerRef.current?.close(reason);
    peerRef.current = null;
    for (const [transferId, controller] of transferAbortControllersRef.current) {
      controller.abort();
      transferControlsRef.current.get(transferId)?.fail(reason ?? "The connection closed.");
    }
    transferAbortControllersRef.current.clear();
    for (const waiter of acknowledgementWaitersRef.current.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(reason ?? "The connection closed."));
    }
    acknowledgementWaitersRef.current.clear();
    earlyAcknowledgementsRef.current.clear();
    setSentTransfers((previous) => previous.map((transfer) => transfer.status === "transferring" ? { ...transfer, status: "failed", error: reason ?? "The connection closed." } : transfer));
    setReceivedTransfers((previous) => previous.filter((transfer) => transfer.status !== "transferring"));
    pendingReceiveRef.current = null;
    setPendingConnection(null);
    setDirectMode(false);
  }, []);

  const updateTransfer = useCallback((direction: "sent" | "received", id: string, update: Partial<DirectTransfer>) => {
    const setter = direction === "sent" ? setSentTransfers : setReceivedTransfers;
    setter((previous) => previous.map((transfer) => transfer.id === id ? { ...transfer, ...update } : transfer));
  }, []);

  const handleData = useCallback((data: string | ArrayBuffer) => {
    if (typeof data !== "string") {
      const pending = pendingReceiveRef.current;
      if (!pending?.current) return;
      pending.current.chunks.push(data);
      const transferredBytes = pending.files.reduce((total, file) => total + file.size, 0) + pending.current.chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
      updateTransfer("received", pending.transfer.id, { transferredBytes });
      return;
    }

    let message: unknown;
    try { message = JSON.parse(data); } catch { return; }
    if (!isControlMessage(message)) return;
    const control = message as DirectControlMessage;
    if (control.type === "transfer-acknowledged") {
      const waiter = acknowledgementWaitersRef.current.get(control.transferId);
      if (waiter) {
        clearTimeout(waiter.timeout);
        acknowledgementWaitersRef.current.delete(control.transferId);
        waiter.resolve();
      } else earlyAcknowledgementsRef.current.add(control.transferId);
      return;
    }
    if (control.type === "transfer-failed") {
      const waiter = acknowledgementWaitersRef.current.get(control.transferId);
      if (waiter) {
        clearTimeout(waiter.timeout);
        acknowledgementWaitersRef.current.delete(control.transferId);
        waiter.reject(new Error(control.reason));
      }
      return;
    }
    const pending = pendingReceiveRef.current;

    if (control.type === "transfer-start") {
      const transfer: DirectTransfer = {
        id: control.transferId,
        direction: "received",
        name: control.name,
        type: control.transferType,
        totalBytes: control.totalBytes,
        transferredBytes: 0,
        fileCount: control.fileCount,
        deviceName: pendingConnectionRef.current?.device.name ?? "Connected device",
        createdAt: new Date().toISOString(),
        status: "transferring",
        files: [],
      };
      pendingReceiveRef.current = { transfer, files: [] };
      setReceivedTransfers((previous) => [transfer, ...previous.filter((item) => item.id !== transfer.id)]);
      return;
    }

    if (!pending) return;
    if (control.type === "file-start") {
      pending.current = { path: control.path, size: control.size, type: control.contentType, chunks: [] };
    } else if (control.type === "file-end" && pending.current) {
      const file = pending.current;
      const received: ReceivedDirectFile = { path: file.path, size: file.size, type: file.type, blob: new Blob(file.chunks, { type: file.type }) };
      pending.files.push(received);
      pending.current = undefined;
      updateTransfer("received", pending.transfer.id, { transferredBytes: pending.files.reduce((total, item) => total + item.size, 0), files: [...pending.files] });
    } else if (control.type === "transfer-complete") {
      const receivedBytes = pending.files.reduce((total, file) => total + file.size, 0);
      const isComplete = pending.files.length === pending.transfer.fileCount && receivedBytes === pending.transfer.totalBytes;
      if (!isComplete) {
        try {
          peerRef.current?.send(JSON.stringify({ type: "transfer-failed", transferId: pending.transfer.id, reason: "The received file data was incomplete." } satisfies DirectControlMessage));
        } catch { /* connection is closing */ }
        setReceivedTransfers((previous) => previous.filter((transfer) => transfer.id !== pending.transfer.id));
        pendingReceiveRef.current = null;
        return;
      }
      try {
        peerRef.current?.send(JSON.stringify({ type: "transfer-acknowledged", transferId: pending.transfer.id } satisfies DirectControlMessage));
      } catch {
        setReceivedTransfers((previous) => previous.filter((transfer) => transfer.id !== pending.transfer.id));
        pendingReceiveRef.current = null;
        return;
      }
      updateTransfer("received", pending.transfer.id, { status: "complete", transferredBytes: pending.transfer.totalBytes, files: [...pending.files] });
      pendingReceiveRef.current = null;
    } else if (control.type === "transfer-cancelled") {
      setReceivedTransfers((previous) => previous.filter((transfer) => transfer.id !== pending.transfer.id));
      pendingReceiveRef.current = null;
    }
  }, [updateTransfer]);

  const createPeer = useCallback((initiator: boolean, target: DirectDevice) => {
    peerRef.current?.close("replaced");
    const peer = new DirectPeerConnection({
      initiator,
      iceServers: getIceServers(),
      sendSignal: (payload: DirectSignalPayload) => send({ type: "signal", toDeviceId: target.deviceId, payload }),
      onConnected: () => setPendingConnection((previous) => previous ? { ...previous, status: "connected" } : previous),
      onMessage: handleData,
      onClosed: (reason) => {
        if (peerRef.current === peer) resetPeer(reason);
      },
    });
    peerRef.current = peer;
    return peer;
  }, [handleData, resetPeer, send]);

  const connectTo = useCallback((target: DirectDevice) => {
    const requestId = crypto.randomUUID();
    setDirectMode(true);
    setPendingConnection({ requestId, device: target, status: "requesting" });
    send({ type: "connection-request", requestId, toDeviceId: target.deviceId });
  }, [send]);

  const acceptRequest = useCallback(() => {
    const request = incomingRequest;
    if (!request) return;
    setIncomingRequest(null);
    setDirectMode(true);
    setPendingConnection({ requestId: request.requestId, device: request.from, status: "connecting" });
    send({ type: "connection-response", requestId: request.requestId, toDeviceId: request.from.deviceId, accepted: true });
    createPeer(false, request.from);
  }, [createPeer, incomingRequest, send]);

  const declineRequest = useCallback(() => {
    const request = incomingRequest;
    if (!request) return;
    send({ type: "connection-response", requestId: request.requestId, toDeviceId: request.from.deviceId, accepted: false });
    setIncomingRequest(null);
  }, [incomingRequest, send]);

  const disconnect = useCallback(() => {
    const target = pendingConnection?.device;
    if (target) send({ type: "disconnect", toDeviceId: target.deviceId });
    resetPeer("Disconnected by user.");
  }, [pendingConnection?.device, resetPeer, send]);

  const waitForAcknowledgement = useCallback((transferId: string, signal: AbortSignal) => {
    if (earlyAcknowledgementsRef.current.delete(transferId)) return Promise.resolve();
    if (signal.aborted) return Promise.reject(new DOMException("Transfer cancelled.", "AbortError"));
    return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      acknowledgementWaitersRef.current.delete(transferId);
      reject(new Error("The receiving device did not confirm the transfer."));
    }, 30_000);
    const abort = () => {
      clearTimeout(timeout);
      acknowledgementWaitersRef.current.delete(transferId);
      reject(new DOMException("Transfer cancelled.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    acknowledgementWaitersRef.current.set(transferId, {
      timeout,
      resolve: () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      reject: (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    });
    });
  }, []);

  const handleDirectGroup = useCallback((group: UploadGroup, controls: DirectQueueControls) => {
    if (!peerRef.current) {
      controls.fail("Connect to another device before sending files.");
      return;
    }
    transferGroupsRef.current.set(group.id, group);
    transferControlsRef.current.set(group.id, controls);
    const transfer: DirectTransfer = {
      id: group.id,
      direction: "sent",
      name: group.name,
      type: group.type,
      totalBytes: group.files.reduce((total, item) => total + item.file.size, 0),
      transferredBytes: 0,
      fileCount: group.files.length,
      deviceName: pendingConnectionRef.current?.device.name ?? "Connected device",
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    setSentTransfers((previous) => [transfer, ...previous.filter((item) => item.id !== transfer.id)]);
    const abortController = new AbortController();
    transferAbortControllersRef.current.set(group.id, abortController);
    const run = async () => {
      const peer = peerRef.current;
      if (!peer) throw new Error("The direct connection is no longer available.");
      controls.update({ status: "uploading" });
      updateTransfer("sent", transfer.id, { status: "transferring" });
      await sendUploadGroup(peer, group, (transferredBytes, speedBytesPerSecond) => {
        controls.update({ progress: transfer.totalBytes ? Math.round(transferredBytes / transfer.totalBytes * 100) : 100, uploadedBytes: transferredBytes });
        updateTransfer("sent", transfer.id, { transferredBytes, speedBytesPerSecond });
      }, abortController.signal);
      await waitForAcknowledgement(transfer.id, abortController.signal);
      controls.complete();
      updateTransfer("sent", transfer.id, { status: "complete", transferredBytes: transfer.totalBytes });
    };
    const queuedRun = sendQueueRef.current.then(run, run).catch((error: unknown) => {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      const message = cancelled ? "Cancelled" : error instanceof Error ? error.message : "Direct transfer failed.";
      controls.fail(message);
      updateTransfer("sent", transfer.id, { status: cancelled ? "cancelled" : "failed", error: message });
    }).finally(() => {
      transferAbortControllersRef.current.delete(group.id);
    });
    sendQueueRef.current = queuedRun.then(() => undefined, () => undefined);
  }, [updateTransfer, waitForAcknowledgement]);

  const handleDirectCancel = useCallback((id: string) => {
    transferAbortControllersRef.current.get(id)?.abort();
    updateTransfer("sent", id, { status: "cancelled", error: "Cancelled" });
  }, [updateTransfer]);

  const retrySentTransfer = useCallback((id: string) => {
    const group = transferGroupsRef.current.get(id);
    const controls = transferControlsRef.current.get(id);
    if (group && controls) handleDirectGroup(group, controls);
  }, [handleDirectGroup]);

  useEffect(() => {
    let disposed = false;
    const localDevice = deviceRef.current;
    if (!localDevice) return;
    const deviceId = localDevice.deviceId;
    const localDeviceName = localDevice.name;

    async function connectSignaling() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/direct-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, deviceName: localDeviceName }),
        });
        if (!response.ok) throw new Error("Unable to connect to direct transfer signaling.");
        const session = await response.json() as { url: string; token: string };
        if (disposed) return;
        const socket = new WebSocket(`${session.url}?token=${encodeURIComponent(session.token)}`);
        socketRef.current = socket;
        socket.onmessage = (event) => {
          let message: DirectServerMessage;
          try { message = JSON.parse(event.data) as DirectServerMessage; } catch { return; }
          if (message.type === "ready") {
            setDevice(message.device);
            setSignalingError(null);
          }
          if (message.type === "presence") setDevices(message.devices.filter((item) => item.deviceId !== deviceId));
          if (message.type === "connection-request") setIncomingRequest({ requestId: message.requestId, from: message.from });
          if (message.type === "connection-response") {
            if (!message.accepted) {
              setPendingConnection(null);
              setDirectMode(false);
              setSignalingError(`${message.from.name} declined the connection.`);
            } else {
              const pending = pendingConnectionRef.current;
              if (pending?.requestId === message.requestId) {
                const peer = createPeer(true, message.from);
                void peer.startOffer();
              }
            }
          }
          if (message.type === "signal" && peerRef.current) void peerRef.current.handleSignal(message.payload).catch((error) => setSignalingError(error instanceof Error ? error.message : "Unable to negotiate direct connection."));
          if (message.type === "peer-disconnected") resetPeer("The other device disconnected.");
        };
        socket.onerror = () => setSignalingError("Direct connection signaling is unavailable.");
        socket.onclose = () => { if (!disposed) setDevices([]); };
      } catch (error) {
        if (!disposed) setSignalingError(error instanceof Error ? error.message : "Unable to connect to direct transfer signaling.");
      }
    }
    void connectSignaling();
    return () => {
      disposed = true;
      resetPeer("Room closed.");
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [createPeer, resetPeer, roomId]);

  return {
    device,
    devices,
    directMode,
    pendingConnection,
    incomingRequest,
    receivedTransfers,
    sentTransfers,
    signalingError,
    connectTo,
    acceptRequest,
    declineRequest,
    disconnect,
    setDirectMode,
    handleDirectGroup,
    handleDirectCancel,
    retrySentTransfer,
  };
}
