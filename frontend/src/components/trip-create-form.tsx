"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { createTrip, getErrorMessage } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { cacheTrip } from "@/lib/offline-cache";
import { prepareMedia } from "@/lib/media";

import styles from "./trip-create-form.module.css";

interface SelectedMedia {
  file: File;
  previewUrl: string;
  note: string;
}

const TRUST_POINTS = [
  {
    title: "Deletion-first",
    copy: "Raw uploads are discarded after analysis by default, so storage growth stays predictable.",
  },
  {
    title: "Low-bandwidth aware",
    copy: "Images are compressed on-device before upload to keep mobile capture snappy.",
  },
  {
    title: "Offline-ready",
    copy: "Your checklist remains available from local cache after the first successful load.",
  },
];

export function TripCreateForm() {
  const router = useRouter();
  const [isRedirecting, startRedirect] = useTransition();
  const [tripName, setTripName] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (selectedMedia) {
        URL.revokeObjectURL(selectedMedia.previewUrl);
      }
    };
  }, [selectedMedia]);

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setIsPreparing(true);

    try {
      const prepared = await prepareMedia(file);
      setSelectedMedia((current) => {
        if (current) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          file: prepared.file,
          previewUrl: URL.createObjectURL(prepared.file),
          note: prepared.note,
        };
      });
    } catch (nextError) {
      setSelectedMedia((current) => {
        if (current) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return null;
      });
      setError(getErrorMessage(nextError));
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tripName.trim()) {
      setError("Trip name is required.");
      return;
    }

    if (!selectedMedia) {
      setError("Choose a luggage photo or short MP4 before creating a trip.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trip = await createTrip({
        tripName: tripName.trim(),
        media: selectedMedia.file,
        userId: getOrCreateDeviceId(),
      });

      cacheTrip(trip);
      startRedirect(() => {
        router.push(`/trips/${trip._id}`);
      });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isPreparing || isSubmitting || isRedirecting;
  const isVideo = selectedMedia?.file.type === "video/mp4";

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <p className={styles.kicker}>Create a trip</p>
          <span className={styles.privacyPill}>Privacy-first upload flow</span>
        </div>
        <h2>Upload once, repack with confidence later.</h2>
        <p className={styles.copy}>
          PackAI reads a luggage photo or short MP4, turns visible items into
          a categorized checklist, and keeps the trip cached for offline viewing
          without keeping every raw capture around forever.
        </p>
      </div>

      <label className={styles.field}>
        <span>Trip name</span>
        <input
          name="trip_name"
          placeholder="GSoC Summit 2026"
          value={tripName}
          onChange={(event) => setTripName(event.target.value)}
          maxLength={80}
          required
        />
      </label>

      <label className={styles.uploader}>
        <input
          type="file"
          accept="image/jpeg,image/png,video/mp4"
          capture="environment"
          onChange={handleMediaChange}
          disabled={isBusy}
        />
        <span className={styles.uploaderLabel}>Choose luggage photo or video</span>
        <span className={styles.uploaderHint}>
          JPEG, PNG, or MP4 up to 15 seconds. Images are compressed client-side.
        </span>
      </label>

      <div className={styles.preview}>
        {selectedMedia ? (
          isVideo ? (
            <video
              className={styles.previewMedia}
              src={selectedMedia.previewUrl}
              controls
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.previewMedia}
              src={selectedMedia.previewUrl}
              alt="Selected luggage media preview"
            />
          )
        ) : (
          <div className={styles.previewEmpty}>
            <span className={styles.previewBadge}>Rear camera preferred</span>
            <strong>Mobile capture ready</strong>
            <p>Use the rear camera for a packed suitcase photo, or a short pan video.</p>
          </div>
        )}
      </div>

      <p className={styles.note}>
        {selectedMedia?.note ??
          "Tip: spread items so the model can clearly see distinct objects and counts."}
      </p>

      <section className={styles.trustGrid} aria-label="Product guarantees">
        {TRUST_POINTS.map((point) => (
          <article key={point.title} className={styles.trustCard}>
            <strong>{point.title}</strong>
            <p>{point.copy}</p>
          </article>
        ))}
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className={styles.submit} type="submit" disabled={isBusy}>
        {isPreparing
          ? "Preparing media..."
          : isSubmitting
            ? "Analyzing luggage..."
            : isRedirecting
              ? "Opening checklist..."
              : "Create checklist"}
      </button>

      <p className={styles.footnote}>
        Optional archival is still supported on the backend, including S3-compatible
        object stores, but the default path is disposable processing.
      </p>
    </form>
  );
}
