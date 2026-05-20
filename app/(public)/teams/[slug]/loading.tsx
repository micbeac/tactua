import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="bg-card border-border rounded-2xl border p-6 sm:p-8">
        <div className="flex items-center gap-5 sm:gap-6">
          <Skeleton className="size-20 rounded-full sm:size-24" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </section>
      {Array.from({ length: 4 }).map((_, i) => (
        <section
          key={i}
          className="bg-card border-border rounded-2xl border p-6"
        >
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </section>
      ))}
    </main>
  );
}
