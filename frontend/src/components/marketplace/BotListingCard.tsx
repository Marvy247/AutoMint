"use client";

import { motion } from "framer-motion";
import { Bot, ShoppingCart, X, Zap, Tag } from "lucide-react";
import clsx from "clsx";
import {
  BotTier,
  BOT_TIER_NAMES,
  BOT_TIER_COLORS,
  BOT_TIER_BG_COLORS,
  TIER_META,
  stroopsToXlm,
} from "@/types";
import type { MarketplaceListing, BotNFT } from "@/types";

interface BotListingCardProps {
  listing: MarketplaceListing;
  bot: BotNFT;
  connectedAddress: string | null;
  onBuy: (listingId: bigint) => void;
  onCancel: (listingId: bigint) => void;
  isBuying?: boolean;
  isCancelling?: boolean;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function BotListingCard({
  listing,
  bot,
  connectedAddress,
  onBuy,
  onCancel,
  isBuying = false,
  isCancelling = false,
}: BotListingCardProps) {
  const tier = bot.tier as BotTier;
  const tierName = BOT_TIER_NAMES[tier] ?? "Unknown";
  const tierColor = BOT_TIER_COLORS[tier] ?? "text-muted";
  const tierBg = BOT_TIER_BG_COLORS[tier] ?? "bg-muted/20";
  const tierMeta = TIER_META[tier];
  const priceXlm = stroopsToXlm(listing.price);
  const isOwner =
    connectedAddress !== null &&
    listing.seller.toLowerCase() === connectedAddress.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "relative rounded-2xl border border-liner bg-card p-5",
        "flex flex-col gap-4",
        "hover:border-white/10 transition-colors"
      )}
      data-testid={`listing-card-${listing.id.toString()}`}
    >
      {/* Header: tier icon + name + tier badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl text-xl",
              tierBg
            )}
          >
            {tierMeta?.emoji ?? <Bot className={clsx("h-5 w-5", tierColor)} />}
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-text">
              {bot.name || tierName} Bot
            </p>
            <p className="text-xs text-muted">#{bot.id.toString()}</p>
          </div>
        </div>

        <span
          className={clsx(
            "inline-flex items-center rounded-full px-2.5 py-0.5",
            "text-xs font-medium",
            tierBg,
            tierColor
          )}
        >
          {tierName}
        </span>
      </div>

      {/* Stats: rate + price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-card-2 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-gold" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Rate
            </p>
            <p className="text-sm font-semibold text-text">
              {bot.accrual_rate.toString()}{" "}
              <span className="text-xs font-normal text-muted">pt/hr</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-card-2 px-3 py-2">
          <Tag className="h-3.5 w-3.5 text-green" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Price
            </p>
            <p className="text-sm font-semibold text-text">
              {priceXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
              <span className="text-xs font-normal text-muted">XLM</span>
            </p>
          </div>
        </div>
      </div>

      {/* Seller */}
      <div className="flex items-center justify-between rounded-lg bg-card-2 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Seller
        </span>
        <span className="font-mono text-xs text-text" title={listing.seller}>
          {truncateAddress(listing.seller)}
        </span>
      </div>

      {/* Action button */}
      {isOwner ? (
        <button
          onClick={() => onCancel(listing.id)}
          disabled={isCancelling}
          data-testid={`cancel-btn-${listing.id.toString()}`}
          className={clsx(
            "flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5",
            "text-sm font-medium transition-all",
            isCancelling
              ? "border-liner bg-card-2 text-muted cursor-not-allowed opacity-50"
              : "border-pink/30 bg-pink/10 text-pink hover:bg-pink/20 hover:border-pink/50"
          )}
        >
          <X className="h-4 w-4" />
          {isCancelling ? "Cancelling..." : "Cancel Listing"}
        </button>
      ) : (
        <button
          onClick={() => onBuy(listing.id)}
          disabled={isBuying || !connectedAddress}
          data-testid={`buy-btn-${listing.id.toString()}`}
          className={clsx(
            "flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5",
            "text-sm font-medium transition-all",
            isBuying || !connectedAddress
              ? "border-liner bg-card-2 text-muted cursor-not-allowed opacity-50"
              : "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/50"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          {isBuying ? "Buying..." : "Buy"}
        </button>
      )}
    </motion.div>
  );
}
