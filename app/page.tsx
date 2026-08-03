import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/session";
import { getInitialRoomForUser } from "@/server/rooms/queries";
import { HomeShell } from "@/components/home/home-shell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    return <HomeShell />;
  }

  const initialRoom = await getInitialRoomForUser(session.user.id);

  if (initialRoom) {
    redirect(`/rooms/${initialRoom.id}`);
  }

  redirect("/welcome");
}
