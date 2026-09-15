import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Petish",
    short_name: "Petish",
    description:
      "A little home for your pets, their stories, and everyday care.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbf8f5",
    theme_color: "#38293f",
    lang: "en",
    categories: ["lifestyle"],
    icons: [
      {
        src: "/icons/petish-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/petish-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/petish-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
