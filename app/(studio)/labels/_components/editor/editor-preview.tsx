"use client";

import { ScaledLabel } from "@/components/scaled-label";
import { FIELDS, type LabelDesign } from "@/entities/label";

const EXAMPLES = Object.fromEntries(FIELDS.map((f) => [f.key, f.example]));

/** The label to scale, beside the controls; sticky on wide screens. */
export function EditorPreview({
	design,
	barcode,
	selectedId,
	canEdit,
}: { design: LabelDesign; barcode: string | null; selectedId: string | null; canEdit: boolean }) {
	return (
		<section
			aria-label="Preview"
			className="flex flex-col items-center gap-4 border-b border-rule bg-wash px-4 py-6 md:px-10 tablet:sticky tablet:top-[121px] tablet:h-[calc(100dvh-121px)] tablet:flex-1 tablet:border-b-0 tablet:border-l tablet:py-10"
		>
			<ScaledLabel
				design={design}
				barcode={barcode}
				values={EXAMPLES}
				selectedId={selectedId}
				maxScale={7}
				minHeightPx={280}
				className="max-w-[640px] flex-1 tablet:min-h-0"
			/>
			<p className="text-center text-sm leading-5 text-graphite tabular-nums">
				To scale, {design.widthMm} × {design.heightMm} mm.{canEdit && " The outlined part is the one you're editing."} Batch and BBE
				show sample values.
			</p>
		</section>
	);
}
