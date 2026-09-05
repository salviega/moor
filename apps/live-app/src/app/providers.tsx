"use client";

import { WalletAPIProvider } from "@ledgerhq/wallet-api-client-react";
import { type ReactNode, useEffect, useState } from "react";
import { createTransport } from "@/lib/wallet-api";

/**
 * The transport talks to `window`, so it only exists in the browser. Until it
 * does, nothing renders: a Live App has no meaning without its host, and the
 * static shell Next prerenders is enough for the first paint.
 */
export function Providers({ children }: { children: ReactNode }) {
	const [connection, setConnection] = useState<ReturnType<typeof createTransport> | null>(null);
	useEffect(() => {
		const c = createTransport();
		setConnection(c);
		return c.disconnect;
	}, []);
	if (!connection) return null;
	return <WalletAPIProvider transport={connection.transport}>{children}</WalletAPIProvider>;
}
