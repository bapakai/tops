import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "potram.id — Cek dulu. Baru potong.",
  description: "AI hairstyle recommendation untuk pria Indonesia.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}