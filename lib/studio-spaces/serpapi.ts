import { getEnvValue } from "@/lib/storage/cloudflare";
import {
  classifyStudioKind,
  cleanText,
  compactHash,
  scoreStudioLead,
  studioLeadIsUseful,
  studioLeadLooksLikeRealEstateNoise,
  studioMediumTags,
  type StudioSpaceLeadPayload
} from "@/lib/studio-spaces/shared";

const serpApiEndpoint = "https://serpapi.com/search";
const studioSearchTimeoutMs = 1000 * 25;

type SerpApiOrganicResult = {
  position?: number;
  title?: string;
  link?: string;
  source?: string;
  displayed_link?: string;
  snippet?: string;
  date?: string;
};

type SerpApiGoogleResponse = {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
};

function sourceName(result: SerpApiOrganicResult) {
  if (result.source) return result.source;
  if (result.displayed_link) return result.displayed_link.replace(/^https?:\/\//, "");

  try {
    return result.link ? new URL(result.link).hostname.replace(/^www\./, "") : "Source";
  } catch {
    return "Source";
  }
}

function studioSpaceQuery(city: string) {
  const safeCity = city.trim().replace(/"/g, "");
  return [
    `"${safeCity}"`,
    '("artist studio space" OR "artist workspace" OR "artist live work" OR "artist live/work" OR "artist studio swap" OR "artist studio sublet" OR "art studio rental" OR "atelier rental" OR "room + studio" OR "room and studio")',
    "(temporary OR short-term OR sublet OR swap OR available OR rent)",
    "-airbnb -hotel -workshop -class -\"studio apartment\" -apartments -zillow -booking -vrbo"
  ].join(" ");
}

function normalizeOrganicResult(
  result: SerpApiOrganicResult,
  city: string,
  query: string
): StudioSpaceLeadPayload | null {
  if (!result.link || !result.title) return null;

  const source = sourceName(result);
  const text = cleanText([result.title, result.snippet, source, result.displayed_link].filter(Boolean).join(" "));
  const kind = classifyStudioKind(text);
  if (studioLeadLooksLikeRealEstateNoise(text)) return null;
  if (!studioLeadIsUseful(kind, text)) return null;
  if (!new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) return null;

  const sourceScore = /gerties|nyfa|transartists|artist/i.test(source) ? 1 : 0;
  const score = scoreStudioLead(kind, text, sourceScore);
  if (score < 5) return null;

  return {
    id: compactHash([city, result.title, result.link].join("|").toLowerCase()),
    status: "new",
    kind,
    title: result.title,
    city,
    sourceUrl: result.link,
    sourceName: source,
    postedDate: result.date,
    availabilityText: result.snippet?.match(/(?:available|availability|from|dates?)[:\s][^.]{0,180}/i)?.[0],
    priceText: result.snippet?.match(/(?:€|£|\$)\s?\d[\d,.]*[^.]{0,90}/i)?.[0],
    durationText: result.snippet?.match(/\b(?:days?|weeks?|months?)\b[^.]{0,90}/i)?.[0],
    accommodationNote: result.snippet?.match(/(?:room|loft|flat|apartment|living|accommodation)[^.]{0,180}/i)?.[0],
    workspaceNote: result.snippet?.match(/(?:studio|workspace|working space|atelier)[^.]{0,180}/i)?.[0],
    mediumTags: studioMediumTags(text),
    summary:
      result.snippet ??
      "Source candidate found by a controlled Google organic search. Open the source to confirm details.",
    score,
    wasSaved: false,
    lastSeenAt: new Date().toISOString(),
    rawResponseJson: JSON.stringify({ query, result }),
    model: "serpapi-google-organic"
  };
}

function dedupeLeads(leads: StudioSpaceLeadPayload[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = [lead.sourceUrl, lead.title, lead.city].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findStudioSpacesWithSerpApi(city: string) {
  const apiKey = await getEnvValue("SERPAPI_API_KEY");
  if (!apiKey) throw new Error("SerpAPI key is not configured.");

  const searchCity = city.trim().slice(0, 80);
  if (!searchCity) return { rawResponseJson: "", leads: [] };

  const query = studioSpaceQuery(searchCity);
  const params = new URLSearchParams({
    engine: "google",
    api_key: apiKey,
    q: query,
    num: "10",
    hl: "en",
    gl: "us"
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), studioSearchTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${serpApiEndpoint}?${params.toString()}`, {
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `SerpAPI request timed out after ${Math.round(studioSearchTimeoutMs / 1000)} seconds for ${searchCity}.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as SerpApiGoogleResponse;
  if (!response.ok) throw new Error(data.error ?? `SerpAPI returned ${response.status}.`);
  if (data.error) throw new Error(data.error);

  const leads = dedupeLeads(
    (data.organic_results ?? [])
      .map((result) => normalizeOrganicResult(result, searchCity, query))
      .filter((lead): lead is StudioSpaceLeadPayload => Boolean(lead))
  ).slice(0, 6);

  return {
    rawResponseJson: JSON.stringify(data),
    leads
  };
}
