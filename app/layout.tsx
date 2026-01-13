import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Command Vault",
  description: "Pin, organize, and copy your most important commands instantly."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
