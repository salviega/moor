import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
	return site.routes.map((path) => ({
		url: new URL(path, site.url).toString(),
		changeFrequency: "weekly",
		priority: path === "/" ? 1 : 0.6,
	}));
}
