import { jsonError } from "@/lib/http";
import { env } from "@/lib/env";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";

function encodeBase64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.directSignalingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encodeBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);
    const body = await request.json() as { deviceId?: string; deviceName?: string };
    const deviceId = body.deviceId?.trim();
    const deviceName = body.deviceName?.trim();

    if (!deviceId || !/^[a-zA-Z0-9_-]{8,96}$/.test(deviceId)) {
      return jsonError("Invalid device identifier.", 400);
    }
    if (!deviceName || deviceName.length > 80) return jsonError("Invalid device name.", 400);

    const payload = encodeBase64Url(JSON.stringify({
      roomId,
      userId: session.user.id,
      deviceId,
      name: deviceName,
      exp: Date.now() + 5 * 60 * 1000,
    }));
    const token = `${payload}.${await sign(payload)}`;
    return Response.json({
      token,
      url: `${env.directSignalingUrl.replace(/\/$/, "")}/rooms/${encodeURIComponent(roomId)}`,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to authorize direct transfer.", 401);
  }
}
