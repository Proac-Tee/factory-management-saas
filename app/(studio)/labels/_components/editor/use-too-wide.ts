"use client";

import { useMemo, useSyncExternalStore } from "react";
import { FIELDS, fillText, MM_PER_PT, type StackDesign, usableWidthMm } from "@/entities/label";

const noSubscribe = () => () => {};

/** Ids of lines wider than a stacked label, measured with the label's own font. */
export function useTooWide(design: StackDesign | null): Set<string> {
	// The page font (next/font gives it a generated name); none on the server.
	const font = useSyncExternalStore(
		noSubscribe,
		() => getComputedStyle(document.body).fontFamily,
		() => null,
	);
	return useMemo(() => {
		const wide = new Set<string>();
		if (!design || !font || typeof document === "undefined") return wide;
		const ctx = document.createElement("canvas").getContext("2d");
		if (!ctx) return wide;
		const usable = usableWidthMm(design);
		const values = Object.fromEntries(FIELDS.map((f) => [f.key, f.example]));
		for (const part of design.parts) {
			if (part.kind !== "text" || !part.visible) continue;
			ctx.font = `${part.weight} 100px ${font}`;
			const widthMm = (ctx.measureText(fillText(part.text, values)).width / 100) * part.sizePt * MM_PER_PT;
			if (widthMm > usable) wide.add(part.id);
		}
		return wide;
	}, [design, font]);
}
