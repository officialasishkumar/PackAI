import { TripCreateForm } from "@/components/trip-create-form";

import styles from "./home.module.css";

const STEPS = [
  {
    step: "01",
    title: "Name the trip",
    copy: "Use a label you will recognize later.",
  },
  {
    step: "02",
    title: "Add one clear bag photo",
    copy: "A single top-down shot is usually enough.",
  },
  {
    step: "03",
    title: "Fix the checklist",
    copy: "Adjust quantities and missing items in seconds.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <div className={styles.orb} />
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Smart Extraction</span>
          <span className={styles.badge}>Offline Ready</span>
          <span className={styles.badge}>Privacy First</span>
        </div>

        <div className={styles.headline}>
          <p className="monoLabel">PackAI</p>
          <h1>Snap the bag. Check the list.</h1>
          <p>
            Turn one luggage photo into a checklist you can review before you
            leave and again before you fly home.
          </p>
        </div>

        <div className={styles.steps} aria-label="How it works">
          {STEPS.map((item) => (
            <article key={item.step} className={styles.step}>
              <span className={styles.stepNumber}>{item.step}</span>
              <div className={styles.stepCopy}>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <TripCreateForm />
    </main>
  );
}
