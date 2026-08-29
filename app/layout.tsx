import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Majestic+ | Richards Majestic",
  description: "Majestic+ — streaming from Richards Majestic Studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
