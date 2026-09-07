import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "@/components/nav";
import { site } from "@/lib/site";
import { Providers } from "./providers";

export const metadata: Metadata = {
	metadataBase: new URL(site.url),
	title: { default: site.title, template: site.titleTemplate },
	description: site.description,
	applicationName: site.name,
	category: "finance",
	alternates: { canonical: "/" },
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "48x48" },
			{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
		],
		apple: "/icon-180.png",
	},
	openGraph: {
		type: "website",
		siteName: site.name,
		title: site.title,
		description: site.shortDescription,
		url: "/",
		locale: site.locale,
		images: [
			{
				url: site.ogImage.path,
				width: site.ogImage.width,
				height: site.ogImage.height,
				alt: site.ogImage.alt,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: site.title,
		description: site.shortDescription,
		images: [site.ogImage.path],
	},
	robots: { index: true, follow: true },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: site.themeColor,
	colorScheme: "dark",
};

/**
 * Structured data for search engines. Rendered as a text child on purpose —
 * React does not HTML-escape the content of a `<script>`, and the only thing
 * that could break out of one is a closing tag, which `<` is escaped against.
 * Nothing here comes from a user or from the chain.
 */
const structuredData = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: site.name,
	applicationCategory: "FinanceApplication",
	operatingSystem: "Web",
	url: site.url,
	description: site.description,
	offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
}).replace(/</g, "\\u003c");

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="flex h-dvh flex-col overflow-hidden bg-ink-0 text-text">
				<script type="application/ld+json">{structuredData}</script>
				<Providers>
					<Nav />
					<main className="flex w-full flex-1 flex-col gap-5 overflow-y-auto px-5 py-3 lg:px-8">
						{children}
					</main>
				</Providers>
			</body>
		</html>
	);
}
