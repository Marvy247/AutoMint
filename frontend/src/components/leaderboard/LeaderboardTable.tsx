"use client";

import React from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Medal } from "lucide-react";

export interface LeaderboardUser {
  rank: number;
  /** Wallet address (may be empty string if not available) */
  address: string;
  /** Display username */
  username?: string;
  points: number;
  botCount?: number;
}

export interface LeaderboardTableProps {
  users: LeaderboardUser[];
  /** Connected wallet's public key — used to highlight the current user's row */
  currentAddress?: string | null;
}

function truncateAddress(address: string): string {
  if (!address || address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const RANK_ICON: Record<number, { icon: string; color: string }> = {
  1: { icon: "🥇", color: "text-gold" },
  2: { icon: "🥈", color: "text-tier-silver" },
  3: { icon: "🥉", color: "text-tier-bronze" },
};

export function LeaderboardTable({ users, currentAddress }: LeaderboardTableProps) {
  if (!users || users.length === 0) {
    return (
      <div data-testid="empty-leaderboard" className="text-muted text-sm text-center py-10">
        No leaderboard data available
      </div>
    );
  }

  const normalizedCurrentAddress = currentAddress?.toLowerCase() ?? null;

  return (
    <div className="overflow-x-auto" data-testid="leaderboard-table">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-liner text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3 text-right">Points</th>
            <th className="px-4 py-3 hidden sm:table-cell">Address</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => {
            const isCurrentUser =
              normalizedCurrentAddress !== null &&
              user.address.toLowerCase() === normalizedCurrentAddress;
            const rankMeta = RANK_ICON[user.rank];

            return (
              <motion.tr
                key={user.address || user.username || idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                data-testid={`user-row-${user.rank}`}
                className={clsx(
                  "border-b border-liner transition-colors",
                  isCurrentUser
                    ? "bg-gold/5 border-l-2 border-l-gold"
                    : "hover:bg-white/[0.02]"
                )}
              >
                {/* Rank */}
                <td className="px-4 py-3 font-bold">
                  {rankMeta ? (
                    <span className={clsx("text-base", rankMeta.color)}>
                      {rankMeta.icon}
                    </span>
                  ) : (
                    <span className="text-muted">#{user.rank}</span>
                  )}
                </td>

                {/* Username / display name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "font-medium",
                        isCurrentUser ? "text-gold" : "text-text"
                      )}
                    >
                      {user.username || `Trader #${user.rank}`}
                    </span>
                    {isCurrentUser && (
                      <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                        You
                      </span>
                    )}
                  </div>
                </td>

                {/* Points */}
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {user.points.toLocaleString()}
                </td>

                {/* Truncated address (hidden on mobile) */}
                <td className="px-4 py-3 font-mono text-xs text-muted hidden sm:table-cell">
                  {truncateAddress(user.address)}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
