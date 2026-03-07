import { TripCreateForm } from "@/components/trip-create-form";

import styles from "./home.module.css";

const PROMISES = [
  {
    label: "Storage discipline",
    value: "Uploads are disposable by default, so the checklist survives, not the raw bag photo.",
  },
  {
    label: "Scale posture",
    value: "Go request limits, Mongo indexes, and bounded payloads keep the API from drifting into demo-only patterns.",
  },
  {
    label: "Travel UX",
    value: "Offline caching and repacking mode keep the useful part available in bad airport Wi-Fi.",
  },
];

const SIGNALS = [
  "AI extraction locked to JSON",
  "Short-form image/video capture",
  "Manual edits when the suitcase is layered",
  "Return-trip checklist with completion tracking",
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <div className={styles.orb} />
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Next.js PWA</span>
          <span className={styles.badge}>Go + MongoDB</span>
          <span className={styles.badge}>Gemini-powered extraction</span>
          <span className={styles.badge}>Deletion-first uploads</span>
        </div>

        <div className={styles.headline}>
          <p className="monoLabel">PackAI</p>
          <h1>Turn a suitcase snapshot into a return-trip ritual.</h1>
          <p>
            Capture a packed bag once, let Gemini pull out visible items, then
            travel with a categorized checklist that still opens when your
            connection drops and does not force you to retain raw luggage media forever.
          </p>
        </div>

        <div className={styles.signalBoard}>
          {SIGNALS.map((signal) => (
            <span key={signal} className={styles.signalChip}>
              {signal}
            </span>
          ))}
        </div>

        <div className={styles.stats}>
          <article className={styles.stat}>
            <span>Input</span>
            <strong>JPEG, PNG, or MP4 under 15 seconds</strong>
          </article>
          <article className={styles.stat}>
            <span>AI output</span>
            <strong>Structured item JSON mapped to packing categories</strong>
          </article>
          <article className={styles.stat}>
            <span>State</span>
            <strong>Edit in packing mode, check off in repacking mode</strong>
          </article>
          <article className={styles.stat}>
            <span>Offline</span>
            <strong>Previously opened trips remain visible from local cache</strong>
          </article>
        </div>

        <div className={styles.promiseGrid}>
          {PROMISES.map((promise) => (
            <article key={promise.label} className={styles.promiseCard}>
              <span>{promise.label}</span>
              <strong>{promise.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.steps}>
          <article className={styles.step}>
            <span>01</span>
            <strong>Shoot the suitcase</strong>
            <p>Use the rear camera or upload a short pan of the packed luggage.</p>
          </article>
          <article className={styles.step}>
            <span>02</span>
            <strong>Review the extraction</strong>
            <p>Add the hidden items AI missed, rename things, and tune quantities.</p>
          </article>
          <article className={styles.step}>
            <span>03</span>
            <strong>Repack with less anxiety</strong>
            <p>Flip into return mode and check items off before leaving the hotel.</p>
          </article>
        </div>
      </section>

      <TripCreateForm />
    </main>
  );
}
