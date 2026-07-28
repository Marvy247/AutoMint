import { useCallback } from "react";
import { requestAccess, getAddress, getNetwork } from "@stellar/freighter-api";
import { toast } from "sonner";
import { useWalletStore } from "@/store/walletStore";

const FREIGHTER_DOWNLOAD_URL = "https://freighter.app";

function isFreighterInstalled(): boolean {
  return typeof window !== "undefined" && "freighter" in window;
}

export function useWallet() {
  const {
    status,
    publicKey,
    network,
    error,
    setConnecting,
    setConnected,
    setError,
    disconnect,
  } = useWalletStore();

  const connect = useCallback(async () => {
    if (!isFreighterInstalled()) {
      toast.error("Freighter wallet is not installed");
      window.open(FREIGHTER_DOWNLOAD_URL, "_blank");
      return;
    }

    setConnecting();
    toast.loading("Connecting wallet...", { id: "wallet-connect" });

    try {
      await requestAccess();
      const { address: pk } = await getAddress();
      const net = await getNetwork();
      setConnected(pk, net.networkPassphrase);
      toast.success("Wallet connected!", { id: "wallet-connect" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      toast.error(message, { id: "wallet-connect" });
    }
  }, [setConnecting, setConnected, setError]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    toast.success("Wallet disconnected");
  }, [disconnect]);

  return {
    status,
    publicKey,
    network,
    error,
    connect,
    disconnect: disconnectWallet,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
  };
}
