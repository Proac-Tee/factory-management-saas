"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Field } from "@/components/field";
import { ArrowLeftIcon, MinusIcon, PlusIcon, PrinterIcon, ScanIcon } from "@/components/icons";
import { LabelRender } from "@/components/label-render";
import { ErrorLine, outlineButton, PageHeader, primaryButton } from "@/components/ui";
import type { LabelFull } from "@/data-access/labels";
import { FIELDS, type FieldKey, type FieldValues, KIND_NAMES, type LabelDesign } from "@/entities/label";

const MAX_COPIES = 200;

/**
 * Fill in the batch, BBE and quantity, then print through the PC's label
 * printer driver. The page size is the label size, so set the printer's
 * stock to match once and every label comes out at true size.
 */
export function PrintScreen({ label, design, fields }: { label: LabelFull; design: LabelDesign; fields: FieldKey[] }) {
	const [values, setValues] = useState<FieldValues>({});
	const [copies, setCopies] = useState(1);
	const [tried, setTried] = useState(false);
	const missing = fields.filter((key) => !values[key]?.trim());

	const print = () => {
		setTried(true);
		if (missing.length > 0) return;
		window.print();
	};

	return (
		<div className="flex flex-1 flex-col">
			{/* The printer's page is exactly one label. */}
			<style>{`@page { size: ${design.widthMm}mm ${design.heightMm}mm; margin: 0; }`}</style>

			<div className="no-print flex flex-1 flex-col">
				<PageHeader
					context={
						<Link href={`/labels/${label.id}`} className="inline-flex items-center gap-1.5 font-bold text-ink underline underline-offset-2">
							<ArrowLeftIcon size={16} />
							{label.name}
						</Link>
					}
					title="Print labels"
				/>
				<div className="flex flex-1 flex-col-reverse tablet:flex-row">
					<div className="flex w-full flex-col gap-5 px-4 py-6 md:px-10 tablet:w-[512px] tablet:shrink-0">
						<p className="text-base leading-normal text-graphite">
							{label.customer}, {KIND_NAMES[label.kind]}, {design.widthMm} × {design.heightMm} mm.{" "}
							{fields.length > 0 ? "Fill in what changes for this run." : "Nothing to fill in on this label."}
						</p>
						{fields.map((key) => {
							const field = FIELDS.find((f) => f.key === key)!;
							return (
								<Field
									key={key}
									label={field.name}
									value={values[key] ?? ""}
									placeholder={`e.g. ${field.example}`}
									maxLength={30}
									autoComplete="off"
									onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value.toUpperCase() }))}
									error={tried && !values[key]?.trim() ? `Enter the ${field.name.toLowerCase()} printed on this run.` : undefined}
									className="h-tap w-full rounded-t-md border-b-2 border-ink bg-wash px-4 text-xl font-black tracking-wide tabular-nums uppercase outline-none placeholder:font-medium placeholder:tracking-normal placeholder:normal-case placeholder:text-graphite focus-visible:ring-2 focus-visible:ring-ink aria-invalid:border-hold"
								/>
							);
						})}

						<div className="flex items-center justify-between gap-4 border-t border-ink pt-4">
							<span className="text-base leading-5 font-bold">How many labels?</span>
							<div className="flex items-center rounded-md bg-wash" role="group" aria-label="How many labels">
								<button
									type="button"
									aria-label="One fewer"
									disabled={copies <= 1}
									onClick={() => setCopies((c) => Math.max(1, c - 1))}
									className="flex size-14 items-center justify-center rounded-l-md hover:bg-rule disabled:text-rule"
								>
									<MinusIcon size={20} />
								</button>
								<input
									aria-label="Number of labels"
									inputMode="numeric"
									value={copies}
									onChange={(e) => {
										const n = Number.parseInt(e.target.value, 10);
										setCopies(Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(1, n)) : 1);
									}}
									className="h-14 w-20 bg-transparent text-center text-xl font-black tabular-nums outline-none"
								/>
								<button
									type="button"
									aria-label="One more"
									disabled={copies >= MAX_COPIES}
									onClick={() => setCopies((c) => Math.min(MAX_COPIES, c + 1))}
									className="flex size-14 items-center justify-center rounded-r-md hover:bg-rule disabled:text-rule"
								>
									<PlusIcon size={20} />
								</button>
							</div>
						</div>

						{!label.barcode && design.parts.some((p) => p.kind === "barcode" && p.visible) && (
							<ErrorLine message="This label has no barcode number yet, so the barcode prints as a blank box. An editor can add it in Details." />
						)}

						<div className="flex flex-col gap-3 pt-2">
							<button type="button" onClick={print} className={`${primaryButton} h-16 w-full text-lg`}>
								<PrinterIcon size={22} />
								Print {copies} {copies === 1 ? "label" : "labels"}
							</button>
							{label.barcode && (
								<Link href={`/scan?mode=check&label=${label.id}`} className={`${outlineButton} h-tap w-full`}>
									<ScanIcon size={20} />
									Check a printed label
								</Link>
							)}
							<p className="text-sm leading-5 text-graphite">
								Prints through this computer&apos;s label printer. The first time, set its paper size to {design.widthMm} × {design.heightMm} mm
								with no margins.
							</p>
						</div>
					</div>

					<Preview design={design} barcode={label.barcode} values={values} />
				</div>
			</div>

			{/* What the printer gets: one label per page, at true size. */}
			<div className="print-only">
				{Array.from({ length: copies }, (_, i) => (
					<div key={i} style={{ breakAfter: i < copies - 1 ? "page" : "auto" }}>
						<LabelRender design={design} barcode={label.barcode} values={values} scale="print" />
					</div>
				))}
			</div>
		</div>
	);
}

function Preview({ design, barcode, values }: { design: LabelDesign; barcode: string | null; values: FieldValues }) {
	const [width, setWidth] = useState(0);
	const measure = useCallback((node: HTMLDivElement | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	const scale = width > 0 ? Math.min(width / design.widthMm, 560 / design.heightMm, 6) : 0;
	return (
		<section aria-label="Preview" className="flex flex-col items-center gap-4 border-b border-rule bg-wash px-4 py-6 md:px-10 tablet:flex-1 tablet:border-b-0 tablet:border-l tablet:py-10">
			<div ref={measure} className="flex w-full max-w-[600px] justify-center">
				{scale > 0 && (
					<div className="border border-graphite">
						<LabelRender design={design} barcode={barcode} values={values} scale={scale} />
					</div>
				)}
			</div>
			<p className="text-center text-sm leading-5 text-graphite">What prints, to scale. Empty fields show an example until you fill them in.</p>
		</section>
	);
}
