// Reads a barcode number back from its bars, for barcodes drawn as shapes in
// the old label files (one rectangle per bar). Exact widths, so no image
// recognition is needed: the inverse of entities/barcodes.ts.

import type { Bar } from "./barcodes";
import { checkGtin } from "./gtin";

const ITF_DIGITS = ["NNWWN", "WNNNW", "NWNNW", "WWNNN", "NNWNW", "WNWNN", "NWWNN", "NNNWW", "WNNWN", "NWNWN"];
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Bars and the spaces between them, left to right, as widths. */
const elements = (bars: Bar[]): number[] => {
	const sorted = bars.toSorted((a, b) => a.x - b.x);
	const widths: number[] = [];
	sorted.forEach((bar, i) => {
		if (i > 0) widths.push(bar.x - (sorted[i - 1].x + sorted[i - 1].width));
		widths.push(bar.width);
	});
	return widths;
};

const readItf = (bars: Bar[]): string | null => {
	if (bars.length !== 39) return null;
	const widths = elements(bars);
	const threshold = (Math.min(...widths) + Math.max(...widths)) / 2;
	const nw = widths.map((w) => (w > threshold ? "W" : "N")).join("");
	if (!nw.startsWith("NNNN") || !nw.endsWith("WNN")) return null;
	let digits = "";
	for (let pair = 0; pair < 7; pair++) {
		const chunk = nw.slice(4 + pair * 10, 14 + pair * 10);
		const inBars = ITF_DIGITS.indexOf([0, 2, 4, 6, 8].map((i) => chunk[i]).join(""));
		const inSpaces = ITF_DIGITS.indexOf([1, 3, 5, 7, 9].map((i) => chunk[i]).join(""));
		if (inBars < 0 || inSpaces < 0) return null;
		digits += `${inBars}${inSpaces}`;
	}
	return digits;
};

const readEan13 = (bars: Bar[]): string | null => {
	if (bars.length !== 30) return null;
	const sorted = bars.toSorted((a, b) => a.x - b.x);
	const start = sorted[0].x;
	const moduleWidth = (sorted.at(-1)!.x + sorted.at(-1)!.width - start) / 95;
	const modules = Array<string>(95).fill("0");
	for (const bar of sorted) {
		const from = Math.round((bar.x - start) / moduleWidth);
		const to = Math.round((bar.x + bar.width - start) / moduleWidth);
		for (let m = from; m < to && m < 95; m++) modules[m] = "1";
	}
	const s = modules.join("");
	if (s.slice(0, 3) !== "101" || s.slice(45, 50) !== "01010" || s.slice(92) !== "101") return null;
	let parity = "";
	let left = "";
	for (let i = 0; i < 6; i++) {
		const code = s.slice(3 + i * 7, 10 + i * 7);
		const l = L.indexOf(code);
		const g = G.indexOf(code);
		if (l >= 0) {
			parity += "L";
			left += l;
		} else if (g >= 0) {
			parity += "G";
			left += g;
		} else return null;
	}
	const first = PARITY.indexOf(parity);
	if (first < 0) return null;
	let right = "";
	for (let i = 0; i < 6; i++) {
		const r = R.indexOf(s.slice(50 + i * 7, 57 + i * 7));
		if (r < 0) return null;
		right += r;
	}
	return `${first}${left}${right}`;
};

// Code 128: each symbol is 3 bars and 3 spaces, 11 modules wide.
const CODE128 = (
	"212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
	"123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
	"232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 " +
	"313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 " +
	"111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
	"111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 " +
	"114311 411113 411311 113141 114131 311141 411131 211412 211214 211232"
).split(" ");
const CODE128_STOP = "2331112";

/** The text in a Code 128 barcode (GS1-128 separators as \x1d), or null. */
export const readCode128 = (bars: Bar[]): string | null => {
	if (bars.length < 10 || (bars.length - 7) % 3 !== 0) return null;
	const widths = elements(bars);
	const symbols = (bars.length - 7) / 3 + 1; // with the start symbol
	const moduleWidth = widths.reduce((a, b) => a + b, 0) / (symbols * 11 + 13);
	const units = widths.map((w) => Math.max(1, Math.round(w / moduleWidth)));
	if (units.slice(-7).join("") !== CODE128_STOP) return null;
	const values: number[] = [];
	for (let i = 0; i < symbols; i++) {
		const value = CODE128.indexOf(units.slice(i * 6, i * 6 + 6).join(""));
		if (value < 0) return null;
		values.push(value);
	}
	const [start, ...rest] = values;
	if (start < 103 || start > 105) return null;
	const data = rest.slice(0, -1);
	const checksum = (start + data.reduce((sum, v, i) => sum + v * (i + 1), 0)) % 103;
	if (checksum !== rest.at(-1)) return null;

	let set = start === 103 ? "A" : start === 104 ? "B" : "C";
	let text = "";
	for (const v of data) {
		if (v === 102) text += "\x1d";
		else if (set === "C" && v < 100) text += String(v).padStart(2, "0");
		else if (v === 99) set = "C";
		else if (v === 100) set = "B";
		else if (v === 101) set = "A";
		else if (v < 96) text += String.fromCharCode(set === "A" && v >= 64 ? v - 64 : v + 32);
	}
	return text.replace(/^\x1d/, "");
};

/**
 * The product number (GTIN) in a row of bars: ITF-14, EAN-13, or Code 128
 * holding a GTIN (plain or as GS1 (01)). Null if they don't spell a valid one.
 */
export const readBars = (bars: Bar[]): string | null => {
	const code128 = readCode128(bars);
	const digits = readItf(bars) ?? readEan13(bars) ?? gs1Gtin(code128);
	if (!digits) return null;
	const check = checkGtin(digits);
	return check.ok ? check.gtin : null;
};

/** A GTIN in Code 128 text: the 14 digits after (01), or the whole text if it's 13 or 14 digits. */
const gs1Gtin = (text: string | null): string | null => {
	if (!text) return null;
	const ai = /^01(\d{14})/.exec(text);
	if (ai) return ai[1];
	return /^\d{13,14}$/.test(text) ? text : null;
};
