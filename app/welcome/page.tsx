import { redirect } from "next/navigation";

import { WelcomeScreen } from "@/components/welcome/welcome-screen";
import { getCurrentSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  return <WelcomeScreen userName={session.user.name} />;
}
