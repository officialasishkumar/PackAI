import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { TripDashboard } from "@/components/trip-dashboard";
import { authOptions } from "@/lib/auth-options";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return <TripDashboard />;
}
