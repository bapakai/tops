import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOPSID — Cek dulu. Baru potong.",
  description: "AI hairstyle matching untuk menemukan model rambut yang paling cocok sebelum potong."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
