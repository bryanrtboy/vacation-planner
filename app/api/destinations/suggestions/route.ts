import { NextResponse } from "next/server";
import { suggestDestinationsWithGemini } from "@/lib/ai/gemini";
import { destinationPhotoSearchUrl, fallbackPhotoForRegion } from "@/lib/destination-photos";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { listDestinationCandidates, writeDestinationCandidate } from "@/lib/storage/destination-store";
import {
  destinationSuggestionStorageState,
  getDestinationSuggestion,
  listDestinationSuggestions,
  updateDestinationSuggestionStatus,
  writeDestinationSuggestions
} from "@/lib/storage/destination-suggestion-store";
import { defaultTripPreferences } from "@/lib/trip-preferences";
import type {
  Destination,
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

function cleanMoodLabel(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized || normalized === "ai suggested" || normalized === "suggested idea") return undefined;
  return normalized.slice(0, 42);
}

function moodLabelFromSuggestion(payload: DestinationSuggestion["payload"]) {
  const explicit = cleanMoodLabel(payload.moodLabel);
  if (explicit) return explicit;

  const interests = payload.interests
    .map((interest) => interest.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3);
  if (interests.length >= 2) return `${interests[0]} and ${interests[1]}`;
  if (interests.length === 1) return interests[0];

  return "slow travel";
}

