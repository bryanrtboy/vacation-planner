import { Header } from "@/components/header";
import { DestinationCard } from "@/components/destination-card";
import { PriceWatchPanel } from "@/components/price-watch-panel";
import { PreferenceStrip } from "@/components/preference-strip";
import { destinations } from "@/lib/seed-data";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-16 pt-5 sm:px-8">
        <PriceWatchPanel />

        <PreferenceStrip />

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold">Worth Considering</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/65">
                Shortlisted places with enough context to compare, not enough to bury the decision.
              </p>
            </div>
            <p className="text-xs text-ink/24">Prototype prices until live APIs are connected.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {destinations.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
