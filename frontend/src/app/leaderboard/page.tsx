"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Trophy, RotateCw } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useWalletStore } from "@/store/walletStore";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserProfile } from "@/types";

function mapToTableUsers(
  users: UserProfile[],
  currentAddress: string | null
) {
  return users.map((user, index) => ({
    rank: index + 1,
    username: user.username,
    address: currentAddress ?? "",
    points: Number(user.points),
    isCurrentUser: false, // address matching handled inside table via currentAddress prop
  }));
}

export default function LeaderboardPage() {
  const { data: leaderboardData, isLoading, isError, refetch, isRefetching } = useLeaderboard();
  const publicKey = useWalletStore((s) => s.publicKey);

  // #202 — surface load failures the same way the rest of the app does
  // (sonner toast), in addition to the existing inline error panel.
  const hasToastedError = useRef(false);
  useEffect(() => {
    if (isError && !hasToastedError.current) {
      hasToastedError.current = true;
      toast.error("Failed to load leaderboard. Please try again later.");
    } else if (!isError) {
      hasToastedError.current = false;
    }
  }, [isError]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
          <Trophy className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text">
            Leaderboard
          </h1>
          <p className="text-sm text-muted">Top earners across the network</p>
        </div>
      </div>

      {/* Loading state — skeleton rows matching the real table shape, per
          the app-wide loading convention (Skeleton component), instead of
          a generic spinner. */}
      {isLoading && (
        <div
          className="overflow-hidden rounded-2xl border border-liner"
          data-testid="leaderboard-loading"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex border-b border-liner px-4 py-3">
            <Skeleton className="h-3 w-10" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-liner px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-5 w-6 rounded" />
              <Skeleton className="h-4 flex-1 max-w-[10rem]" />
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="hidden h-3 w-20 sm:block" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          className="rounded-2xl border border-liner bg-card px-6 py-10 text-center text-muted"
          data-testid="leaderboard-error"
        >
          <p className="text-sm">
            Failed to load leaderboard. Please try again later.
          </p>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-liner px-4 py-2 text-sm font-semibold text-text hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
          >
            <RotateCw className={isRefetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isRefetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!leaderboardData || leaderboardData.length === 0) && (
        <div
          className="rounded-2xl border border-liner bg-card px-6 py-10 text-center text-muted"
          data-testid="leaderboard-empty"
        >
          <Trophy className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">No rankings yet. Be the first to earn points!</p>
        </div>
      )}

      {/* Populated table */}
      {!isLoading && !isError && leaderboardData && leaderboardData.length > 0 && (
        <LeaderboardTable
          users={leaderboardData.map((user, index) => ({
            rank: index + 1,
            address: "", // UserProfile doesn't carry address; display username instead
            username: user.username,
            points: Number(user.points),
          }))}
          currentAddress={publicKey}
        />
      )}
    </main>
  );
}
