import { GEMINI_MODEL } from "@/lib/settings";
import { getEnvValue } from "@/lib/storage/cloudflare";
import type { DestinationSuggestion } from "@/lib/types";

const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";

export type SuggestDestinationsInput = {
  promptKind: DestinationSuggestion["promptKind"];
  region?: string;
  parentName?: string;
  existingDestinations: {
    name: string;
    region: string;
    tripType: string;
    bestMonths: string;
    fitSummary: string;
    interests: string[];
  }[];
  preferences: {
    departure: string;
    flightCount: number;
    nights: number;
    lodging: string;
    interests: string;
  };
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

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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
  const parsed = JSON.parse(stripCodeFence(text)) as { suggestions?: SuggestedDestinationPayload[] };
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

function promptForSuggestions(input: SuggestDestinationsInput) {
  return `Suggest 3 to 5 travel destination ideas for a personal art-and-slow-travel planner.

Hard rules:
- Return only JSON with a top-level "suggestions" array.
- Do not include airfare or lodging prices.
- Include a rough dining estimate in USD per day for two adults. It can be approximate, but it should be useful for planning. Base it on the local cost level, casual restaurant meals, cafes, markets, and a modest amount of nicer dining. Use confidence "low" when evidence is thin.
- Do not invent current event dates unless you are confident; describe event/gallery potential generally.
- Prefer places accessible from ${input.preferences.departure}.
- Match interests: ${input.preferences.interests}.
- Lodging preference: ${input.preferences.lodging}; ${input.preferences.flightCount} flight tickets; ${
    input.preferences.nights
  } nights.
- Avoid duplicating existing destinations by name.
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
        maxOutputTokens: 2200,
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
