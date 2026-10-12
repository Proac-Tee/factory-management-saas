"use client";

import { useCallback, useState } from "react";

/** The content size of an element, kept up to date. Use the returned ref on it. */
export function useElementSize() {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const ref = useCallback((node: HTMLElement | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) =>
			setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, size] as const;
}
