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
			<body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
				<Providers>
					<Nav />
					<main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">{children}</main>
				</Providers>
			</body>
		</html>
	);
}
