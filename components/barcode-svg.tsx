// The barcode drawn from its number: ITF-14 with bearer bars, or EAN-13.
// Sizes in label millimetres through the --mm variable (see label-render).

import { barsFor } from "@/entities/barcodes";

const mm = (n: number) => `calc(var(--mm) * ${n})`;

/** ITF-14 with its bearer bars top and bottom, or EAN-13, across the usable width. */
export function Barcode({ gtin, heightMm }: { gtin: string | null; heightMm: number }) {
	if (!gtin) {
		return (
			<div
				className="flex w-full items-center justify-center border-2 border-dashed border-rule px-2 text-center text-graphite"
				style={{ height: mm(heightMm), fontSize: mm(3) }}
			>
				Add the barcode number in Details
			</div>
		);
	}
	const { bars, width } = barsFor(gtin);
	const itf = gtin.length === 14;
	const quiet = itf ? 10 : 9;
	const total = width + 2 * quiet;
	return (
		<svg
			viewBox={`0 0 ${total} 100`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="block w-full"
			style={{ height: mm(heightMm) }}
		>
			{itf && (
				<>
					<rect x={0} y={0} width={total} height={7} fill="currentColor" />
					<rect x={0} y={93} width={total} height={7} fill="currentColor" />
				</>
			)}
			{bars.map((bar) => (
				<rect
					key={bar.x}
					x={quiet + bar.x}
					y={itf ? 7 : 0}
					width={bar.width}
					height={itf ? 86 : 100}
					fill="currentColor"
				/>
			))}
		</svg>
	);
}

