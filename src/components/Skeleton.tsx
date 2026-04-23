// src/components/Skeleton.tsx
// Reusable skeleton loading components (Opt 9)

interface SkeletonProps {
  className?: string;
}

/** Base animated shimmer block */
export const Skeleton = ({ className = '' }: SkeletonProps) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

/** Matches a job card on /jobs */
export const JobCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
    {/* Status badge + menu */}
    <div className="flex items-start justify-between">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-7 w-7 rounded-lg" />
    </div>
    {/* Title */}
    <Skeleton className="h-5 w-3/4" />
    {/* Description */}
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
    {/* Skill chips */}
    <div className="flex gap-2 mt-1">
      <Skeleton className="h-5 w-14 rounded-md" />
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-5 w-12 rounded-md" />
    </div>
    {/* Footer */}
    <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
);

/** Matches a session card row on /interviews */
export const SessionCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
    {/* Avatar */}
    <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
    <div className="flex-1 flex flex-col gap-2 min-w-0">
      {/* Name + badge */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      {/* Job + date */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    {/* Score bar */}
    <div className="flex flex-col gap-1.5 w-32 flex-shrink-0">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
    {/* Arrow */}
    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
  </div>
);

/** Matches a candidate row in Dashboard */
export const CandidateRowSkeleton = () => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
    {/* Avatar */}
    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1 flex flex-col gap-1.5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-28" />
    </div>
    {/* Score */}
    <div className="flex flex-col gap-1 w-24">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
    {/* Status badge */}
    <Skeleton className="h-5 w-16 rounded-full" />
    {/* Arrow */}
    <Skeleton className="w-8 h-8 rounded-lg" />
  </div>
);
