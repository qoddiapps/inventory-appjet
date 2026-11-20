import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockroom — Inventory Management",
  description:
    "A complete inventory management demo built entirely by AppJet AI: products, categories, suppliers and stock movements.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
