"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Wallet, LogOut } from "lucide-react";
import clsx from "clsx";
import { useWallet } from "@/hooks/useWallet";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Leaderboard", href: "/leaderboard" },
];

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { publicKey, isConnected, connect, disconnect } = useWallet();

  // Close mobile menu on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (mobileOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, handleKeyDown]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const linkClass = (isActive: boolean, mobile = false) =>
    clsx(
      "rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      mobile ? "px-3 py-2.5 text-sm" : "px-3 py-2 text-sm",
      isActive
        ? "bg-card-2 text-text"
        : "text-muted hover:bg-card-2 hover:text-text",
    );

  return (
    <header className="sticky top-0 z-50 border-b border-liner bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-lg"
          aria-label="AutoMint Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
            <span className="font-display text-sm font-bold text-gold">A</span>
          </div>
          <span className="font-display text-lg font-bold text-text">AutoMint</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass(isActive)}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isConnected && publicKey ? (
            <div className="flex items-center gap-2 rounded-xl border border-liner bg-card-2 px-3 py-2">
              <Wallet className="h-4 w-4 text-green" aria-hidden="true" />
              <span className="text-sm font-medium text-text">
                {truncateAddress(publicKey)}
              </span>
              <button
                onClick={disconnect}
                className="ml-1 rounded-lg p-1 text-muted hover:text-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Disconnect wallet"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              className="flex items-center gap-2 rounded-xl bg-gold/10 px-4 py-2 text-sm font-medium text-gold border border-gold/30 hover:bg-gold/20 hover:border-gold/50 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Connect Wallet
            </button>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center justify-center rounded-lg p-2 text-muted hover:text-text md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="border-t border-liner md:hidden"
          role="dialog"
          aria-label="Mobile navigation"
          aria-modal="true"
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass(isActive, true)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-liner pt-2">
              {isConnected && publicKey ? (
                <div className="flex items-center justify-between rounded-xl border border-liner bg-card-2 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green" aria-hidden="true" />
                    <span className="text-sm font-medium text-text">
                      {truncateAddress(publicKey)}
                    </span>
                  </div>
                  <button
                    onClick={() => { disconnect(); setMobileOpen(false); }}
                    className="rounded-lg p-1 text-muted hover:text-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="Disconnect wallet"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { connect(); setMobileOpen(false); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold border border-gold/30 hover:bg-gold/20 hover:border-gold/50 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
