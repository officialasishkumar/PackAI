"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { SignInNudge } from "@/components/sign-in-nudge";
import { createTrip, getErrorMessage } from "@/lib/api";
import { cacheTrip } from "@/lib/offline-cache";
import { prepareMedia } from "@/lib/media";

import styles from "./trip-create-form.module.css";

interface SelectedMedia {
  file: File;
  previewUrl: string;
  note: string;
}

interface SharedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
}

const TRUST_POINTS = [
  {
    title: "Device-first history",
    copy: "Trips can be revisited from the dashboard without exposing the source image there, even before sign-in.",
  },
  {
    title: "Location is optional",
    copy: "You choose whether to attach approximate location so the dashboard can show where a list was created.",
  },
  {
    title: "Deletion-first",
    copy: "Raw uploads are still discarded after analysis by default, so storage stays predictable.",
  },
];

export function TripCreateForm() {
  const router = useRouter();
  const { status } = useSession();
  const [isRedirecting, startRedirect] = useTransition();
  const [tripName, setTripName] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [wantsLocation, setWantsLocation] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
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

  function handleLocationToggle(nextValue: boolean) {
    setWantsLocation(nextValue);
    if (!nextValue) {
      setSharedLocation(null);
      setIsLocating(false);
    }
  }

  async function captureLocation(): Promise<void> {
    if (!("geolocation" in navigator)) {
      setError("This device does not support location capture.");
      return;
    }

    setError(null);
    setIsLocating(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        });
      });

      setSharedLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
    } catch {
      setError("Location access was denied or unavailable.");
    } finally {
      setIsLocating(false);
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

    if (wantsLocation && !sharedLocation) {
      setError("Capture your location first, or turn off location sharing.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trip = await createTrip({
        tripName: tripName.trim(),
        media: selectedMedia.file,
        location: sharedLocation ?? undefined,
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

  const isBusy = isPreparing || isSubmitting || isRedirecting || isLocating;
  const isVideo = selectedMedia?.file.type === "video/mp4";

  return (
    <div className={styles.stack}>
      {status !== "authenticated" ? (
        <SignInNudge
          title="Create instantly, or sign in if you want sync."
          copy="Guests can still generate lists, download checklist images, and see them on this device dashboard. Google sign-in simply keeps that history across devices."
        />
      ) : null}

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <p className={styles.kicker}>Create a trip</p>
            <span className={styles.privacyPill}>
              {status === "authenticated" ? "Cloud-backed dashboard" : "Guest-friendly capture flow"}
            </span>
          </div>
          <h2>Generate the list, then keep the context.</h2>
          <p className={styles.copy}>
            Every trip can land on your dashboard with its creation day and optional
            location. The dashboard still leaves the source media out.
          </p>
          {status !== "authenticated" ? (
            <button
              type="button"
              className={styles.inlineSignIn}
              onClick={() => signIn("google")}
            >
              Sign in if you want cross-device history
            </button>
          ) : null}
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

        <section className={styles.locationCard}>
          <div className={styles.locationHeader}>
            <div>
              <p className={styles.kicker}>Location sharing</p>
              <strong>Add approximate location to the dashboard</strong>
            </div>

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={wantsLocation}
                onChange={(event) => handleLocationToggle(event.target.checked)}
              />
              <span>{wantsLocation ? "On" : "Off"}</span>
            </label>
          </div>

          <p className={styles.locationCopy}>
            Optional. If you enable this, the browser will ask whether you want to
            share your current location for trip history only.
          </p>

          {wantsLocation ? (
            <div className={styles.locationActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={captureLocation}
                disabled={isBusy}
              >
                {isLocating ? "Capturing location..." : "Use current location"}
              </button>
              <p className={styles.locationNote}>
                {sharedLocation
                  ? `Approximate coordinates saved: ${sharedLocation.latitude.toFixed(2)}, ${sharedLocation.longitude.toFixed(2)}`
                  : "No location captured yet."}
              </p>
            </div>
          ) : null}
        </section>

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
            : isLocating
              ? "Capturing location..."
              : isSubmitting
                ? "Analyzing luggage..."
                : isRedirecting
                  ? "Opening checklist..."
                  : "Create checklist"}
        </button>

        <p className={styles.footnote}>
          Guests can create, revisit, and export list images on this device.
          Signing in just makes that history portable.
        </p>
      </form>
    </div>
  );
}
