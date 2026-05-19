import { Skeleton } from '@/components/ui/skeleton';

export function MatchCardSkeleton() {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-6" />
        <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
