import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
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
  title: "PackSnap",
  description: "Mobile-first trip packing and repacking with AI-assisted item extraction.",
};

export const viewport = {
  themeColor: "#f4efe6",
};

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono-fallback",
  subsets: ["latin"],
  weight: ["400"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${plexMono.variable} ${mono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
