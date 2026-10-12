// Bar patterns for the two barcodes on our labels, in module units from 0.
// Drawing (SVG on screen and in print) lives in the UI; this is just the
// symbology, so it can be tested.

import { gtinCheckDigit } from "./gtin";

export type Bar = { x: number; width: number };
export type BarPattern = { bars: Bar[]; width: number };

const ITF_PATTERNS = [
	"NNWWN", "WNNNW", "NWNNW", "WWNNN", "NNWNW",
	"WNWNN", "NWWNN", "NNNWW", "WNNWN", "NWNWN",
];

/** ITF-14 wide elements are this many times a narrow one (GS1 allows 2.25 to 3). */
export const ITF_WIDE = 2.5;

/**
 * ITF-14 (Interleaved 2 of 5). Digits are paired: the first of a pair is drawn
 * in the bars, the second in the spaces between them. No quiet zones.
 */
export const itf14Bars = (gtin: string): BarPattern => {
	if (!/^\d{14}$/.test(gtin)) throw new Error("ITF-14 needs 14 digits.");
	if (gtinCheckDigit(gtin.slice(0, 13)) !== Number(gtin[13])) {
		throw new Error("The barcode's last digit is wrong.");
	}

	const bars: Bar[] = [];
	let x = 0;
	const draw = (isBar: boolean, wide: boolean) => {
		const width = wide ? ITF_WIDE : 1;
		if (isBar) bars.push({ x, width });
		x += width;
	};

	// Start: narrow bar, space, bar, space.
	draw(true, false);
	draw(false, false);
	draw(true, false);
	draw(false, false);
	for (let i = 0; i < 14; i += 2) {
		const inBars = ITF_PATTERNS[Number(gtin[i])];
		const inSpaces = ITF_PATTERNS[Number(gtin[i + 1])];
		for (let e = 0; e < 5; e++) {
			draw(true, inBars[e] === "W");
			draw(false, inSpaces[e] === "W");
		}
	}
	// Stop: wide bar, narrow space, narrow bar.
	draw(true, true);
	draw(false, false);
	draw(true, false);
	return { bars, width: x };
};

// EAN-13 digit encodings, as 7 modules (1 = bar).
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
// Which of the left six digits use G, set by the first digit.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** EAN-13: 95 modules (start, 6 left digits, centre, 6 right digits, end). */
export const ean13Bars = (gtin: string): BarPattern => {
	if (!/^\d{13}$/.test(gtin)) throw new Error("EAN-13 needs 13 digits.");
	if (gtinCheckDigit(gtin.slice(0, 12)) !== Number(gtin[12])) {
		throw new Error("The barcode's last digit is wrong.");
	}
	const parity = PARITY[Number(gtin[0])];
	let modules = "101";
	for (let i = 1; i <= 6; i++) {
		const table = parity[i - 1] === "L" ? L : G;
		modules += table[Number(gtin[i])];
	}
	modules += "01010";
	for (let i = 7; i <= 12; i++) modules += R[Number(gtin[i])];
	modules += "101";

	const bars: Bar[] = [];
	for (let i = 0; i < modules.length; i++) {
		if (modules[i] !== "1") continue;
		const last = bars.at(-1);
		if (last && last.x + last.width === i) last.width += 1;
		else bars.push({ x: i, width: 1 });
	}
	return { bars, width: modules.length };
};

export const barsFor = (gtin: string): BarPattern =>
	gtin.length === 14 ? itf14Bars(gtin) : ean13Bars(gtin);
