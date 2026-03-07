import Link from "next/link";

import styles from "./offline.module.css";

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className="monoLabel">Offline fallback</p>
        <h1>PackAI can still open cached trips without a connection.</h1>
        <p>
          Return to the home screen after connectivity comes back, or reopen a
          trip you previously loaded on this device to keep checking items off.
        </p>
        <Link className={styles.link} href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}

