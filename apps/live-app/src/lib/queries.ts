"use client";

/**
 * Server state (06 §3: TanStack Query). Every read goes through @moor/core; the
 * hooks only decide how often to ask again.
 */
import {
	AGENT_LABEL,
	chainlinkFeed,
	ensV2Sepolia,
	erc20Abi,
	listPositions,
	type MarketAsset,
	MoorRoles,
	moorSepolia,
	permissionedRegistryAbi,
	permissionedResolverAbi,
	readPositionView,
	readPrice,
	readPriceHistory,
} from "@moor/core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { logsClient, publicClient } from "./chain";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Where the oracle has been: the last 48 Chainlink rounds (one per hour on Sepolia), one multicall. */
export function usePriceHistory(asset: MarketAsset = "btc") {
	return useQuery({
		queryKey: ["price-history", asset],
		queryFn: () => readPriceHistory(publicClient, { rounds: 48, feed: chainlinkFeed(asset) }),
		staleTime: 10 * 60_000,
		refetchInterval: 10 * 60_000,
	});
}

/** The oracle price of one asset — the number a position of that asset is judged by. */
export function usePrice(asset: MarketAsset = "btc") {
	return useQuery({
		queryKey: ["price", asset],
		queryFn: () => readPrice(publicClient, chainlinkFeed(asset)),
		// Chainlink's Sepolia feed itself doesn't tick every second, but polling
		// tighter than the old 60s makes the chart's dot feel watched, not stale.
		refetchInterval: 20_000,
	});
}

/** The holder's registry under their name, or null before first-time setup. */
export async function readHolderRegistry(parentLabel: string): Promise<Address | null> {
	const r = (await publicClient.readContract({
		address: ensV2Sepolia.ethRegistry,
		abi: permissionedRegistryAbi,
		functionName: "getSubregistry",
		args: [parentLabel],
	})) as Address;
	return r === ZERO ? null : r;
}

export async function readHolderResolver(parentLabel: string): Promise<Address | null> {
	const r = (await publicClient.readContract({
		address: ensV2Sepolia.ethRegistry,
		abi: permissionedRegistryAbi,
		functionName: "getResolver",
		args: [parentLabel],
	})) as Address;
	return r === ZERO ? null : r;
}

export function usePositions(parentName: string, parentLabel: string) {
	return useQuery({
		queryKey: ["positions", parentName],
		queryFn: async () => {
			const registry = await readHolderRegistry(parentLabel);
			if (!registry) return { registry: null, positions: [] };
			const [named, price] = await Promise.all([
				listPositions(logsClient, { registry, registrar: moorSepolia.moorRegistrar }),
				readPrice(publicClient),
			]);
			const now = Math.floor(Date.now() / 1000);
			const positions = await Promise.all(
				named.map((n) =>
					readPositionView(publicClient, { parentName, label: n.label, price: price.price, now }),
				),
			);
			return { registry, positions };
		},
		refetchInterval: 30_000,
	});
}

export function usePosition(parentName: string, label: string) {
	return useQuery({
		queryKey: ["position", parentName, label],
		queryFn: async () => {
			const price = await readPrice(publicClient);
			return readPositionView(publicClient, {
				parentName,
				label,
				price: price.price,
				now: Math.floor(Date.now() / 1000),
			});
		},
		refetchInterval: 30_000,
	});
}

export function useTokenAccount(owner: Address | null, token: Address) {
	return useQuery({
		queryKey: ["token", owner, token],
		enabled: !!owner,
		queryFn: async () => {
			const [balance, allowance] = await Promise.all([
				publicClient.readContract({
					address: token,
					abi: erc20Abi,
					functionName: "balanceOf",
					args: [owner as Address],
				}),
				publicClient.readContract({
					address: token,
					abi: erc20Abi,
					functionName: "allowance",
					args: [owner as Address, moorSepolia.aqua],
				}),
			]);
			return { balance: balance as bigint, allowance: allowance as bigint };
		},
		refetchInterval: 30_000,
	});
}

export interface SetupStatus {
	registry: Address | null;
	resolver: Address | null;
	moorOnRegistry: boolean;
	moorOnResolver: boolean;
	agentNamed: boolean;
}

/** What first-time setup has and has not done for a name (04 §4.0). */
export function useSetupStatus(parentLabel: string) {
	return useQuery({
		queryKey: ["setup", parentLabel],
		queryFn: async (): Promise<SetupStatus> => {
			const [registry, resolver] = await Promise.all([
				readHolderRegistry(parentLabel),
				readHolderResolver(parentLabel),
			]);
			const [moorOnRegistry, moorOnResolver, agentResolver] = await Promise.all([
				registry
					? publicClient.readContract({
							address: registry,
							abi: permissionedRegistryAbi,
							functionName: "hasRootRoles",
							args: [MoorRoles.REGISTRAR_ON_REGISTRY, moorSepolia.moorRegistrar],
						})
					: false,
				resolver
					? publicClient.readContract({
							address: resolver,
							abi: permissionedResolverAbi,
							functionName: "hasRootRoles",
							args: [MoorRoles.REGISTRAR_ON_RESOLVER, moorSepolia.moorRegistrar],
						})
					: false,
				registry
					? publicClient.readContract({
							address: registry,
							abi: permissionedRegistryAbi,
							functionName: "getResolver",
							args: [AGENT_LABEL],
						})
					: ZERO,
			]);
			return {
				registry,
				resolver,
				moorOnRegistry: moorOnRegistry as boolean,
				moorOnResolver: moorOnResolver as boolean,
				agentNamed: (agentResolver as Address) !== ZERO,
			};
		},
		staleTime: 30_000,
	});
}
