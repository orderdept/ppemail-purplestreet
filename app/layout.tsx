import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Purplestreet",
  description: "Private hosted control panels for Purplestreet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
