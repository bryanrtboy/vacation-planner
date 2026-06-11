import { NextResponse } from "next/server";
import { defaultFallbackPhoto } from "@/lib/destination-photos";

export const runtime = "nodejs";

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  mime?: string;
};

type CommonsSearchResponse = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: CommonsImageInfo[];
      }
    >;
  };
};

function safeFallback(value: string | null) {
  if (!value) return defaultFallbackPhoto;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return defaultFallbackPhoto;
    return url.toString();
  } catch {
    return defaultFallbackPhoto;
  }
}

function redirectTo(url: string, status = 302) {
  return NextResponse.redirect(url, {
    status,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800"
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();
  const fallback = safeFallback(url.searchParams.get("fallback"));

  if (!query) return redirectTo(fallback);

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "5",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "1200"
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: {
        "User-Agent": "vacation-planner personal travel app"
      },
      next: { revalidate: 604800 }
    });
    const data = (await response.json().catch(() => ({}))) as CommonsSearchResponse;
    const imageUrl = Object.values(data.query?.pages ?? {})
      .flatMap((page) => page.imageinfo ?? [])
      .find((image) => image.mime?.startsWith("image/") && (image.thumburl || image.url));

    return redirectTo(imageUrl?.thumburl ?? imageUrl?.url ?? fallback);
  } catch {
    return redirectTo(fallback);
  }
}
