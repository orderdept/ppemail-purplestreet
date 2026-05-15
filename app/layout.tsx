import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PP Email Control Panel",
  description: "Hosted Purple Prices email control panel",
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
