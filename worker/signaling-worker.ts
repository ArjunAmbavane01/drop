type WorkerEnv = {
  DIRECT_SIGNALING_SECRET: string;
  DIRECT_ROOMS: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } };
};

type DirectIdentity = { roomId: string; userId: string; deviceId: string; name: string; exp: number };
type SocketLike = {
  accept(): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0)));
}

async function verifyToken(token: string, secret: string): Promise<DirectIdentity | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = Uint8Array.from(atob(signature.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((signature.length + 3) % 4)), (char) => char.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    const identity = JSON.parse(decodeBase64Url(payload)) as DirectIdentity;
    return identity.exp > Date.now() ? identity : null;
  } catch {
    return null;
  }
}

export class DirectRoom {
  private readonly state: { acceptWebSocket(socket: SocketLike): void };
  private readonly peers = new Map<string, { socket: SocketLike; userId: string; name: string }>();

  constructor(state: { acceptWebSocket(socket: SocketLike): void }) {
    this.state = state;
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const pair = new (globalThis as unknown as { WebSocketPair: new () => { 0: SocketLike; 1: SocketLike } }).WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const identity: DirectIdentity = {
      roomId: request.headers.get("X-Direct-Room") ?? "",
      userId: request.headers.get("X-Direct-User") ?? "",
      deviceId: request.headers.get("X-Direct-Device") ?? "",
      name: request.headers.get("X-Direct-Name") ?? "Device",
      exp: 0,
    };
    this.state.acceptWebSocket(server);
    const existing = this.peers.get(identity.deviceId);
    if (existing) existing.socket.close(1000, "Reconnected");
    this.peers.set(identity.deviceId, { socket: server, userId: identity.userId, name: identity.name });
    server.addEventListener("message", (event) => this.handleMessage(identity, server, event.data));
    server.addEventListener("close", () => this.remove(identity.deviceId, server));
    this.broadcastPresence();
    server.send(JSON.stringify({ type: "ready", device: { deviceId: identity.deviceId, userId: identity.userId, name: identity.name } }));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: SocketLike });
  }

  private handleMessage(identity: DirectIdentity, socket: SocketLike, raw: unknown) {
    if (typeof raw !== "string" || raw.length > 64 * 1024) return;
    let message: { type?: string; toDeviceId?: string; requestId?: string; accepted?: boolean; payload?: unknown };
    try { message = JSON.parse(raw); } catch { return; }
    const targetId = typeof message.toDeviceId === "string" ? message.toDeviceId : undefined;
    const target = targetId ? this.peers.get(targetId) : undefined;

    if (message.type === "connection-request" && target && typeof message.requestId === "string") {
      target.socket.send(JSON.stringify({ type: "connection-request", requestId: message.requestId, from: { deviceId: identity.deviceId, userId: identity.userId, name: identity.name } }));
    } else if (message.type === "connection-response" && target && typeof message.requestId === "string" && typeof message.accepted === "boolean") {
      target.socket.send(JSON.stringify({ type: "connection-response", requestId: message.requestId, accepted: message.accepted, from: { deviceId: identity.deviceId, userId: identity.userId, name: identity.name } }));
    } else if (message.type === "signal" && target && message.payload) {
      target.socket.send(JSON.stringify({ type: "signal", fromDeviceId: identity.deviceId, payload: message.payload }));
    } else if (message.type === "disconnect" && target) {
      target.socket.send(JSON.stringify({ type: "peer-disconnected", deviceId: identity.deviceId }));
    }
    void socket;
  }

  private remove(deviceId: string, socket?: SocketLike) {
    const current = this.peers.get(deviceId);
    if (!current || (socket && current.socket !== socket)) return;
    this.peers.delete(deviceId);
    for (const peer of this.peers.values()) {
      try { peer.socket.send(JSON.stringify({ type: "peer-disconnected", deviceId })); } catch { /* socket is closing */ }
    }
    this.broadcastPresence();
  }

  private broadcastPresence() {
    const devices = Array.from(this.peers.entries()).map(([deviceId, peer]) => ({ deviceId, userId: peer.userId, name: peer.name }));
    const message = JSON.stringify({ type: "presence", devices });
    for (const peer of this.peers.values()) {
      try { peer.socket.send(message); } catch { /* socket is closing */ }
    }
  }
}

const worker = {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Not found", { status: 404 });
    const token = url.searchParams.get("token");
    const identity = token ? await verifyToken(token, env.DIRECT_SIGNALING_SECRET) : null;
    const roomId = url.pathname.match(/^\/rooms\/([^/]+)$/)?.[1];
    if (!identity || !roomId || identity.roomId !== roomId) return new Response("Unauthorized", { status: 401 });
    const id = env.DIRECT_ROOMS.idFromName(roomId);
    const headers = new Headers(request.headers);
    headers.set("X-Direct-Room", identity.roomId);
    headers.set("X-Direct-User", identity.userId);
    headers.set("X-Direct-Device", identity.deviceId);
    headers.set("X-Direct-Name", identity.name);
    return env.DIRECT_ROOMS.get(id).fetch(new Request(request, { headers }));
  },
};

export default worker;
