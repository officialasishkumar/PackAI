"use client";

import { signIn, useSession } from "next-auth/react";

import styles from "./sign-in-nudge.module.css";

export function SignInNudge({
  title,
  copy,
  buttonLabel = "Continue with Google",
  callbackUrl,
}: Readonly<{
  title: string;
  copy: string;
  buttonLabel?: string;
  callbackUrl?: string;
}>) {
  const { status } = useSession();

  if (status === "authenticated") {
    return null;
  }

  return (
    <section className={styles.card}>
      <div>
        <p className={styles.kicker}>Optional sync</p>
        <h2>{title}</h2>
        <p className={styles.copy}>{copy}</p>
      </div>

      <button
        type="button"
        onClick={() => signIn("google", callbackUrl ? { callbackUrl } : undefined)}
      >
        {buttonLabel}
      </button>
    </section>
  );
}
