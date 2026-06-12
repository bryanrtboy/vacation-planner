import { NextResponse } from "next/server";
import { listRecentSavedSearches } from "@/lib/storage/price-snapshot-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    savedSearches: await listRecentSavedSearches(150)
  });
}
