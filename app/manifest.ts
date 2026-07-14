import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "After Hours Agenda",
    short_name: "After Hours",
    description: "Expressive everyday clothing from New York. Printed to order.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#FAFAFA",
    orientation: "portrait-primary",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/brand/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New Arrivals", url: "/new-arrivals", icons: [{ src: "/brand/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Track my order", url: "/track-order", icons: [{ src: "/brand/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bag", url: "/cart", icons: [{ src: "/brand/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
