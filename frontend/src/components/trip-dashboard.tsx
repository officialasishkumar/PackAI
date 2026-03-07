"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { AuthRequiredCard } from "@/components/auth-required-card";
import { getErrorMessage, listTripSummaries } from "@/lib/api";
import { TripSummary, formatTripLocation } from "@/lib/types";

import styles from "./trip-dashboard.module.css";

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function TripDashboard() {
  const { status } = useSession();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setTrips([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTrips() {
      setIsLoading(true);
      try {
        const nextTrips = await listTripSummaries(50);
        if (!cancelled) {
          setTrips(nextTrips);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(getErrorMessage(nextError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTrips();

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <main className={styles.page}>
        <section className={styles.loadingCard}>
          <p className={styles.kicker}>Dashboard</p>
          <h1>Loading your travel history…</h1>
        </section>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className={styles.page}>
        <AuthRequiredCard
          title="Sign in to see your trip history."
          copy="The dashboard groups generated lists by day and approximate location. Nothing here needs to show the source image."
        />
      </main>
    );
  }

  const groupedTrips = groupTripsByDay(trips);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Dashboard</p>
          <h1>Your generated lists, sorted by day and place.</h1>
          <p className={styles.copy}>
            This view keeps the useful context: when the list was created and
            where you chose to share location. The source media stays out of the
            dashboard.
          </p>
        </div>

        <div className={styles.heroStats}>
          <article className={styles.statCard}>
            <span>Total trips</span>
            <strong>{trips.length}</strong>
          </article>
          <article className={styles.statCard}>
            <span>Location shared</span>
            <strong>{trips.filter((trip) => trip.location).length}</strong>
          </article>
        </div>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isLoading ? (
        <section className={styles.loadingCard}>
          <p className={styles.kicker}>Refreshing</p>
          <h2>Pulling your latest trips…</h2>
        </section>
      ) : groupedTrips.length === 0 ? (
        <section className={styles.emptyCard}>
          <p className={styles.kicker}>No trips yet</p>
          <h2>Create your first checklist.</h2>
          <p>Once you generate a trip, it will appear here with its date and optional location.</p>
          <Link href="/">Start a trip</Link>
        </section>
      ) : (
        <section className={styles.timeline}>
          {groupedTrips.map((group) => (
            <article key={group.dayKey} className={styles.dayGroup}>
              <header className={styles.dayHeader}>
                <h2>{group.dayLabel}</h2>
                <span>{group.trips.length} lists</span>
              </header>

              <div className={styles.tripList}>
                {group.trips.map((trip) => (
                  <Link key={trip._id} href={`/trips/${trip._id}`} className={styles.tripCard}>
                    <div className={styles.tripMeta}>
                      <p className={styles.tripTime}>
                        {TIME_FORMATTER.format(new Date(trip.created_at))}
                      </p>
                      <span className={styles.tripStatus}>
                        {trip.status.replace("_", " ")}
                      </span>
                    </div>

                    <strong>{trip.trip_name}</strong>
                    <p className={styles.tripLocation}>
                      {formatTripLocation(trip.location)}
                    </p>
                    <p className={styles.tripCounts}>
                      {trip.item_count} items · {trip.total_units} total units
                    </p>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function groupTripsByDay(trips: TripSummary[]) {
  const groups = new Map<string, TripSummary[]>();

  for (const trip of trips) {
    const dayKey = new Date(trip.created_at).toISOString().slice(0, 10);
    const bucket = groups.get(dayKey);
    if (bucket) {
      bucket.push(trip);
    } else {
      groups.set(dayKey, [trip]);
    }
  }

  return Array.from(groups.entries()).map(([dayKey, dayTrips]) => ({
    dayKey,
    dayLabel: DAY_FORMATTER.format(new Date(dayTrips[0].created_at)),
    trips: dayTrips,
  }));
}
