import { GEMINI_MODEL } from "@/lib/settings";
import { getEnvValue } from "@/lib/storage/cloudflare";
import type { ArtShowLead, DestinationSuggestion, TripPreferences } from "@/lib/types";

const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";
const geminiInteractionsEndpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
const artShowSearchTimeoutMs = 1000 * 45;

export type SuggestDestinationsInput = {
  promptKind: DestinationSuggestion["promptKind"];
  region?: string;
  parentName?: string;
  draftSuggestions: SuggestionMemoryItem[];
  rejectedSuggestions: SuggestionMemoryItem[];
  existingDestinations: {
    name: string;
    region: string;
    tripType: string;
    bestMonths: string;
    fitSummary: string;
    interests: string[];
  }[];
  preferences: Pick<
    TripPreferences,
    "departure" | "travelMode" | "flightCount" | "nights" | "lodging" | "interests"
  >;
};

export type SuggestionMemoryItem = {
  name: string;
  region?: string;
  reason?: string;
};

export type SuggestedDestinationPayload = DestinationSuggestion["payload"];

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  error?: {
    message?: string;
  };
};

type GeminiInteractionResponse = {
  output_text?: string;
  steps?: {
    type?: string;
    content?: {
      type?: string;
      text?: string;
      annotations?: {
        type?: string;
        url?: string;
        title?: string;
      }[];
    }[];
  }[];
  error?: {
    message?: string;
  };
};

type ArtShowLeadPayload = Omit<
  ArtShowLead,
  "id" | "status" | "rawResponseJson" | "model" | "createdAt" | "updatedAt" | "reviewedAt"
>;

const artSearchCanonicalTerms: Record<string, string> = {
  "anselm keifer": "Anselm Kiefer",
  "berthe morrisot": "Berthe Morisot",
  manet: "Edouard Manet",
  ingres: "Jean-Auguste-Dominique Ingres",
  "francis alys": "Francis Alys OR Francis Alÿs",
  raphael: "Raphael OR Raffaello Sanzio",
  carravagio: "Caravaggio OR Michelangelo Merisi da Caravaggio",
  caravaggio: "Caravaggio OR Michelangelo Merisi da Caravaggio"
};

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseSuggestionJson(text: string) {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped) as { suggestions?: SuggestedDestinationPayload[] };
  } catch (error) {
    const suggestions = salvageCompleteSuggestions(stripped);
    if (suggestions.length) return { suggestions };
    throw error;
  }
}

function salvageCompleteSuggestions(text: string): SuggestedDestinationPayload[] {
  const suggestionsKeyIndex = text.indexOf('"suggestions"');
  if (suggestionsKeyIndex < 0) return [];

  const arrayStart = text.indexOf("[", suggestionsKeyIndex);
  if (arrayStart < 0) return [];

  const suggestions: SuggestedDestinationPayload[] = [];
  let objectStart = -1;
  let objectDepth = 0;
  let inString = false;
  let escaping = false;

  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const char = text[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (inString) {
      if (char === "\\") {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (objectDepth === 0) objectStart = index;
      objectDepth += 1;
      continue;
    }

    if (char === "}") {
      objectDepth -= 1;
      if (objectDepth === 0 && objectStart >= 0) {
        const objectText = text.slice(objectStart, index + 1);
        try {
          suggestions.push(JSON.parse(objectText) as SuggestedDestinationPayload);
        } catch {
          // Ignore the partial object and keep any earlier complete suggestions.
        }
        objectStart = -1;
      }
    }
  }

  return suggestions;
}

function parseDiningEstimate(suggestion: SuggestedDestinationPayload) {
  const estimate = suggestion.diningEstimate;
  if (!estimate) return undefined;

  const min = Math.round(Number(estimate.minDailyUsdForTwo));
  const max = Math.round(Number(estimate.maxDailyUsdForTwo));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return undefined;

  const confidence = ["low", "medium", "high"].includes(String(estimate.confidence))
    ? estimate.confidence
    : "low";

  return {
    minDailyUsdForTwo: Math.min(min, max),
    maxDailyUsdForTwo: Math.max(min, max),
    confidence,
    rationale: String(
      estimate.rationale ??
        "Rough food budget inferred from local cost level and casual restaurant pricing."
    )
  };
}

function parseStringList(value: unknown, limit: number) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, limit) : undefined;
}

