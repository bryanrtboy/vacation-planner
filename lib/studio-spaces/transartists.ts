import {
  classifyStudioKind,
  cleanText,
  compactHash,
  excerpt,
  scoreStudioLead,
  studioLeadIsUseful,
  studioMediumTags,
  type StudioSpaceLeadPayload
} from "./shared.ts";

const transArtistsStudioSpacesUrl = "https://www.transartists.org/en/studio-spaces";
const transArtistsSourceName = "TransArtists Studio Spaces";
const transArtistsFetchTimeoutMs = 1000 * 20;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&euro;/g, "€")
    .replace(/&pound;/g, "£")
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function htmlToLines(html: string) {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|article|section)>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
}

function normalizePostedDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function extractPriceText(value: string) {
  const patterns = [
    /(?:price|pricing|rent|cost|fee)[:\s][^.]{0,180}/i,
    /(?:€|£|\$)\s?\d[\d,.]*(?:\s?(?:eur|euro|usd|gbp|per|\/)\s?[^.]{0,90})?/i,
    /\b\d[\d,.]*\s?(?:eur|euro|usd|gbp)\b[^.]{0,90}/i
  ];
  return patterns.map((pattern) => value.match(pattern)?.[0]).find(Boolean);
}

function extractAvailabilityText(value: string) {
  const patterns = [
    /(?:available|availability|dates?)[:\s][^.]{0,220}/i,
    /(?:from|between)\s+(?:\d{1,2}\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[^.]{0,180}/i,
    /\b(?:august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{4}\b[^.]{0,140}/i
  ];
  return patterns.map((pattern) => value.match(pattern)?.[0]).find(Boolean);
}

function extractDurationText(value: string) {
  const match = value.match(
    /\b(?:duration|for|from)\b[^.]{0,80}\b(?:days?|weeks?|months?|year|years)\b[^.]{0,90}/i
  );
  return match?.[0];
}

function extractContactText(value: string) {
  const email = value.match(/[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|@)\s*[A-Z0-9.-]+/i)?.[0];
  if (email) return email;
  return value.match(/(?:email|contact)[:\s][^.]{0,160}/i)?.[0];
}

function extractCityCountry(title: string, body: string) {
  const text = `${title}. ${body}`;
  const explicitPatterns = [
    /\bin\s+([A-Z][A-Za-zÀ-ÿ' -]{2,40})(?:,\s*([A-Z][A-Za-zÀ-ÿ' -]{2,40}))?/,
    /\bnear\s+([A-Z][A-Za-zÀ-ÿ' -]{2,40})(?:,\s*([A-Z][A-Za-zÀ-ÿ' -]{2,40}))?/,
    /\bfrom\s+([A-Z][A-Za-zÀ-ÿ' -]{2,40})(?:,\s*([A-Z][A-Za-zÀ-ÿ' -]{2,40}))?/
  ];
  const stopWords = new Set([
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "Artist Studio",
    "Studio Space"
  ]);

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    const city = match?.[1]?.trim();
    if (city && !stopWords.has(city)) {
      return {
        city,
        country: match?.[2]?.trim()
      };
    }
  }

  const knownCities = [
    "Barcelona",
    "Berlin",
    "Montreuil",
    "Munich",
    "Paris",
    "Galicia",
    "North Yorkshire",
    "Scarborough",
    "Whitby",
    "Helsinki",
    "Lisbon",
    "Madrid",
    "New York",
    "Brooklyn"
  ];
  const city = knownCities.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(text));
  return { city: city ?? "Review source" };
}

function listingChunks(lines: string[]) {
  const chunks: { postedDate: string; title: string; body: string }[] = [];
  let current: { postedDate: string; title?: string; body: string[] } | null = null;

  for (const line of lines) {
    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*\|?$/);
    if (dateMatch) {
      if (current?.title) {
        chunks.push({
          postedDate: current.postedDate,
          title: current.title,
          body: current.body.join(" ")
        });
      }
      current = { postedDate: dateMatch[1], body: [] };
      continue;
    }

    if (!current) continue;
    if (!current.title) {
      if (line.length < 6 || /^studio spaces$/i.test(line)) continue;
      current.title = line;
      continue;
    }
    current.body.push(line);
  }

  if (current?.title) {
    chunks.push({
      postedDate: current.postedDate,
      title: current.title,
      body: current.body.join(" ")
    });
  }

  return chunks;
}

export function parseTransArtistsStudioSpaces(html: string, fetchedAt = new Date().toISOString()) {
  const lines = htmlToLines(html);
  return listingChunks(lines)
    .map((chunk): StudioSpaceLeadPayload | null => {
      const title = cleanText(chunk.title);
      const body = cleanText(chunk.body);
      const text = `${title}. ${body}`;
      const kind = classifyStudioKind(text);
      if (!studioLeadIsUseful(kind, text)) return null;

      const location = extractCityCountry(title, body);
      const postedDate = normalizePostedDate(chunk.postedDate);
      const sourceUrl = transArtistsStudioSpacesUrl;
      const id = compactHash([sourceUrl, title, postedDate ?? chunk.postedDate].join("|").toLowerCase());
      const workspaceNote = body.match(/(?:studio|workspace|working space|atelier)[^.]{0,220}/i)?.[0];
      const accommodationNote = body.match(/(?:room|loft|flat|apartment|living|accommodation|sleeping)[^.]{0,220}/i)?.[0];
      const mediumTags = studioMediumTags(text);

      return {
        id,
        status: "new",
        kind,
        title,
        city: location.city,
        country: location.country,
        sourceUrl,
        sourceName: transArtistsSourceName,
        postedDate,
        availabilityText: extractAvailabilityText(text),
        priceText: extractPriceText(text),
        durationText: extractDurationText(text),
        accommodationNote,
        workspaceNote,
        contactText: extractContactText(text),
        mediumTags,
        summary: excerpt(body || title),
        score: scoreStudioLead(kind, text, 1),
        wasSaved: false,
        lastSeenAt: fetchedAt,
        rawResponseJson: JSON.stringify({ source: transArtistsSourceName, postedDate: chunk.postedDate, title, body }),
        model: "transartists-direct"
      };
    })
    .filter((lead): lead is StudioSpaceLeadPayload => Boolean(lead));
}

export async function fetchTransArtistsStudioSpaces() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), transArtistsFetchTimeoutMs);
  try {
    const response = await fetch(transArtistsStudioSpacesUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "vacation-planner-studio-space-finder/1.0"
      }
    });
    if (!response.ok) throw new Error(`TransArtists returned ${response.status}.`);
    return parseTransArtistsStudioSpaces(await response.text());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("TransArtists studio spaces request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
