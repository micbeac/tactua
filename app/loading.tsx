import { MatchCardSkeleton } from '@/components/match/MatchCardSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10 space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </section>

      <section className="mb-12">
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <Skeleton className="mb-4 h-5 w-64" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