function transportNoteFromSuggestion(suggestion: DestinationSuggestion, airportTargets: string[]) {
  const airports = airportTargets.filter((target) => /^[A-Z]{3}$/.test(target)).slice(0, 3);
  const airportText = airports.length ? ` Check transfers from ${airports.join(", ")}.` : "";
  return `Use ${suggestion.name} as the base, then verify whether the best day trips need trains, drivers, or a short rental car.${airportText} ${suggestion.payload.tradeoffs}`;
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

function candidateFromSuggestion(suggestion: DestinationSuggestion): Destination {
  const slug = suggestion.destinationSlug ?? slugify(suggestion.name);
  const airportTargets = suggestion.payload.airportTargets.length
    ? suggestion.payload.airportTargets
    : [suggestion.name];
  const moodLabel = moodLabelFromSuggestion(suggestion.payload);
  const region = suggestion.region ?? suggestion.payload.region;

  return {
    slug,
    name: suggestion.name,
    region,
    mapQuery: suggestion.name,
    tripType: suggestion.payload.lodgingAngle,
    fitSummary: suggestion.payload.whyItFits,
    caveat: suggestion.payload.tradeoffs,
    bestMonths: suggestion.payload.bestMonths,
    avoid: suggestion.payload.tradeoffs,
    visualTheme: {
      accentName: "suggested idea",
      bannerClass: "bg-[linear-gradient(135deg,#12363c_0%,#336b73_52%,#8bb8b4_100%)]",
      photoUrl: destinationPhotoSearchUrl({
        name: suggestion.name,
        region,
        moodLabel,
        photoSearch: suggestion.payload.photoSearch,
        fallbackUrl: fallbackPhotoForRegion(region)
      }),
      photoPosition: "center",
      photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
      heroOverlayClass: "from-[#12363c]/96 via-[#336b73]/74 to-[#336b73]/8",
      cardClass: "border-[#336b73]/75 shadow-[0_10px_30px_rgba(30,70,80,0.16)]",
      panelClass: "bg-[#eef8f7] border-[#abd3d0]",
      summaryClass: "bg-[#eef8f7] border-[#abd3d0]",
      highlightClass: "border-[#12363c] bg-[#336b73] text-white",
      highlightInfoClass: "text-[#336b73]",
      buttonClass: "border-[#336b73] bg-[#336b73] text-white hover:bg-[#12363c]",
      watchActiveClass: "border-[#336b73] bg-[#336b73] text-white hover:bg-[#12363c]",
      textClass: "text-[#336b73]",
      moodLabel
    },
    flightSearch: {
      origin: defaultTripPreferences.departure,
      destination: suggestion.name,
      destinationAirports: airportTargets,
      departDate: "2026-10-15",
      returnDate: "2026-10-22"
    },
    transport: "Car useful",
    transportNote: transportNoteFromSuggestion(suggestion, airportTargets),
    monthlyPotential: "Selective",
    sharedRentalPotential: "Possible",
    fit: {
      art: suggestion.payload.interests.includes("art") ? 8 : 6,
      gardens: suggestion.payload.interests.includes("gardens") ? 8 : 6,
      food: suggestion.payload.interests.includes("food") ? 8 : 6,
      landscape:
        suggestion.payload.interests.includes("landscape") ||
        suggestion.payload.interests.includes("coast")
          ? 8
          : 6
    },
    airfare: {
      min: 0,
      max: 0,
      currency: "USD",
      label: "Airfare not checked",
      provider: "Suggested idea",
      sampledDates: "Not checked",
      retrievedAt: new Date().toISOString(),
      sourceDetail: "Suggested destination. Use Check now for airfare.",
      sourceKind: "unavailable"
    },
    lodging: {
      hotel3Star: {
        min: 0,
        max: 0,
        currency: "USD",
        label: "Hotel baseline not checked",
        provider: "Suggested idea",
        sampledDates: "Not checked",
        retrievedAt: new Date().toISOString(),
        sourceDetail: "Suggested destination. Use Check lodging for current lodging prices.",
        sourceKind: "unavailable"
      },
      rental: {
        min: 0,
        max: 0,
        currency: "USD",
        label: "Rental not checked",
        provider: "Suggested idea",
        sampledDates: "Not checked",
        retrievedAt: new Date().toISOString(),
        sourceUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
          suggestion.name
        )}`,
        sourceDetail: "Suggested destination. Use Check lodging for current lodging prices.",
        sourceKind: "unavailable"
      }
    },
    dining: {
      min: 0,
      max: 0,
      currency: "USD",
      label: "Dining not estimated",
      provider: "Suggested idea",
      sampledDates: "Not checked",
      retrievedAt: new Date().toISOString(),
      sourceDetail: "Dining has not been estimated for this suggested destination yet.",
      sourceKind: "unavailable"
    },
    highlights: suggestion.payload.interests,
    curatedFinds: suggestion.payload.starterLinks?.map((link) => ({
      label: link.label,
      note: "Starter research link from the suggestion.",
      url: link.url,
      kind: link.kind === "guide" || link.kind === "transport" ? "day-trip" : link.kind
    })),
    retreatNote: suggestion.payload.photoSearch,
    links:
      suggestion.payload.starterLinks?.map((link) => ({
        label: link.label,
        url: link.url,
        kind: link.kind === "food" ? "guide" : link.kind
      })) ?? []
  };
}

export async function GET() {
  const storageState = await destinationSuggestionStorageState();

  return NextResponse.json({
    storageReady: storageState.ready,
    message: storageState.message,
    usage: await getUsageState(aiUsageService),
    suggestions: storageState.ready ? await listDestinationSuggestions("draft") : []
  });
}

export async function POST(request: Request) {
  const storageState = await destinationSuggestionStorageState();
  if (!storageState.ready) {
    return NextResponse.json(
      {
        storageReady: false,
        usage: await getUsageState(aiUsageService),
        suggestions: [],
        message: storageState.message
      },
      { status: 503 }
    );
  }

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
        storageReady: true,
        suggestions: await listDestinationSuggestions("draft"),
        message: "Daily suggestion cap reached. Existing suggested ideas are still shown."
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

    const saved = await writeDestinationSuggestions(suggestions);

    return NextResponse.json({
      usage: await getUsageState(aiUsageService),
      storageReady: true,
      suggestions: saved ? await listDestinationSuggestions("draft") : suggestions,
      message: saved
        ? `Saved ${suggestions.length} suggested destination idea${
            suggestions.length === 1 ? "" : "s"
          }.`
        : "Suggestions were generated, but could not be saved. Check the migration and logs."
    });
  } catch (error) {
    return NextResponse.json(
      {
        usage: await getUsageState(aiUsageService),
        storageReady: true,
        suggestions: await listDestinationSuggestions("draft"),
        message: error instanceof Error ? error.message : "Unable to generate suggestions."
      },
      { status: 502 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    action?: "accept" | "hide";
  } | null;

  if (!body?.id || !body.action) {
    return NextResponse.json(
      {
        usage: await getUsageState(aiUsageService),
        suggestions: await listDestinationSuggestions("draft"),
        message: "Suggestion id and action are required."
      },
      { status: 400 }
    );
  }

  if (body.action === "hide") {
    await updateDestinationSuggestionStatus(body.id, "hidden");
    return NextResponse.json({
      usage: await getUsageState(aiUsageService),
      suggestions: await listDestinationSuggestions("draft"),
      message: "Suggestion hidden."
    });
  }

  const suggestion = await getDestinationSuggestion(body.id);
  if (!suggestion) {
    return NextResponse.json(
      {
        usage: await getUsageState(aiUsageService),
        suggestions: await listDestinationSuggestions("draft"),
        message: "Suggestion was not found in saved ideas."
      },
      { status: 404 }
    );
  }

  const saved = await writeDestinationCandidate(candidateFromSuggestion(suggestion));
  if (!saved) {
    return NextResponse.json(
      {
        usage: await getUsageState(aiUsageService),
        suggestions: await listDestinationSuggestions("draft"),
        message: "Unable to add the suggestion to destination ideas."
      },
      { status: 502 }
    );
  }

  await updateDestinationSuggestionStatus(body.id, "accepted");

  return NextResponse.json({
    usage: await getUsageState(aiUsageService),
    suggestions: await listDestinationSuggestions("draft"),
    message: "Suggestion added to destination ideas."
  });
}
