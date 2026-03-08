"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

import styles from "./dashboard-access-gate.module.css";

export function DashboardAccessGate() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Dashboard locked</p>
        <h1>Sign in to see saved trips.</h1>
        <p className={styles.copy}>
          The dashboard stores your checklist history. You can still create a
          one-off checklist without an account.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continue with Google
          </button>
          <Link href="/" className={styles.link}>
            Go back to create
          </Link>
        </div>
      </section>
    </main>
  );
}
