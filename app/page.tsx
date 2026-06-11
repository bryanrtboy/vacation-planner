import { Header } from "@/components/header";
import { DestinationGrid } from "@/components/destination-grid";
import { PreferenceStrip } from "@/components/preference-strip";
import { listDestinationCandidates } from "@/lib/storage/destination-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const destinations = await listDestinationCandidates();

  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-16 pt-5 sm:px-8">
        <PreferenceStrip />

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold">Ideas to Compare</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/65">
                Curated places with enough context to compare costs, dates, scores, and tradeoffs.
              </p>
            </div>
            <p className="text-xs text-ink/24">Prices update only when checked, then stay saved.</p>
          </div>
          <DestinationGrid destinations={destinations} />
        </section>
      </div>
    </main>
  );
}
