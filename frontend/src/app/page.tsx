import { TripCreateForm } from "@/components/trip-create-form";

import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Next.js PWA</span>
          <span className={styles.badge}>Go + MongoDB</span>
          <span className={styles.badge}>Gemini-powered extraction</span>
        </div>

        <div className={styles.headline}>
          <p className="monoLabel">PackAI</p>
          <h1>Turn a suitcase snapshot into a return-trip ritual.</h1>
          <p>
            Capture a packed bag once, let Gemini pull out visible items, then
            travel with a categorized checklist that still opens when your
            connection drops.
          </p>
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
