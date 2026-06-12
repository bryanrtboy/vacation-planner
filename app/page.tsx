import { DestinationGrid } from "@/components/destination-grid";
import { listDestinationCandidates } from "@/lib/storage/destination-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const destinations = await listDestinationCandidates();

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[94rem] flex-col gap-5 px-5 pb-16 pt-6 sm:px-8 xl:px-10">
        <section>
          <DestinationGrid destinations={destinations} />
        </section>
      </div>
    </main>
  );
}
