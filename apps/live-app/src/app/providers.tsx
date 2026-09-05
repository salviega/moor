"use client";

import { WalletAPIProvider } from "@ledgerhq/wallet-api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { ToastProvider } from "@/components/toast";
import { HolderProvider } from "@/lib/holder";
import { createTransport } from "@/lib/wallet-api";

/**
 * The transport talks to `window`, so it only exists in the browser. Until it
 * does, nothing renders: a Live App has no meaning without its host, and the
 * static shell Next prerenders is enough for the first paint.
 */
export function Providers({ children }: { children: ReactNode }) {
	const [connection, setConnection] = useState<ReturnType<typeof createTransport> | null>(null);
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
	);
	useEffect(() => {
		const c = createTransport();
		setConnection(c);
		return c.disconnect;
	}, []);
	if (!connection) return null;
	return (
		<WalletAPIProvider transport={connection.transport}>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<HolderProvider>{children}</HolderProvider>
				</ToastProvider>
			</QueryClientProvider>
		</WalletAPIProvider>
	);
}
