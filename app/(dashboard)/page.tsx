import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { getRoomsForUser } from "@/server/rooms/queries";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) redirect("/sign-in");

  const { myRooms, joinedRooms } = await getRoomsForUser(session.user.id);

  return (
    <DashboardScreen
      initialMyRooms={myRooms}
      initialJoinedRooms={joinedRooms}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
    />
  );
}