function parseSuggestions(text: string): SuggestedDestinationPayload[] {
  const parsed = parseSuggestionJson(text);
  if (!Array.isArray(parsed.suggestions)) return [];

  return parsed.suggestions
    .filter((suggestion) => suggestion?.name && suggestion?.region && suggestion?.whyItFits)
    .slice(0, 6)
    .map((suggestion) => ({
      name: String(suggestion.name),
      region: String(suggestion.region),
      moodLabel: suggestion.moodLabel ? String(suggestion.moodLabel) : undefined,
      whyItFits: String(suggestion.whyItFits),
      bestMonths: String(suggestion.bestMonths ?? "Shoulder season"),
      tradeoffs: String(suggestion.tradeoffs ?? "Needs manual review."),
      airportTargets: Array.isArray(suggestion.airportTargets)
        ? suggestion.airportTargets.map(String).slice(0, 4)
        : [],
      lodgingAngle: String(suggestion.lodgingAngle ?? "Review hotels and rentals manually."),
      diningEstimate: parseDiningEstimate(suggestion),
      interests: Array.isArray(suggestion.interests)
        ? suggestion.interests.map(String).slice(0, 8)
        : [],
      artNotes: parseStringList(suggestion.artNotes, 5),
      foodNotes: parseStringList(suggestion.foodNotes, 5),
      landscapeNotes: parseStringList(suggestion.landscapeNotes, 5),
      offbeatFinds: parseStringList(suggestion.offbeatFinds, 6),
      starterLinks: Array.isArray(suggestion.starterLinks)
        ? suggestion.starterLinks
            .filter((link) => link?.label && link?.url)
            .slice(0, 6)
            .map((link) => ({
              label: String(link.label),
              url: String(link.url),
              kind: ["art", "food", "lodging", "transport", "guide", "landscape", "day-trip"].includes(
                String(link.kind)
              )
                ? link.kind
                : "guide"
            }))
        : undefined,
      photoSearch: suggestion.photoSearch ? String(suggestion.photoSearch) : undefined
    }));
}

function parseArtShowLeadJson(text: string) {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped) as { leads?: ArtShowLeadPayload[] };
  } catch {
    const objectStart = stripped.indexOf("{");
    const objectEnd = stripped.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(stripped.slice(objectStart, objectEnd + 1)) as {
        leads?: ArtShowLeadPayload[];
      };
    }
    return { leads: [] };
  }
}

function parseOptionalIsoDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  return text;
}

function normalizeArtShowLead(value: Partial<ArtShowLeadPayload>): ArtShowLeadPayload | null {
  const sourceUrl = String(value.sourceUrl ?? "").trim();
  const artist = String(value.artist ?? "").trim();
  const title = String(value.title ?? "").trim();
  const venue = String(value.venue ?? "").trim();
  const city = String(value.city ?? "").trim();
  const dateText = String(value.dateText ?? "").trim();
  const sourceName = String(value.sourceName ?? "").trim();
  const summary = String(value.summary ?? "").trim();
  const travelReason = String(value.travelReason ?? "").trim();
  const score = Math.round(Number(value.score));

  if (
    !artist ||
    !title ||
    !venue ||
    !city ||
    !dateText ||
    !sourceUrl.startsWith("http") ||
    !sourceName ||
    !summary ||
    !travelReason ||
    !Number.isFinite(score)
  ) {
    return null;
  }

  if (score < 6) return null;

  return {
    artist: artist.slice(0, 120),
    title: title.slice(0, 180),
    venue: venue.slice(0, 160),
    city: city.slice(0, 100),
    country: value.country ? String(value.country).trim().slice(0, 100) : undefined,
    startDate: parseOptionalIsoDate(value.startDate),
    endDate: parseOptionalIsoDate(value.endDate),
    dateText: dateText.slice(0, 160),
    sourceUrl,
    sourceName: sourceName.slice(0, 120),
    summary: summary.slice(0, 360),
    travelReason: travelReason.slice(0, 220),
    score: Math.min(Math.max(score, 0), 10)
  };
}

