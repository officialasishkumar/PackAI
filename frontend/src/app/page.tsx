import { TripCreateForm } from "@/components/trip-create-form";

import styles from "./home.module.css";

const STEPS = [
  {
    step: "01",
    title: "Name trip",
    copy: "Quick label.",
  },
  {
    step: "02",
    title: "Add one photo",
    copy: "Top-down works best.",
  },
  {
    step: "03",
    title: "Review list",
    copy: "Edit in seconds.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <div className={styles.orb} />
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Fast</span>
          <span className={styles.badge}>Mobile</span>
          <span className={styles.badge}>Private</span>
        </div>

        <div className={styles.headline}>
          <p className="monoLabel">PackAI</p>
          <h1>Snap the bag. Check the list.</h1>
          <p>One bag photo → instant checklist.</p>
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
