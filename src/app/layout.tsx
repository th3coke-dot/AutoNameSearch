import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  weight: ["500", "600", "700", "800"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AutoNameSearch — Venture naming pipeline",
  description:
    "Phonetic generation, domain screening, AI brand collision search, company checks, and brand scoring — built like Scope2Plan and PartnerForge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${plex.variable} ${plexMono.variable}`}>
      <body
        style={
          {
            ["--font-display" as string]: "var(--font-display-loaded), sans-serif",
            ["--font-body" as string]: "var(--font-body-loaded), sans-serif",
            ["--font-mono" as string]: "var(--font-mono-loaded), monospace",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
