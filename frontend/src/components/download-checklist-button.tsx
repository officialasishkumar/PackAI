"use client";

import { useState } from "react";

import { getErrorMessage, getTrip } from "@/lib/api";
import { downloadTripChecklistImage } from "@/lib/checklist-image";
import { Trip } from "@/lib/types";

import styles from "./download-checklist-button.module.css";

export function DownloadChecklistButton({
  trip,
  tripId,
  label = "Save image",
  className,
}: Readonly<{
  trip?: Trip;
  tripId?: string;
  label?: string;
  className?: string;
}>) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const resolvedTrip = trip ?? (tripId ? await getTrip(tripId) : null);
      if (!resolvedTrip) {
        throw new Error("Trip data is unavailable for image export.");
      }

      await downloadTripChecklistImage(resolvedTrip);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={className}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? "Saving image..." : label}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
