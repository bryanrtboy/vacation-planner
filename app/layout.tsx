import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artist Travel Finder",
  description: "Curated travel research with price-watch guardrails."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
