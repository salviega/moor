import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: "Moor",
	description:
		"Turn the waiting time of holding into productive capital. Sign once; the Ledger decides.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="flex h-dvh flex-col overflow-hidden bg-ink-0 text-text">
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
