/**
 * The Live App's environment (06 §8), validated once at module load. Only one
 * variable, and it has a default: a public Sepolia RPC. Nothing secret lives
 * here — the app reads the chain and hands signing to Ledger Live.
 */
import { z } from "zod";

const Env = z.object({
	NEXT_PUBLIC_SEPOLIA_RPC_URL: z.url().default("https://ethereum-sepolia-rpc.publicnode.com"),
});

export const env = Env.parse({
	NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined,
});
