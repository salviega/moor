"use client";

/**
 * Who is using the app: the Ledger Live account (from the Wallet API — the only
 * identity there is, 04 §2) and the ENS name positions live under. The name is
 * the holder's choice, remembered in this browser, and checked against the
 * account: `addr(name)` must be the account, or every screen says so.
 */
import { useAccounts, useRequestAccount } from "@ledgerhq/wallet-api-client-react";
import { readAddr } from "@moor/core";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "./chain";
import { SEPOLIA_CURRENCY_ID, useSimulator } from "./wallet-api";

const NAME_KEY = "moor.holderName";
const ACCOUNT_KEY = "moor.accountId";
const DEFAULT_NAME = "salviega.eth";

export interface Holder {
	accountId: string | null;
	address: Address | null;
	connecting: boolean;
	connectError: unknown;
	connect: () => void;
	/** `salviega.eth` — the parent of every position name. */
	name: string;
	setName: (name: string) => void;
	parentLabel: string;
	/** addr(name) on chain, once read; null while loading. */
	nameAddress: Address | null | undefined;
	nameMatches: boolean | undefined;
	/** "ledger-live" inside the host, "simulator" under pnpm dev, "browser" when opened directly (reads only). */
	host: "ledger-live" | "simulator" | "browser" | undefined;
}

const Ctx = createContext<Holder | null>(null);

export function HolderProvider({ children }: { children: ReactNode }) {
	const { requestAccount, account: requested, pending, error } = useRequestAccount();
	const listed = useAccounts();
	const [rememberedId, setRememberedId] = useState<string | null>(null);
	useEffect(() => {
		try {
			setRememberedId(window.localStorage.getItem(ACCOUNT_KEY));
		} catch {}
	}, []);
	// The account the holder picked, or the one they picked last time if Ledger Live still lists it.
	const account = requested ?? listed.accounts?.find((a) => a.id === rememberedId) ?? null;
	useEffect(() => {
		if (requested) {
			try {
				window.localStorage.setItem(ACCOUNT_KEY, requested.id);
			} catch {}
		}
	}, [requested]);
	const [host, setHost] = useState<Holder["host"]>(undefined);
	useEffect(() => {
		setHost(useSimulator ? "simulator" : window.self !== window.top ? "ledger-live" : "browser");
	}, []);
	const [name, setNameState] = useState(DEFAULT_NAME);
	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(NAME_KEY);
			if (stored) setNameState(stored);
		} catch {}
	}, []);
	const setName = useCallback((n: string) => {
		const clean = n.trim().toLowerCase();
		setNameState(clean);
		try {
			window.localStorage.setItem(NAME_KEY, clean);
		} catch {}
	}, []);
	const connect = useCallback(() => {
		requestAccount({ currencyIds: [SEPOLIA_CURRENCY_ID] }).catch((e: unknown) => {
			// The hook keeps the error in state; this line is what a developer sees in the console.
			console.error("account.request failed", e);
		});
	}, [requestAccount]);
	useEffect(() => {
		if (error) console.error("account.request error", error);
	}, [error]);

	const nameAddr = useQuery({
		queryKey: ["addr", name],
		queryFn: () => readAddr(publicClient, name),
		enabled: /^[a-z0-9-]+\.eth$/.test(name),
		staleTime: 60_000,
	});
	const address = (account?.address as Address | undefined) ?? null;
	const nameMatches =
		address && nameAddr.data ? nameAddr.data.toLowerCase() === address.toLowerCase() : undefined;

	return (
		<Ctx.Provider
			value={{
				accountId: account?.id ?? null,
				address,
				connecting: pending,
				connectError: error,
				connect,
				name,
				setName,
				parentLabel: name.replace(/\.eth$/, ""),
				nameAddress: nameAddr.data ?? (nameAddr.isLoading ? null : undefined),
				nameMatches,
				host,
			}}
		>
			{children}
		</Ctx.Provider>
	);
}

export function useHolder(): Holder {
	const h = useContext(Ctx);
	if (!h) throw new Error("useHolder outside HolderProvider");
	return h;
}
