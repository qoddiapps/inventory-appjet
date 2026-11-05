import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Stockroom — Inventory Management",
  description:
    "A complete inventory management demo built entirely by AppJet AI: products, categories, suppliers and stock movements.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
