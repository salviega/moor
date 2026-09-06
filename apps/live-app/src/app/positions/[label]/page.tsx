"use client";

/** Old links keep working: a position's page is the dashboard with it selected. */
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PositionRedirect() {
	const { label } = useParams<{ label: string }>();
	const router = useRouter();
	useEffect(() => {
		router.replace(`/?position=${encodeURIComponent(label)}`);
	}, [label, router]);
	return null;
}
