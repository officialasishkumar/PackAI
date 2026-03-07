import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PackAI",
    short_name: "PackAI",
    description:
      "Create packing and repacking checklists from luggage photos and short videos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e8",
    theme_color: "#f7f1e8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
