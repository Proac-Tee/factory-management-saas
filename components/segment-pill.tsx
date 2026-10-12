"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Box = { x: number; y: number; w: number; h: number };

/**
 * The ink pill behind the chosen option of a segmented control, sliding when
 * the choice changes. Mark the chosen option with `data-active`; until the
 * pill has measured it (first paint, no JS), give that option its own ink
 * fill with `selectedClass(ready)`.
 */
export function useSegmentPill<T extends HTMLElement>(active: unknown) {
	const ref = useRef<T>(null);
	const [box, setBox] = useState<Box | null>(null);

	useLayoutEffect(() => {
		const root = ref.current;
		if (!root) return;
		const measure = () => {
			const el = root.querySelector<HTMLElement>("[data-active]");
			setBox(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	}, [active]);

	const pill = box && (
		<span
			aria-hidden="true"
			className="pointer-events-none absolute top-0 left-0 rounded-[6px] bg-ink transition-[transform,width,height] duration-300 ease-out-expo motion-reduce:transition-none"
			style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
		/>
	);

	return { ref, pill, ready: box !== null };
}

/** Classes for one option: the chosen one is white on the pill, the rest wash out on hover. */
export const segmentClass = (selected: boolean, ready: boolean) =>
	`relative transition-colors duration-150 ${
		selected ? `font-bold text-stock ${ready ? "" : "bg-ink"}` : "font-medium hover:bg-rule"
	}`;
