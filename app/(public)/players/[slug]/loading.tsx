import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="bg-card border-border rounded-2xl border p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-12 w-44 rounded-xl" />
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, i) => (
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
