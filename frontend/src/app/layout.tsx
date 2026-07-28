import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "./providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--memefi-font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--memefi-font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoMint — Mint, Earn & Trade AI Bot NFTs on Stellar",
  description:
    "Mint AI-powered bot NFTs on Stellar, earn points through daily accrual, and trade on the marketplace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-text">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--memefi-color-card)",
                border: "1px solid var(--memefi-color-liner)",
                color: "var(--memefi-color-text)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
