import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="bg-card border-border rounded-2xl border p-6 sm:p-8">
        <div className="mb-6 flex justify-center gap-3">
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-12" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </section>
      {Array.from({ length: 3 }).map((_, i) => (
        <section
          key={i}
          className="bg-card border-border rounded-2xl border p-6"
        >
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </section>
      ))}
    </main>
  );
}
