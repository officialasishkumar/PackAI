"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import styles from "./site-chrome.module.css";

export function SiteChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const signedIn = status === "authenticated";

  return (
    <>
      <header className={styles.shell}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>
            <span className={styles.mark}>PackAI</span>
            <small>smart trip memory</small>
          </Link>

          <nav className={styles.nav}>
            <Link
              href="/"
              className={pathname === "/" ? styles.navActive : styles.navLink}
            >
              Create
            </Link>
            <Link
              href="/dashboard"
              className={
                pathname?.startsWith("/dashboard")
                  ? styles.navActive
                  : styles.navLink
              }
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className={styles.authRow}>
          {signedIn && session.user ? (
            <div className={styles.userMeta}>
              <strong>{session.user.name ?? "Google account"}</strong>
              <span>{session.user.email}</span>
            </div>
          ) : (
            <div className={styles.userMeta}>
              <strong>Guest mode on this device</strong>
              <span>sign in only if you want cross-device history</span>
            </div>
          )}

          {signedIn ? (
            <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </button>
          ) : (
            <button type="button" onClick={() => signIn("google")}>
              Continue with Google
            </button>
          )}
        </div>
      </header>

      {children}
    </>
  );
}
