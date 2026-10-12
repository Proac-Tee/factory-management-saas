import { describe, expect, it } from "vitest";
import { ean13Bars, ITF_WIDE, itf14Bars } from "./barcodes";

describe("itf14Bars", () => {
	it("draws 7 digit pairs between the start and stop patterns", () => {
		const { bars, width } = itf14Bars("15060534671000");
		// Start (2 bars) + 7 pairs x 5 bars + stop (2 bars).
		expect(bars).toHaveLength(2 + 35 + 2);
		// Each pair is 2 wide + 3 narrow in bars and spaces: 2 x (2W + 3N).
		const pairWidth = 2 * (2 * ITF_WIDE + 3);
		expect(width).toBe(4 + 7 * pairWidth + ITF_WIDE + 2);
	});

	it("refuses a number with the wrong check digit", () => {
		expect(() => itf14Bars("15060534671001")).toThrow("last digit");
	});
});

describe("ean13Bars", () => {
	it("is 95 modules wide with bars only on 1s", () => {
		const { bars, width } = ean13Bars("5060534671003");
		expect(width).toBe(95);
		expect(bars[0]).toEqual({ x: 0, width: 1 }); // start guard 101
		expect(bars[1]).toEqual({ x: 2, width: 1 });
		expect(bars.at(-1)).toEqual({ x: 94, width: 1 }); // end guard
	});

	it("matches a known encoding", () => {
		// 4006381333931: left half uses parity LGLLGG for first digit 4.
		const { bars } = ean13Bars("4006381333931");
		const modules = Array(95).fill("0");
		for (const b of bars) for (let i = 0; i < b.width; i++) modules[b.x + i] = "1";
		expect(modules.join("")).toBe(
			// 0(L) 0(G) 6(L) 3(L) 8(G) 1(G) | 3 3 3 9 3 1 (R)
			"101" + "0001101" + "0100111" + "0101111" + "0111101" + "0001001" + "0110011" +
				"01010" + "1000010" + "1000010" + "1000010" + "1110100" + "1000010" + "1100110" + "101",
		);
	});
});
