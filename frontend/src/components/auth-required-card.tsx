"use client";

import { signIn } from "next-auth/react";

import styles from "./auth-required-card.module.css";

export function AuthRequiredCard({
  title,
  copy,
}: Readonly<{
  title: string;
  copy: string;
}>) {
  return (
    <section className={styles.card}>
      <p className={styles.kicker}>Google account required</p>
      <h2>{title}</h2>
      <p className={styles.copy}>{copy}</p>
      <button type="button" onClick={() => signIn("google")}>
        Continue with Google
      </button>
    </section>
  );
}
