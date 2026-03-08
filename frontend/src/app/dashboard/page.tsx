import { getServerSession } from "next-auth";

import { DashboardAccessGate } from "@/components/dashboard-access-gate";
import { TripDashboard } from "@/components/trip-dashboard";
import { authOptions } from "@/lib/auth-options";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <DashboardAccessGate />;
  }

  return <TripDashboard />;
}
