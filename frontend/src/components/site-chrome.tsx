"use client";

import { useState } from "react";
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
  const [promptRoute, setPromptRoute] = useState<string | null>(null);
  const currentRoute = pathname ?? "/";

  const signedIn = status === "authenticated";
  const displayName =
    session?.user?.name?.trim()?.split(/\s+/)[0] ??
    session?.user?.email ??
    "Account";
  const showDashboardPrompt = !signedIn && promptRoute === currentRoute;

  function handleSignIn(callbackUrl = currentRoute) {
    void signIn("google", { callbackUrl });
  }

  const guestDashboardClassName = showDashboardPrompt
    ? `${styles.navButton} ${styles.navPromptOpen}`
    : styles.navButton;

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
                className={guestDashboardClassName}
                aria-expanded={showDashboardPrompt}
                aria-controls="dashboard-sign-in-prompt"
                onClick={() =>
                  setPromptRoute((current) =>
                    current === currentRoute ? null : currentRoute,
                  )
                }
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
              <p className={styles.accountHint}>Sign in to unlock the dashboard.</p>
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

        {!signedIn && showDashboardPrompt ? (
          <section
            id="dashboard-sign-in-prompt"
            className={styles.dashboardPrompt}
            aria-live="polite"
          >
            <div className={styles.promptCopy}>
              <p className={styles.promptLabel}>Dashboard locked</p>
              <strong>Sign in to open saved trips.</strong>
              <p>
                Guests can still create one-off checklists, but dashboard history
                stays behind Google sign-in.
              </p>
            </div>

            <div className={styles.promptActions}>
              <button type="button" onClick={() => handleSignIn("/dashboard")}>
                Continue with Google
              </button>
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => setPromptRoute(null)}
              >
                Not now
              </button>
            </div>
          </section>
        ) : null}
      </header>

      {children}
    </>
  );
}
