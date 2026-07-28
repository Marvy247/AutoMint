import clsx from "clsx";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-lg bg-card-2",
        className
      )}
      aria-hidden="true"
    />
  );
}

function CardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-liner bg-card p-5 flex flex-col gap-4"
      role="status"
      aria-busy="true"
      aria-label="Loading card content"
    >
      <span className="sr-only">Loading...</span>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

function BotCardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-liner bg-card p-5 flex flex-col gap-4"
      role="status"
      aria-busy="true"
      aria-label="Loading bot card content"
    >
      <span className="sr-only">Loading...</span>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-card-2 px-3 py-2">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-card-2 px-3 py-2">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

export { Skeleton, CardSkeleton, BotCardSkeleton };
export type { SkeletonProps };
