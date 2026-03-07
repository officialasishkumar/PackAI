import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { AuthSessionProvider } from "@/components/session-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SiteChrome } from "@/components/site-chrome";
import { authOptions } from "@/lib/auth-options";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PackAI",
  description: "Mobile-first trip packing and repacking with AI-assisted item extraction.",
  applicationName: "PackAI",
};

export const viewport = {
  themeColor: "#f7f1e8",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <AuthSessionProvider session={session}>
          <ServiceWorkerRegistration />
          <SiteChrome>{children}</SiteChrome>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
