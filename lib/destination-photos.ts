import type { Destination } from "@/lib/types";

export const fallbackPhotoByRegion: Record<string, string> = {
  Austria: "https://commons.wikimedia.org/wiki/Special:FilePath/Graz-hauptplatz-2007.jpg?width=800",
  Canada:
    "https://commons.wikimedia.org/wiki/Special:FilePath/British%20Columbia%20Parliament%20Buildings%20-%20Pano%20-%20HDR.jpg?width=800",
  Italy:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Panoramica%20Cattedrale%20di%20Palermo.jpg?width=800",
  Mexico: "https://commons.wikimedia.org/wiki/Special:FilePath/Colonial%20Oaxaca.jpg?width=800",
  Morocco:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Morocco%20-%20Essaouira%20Part%202%20%2831679848385%29.jpg?width=800",
  Portugal:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Puente%20Don%20Luis%20I%2C%20Oporto%2C%20Portugal%2C%202012-05-09%2C%20DD%2013.JPG?width=800",
  Slovenia:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ljubljana%20Old%20Town%2C%20Slovenia%20%28Old%20Camera%29%20%2833286165680%29.jpg?width=800",
  Spain:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ciutat%20de%20les%20Arts%20i%20les%20Ci%C3%A8ncies%20at%20night%2C%20May%202017.jpg?width=800",
  "United States":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Palace%20of%20the%20Governors.jpg?width=800"
};

export const defaultFallbackPhoto =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Puente%20Don%20Luis%20I%2C%20Oporto%2C%20Portugal%2C%202012-05-09%2C%20DD%2013.JPG?width=800";

function safePhotoTerms(values: (string | undefined)[]) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/[^\p{L}\p{N}\s,'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function fallbackPhotoForRegion(region: string) {
  return fallbackPhotoByRegion[region] ?? defaultFallbackPhoto;
}

export function destinationPhotoSearchUrl(input: {
  name: string;
  region?: string;
  moodLabel?: string;
  photoSearch?: string;
  fallbackUrl?: string;
}) {
  const query = safePhotoTerms([
    input.photoSearch,
    input.name,
    input.region,
    input.moodLabel,
    "travel"
  ]);
  const params = new URLSearchParams({
    query,
    fallback: input.fallbackUrl ?? fallbackPhotoForRegion(input.region ?? "")
  });

  return `/api/destinations/photo?${params.toString()}`;
}

export function destinationPhotoSearchUrlFromDestination(destination: Destination, moodLabel: string) {
  return destinationPhotoSearchUrl({
    name: destination.name,
    region: destination.region,
    moodLabel,
    photoSearch: destination.retreatNote,
    fallbackUrl: fallbackPhotoForRegion(destination.region)
  });
}
