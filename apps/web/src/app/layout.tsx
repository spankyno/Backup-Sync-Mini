import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BackupHub",
  description: "Gestión moderna de backups mediante agentes locales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
