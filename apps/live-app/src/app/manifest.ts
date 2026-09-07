import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Served at `/manifest.webmanifest`; Next links it from every page. */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: `${site.name} — ${site.tagline}`,
		short_name: site.name,
		description: site.manifestDescription,
		id: "/",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: site.themeColor,
		theme_color: site.themeColor,
		categories: ["finance", "productivity"],
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
