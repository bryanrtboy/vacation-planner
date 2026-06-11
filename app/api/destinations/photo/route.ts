import { NextResponse } from "next/server";
import { defaultFallbackPhoto } from "@/lib/destination-photos";
import { updateDestinationPhoto } from "@/lib/storage/destination-store";

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

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    photoUrl?: string;
  } | null;
  const slug = body?.slug?.trim();
  const photoUrl = body?.photoUrl?.trim();

  if (!slug || !photoUrl) {
    return NextResponse.json({ ok: false, message: "Destination and photo URL are required." }, { status: 400 });
  }

  try {
    const parsed = new URL(photoUrl);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ ok: false, message: "Photo URL must start with https://." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, message: "Photo URL is not valid." }, { status: 400 });
  }

  const ok = await updateDestinationPhoto(slug, photoUrl);
  return NextResponse.json(
    {
      ok,
      photoUrl,
      message: ok ? "Photo saved." : "Unable to save photo."
    },
    { status: ok ? 200 : 500 }
  );
}
