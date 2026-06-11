import { DestinationGrid } from "@/components/destination-grid";
import { listDestinationCandidates } from "@/lib/storage/destination-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const destinations = await listDestinationCandidates();

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[94rem] flex-col gap-5 px-5 pb-16 pt-6 sm:px-8 xl:px-10">
        <section>
          <div className="mb-5 rounded-md bg-harbor px-5 py-5 text-white shadow-[0_18px_42px_rgb(43_86_96_/_0.16)] sm:px-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Trip Ideas
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/72">
                Curated places with enough context to compare costs, dates, scores, and tradeoffs.
              </p>
            </div>
          </div>
          <DestinationGrid destinations={destinations} />
        </section>
      </div>
    </main>
  );
}
