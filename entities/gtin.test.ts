import { describe, expect, it } from "vitest";
import { checkGtin, gtinCheckDigit, sameItem } from "./gtin";

describe("checkGtin", () => {
	it("accepts the Ember case and pouch barcodes and says which they are", () => {
		expect(checkGtin("15060534671000")).toEqual({ ok: true, gtin: "15060534671000", kind: "itf14" });
		expect(checkGtin("5060534671003")).toEqual({ ok: true, gtin: "5060534671003", kind: "ean13" });
	});

	it("ignores the spaces GS1 prints between groups", () => {
		expect(checkGtin("1 50 60534 67100 0").ok).toBe(true);
	});

	it("says what's wrong in plain words", () => {
		expect(checkGtin("")).toMatchObject({ ok: false, message: "Enter the barcode number." });
		expect(checkGtin("1506053467100A")).toMatchObject({ ok: false, message: "Use digits only." });
		expect(checkGtin("150605346710")).toMatchObject({ ok: false, message: expect.stringContaining("This has 12") });
		expect(checkGtin("15060534671012")).toMatchObject({ ok: false, message: expect.stringContaining("should be 7") });
	});
});

describe("gtinCheckDigit", () => {
	it("matches GS1's worked example", () => {
		expect(gtinCheckDigit("629104150021")).toBe(3);
	});
});

describe("sameItem", () => {
	it("matches a case barcode to its pouch barcode", () => {
		expect(sameItem("15060534671000", "5060534671003")).toBe(true);
		expect(sameItem("15060534671017", "5060534671003")).toBe(false);
	});
});
