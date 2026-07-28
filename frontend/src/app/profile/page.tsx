'use client';

import { useProfile, useBots } from '@/hooks/useAccrual';
import { useWalletStore } from '@/store/walletStore';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfilePage() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: bots, isLoading: botsLoading } = useBots();

  if (!publicKey) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  if (profileLoading || botsLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile Not Found
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please register to create your profile
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPoints = (points: bigint) => {
    return points.toLocaleString('en-US');
  };

  const formatAmt = (amt: bigint) => {
    // Assuming 7 decimals
    const amtNumber = Number(amt) / 10_000_000;
    return amtNumber.toFixed(2);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
        My Profile
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Username Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Username
          </h2>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {profile.username}
          </p>
        </div>

        {/* Registration Date Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Member Since
          </h2>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatDate(profile.registeredAt)}
          </p>
        </div>

        {/* Total Points Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Points
          </h2>
          <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatPoints(profile.points)}
          </p>
        </div>

        {/* Claimed AMT Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Claimed AMT
          </h2>
          <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatAmt(profile.claimedAmt)} AMT
          </p>
        </div>

        {/* Bot Count Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Bots
          </h2>
          <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {profile.botCount}
          </p>
        </div>

        {/* Wallet Address Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Wallet Address
          </h2>
          <p className="mt-2 text-lg font-mono text-gray-900 dark:text-white break-all">
            {profile.address.slice(0, 8)}...{profile.address.slice(-8)}
          </p>
        </div>
      </div>

      {/* Bot IDs Section */}
      {bots && bots.length > 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
            My Bots ({bots.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {bots.map((botId) => (
              <span
                key={botId.toString()}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                Bot #{botId.toString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
