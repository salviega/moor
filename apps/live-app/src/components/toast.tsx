"use client";

/** The one way a save is confirmed to the person (AGENTS.md, stack conventions). */
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type Kind = "ok" | "error" | "info";
interface Toast {
	id: number;
	kind: Kind;
	text: string;
}
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const push = useCallback((kind: Kind, text: string) => {
		const id = Date.now() + Math.random();
		setToasts((t) => [...t, { id, kind, text }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
	}, []);
	return (
		<Ctx.Provider value={push}>
			{children}
			<div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						key={t.id}
						className={`rounded-md border px-3 py-2 text-sm shadow ${
							t.kind === "ok"
								? "border-emerald-700 bg-emerald-950 text-emerald-200"
								: t.kind === "error"
									? "border-red-800 bg-red-950 text-red-200"
									: "border-neutral-700 bg-neutral-900 text-neutral-200"
						}`}
					>
						{t.text}
					</div>
				))}
			</div>
		</Ctx.Provider>
	);
}

export const useToast = () => useContext(Ctx);