function canonicalArtSearchTerm(term: string) {
  const normalized = term
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return artSearchCanonicalTerms[normalized] ?? term;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function artShowPrompt(artists: string[]) {
  const searchTerms = artists.map((artist) => canonicalArtSearchTerm(artist));
  const today = new Date();
  const recentStart = addDays(today, -90);
  const horizonEnd = addMonths(today, 24);

  return `Find up to 5 travel-worthy upcoming, currently open, recently opened, or formally announced museum or major gallery exhibitions for this watchlist:
${searchTerms.map((artist) => `- ${artist}`).join("\n")}

Use Google Search. Return only JSON with a top-level "leads" array.

Search window:
- Today is ${isoDate(today)}.
- Include recently opened exhibitions that opened on or after ${isoDate(recentStart)}.
- Include currently open exhibitions.
- Include announced or planned exhibitions with dates, expected seasons, or dates to be announced through ${isoDate(horizonEnd)}.
- Prefer future and currently open shows over shows that have already closed.

Keep only high-confidence exhibition leads:
- Must have an official museum/gallery/foundation source or reputable arts publication source.
- Must have a show title, venue, city, and source URL.
- Must have explicit dates or clear date text such as "dates to be announced".
- Prefer solo exhibitions, retrospectives, major two-artist shows, and major museum/foundation group shows where the watched artist is central.
- Weed out permanent collection pages, auction listings, commercial inventory pages, old closed shows, artist bios, generic collection pages, and minor mentions where one artwork is incidental.
- Do not include more than one lead for the same exhibition.
- Score 1 to 10 for travel-worthiness. Only include leads with score 6 or higher.
- If a watchlist term is a shortened, misspelled, unaccented, or alternate artist name, use the best-known canonical spelling for search and matching.
- In the "artist" field, return the clean display name most people would recognize.

JSON shape:
{
  "leads": [
    {
      "artist": "Matched artist or movement",
      "title": "Exhibition title",
      "venue": "Museum or gallery",
      "city": "City",
      "country": "Country",
      "startDate": "YYYY-MM-DD if known",
      "endDate": "YYYY-MM-DD if known",
      "dateText": "Human-readable dates",
      "sourceUrl": "https://...",
      "sourceName": "Source name",
      "summary": "One concise sentence about the exhibition.",
      "travelReason": "One concise reason this could anchor a trip.",
      "score": 8
    }
  ]
}`;
}

function compactHash(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
}

function leadId(lead: ArtShowLeadPayload) {
  return compactHash(
    [lead.artist, lead.title, lead.venue, lead.city, lead.sourceUrl].join("|").toLowerCase()
  );
}

function interactionOutputText(data: GeminiInteractionResponse) {
  if (data.output_text) return data.output_text;

  return (
    data.steps
      ?.flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text")
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function promptForSuggestions(input: SuggestDestinationsInput) {
  return `Suggest exactly 3 travel destination ideas for a personal art-and-slow-travel planner.

Hard rules:
- Return only JSON with a top-level "suggestions" array.
- Keep every string concise so the JSON is complete.
- Do not include airfare or lodging prices.
- Include a rough dining estimate in USD per day for two adults. It can be approximate, but it should be useful for planning. Base it on the local cost level, casual restaurant meals, cafes, markets, and a modest amount of nicer dining. Use confidence "low" when evidence is thin.
- Do not invent current event dates unless you are confident; describe event/gallery potential generally.
- Prefer places accessible from ${input.preferences.departure}${
    input.preferences.travelMode === "drive" ? " by car without airfare" : " by flight"
  }.
- Match interests: ${input.preferences.interests}.
- Lodging preference: ${input.preferences.lodging}; ${
    input.preferences.travelMode === "drive"
      ? `${input.preferences.flightCount} travelers; driving trip`
      : `${input.preferences.flightCount} flight tickets`
  }; ${
    input.preferences.nights
  } nights.
- Avoid duplicating existing destinations by name.
- Do not suggest anything from the existing, draft, or rejected lists. Avoid nearby equivalents and obvious duplicates too.
- Optimize for thoughtful, high-signal recommendations: good art/museum/gallery potential, compelling landscape or gardens, walkable neighborhoods, food/market appeal, and a few less-obvious or off-the-beaten-path reasons the place belongs on the list.
- Prefer distinctive places over generic famous cities when fit is otherwise similar.
- Include a concise "moodLabel" of 2 to 5 lowercase words, like "coastal tiles", "porticoes and trains", or "gardens and coast".
- Include a short "photoSearch" phrase that can later find a real public-domain or Wikimedia-style card image.
- Include starter links only when they are likely stable official tourism, museum, park, transport, or regional guide pages. Avoid made-up URLs.

Request type: ${input.promptKind}.
${input.region ? `Requested region: ${input.region}.` : ""}
${input.parentName ? `Use ${input.parentName} as the comparison anchor.` : ""}

Existing destinations:
${JSON.stringify(input.existingDestinations, null, 2)}

Draft suggestions already waiting for review:
${JSON.stringify(input.draftSuggestions, null, 2)}

Rejected suggestions to avoid:
${JSON.stringify(input.rejectedSuggestions, null, 2)}

JSON shape:
{
  "suggestions": [
    {
      "name": "City or region name",
      "region": "Country or broad region",
      "moodLabel": "short visual/trip mood",
      "whyItFits": "One sentence explaining the fit.",
      "bestMonths": "Best planning months",
      "tradeoffs": "One practical tradeoff to review.",
      "airportTargets": ["ABC"],
      "lodgingAngle": "What lodging style seems plausible.",
      "diningEstimate": {
        "minDailyUsdForTwo": 90,
        "maxDailyUsdForTwo": 155,
        "confidence": "medium",
        "rationale": "Why this daily dining range is a reasonable planning estimate."
      },
      "interests": ["art", "food", "coast"],
      "artNotes": ["Specific museum, craft, studio, architecture, or gallery angle."],
      "foodNotes": ["Specific market, cuisine, cafe, wine, or dining angle."],
      "landscapeNotes": ["Specific coast, garden, mountain, park, or walking landscape angle."],
      "offbeatFinds": ["Less obvious village, neighborhood, day trip, workshop, garden, or viewpoint."],
      "starterLinks": [
        { "label": "Official visitor guide", "url": "https://example.com", "kind": "guide" }
      ],
      "photoSearch": "Specific image search phrase"
    }
  ]
}`;
}

export async function suggestDestinationsWithGemini(input: SuggestDestinationsInput) {
  const apiKey = await getEnvValue("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const response = await fetch(`${geminiEndpoint}/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptForSuggestions(input) }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.45,
        maxOutputTokens: 5000,
        thinkingConfig: {
          thinkingLevel: "low"
        }
      }
    })
  });

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini returned ${response.status}.`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const suggestions = parseSuggestions(text);
  if (!suggestions.length) {
    throw new Error("Gemini did not return usable destination suggestions.");
  }

  return {
    model: GEMINI_MODEL,
    rawResponseJson: JSON.stringify(data),
    suggestions
  };
}

export async function findArtShowsWithGemini(artists: string[]) {
  const apiKey = await getEnvValue("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const watchedArtists = artists.map((artist) => artist.trim()).filter(Boolean).slice(0, 40);
  if (!watchedArtists.length) {
    return { model: GEMINI_MODEL, rawResponseJson: "", leads: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), artShowSearchTimeoutMs);

  const response = await fetch(geminiInteractionsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Revision": "2026-05-20",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: artShowPrompt(watchedArtists),
      tools: [{ type: "google_search" }]
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));

  const data = (await response.json().catch(() => ({}))) as GeminiInteractionResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini returned ${response.status}.`);
  }

  const text = interactionOutputText(data);
  const parsed = parseArtShowLeadJson(text);
  const rawResponseJson = JSON.stringify(data);
  const leads = Array.isArray(parsed.leads)
    ? parsed.leads
        .map(normalizeArtShowLead)
        .filter((lead): lead is ArtShowLeadPayload => Boolean(lead))
        .slice(0, 5)
        .map((lead) => ({
          id: leadId(lead),
          status: "new" as const,
          ...lead,
          rawResponseJson,
          model: GEMINI_MODEL
        }))
    : [];

  return {
    model: GEMINI_MODEL,
    rawResponseJson,
    leads
  };
}
