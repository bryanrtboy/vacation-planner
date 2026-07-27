import type { StudioSpaceLead, StudioSpaceLeadKind } from "@/lib/types";

export type StudioSpaceLeadPayload = Omit<
  StudioSpaceLead,
  "createdAt" | "updatedAt" | "reviewedAt"
>;

const mediumPatterns: [string, RegExp][] = [
  ["ceramics", /\b(ceramic|ceramics|pottery|kiln|wheel)\b/i],
  ["painting", /\b(painting|painter|easel|drawing)\b/i],
  ["sculpture", /\b(sculpture|sculptor|installation|wood|metal)\b/i],
  ["textile", /\b(textile|fiber|fibre|weaving|sewing)\b/i],
  ["writing", /\b(writer|writing|research|desk)\b/i],
  ["digital", /\b(digital|photography|video|film|media)\b/i],
  ["performance", /\b(performance|dance|rehearsal|theater|theatre)\b/i]
];

export function compactHash(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
}

export function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export function normalizeForStudioMatch(value: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function classifyStudioKind(value: string): StudioSpaceLeadKind {
  const normalized = normalizeForStudioMatch(value);
  if (/\b(i am|i'm|im|we are|looking|seeking|wanted|want to rent)\b/.test(normalized)) {
    if (/\b(looking|seeking|wanted|want to rent)\b/.test(normalized)) return "wanted";
  }
  if (/\b(swap|exchange|house swap|studio swap|flat swap)\b/.test(normalized)) return "swap";
  if (/\b(not a living space|not live|no overnight|overnight stays are not permitted|studio only|workspace only|exclusively a workspace)\b/.test(normalized)) {
    return "studio-only";
  }
  if (/\b(room plus studio|room studio|room and studio|accommodation and (a )?studio)\b/.test(normalized)) {
    return "room-plus-studio";
  }
  if (/\b(live work|live-work|live and work|living and working|living working|living space|live-in|live in|loft \+ studio|loft and studio)\b/.test(normalized)) {
    return "live-work";
  }
  if (/\b(studio|workspace|working space|atelier)\b/.test(normalized)) return "studio-only";
  return "unknown";
}

export function studioMediumTags(value: string) {
  return mediumPatterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([label]) => label);
}

export function scoreStudioLead(kind: StudioSpaceLeadKind, value: string, sourceScore = 0) {
  let score = 4 + sourceScore;
  if (kind === "live-work" || kind === "room-plus-studio") score += 3;
  if (kind === "swap") score += 2;
  if (kind === "wanted") score -= 2;
  if (/\b(price|eur|euro|usd|\$|€|£|month|week)\b/i.test(value)) score += 1;
  if (/\b(available|availability|from|duration|dates?)\b/i.test(value)) score += 1;
  if (/\b(email|contact|@|\[at\])\b/i.test(value)) score += 1;
  if (/\b(not a living space|studio only|no overnight)\b/i.test(value)) score -= 1;
  return Math.max(1, Math.min(score, 10));
}

export function studioLeadIsUseful(kind: StudioSpaceLeadKind, text: string) {
  if (kind === "unknown") return false;
  if (/\b(airbnb|hotel room|vacation rental|workshop class|course)\b/i.test(text)) return false;
  return /\b(artist|studio|workspace|live.?work|living,?\s+working|atelier|loft|swap|sublet|rent|room)\b/i.test(text);
}

export function excerpt(value: string, maxLength = 360) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}
