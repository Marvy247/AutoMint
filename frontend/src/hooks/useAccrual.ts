import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  registerUser,
  mintBasicBot,
  startAccrual,
  getAccrualState,
  getUserProfile,
  isRegistered,
  getUserBots,
  getAmtBalance,
  claimPoints,
} from "@/lib/contracts";
import { useWalletStore } from "@/store/walletStore";
import { useState, useEffect } from "react";
import type { AccrualState, UserProfile } from "@/types";

const BASIC_BOT_RATE = 1; // Basic bot accrual rate
const UPDATE_INTERVAL = 1000; // Update every second
const POINTS_PER_HOUR_DIVISOR = 3600; // Seconds in an hour
const POLL_INTERVAL = 30000; // Poll every 30 seconds

export function useRegister() {
  const queryClient = useQueryClient();
  const publicKey = useWalletStore(
    (s: { publicKey: string | null }) => s.publicKey,
  );

  return useMutation({
    mutationFn: async (username: string) => {
      if (!publicKey) throw new Error("Wallet not connected");

      // Step 1: Register user
      toast.loading("Registering user...", { id: "register" });
      const registerTx = await registerUser(publicKey, username);
      toast.success("User registered successfully!", { id: "register" });

      // Step 2: Mint basic bot
      toast.loading("Minting basic bot...", { id: "mint" });
      const mintTx = await mintBasicBot(publicKey);
      toast.success("Basic bot minted successfully!", { id: "mint" });

      // Step 3: Start accrual
      toast.loading("Starting accrual...", { id: "accrual" });
      const accrualTx = await startAccrual(publicKey, BASIC_BOT_RATE);
      toast.success("Accrual started successfully!", { id: "accrual" });

      return { registerTx, mintTx, accrualTx };
    },
    onSuccess: () => {
      toast.success("Registration complete! Welcome to AutoMint!");

      // Delayed refetch to allow blockchain state to propagate
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["registered"] });
        queryClient.invalidateQueries({ queryKey: ["accrualState"] });
        queryClient.invalidateQueries({ queryKey: ["bots"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast.dismiss("register");
      toast.dismiss("mint");
      toast.dismiss("accrual");
      toast.error(error.message || "Registration failed");
    },
  });
}

/** Whether the connected wallet address is registered in the registry contract. */
export function useRegistered() {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useQuery<boolean>({
    queryKey: ["registered", publicKey],
    queryFn: () =>
      publicKey ? isRegistered(publicKey) : Promise.resolve(false),
    enabled: !!publicKey,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Registry profile (username, points) for the connected wallet address. */
export function useProfile() {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useQuery<UserProfile | null>({
    queryKey: ["profile", publicKey],
    queryFn: () =>
      publicKey ? getUserProfile(publicKey) : Promise.resolve(null),
    enabled: !!publicKey,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Bot IDs owned by the connected wallet address, from the bot_nft contract. */
export function useBots() {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useQuery<bigint[]>({
    queryKey: ["bots", publicKey],
    queryFn: () => (publicKey ? getUserBots(publicKey) : Promise.resolve([])),
    enabled: !!publicKey,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Accrual state (last claim timestamp, cumulative claimed points) for the connected wallet address. */
export function useAccrualState() {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useQuery<AccrualState | null>({
    queryKey: ["accrualState", publicKey],
    queryFn: () =>
      publicKey ? getAccrualState(publicKey) : Promise.resolve(null),
    enabled: !!publicKey,
    refetchInterval: POLL_INTERVAL,
  });
}

/** AMT token balance for the connected wallet address, from the token contract. */
export function useAmtBalance() {
  const publicKey = useWalletStore((s) => s.publicKey);

  return useQuery<bigint>({
    queryKey: ["amtBalance", publicKey],
    queryFn: () =>
      publicKey ? getAmtBalance(publicKey) : Promise.resolve(BigInt(0)),
    enabled: !!publicKey,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Claims accrued points (converting to AMT where the threshold is met). */
export function useClaim() {
  const queryClient = useQueryClient();
  const publicKey = useWalletStore((s) => s.publicKey);

  return useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      return claimPoints(publicKey);
    },
    onSuccess: () => {
      toast.success("Points claimed successfully!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["accrualState"] });
      queryClient.invalidateQueries({ queryKey: ["amtBalance"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to claim points");
    },
  });
}

export function useAnimatedPoints(ratePerHour: number = BASIC_BOT_RATE) {
  const [displayedPoints, setDisplayedPoints] = useState<bigint>(BigInt(0));

  // Fetch accrual state and user profile
  const { data: accrualState } = useAccrualState();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!accrualState && !profile) {
      setDisplayedPoints(BigInt(0));
      return;
    }

    // Fallback to profile.totalPoints when accrual state is unavailable
    if (!accrualState && profile) {
      setDisplayedPoints(profile.points);
      return;
    }

    // Calculate interpolated points based on accrual state
    const updatePoints = () => {
      if (!accrualState) return;

      const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const lastClaimTs = Number(accrualState.last_claim_ts);
      const elapsedSeconds = now - lastClaimTs;

      if (elapsedSeconds <= 0) {
        setDisplayedPoints(accrualState.total_claimed_points);
        return;
      }

      // Calculate points earned since last claim
      const pointsEarned = BigInt(
        Math.floor((elapsedSeconds * ratePerHour) / POINTS_PER_HOUR_DIVISOR),
      );
      const totalPoints = accrualState.total_claimed_points + pointsEarned;

      setDisplayedPoints(totalPoints);
    };

    // Initial update
    updatePoints();

    // Set up interval for smooth animation
    const interval = setInterval(updatePoints, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [accrualState, profile, ratePerHour]);

  return displayedPoints;
}
