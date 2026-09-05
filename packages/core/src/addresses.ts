/**
 * Contract addresses, by chain id.
 *
 * Sepolia is the only chain during the hackathon (05 §1). The ENSv2 entries
 * are the published beta deployments and are constants; the Aqua / SwapVM /
 * Moor entries are written by `pnpm contracts:deploy` and start as the zero
 * address so that nothing can accidentally talk to the canonical production
 * 1inch contracts, which do not exist on Sepolia.
 */
import type { Address } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111 as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const satisfies Address;

export const ensV2Sepolia = {
	ethRegistry: "0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2",
	rootRegistry: "0x8115186e8f2e0b0281e86ab91f0f48ba90364354",
	ethRegistrar: "0xa88553f454b77203b0d036a05c894d555eaaa2cc",
	verifiableFactory: "0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef",
	userRegistryImpl: "0x624a25d67b59d587752ebec8dded8827dae52050",
	permissionedResolverImpl: "0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e",
	universalResolverV2: "0x4a1817d13e9cf196f471725176355c1234b63c70",
} as const satisfies Record<string, Address>;

/** Written by `contracts:deploy`. Zero until the redeploy in phase 0 lands. */
export const moorSepolia = {
	aqua: "0xB8747B3e2F90154420165FB2fc4707D638797140",
	swapVmRouter: "0xdD026eA05C9256A1162dC3d41102579458A804Cd",
	moorRegistrar: ZERO_ADDRESS,
	moorProgramFactory: ZERO_ADDRESS,
	testWbtc: "0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC",
	testUsdc: "0x274aaB610937e018310cCedC0b05B543b75557AB",
} as const satisfies Record<string, Address>;
