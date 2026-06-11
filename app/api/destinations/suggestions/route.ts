import { NextResponse } from "next/server";
import { suggestDestinationsWithGemini } from "@/lib/ai/gemini";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { listDestinationCandidates } from "@/lib/storage/destination-store";
import {
  listDestinationSuggestions,
  writeDestinationSuggestions
} from "@/lib/storage/destination-suggestion-store";
import { defaultTripPreferences } from "@/lib/trip-preferences";
import type {
  DestinationSuggestion,
  DestinationSuggestionPromptKind,
  TripPreferences
} from "@/lib/types";

export const runtime = "nodejs";

const aiUsageService = "ai";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function compactHash(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
}

function normalizePreferences(preferences?: Partial<TripPreferences>): TripPreferences {
  if (!preferences) return defaultTripPreferences;

  const normalized = {
    ...defaultTripPreferences,
    ...preferences
  };

  return {
    ...normalized,
    departure: normalized.departure.trim().toUpperCase(),
    flightCount: Math.min(Math.max(Math.round(Number(normalized.flightCount) || 2), 1), 8),
    nights: Math.min(Math.max(Math.round(Number(normalized.nights) || 7), 1), 60)
  };
}

export async function GET() {
  return NextResponse.json({
    usage: await getUsageState(aiUsageService),
    suggestions: await listDestinationSuggestions("draft")
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    promptKind?: DestinationSuggestionPromptKind;
    region?: string;
    parentSlug?: string;
    preferences?: Partial<TripPreferences>;
  } | null;
  const promptKind = body?.promptKind ?? "more-in-region";
  const preferences = normalizePreferences(body?.preferences);
  const destinations = await listDestinationCandidates();
  const parent = body?.parentSlug
    ? destinations.find((destination) => destination.slug === body.parentSlug)
    : undefined;
  const region = body?.region?.trim() || parent?.region;
  const requestKey = [
    promptKind,
    region ?? "all-regions",
    parent?.slug ?? "no-parent",
    preferences.departure,
    preferences.flightCount,
    preferences.nights,
    preferences.lodging,
    preferences.interests
  ]
    .map(String)
    .join("|");

  const reservation = await tryReserveChecks(1, aiUsageService);
  if (reservation.allowed < 1) {
    return NextResponse.json(
      {
        usage: reservation.usage,
        suggestions: await listDestinationSuggestions("draft"),
        message: "Daily AI suggestion cap reached. Existing drafts are still shown."
      },
      { status: 429 }
    );
  }

  try {
    const existingDestinations = destinations.map((destination) => ({
      name: destination.name,
      region: destination.region,
      tripType: destination.tripType,
      bestMonths: destination.bestMonths,
      fitSummary: destination.fitSummary,
      interests: [
        ...Object.entries(destination.fit)
          .filter(([, score]) => score >= 7)
          .map(([key]) => key),
        ...destination.highlights
      ].slice(0, 10)
    }));
    const result = await suggestDestinationsWithGemini({
      promptKind,
      region,
      parentName: parent?.name,
      preferences,
      existingDestinations
    });
    const requestHash = compactHash(requestKey);
    const suggestions = result.suggestions.map((suggestion): DestinationSuggestion => {
      const suggestionSlug = slugify(suggestion.name);
      return {
        id: `${requestHash}-${suggestionSlug}`,
        requestKey,
        status: "draft",
        source: "gemini",
        promptKind,
        parentSlug: parent?.slug,
        region: suggestion.region,
        name: suggestion.name,
        destinationSlug: suggestionSlug,
        payload: suggestion,
        rawResponseJson: result.rawResponseJson,
        model: result.model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    await writeDestinationSuggestions(suggestions);

    return NextResponse.json({
      usage: await getUsageState(aiUsageService),
      suggestions: await listDestinationSuggestions("draft"),
      message: `Saved ${suggestions.length} draft destination suggestion${
        suggestions.length === 1 ? "" : "s"
      }.`
    });
  } catch (error) {
    return NextResponse.json(
      {
        usage: await getUsageState(aiUsageService),
        suggestions: await listDestinationSuggestions("draft"),
        message: error instanceof Error ? error.message : "Unable to generate suggestions."
      },
      { status: 502 }
    );
  }
}
