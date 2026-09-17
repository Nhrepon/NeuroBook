import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroBook",
  description: "Accounting for Bangladeshi business",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
