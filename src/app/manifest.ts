import type { MetadataRoute } from "next";

/** Lets players install ParyajNet on their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ParyajNet",
    short_name: "ParyajNet",
    description: "Deportes, lotería y casino · Esportes, loteria e cassino",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07111f",
    theme_color: "#07111f",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
