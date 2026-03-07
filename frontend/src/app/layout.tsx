import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

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
  themeColor: "#f4efe6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
