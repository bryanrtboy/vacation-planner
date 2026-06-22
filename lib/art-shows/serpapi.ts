import { getEnvValue } from "@/lib/storage/cloudflare";
import type { ArtShowLead } from "@/lib/types";

const serpApiEndpoint = "https://serpapi.com/search";
const artShowSearchTimeoutMs = 1000 * 25;
const oldestUsefulResultYear = 2023;

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
  search_metadata?: {
    google_url?: string;
  };
  error?: string;
};

type ArtShowLeadPayload = Omit<
  ArtShowLead,
  "createdAt" | "updatedAt" | "reviewedAt"
>;

const artSearchCanonicalTerms: Record<string, string> = {
  "anselm keifer": "Anselm Kiefer",
  "berthe morrisot": "Berthe Morisot",
  manet: "Edouard Manet",
  ingres: "Jean-Auguste-Dominique Ingres",
  "francis alys": "Francis Alys OR Francis Alÿs",
  raphael: "Raphael OR Raffaello Sanzio",
  carravagio: "Caravaggio Michelangelo Merisi",
  caravaggio: "Caravaggio Michelangelo Merisi"
};

const weakSourcePattern =
  /\b(auction|auctions|bid|bidding|sale|sales|lot\b|price|prices|poster|print for sale|inventory|artsy\.net\/artwork|mutualart|invaluable|1stdibs|ebay)\b/i;
const exhibitionPattern =
  /\b(exhibition|exhibitions|retrospective|on view|opens?|opening|museum|gallery|galleries|kunsthalle|foundation|fondation|centre|center|institute|show|biennial|triennial)\b/i;
