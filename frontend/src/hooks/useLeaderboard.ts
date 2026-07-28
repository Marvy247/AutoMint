import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/contracts";
import type { UserProfile } from "@/types";

const LEADERBOARD_POLL_INTERVAL = 30_000;
const DEFAULT_LEADERBOARD_LIMIT = 50;

export function useLeaderboard(limit = DEFAULT_LEADERBOARD_LIMIT) {
  return useQuery<UserProfile[]>({
    queryKey: ["leaderboard", limit],
    queryFn: () => getLeaderboard(limit),
    refetchInterval: LEADERBOARD_POLL_INTERVAL,
    staleTime: 15_000,
  });
}
