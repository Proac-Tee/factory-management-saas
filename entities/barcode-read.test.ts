import { describe, expect, it } from "vitest";
import { readBars, readCode128 } from "./barcode-read";
import { ean13Bars, itf14Bars } from "./barcodes";

const scaled = (bars: { x: number; width: number }[], k: number, offset = 3) =>
	bars.map((b) => ({ x: offset + b.x * k, width: b.width * k }));

describe("readBars", () => {
	it("reads ITF-14 and EAN-13 drawn by our own encoder, at any scale and in any order", () => {
		expect(readBars(scaled(itf14Bars("15060534671000").bars, 0.055).reverse())).toBe("15060534671000");
		expect(readBars(scaled(ean13Bars("5060534671003").bars, 0.33))).toBe("5060534671003");
	});

	it("gives null for bars that don't spell a valid number", () => {
		const bars = scaled(itf14Bars("15060534671000").bars, 1);
		expect(readBars(bars.slice(1))).toBeNull();
		bars[10] = { ...bars[10], width: bars[10].width === 1 ? 2.5 : 1 };
		expect(readBars(bars)).toBeNull();
	});
});

describe("readCode128", () => {
	// Bars from the SVG ZXing's writer draws: one subpath per bar, "M x y h w v h h -w Z".
	const zxingBars = async (text: string) => {
		const { readFileSync } = await import("node:fs");
		const { createRequire } = await import("node:module");
		const { prepareZXingModule, writeBarcode } = await import("zxing-wasm/writer");
		const require = createRequire(import.meta.url);
		prepareZXingModule({ overrides: { wasmBinary: readFileSync(require.resolve("zxing-wasm/writer/zxing_writer.wasm")) } });
		const { svg } = await writeBarcode(text, { format: "Code128", withHRT: false, withQuietZones: false });
		const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
		return [...d.matchAll(/M(\d+) \d+h(\d+)/g)].map((m) => ({ x: Number(m[1]), width: Number(m[2]) }));
	};

	it("reads digits (set C), text (set B) and a GTIN inside, as ZXing writes them", async () => {
		expect(readCode128(await zxingBars("15060534670737"))).toBe("15060534670737");
		expect(readCode128(await zxingBars("X000X1GX37"))).toBe("X000X1GX37");
		expect(readBars(await zxingBars("15060534670737"))).toBe("15060534670737");
		expect(readBars(await zxingBars("X000X1GX37"))).toBeNull();
	});
});