const futureDatePattern = /\b(2026|2027|2028|2029|opens?|opening|announced|upcoming|on view|through)\b/i;
const monthPattern =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const explicitDatePattern = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthPattern})\\.?\\s*,?\\s+\\d{4}|(?:${monthPattern})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?\\s+\\d{4})`;
const monthIndexByName: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

function compactHash(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
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

function sourceName(result: SerpApiOrganicResult) {
  if (result.source) return result.source;
  if (result.displayed_link) return result.displayed_link.replace(/^https?:\/\//, "");

  try {
    return result.link ? new URL(result.link).hostname.replace(/^www\./, "") : "Source";
  } catch {
    return "Source";
  }
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistMatcher(artist: string) {
  const canonical = canonicalArtSearchTerm(artist);
  const variants = [artist, canonical]
    .flatMap((value) => value.split(/\s+OR\s+/i))
    .map(normalizeForMatch)
    .filter(Boolean);

  return {
    label: artist,
    matches(value: string) {
      const normalized = normalizeForMatch(value);
      return variants.some((variant) => {
        if (variant.length <= 6) return normalized.split(/\s+/).includes(variant);
        const words = variant.split(/\s+/).filter((word) => word.length > 2);
        return words.length ? words.every((word) => normalized.includes(word)) : false;
      });
    }
  };
}

function scoreResult(value: string, position: number) {
  let score = 6;
  if (futureDatePattern.test(value)) score += 1;
  if (/\b(retrospective|solo exhibition|major exhibition|museum)\b/i.test(value)) score += 1;
  if (position <= 3) score += 1;
  if (weakSourcePattern.test(value)) score -= 3;
  return Math.max(1, Math.min(score, 9));
}

function resultDateYear(value: string | undefined) {
  if (!value) return null;
  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;

  const year = Number(yearMatch[0]);
  return Number.isFinite(year) ? year : null;
}

function resultHasOldPostDate(value: string | undefined) {
  const year = resultDateYear(value);
  return typeof year === "number" && year < oldestUsefulResultYear;
}

function parseExplicitDate(value: string) {
  const normalized = value.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1").replace(/\./g, "");
  const dayFirst = normalized.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\s*,?\\s+(\\d{4})\\b`, "i")
  );
  const monthFirst = normalized.match(
    new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})\\s*,?\\s+(\\d{4})\\b`, "i")
  );
  const match = dayFirst ?? monthFirst;
  if (!match) return null;

  const monthName = (dayFirst ? match[2] : match[1]).slice(0, 3).toLowerCase();
  const monthIndex = monthIndexByName[monthName];
  const day = Number(dayFirst ? match[1] : match[2]);
  const year = Number(dayFirst ? match[3] : match[3]);
  if (
    typeof monthIndex !== "number" ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59));
}

function explicitExhibitionEndDate(value: string) {
  const normalized = value.replace(/[–—]/g, "-");
  const patterns = [
    new RegExp(`\\b(?:on view|view|runs?|running|open|exhibition dates?|dates?)\\b.{0,120}\\b(?:through|thru|until|to|-)\\s*(${explicitDatePattern})`, "i"),
    new RegExp(`\\b(?:through|thru|until)\\s+(${explicitDatePattern})`, "i"),
    new RegExp(`\\b${explicitDatePattern}\\s*(?:-|to|through|thru|until)\\s*(${explicitDatePattern})`, "i")
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const date = parseExplicitDate(match[1]);
    if (date) return date;
  }

  return null;
}

function hasPastExplicitExhibitionEndDate(value: string) {
  const endDate = explicitExhibitionEndDate(value);
  if (!endDate) return false;

  const today = new Date();
  const startOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return endDate.getTime() < startOfToday.getTime();
}

function normalizeOrganicResult(
  result: SerpApiOrganicResult,
  artists: string[],
  query: string
): ArtShowLeadPayload | null {
  if (!result.link || !result.title) return null;
  if (resultHasOldPostDate(result.date)) return null;

  const text = [result.title, result.snippet, result.source, result.displayed_link].filter(Boolean).join(" ");
  if (hasPastExplicitExhibitionEndDate(text)) return null;
  if (weakSourcePattern.test(text) || !exhibitionPattern.test(text)) return null;

  const matchedArtist = artists.map(artistMatcher).find((matcher) => matcher.matches(text));
  if (!matchedArtist) return null;

  const source = sourceName(result);
  const score = scoreResult(text, result.position ?? 10);
  if (score < 6) return null;

  return {
    id: compactHash([matchedArtist.label, result.title, result.link].join("|").toLowerCase()),
    status: "new",
    artist: matchedArtist.label,
    title: result.title,
    venue: source,
    city: "Review source",
    dateText: result.date ?? "Review source for dates",
    sourceUrl: result.link,
    sourceName: source,
    summary:
      result.snippet ??
      "Source candidate found by a controlled Google organic search. Open the source to confirm dates and venue.",
    travelReason:
      "Possible exhibition lead from a visible search result; confirm source details before planning travel.",
    score,
    rawResponseJson: JSON.stringify({ query, result }),
    model: "serpapi-google-organic"
  };
}

function dedupeLeads(leads: ArtShowLeadPayload[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = [lead.sourceUrl, lead.artist, lead.title].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function artShowQuery(artists: string[]) {
  const artistTerms = [
    ...new Set(
      artists.flatMap((artist) => [artist, canonicalArtSearchTerm(artist)])
        .flatMap((artist) => artist.split(/\s+OR\s+/i))
        .map((artist) => artist.trim())
        .filter(Boolean)
        .map((artist) => `"${artist}"`)
    )
  ];
  return [
    `(${artistTerms.join(" OR ")})`,
    '(exhibition OR retrospective OR "on view" OR "museum show" OR "gallery show")',
    '(2026 OR 2027 OR 2028 OR upcoming OR announced OR opens OR opening)',
    "-auction -auctions -sale -prices -lot"
  ].join(" ");
}

export async function findArtShowsWithSerpApi(artists: string[]) {
  const apiKey = await getEnvValue("SERPAPI_API_KEY");
  if (!apiKey) throw new Error("SerpAPI key is not configured.");

  const watchedArtists = artists.map((artist) => artist.trim()).filter(Boolean).slice(0, 8);
  if (!watchedArtists.length) return { rawResponseJson: "", leads: [] };

  const query = artShowQuery(watchedArtists);
  const params = new URLSearchParams({
    engine: "google",
    api_key: apiKey,
    q: query,
    num: "10",
    hl: "en",
    gl: "us"
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), artShowSearchTimeoutMs);

  const response = await fetch(`${serpApiEndpoint}?${params.toString()}`, {
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));
  const data = (await response.json().catch(() => ({}))) as SerpApiGoogleResponse;

  if (!response.ok) {
    throw new Error(data.error ?? `SerpAPI returned ${response.status}.`);
  }
  if (data.error) throw new Error(data.error);

  const leads = dedupeLeads(
    (data.organic_results ?? [])
      .map((result) => normalizeOrganicResult(result, watchedArtists, query))
      .filter((lead): lead is ArtShowLeadPayload => Boolean(lead))
  ).slice(0, 5);

  return {
    rawResponseJson: JSON.stringify(data),
    leads
  };
}
