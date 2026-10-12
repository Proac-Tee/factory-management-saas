import { describe, expect, it } from "vitest";
import { checkDetails, checkFit, fieldsUsed, fillText, needsBarcodeNumber, newDesign, parseDesign } from "./label";

describe("newDesign", () => {
	it("fits a 100 x 100 mm label and passes its own checks", () => {
		const design = newDesign();
		expect(checkFit(design).fits).toBe(true);
		expect(parseDesign(design)).toEqual({ ok: true, design });
	});
});

describe("checkFit", () => {
	it("counts margins, parts and the gaps between shown parts", () => {
		const fit = checkFit({
			widthMm: 50,
			heightMm: 25,
			marginMm: 2,
			gapMm: 1,
			parts: [
				{ id: "a", kind: "logo", heightMm: 10, visible: true },
				{ id: "b", kind: "logo", heightMm: 5, visible: true },
				{ id: "c", kind: "logo", heightMm: 30, visible: false },
			],
		});
		expect(fit).toEqual({ usedMm: 20, spareMm: 5, fits: true });
	});

	it("says when the parts don't fit", () => {
		const design = newDesign();
		design.heightMm = 40;
		expect(checkFit(design).fits).toBe(false);
	});
});

describe("fields", () => {
	it("finds the fields a design asks for, in a fixed order", () => {
		expect(fieldsUsed(newDesign())).toEqual(["batch", "bbe"]);
	});

	it("fills them in, showing the example where a value is missing", () => {
		expect(fillText("BATCH: {batch}   BBE: {bbe}", { batch: "AN1210602" })).toBe("BATCH: AN1210602   BBE: 12.10.27");
	});
});

describe("parseDesign", () => {
	it("refuses sizes outside the printer's range", () => {
		expect(parseDesign({ ...newDesign(), widthMm: 5 })).toMatchObject({ ok: false, message: "Width must be 10 to 300 mm." });
	});

	it("refuses a margin that leaves no room", () => {
		expect(parseDesign({ ...newDesign(), widthMm: 20, heightMm: 20, marginMm: 10 })).toMatchObject({ ok: false });
	});

	it("refuses unknown parts and duplicate ids", () => {
		const design = newDesign();
		expect(parseDesign({ ...design, parts: [{ id: "x", kind: "image" }] })).toMatchObject({ ok: false });
		expect(parseDesign({ ...design, parts: [design.parts[0], design.parts[0]] })).toEqual({
			ok: false,
			message: "Part 2: needs its own id.",
		});
	});

	it("defaults weight and alignment it doesn't know", () => {
		const result = parseDesign({
			...newDesign(),
			parts: [{ id: "t", kind: "text", text: "HI", sizePt: 12, weight: 500, align: "justify" }],
		});
		expect(result).toMatchObject({ ok: true, design: { parts: [{ weight: 700, align: "center", visible: true }] } });
	});
});

describe("checkDetails", () => {
	const ok = {
		name: " Original  Biltong 45g SRP ",
		customer: "Lenhams",
		kind: "srp",
		sku: "10145",
		productName: " Original Biltong  15 × 45g ",
		storage: "ambient",
		barcode: "15060534671000",
	};

	it("tidies the name and keeps the details", () => {
		expect(checkDetails(ok)).toEqual({
			ok: true,
			details: {
				name: "Original Biltong 45g SRP",
				customer: "Lenhams",
				kind: "srp",
				sku: "10145",
				productName: "Original Biltong 15 × 45g",
				storage: "ambient",
				barcode: "15060534671000",
			},
		});
	});

	it("allows labels with no SKU, storage or barcode", () => {
		expect(checkDetails({ ...ok, sku: "", storage: "", barcode: "" })).toMatchObject({
			ok: true,
			details: { sku: null, productName: null, storage: null, barcode: null },
		});
	});

	it("points at the field to fix", () => {
		expect(checkDetails({ ...ok, name: "" })).toMatchObject({ ok: false, field: "name" });
		expect(checkDetails({ ...ok, kind: "box" })).toMatchObject({ ok: false, field: "kind" });
		expect(checkDetails({ ...ok, barcode: "15060534671012" })).toMatchObject({
			ok: false,
			field: "barcode",
			message: "The last digit should be 7. Check the number on your GS1 account.",
		});
		expect(checkDetails({ ...ok, sku: "1" })).toMatchObject({ ok: false, field: "sku" });
	});

	it("needs a product name when the label has a SKU", () => {
		expect(checkDetails({ ...ok, productName: "  " })).toMatchObject({ ok: false, field: "productName" });
		expect(checkDetails({ ...ok, sku: " 10145a " })).toMatchObject({ ok: true, details: { sku: "10145A" } });
	});
});

describe("needsBarcodeNumber", () => {
	it("flags a shown barcode with no number", () => {
		expect(needsBarcodeNumber(newDesign(), null)).toBe(true);
		expect(needsBarcodeNumber(newDesign(), "05012345678900")).toBe(false);
	});

	it("ignores a hidden barcode", () => {
		const design = newDesign();
		const hidden = { ...design, parts: design.parts.map((p) => (p.kind === "barcode" ? { ...p, visible: false } : p)) };
		expect(needsBarcodeNumber(hidden, null)).toBe(false);
	});
});
