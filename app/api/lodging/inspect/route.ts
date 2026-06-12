import { NextResponse } from "next/server";
import { lodgingModes, type LodgingModeId } from "@/lib/lodging/modes";
import { inspectSerpApiLodging } from "@/lib/lodging/providers/serpapi";
import { listDestinationCandidates } from "@/lib/storage/destination-store";
import type { Destination, TripWindow } from "@/lib/types";

export const runtime = "nodejs";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dollars(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function modeIdFromParam(value: string | null): LodgingModeId {
  if (value === "hotel" || value === "group-house" || value === "apartment") return value;
  return "apartment";
}

function tripWindowFromParams(url: URL): TripWindow | null {
  const departDate = url.searchParams.get("departDate");
  const returnDate = url.searchParams.get("returnDate");
  if (!departDate || !returnDate) return null;

  return {
    departDate,
    returnDate,
    label: `${departDate}-${returnDate}`,
    reason: "Lodging inspection link"
  };
}

function candidateRows(
  candidates: Awaited<ReturnType<typeof inspectSerpApiLodging>>["rawCandidates"],
  emptyLabel: string
) {
  if (!candidates.length) {
    return `<tr><td colspan="7">${escapeHtml(emptyLabel)}</td></tr>`;
  }

  return candidates
    .map((candidate) => {
      return `<tr>
        <td>${escapeHtml(candidate.name)}</td>
        <td>${escapeHtml(candidate.propertyType ?? "")}</td>
        <td>${escapeHtml(candidate.rating ? `${candidate.rating.toFixed(1)} (${candidate.reviews ?? 0})` : "unrated")}</td>
        <td>${candidateLinks(candidate)}</td>
        <td>${escapeHtml(candidate.source === "low-price" ? "price sort" : "relevance")}</td>
        <td>${dollars(candidate.nightly)}/night</td>
        <td>${dollars(candidate.total)}</td>
      </tr>`;
    })
    .join("");
}

function rejectedRows(
  candidates: Awaited<ReturnType<typeof inspectSerpApiLodging>>["rawCandidates"]
) {
  const rejected = candidates.filter((candidate) => candidate.excludedReason);
  if (!rejected.length) return `<tr><td colspan="8">No excluded listings.</td></tr>`;

  return rejected
    .map((candidate) => {
      return `<tr>
        <td>${escapeHtml(candidate.name)}</td>
        <td>${escapeHtml(candidate.propertyType ?? "")}</td>
        <td>${escapeHtml(candidate.rating ? `${candidate.rating.toFixed(1)} (${candidate.reviews ?? 0})` : "unrated")}</td>
        <td>${candidateLinks(candidate)}</td>
        <td>${escapeHtml(candidate.source === "low-price" ? "price sort" : "relevance")}</td>
        <td>${dollars(candidate.nightly)}/night</td>
        <td>${dollars(candidate.total)}</td>
        <td>${escapeHtml(candidate.excludedReason)}</td>
      </tr>`;
    })
    .join("");
}

function candidateLinks(
  candidate: Awaited<ReturnType<typeof inspectSerpApiLodging>>["rawCandidates"][number]
) {
  const links = [
    candidate.link
      ? `<a href="${escapeHtml(candidate.link)}" target="_blank" rel="noreferrer">Listing</a>`
      : "",
    candidate.googleResultUrl
      ? `<a href="${escapeHtml(candidate.googleResultUrl)}" target="_blank" rel="noreferrer">Google result</a>`
      : "",
    candidate.mapsUrl
      ? `<a href="${escapeHtml(candidate.mapsUrl)}" target="_blank" rel="noreferrer">Map</a>`
      : ""
  ].filter(Boolean);
  const sources = candidate.sourceNames.length
    ? `<span class="sources">${escapeHtml(candidate.sourceNames.join(", "))}</span>`
    : "";

  return [...links, sources].join(" ");
}

function inspectHtml(destination: Destination, inspection: Awaited<ReturnType<typeof inspectSerpApiLodging>>) {
  const result = inspection.result;
  const range = result?.currentRange
    ? `${dollars(result.currentRange.min)}-${dollars(result.currentRange.max)} total stay`
    : "No usable range";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lodging Check - ${escapeHtml(destination.name)}</title>
    <style>
      body { color: #202426; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f4ef; }
      main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
      h1 { font-size: 30px; line-height: 1.1; margin: 0 0 8px; }
      h2 { border-top: 1px solid #d8d2c8; font-size: 16px; margin: 28px 0 12px; padding-top: 20px; text-transform: uppercase; letter-spacing: .08em; }
      .summary { background: white; border: 1px solid #d8d2c8; border-radius: 8px; padding: 18px 20px; }
      .range { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
      .meta { color: #5b605f; margin: 0; }
      table { border-collapse: collapse; width: 100%; background: white; border: 1px solid #d8d2c8; }
      th, td { border-bottom: 1px solid #e7e2db; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { color: #5b605f; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      a { color: #2f6f7a; font-weight: 700; text-decoration: none; }
      .sources { color: #77706a; display: inline-block; font-size: 12px; margin-left: 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(destination.name)}</h1>
      <section class="summary">
        <p class="range">${range}</p>
        <p class="meta">${escapeHtml(result?.message ?? "No checked lodging range was returned.")}</p>
        <p class="meta">Query: ${escapeHtml(inspection.query)}</p>
        <p class="meta">Google Travel search: <a href="${escapeHtml(inspection.googleSearchUrl)}" target="_blank" rel="noreferrer">open public search</a></p>
      </section>
      <h2>Included In Estimate</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Rating</th><th>Links</th><th>Sample</th><th>Nightly</th><th>Total</th></tr></thead>
        <tbody>${candidateRows(inspection.summarizedCandidates, "No listings survived filtering.")}</tbody>
      </table>
      <h2>Compatible Results Before Outlier Trim</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Rating</th><th>Links</th><th>Sample</th><th>Nightly</th><th>Total</th></tr></thead>
        <tbody>${candidateRows(inspection.compatibleCandidates, "No compatible listings were found.")}</tbody>
      </table>
      <h2>Excluded Results</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Rating</th><th>Links</th><th>Sample</th><th>Nightly</th><th>Total</th><th>Reason</th></tr></thead>
        <tbody>${rejectedRows(inspection.rawCandidates)}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const tripWindow = tripWindowFromParams(url);
  if (!slug || !tripWindow) {
    return NextResponse.json({ error: "Missing lodging inspection parameters." }, { status: 400 });
  }

  const destinations = await listDestinationCandidates();
  const destination = destinations.find((candidate) => candidate.slug === slug);
  if (!destination) {
    return NextResponse.json({ error: "Destination not found." }, { status: 404 });
  }

  try {
    const inspection = await inspectSerpApiLodging({
      destination,
      mode: lodgingModes[modeIdFromParam(url.searchParams.get("mode"))],
      tripWindow
    });
    return new Response(inspectHtml(destination, inspection), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to inspect lodging results." },
      { status: 500 }
    );
  }
}
