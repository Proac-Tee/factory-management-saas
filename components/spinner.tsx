// A spinning ring in the text colour, so it works on ink buttons and white
// pages alike. Decorative: the words next to it say what's happening.

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
	return (
		<svg
			aria-hidden="true"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={`shrink-0 animate-spin motion-reduce:animate-[spin_2s_linear_infinite] ${className}`}
		>
			<circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
			<path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
		</svg>
	);
}

/** While a page's data loads: a spinner and what's loading, centred in the page. */
export function PageLoading({ label = "Loading…", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
	return (
		<div
			role="status"
			className={`flex flex-1 items-center justify-center gap-3 p-10 text-lg font-bold text-graphite ${fullScreen ? "min-h-dvh" : "min-h-[50dvh]"}`}
		>
			<Spinner size={24} className="text-ink" />
			{label}
		</div>
	);
}
