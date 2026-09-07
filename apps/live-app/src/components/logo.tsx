/**
 * The brand, inline. A bollard with a line: the arc is the fixed mooring, the
 * horizontal stroke the rope that holds — "something that stays in place",
 * read also as an abstract M. The arc is always brass; the rope and the
 * wordmark take `currentColor`, so the same component sits on ink or paper.
 * Stroke weight is 7 on a 64 grid and is not to be changed (brand/README.md).
 */

const brass = "#D99A2B";

export function Mark({ className, title = "Moor" }: { className?: string; title?: string }) {
	return (
		<svg viewBox="0 0 64 64" fill="none" role="img" aria-label={title} className={className}>
			<path
				d="M22 54V26a10 10 0 0 1 20 0v28"
				stroke={brass}
				strokeWidth="7"
				strokeLinecap="round"
			/>
			<path d="M14 42h36" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
		</svg>
	);
}

export function Logo({ className, title = "Moor" }: { className?: string; title?: string }) {
	return (
		<svg viewBox="0 0 268 64" fill="none" role="img" aria-label={title} className={className}>
			<path
				d="M22 54V26a10 10 0 0 1 20 0v28"
				stroke={brass}
				strokeWidth="7"
				strokeLinecap="round"
			/>
			<path d="M14 42h36" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
			<g
				transform="translate(86,0)"
				stroke="currentColor"
				strokeWidth="7"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M3.5 48.5V15.5L18.5 37 33.5 15.5V48.5" />
				<circle cx="65" cy="32" r="16.5" />
				<circle cx="113" cy="32" r="16.5" />
				<path d="M144.5 48.5V15.5h15a9.5 9.5 0 0 1 0 19h-15" />
				<path d="M156 34.5l13 14" />
			</g>
		</svg>
	);
}
