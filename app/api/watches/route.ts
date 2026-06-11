import { NextResponse } from "next/server";
import { listStoredWatches, replaceStoredWatches } from "@/lib/storage/watch-store";
import type { WatchedSearch } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const watches = await listStoredWatches();
  return NextResponse.json({
    durable: Boolean(watches),
    watches: watches ?? []
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { watches?: WatchedSearch[] } | null;
  const watches = body?.watches ?? [];
  const durable = await replaceStoredWatches(watches);

  return NextResponse.json({
    durable,
    watches
  });
}
