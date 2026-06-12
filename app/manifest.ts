import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trip Ideas",
    short_name: "Trip Ideas",
    description: "Private curated travel research with manual price snapshots.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf7",
    theme_color: "#3f7784"
  };
}
