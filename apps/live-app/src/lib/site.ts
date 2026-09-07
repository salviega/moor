/**
 * What the outside world reads about Moor before opening it: the tab title,
 * the search snippet, the link preview, the installed-app card. One place, so
 * the layout, the web manifest, robots and the sitemap never disagree. The
 * Ledger Live manifest (`/manifest.json`) carries the same words by hand — it
 * is JSON Ledger reads, not something Next serves.
 */
import { env } from "./env";

export const site = {
	url: env.NEXT_PUBLIC_SITE_URL,
	name: "Moor",
	title: "Moor — Turn holding time into productive capital",
	titleTemplate: "%s · Moor",
	tagline: "Productive holding on your hardware wallet",
	description:
		"Earn fees on your idle crypto without it ever leaving your hardware wallet. Define a position once, sign it on your Ledger, and let it work while you wait for your price.",
	shortDescription: "Earn fees on your idle crypto without it ever leaving your hardware wallet.",
	manifestDescription:
		"Earn fees on idle assets without them ever leaving your hardware wallet. Programmable positions on 1inch Aqua, named with ENS, signed on Ledger.",
	ogImage: {
		path: "/og-image.png",
		width: 1200,
		height: 630,
		alt: "Moor — turn holding time into productive capital",
	},
	/** Ink, the brand's ground. Tab bar, splash and the installed-app frame all use it. */
	themeColor: "#0A0E14",
	locale: "en_US",
	/** Public routes worth indexing. Positions are read-only pages keyed by an ENS label and are not listed. */
	routes: ["/", "/new", "/setup"] as const,
} as const;
