/**
 * The Live App's environment (06 §8), validated once at module load. Two
 * variables, both with a default: a public Sepolia RPC and the site's own
 * origin — the base for canonical URLs and the Open Graph image, so a preview
 * deploy can point at itself and production at the manifest's URL. Nothing
 * secret lives here — the app reads the chain and hands signing to Ledger Live.
 */
import { z } from "zod";

const Env = z.object({
	NEXT_PUBLIC_SEPOLIA_RPC_URL: z.url().default("https://ethereum-sepolia-rpc.publicnode.com"),
	NEXT_PUBLIC_SITE_URL: z.url().default("https://getmoor.vercel.app"),
});

export const env = Env.parse({
	NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined,
	NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});
