import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Artist Travel Finder",
    short_name: "Travel Finder",
    description: "Private curated travel research with price-watch guardrails.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf7",
    theme_color: "#3f7784"
  };
}
