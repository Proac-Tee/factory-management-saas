"use client";

import type { FieldValues, LabelDesign } from "@/entities/label";
import { useElementSize } from "./hooks/use-element-size";
import { LabelRender } from "./label-render";

/**
 * A label drawn as large as its box allows, to scale. The editor and the
 * print screen both preview with it.
 */
export function ScaledLabel({
	design,
	barcode,
	values,
	selectedId,
	maxScale,
	minHeightPx = 0,
	maxHeightPx = Number.POSITIVE_INFINITY,
	className = "",
}: {
	design: LabelDesign;
	barcode: string | null;
	values?: FieldValues;
	selectedId?: string | null;
	/** Pixels per millimetre at most, so small labels don't blow up. */
	maxScale: number;
	/** Height to plan for when the box itself has none yet (narrow screens). */
	minHeightPx?: number;
	maxHeightPx?: number;
	className?: string;
}) {
	const [ref, box] = useElementSize();
	const height = Math.min(Math.max(box.height, minHeightPx), maxHeightPx);
	const scale = box.width > 0 ? Math.min(box.width / design.widthMm, height / design.heightMm, maxScale) : 0;
	return (
		<div ref={ref} className={`flex w-full items-center justify-center ${className}`}>
			{scale > 0 && (
				<div className="border border-graphite">
					<LabelRender design={design} barcode={barcode} values={values} scale={scale} selectedId={selectedId} />
				</div>
			)}
		</div>
	);
}
