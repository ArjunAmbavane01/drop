import { redirect } from "next/navigation";

import { RoomDashboard } from "@/components/room/room-dashboard";
import { getCurrentSession } from "@/server/auth/session";
import { getRoomSnapshot } from "@/server/rooms/queries";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const session = await getCurrentSession();

  if (!session) redirect("/sign-in");

  const { roomId } = await params;
  const snapshot = await getRoomSnapshot(roomId, session.user.id);

  return (
    <RoomDashboard
      key={roomId}
      initialSnapshot={snapshot}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
    />
  );
}
