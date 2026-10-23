import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatlog Magician PL | Edytor logów GTA RP",
  description: "Polski edytor logów czatu GTA RP. Formatuj, filtruj, wyróżniaj postacie i eksportuj podgląd do PNG.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
