import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// The Wallet API lives in the browser; the server side of this app is thin.
	reactStrictMode: true,
	// @moor/core ships TypeScript source (exports -> ./src/index.ts); Next has to transpile it.
	transpilePackages: ["@moor/core"],
};

export default nextConfig;
