import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mirfa Secure TX",
  description: "Encrypt and decrypt transaction payloads with envelope encryption",
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
