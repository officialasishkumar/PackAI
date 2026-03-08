"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { DownloadChecklistButton } from "@/components/download-checklist-button";
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
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const groupedTrips = groupTripsByDay(trips);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHeader}>
          <p className={styles.kicker}>Dashboard</p>
          <h1>Saved checklists.</h1>
          <p className={styles.copy}>
            Open a trip, scan the essentials, or export the checklist as an image.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/" className={styles.createLink}>
            New trip
          </Link>
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
          <h2>Loading your checklists…</h2>
        </section>
      ) : groupedTrips.length === 0 ? (
        <section className={styles.emptyCard}>
          <p className={styles.kicker}>Nothing here yet</p>
          <h2>Create your first checklist.</h2>
          <p>Your saved trips will show up here once you create one.</p>
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
                  <article key={trip._id} className={styles.tripCard}>
                    <div className={styles.tripMeta}>
                      <div>
                        <p className={styles.tripTime}>
                          {TIME_FORMATTER.format(new Date(trip.created_at))}
                        </p>
                        <strong>{trip.trip_name}</strong>
                      </div>
                      <span className={styles.tripStatus}>
                        {trip.status.replace("_", " ")}
                      </span>
                    </div>

                    <p className={styles.tripLocation}>
                      {formatTripLocation(trip.location)}
                    </p>

                    <div className={styles.previewList}>
                      {(trip.preview_items ?? []).map((item) => (
                        <div key={item.item_id} className={styles.previewRow}>
                          <span className={styles.previewCheck} />
                          <span className={styles.previewLabel}>
                            {item.name}
                            <small>Qty {item.quantity}</small>
                          </span>
                        </div>
                      ))}
                      {trip.item_count > (trip.preview_items?.length ?? 0) ? (
                        <p className={styles.moreItems}>
                          +{trip.item_count - (trip.preview_items?.length ?? 0)} more items
                        </p>
                      ) : null}
                    </div>

                    <p className={styles.tripCounts}>
                      {trip.item_count} items · {trip.total_units} total units
                    </p>

                    <div className={styles.tripActions}>
                      <Link href={`/trips/${trip._id}`} className={styles.openLink}>
                        Open checklist
                      </Link>
                      <DownloadChecklistButton tripId={trip._id} label="Save image" />
                    </div>
                  </article>
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
