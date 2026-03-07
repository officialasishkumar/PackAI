"use client";

import { useParams } from "next/navigation";

import { TripWorkspace } from "@/components/trip-workspace";

export default function TripPage() {
  const params = useParams<{ id: string }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");

  return <TripWorkspace tripId={tripId} />;
}
