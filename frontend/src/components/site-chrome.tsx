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
  const displayName =
    session?.user?.name?.trim()?.split(/\s+/)[0] ??
    session?.user?.email ??
    "Account";
  function handleSignIn(callbackUrl = pathname ?? "/") {
    void signIn("google", { callbackUrl });
  }

  return (
    <>
      <header className={styles.shell}>
        <div className={styles.bar}>
          <Link href="/" className={styles.brand}>
            <span className={styles.mark}>PackAI</span>
            <small>snap bag. get checklist.</small>
          </Link>

          <nav className={styles.nav}>
            <Link
              href="/"
              className={pathname === "/" ? styles.navActive : styles.navLink}
            >
              Create
            </Link>
            {signedIn ? (
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
            ) : (
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handleSignIn("/dashboard")}
              >
                Dashboard
              </button>
            )}
          </nav>

          {signedIn && session.user ? (
            <div className={styles.account}>
              <div className={styles.userMeta}>
                <strong>{displayName}</strong>
                <span>{session.user.email}</span>
              </div>

              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className={styles.account}>
              <p className={styles.accountHint}>Sign in for dashboard</p>
              <button
                type="button"
                className={styles.signInAction}
                onClick={() => handleSignIn()}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </header>

      {children}
    </>
  );
}
