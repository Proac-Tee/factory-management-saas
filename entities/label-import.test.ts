import { describe, expect, it } from "vitest";
import { parseDesign } from "./label";
import {
	customerFor,
	fileToSkip,
	importLabel,
	kindFor,
	nameFor,
	gtinFromScan,
	productNameFor,
	skuFor,
	storageFor,
	withFields,
} from "./label-import";
import type { OdgDocument, OdgItem } from "./odg";

describe("grouping from the folder", () => {
	it("finds the customer, with Tesco and Alliance by file name", () => {
		expect(customerFor("AMAZON/AMAZON EU/SRP LABELS/X.odg")).toBe("Amazon EU");
		expect(customerFor("AMAZON/Heavy Parcel.odg")).toBe("Amazon UK");
		expect(customerFor("LENHAMS/BILTONG LABELS/SRP LABELS/50g Biltong/TESCO CHILLI BILTONG 50g SRP LABEL.odg")).toBe("Tesco");
		expect(customerFor("Alliance Box Label.odg")).toBe("Alliance");
		expect(customerFor("WASTE/BULK WASTE.odg")).toBe("Ember");
	});

	it("finds the kind of label", () => {
		expect(kindFor("LENHAMS/BILTONG LABELS/PALLET LABELS/45g Biltong/8 x 15 x 45g ORIGINAL BILTONG PALLET LABEL   10145.odg")).toBe("pallet");
		expect(kindFor("AMAZON/AMAZON UK/SHIPPER LABELS/ORIGINAL BILTONG 45g  SHIPPER LABEL  10151 UK.odg")).toBe("shipper");
		expect(kindFor("CULINA/CHARCUTERIE LABELS/BARCODES/WILD VENISON 15x37g  10097  BARCODE.odg")).toBe("barcode");
		expect(kindFor("PRODUCT HOLD LABELS/BULK PRODUCT HOLD LABEL.odg")).toBe("hold");
		expect(kindFor("Unders Overs.odg")).toBe("waste");
		expect(kindFor("ADDRESS LABELS/ADDRESS LABEL 1.odg")).toBe("address");
	});

	it("makes a readable name from the file", () => {
		expect(nameFor("X/ORIGINAL BILTONG 45g  SRP LABEL 10145.odg")).toBe("Original Biltong 45g SRP 10145");
		expect(nameFor("X/ORIGINAL BILTONG 45g SRP LABEL 10151 UK (2).odg")).toBe("Original Biltong 45g SRP 10151 UK");
		expect(nameFor("WASTE/LABEL 3.odg")).toBe("Waste 3");
	});
});

describe("details from the text", () => {
	it("prefers the SKU printed on the label, then the file name", () => {
		expect(skuFor("A/B 10145.odg", ["SKU:  10145"])).toBe("10145");
		expect(skuFor("A/LEA & PERRINS 40g SRP LABEL 10190SRP.odg", ["LEA & PERRINS"])).toBe("10190SRP");
		expect(skuFor("A/PRODUCT HOLD LABEL.odg", ["HOLD"])).toBeNull();
	});

	it("reads ambient or chilled", () => {
		expect(storageFor(["WILD VENISON", "CHILLED"])).toBe("chilled");
		expect(storageFor(["AMBIENT"])).toBe("ambient");
		expect(storageFor(["HOLD"])).toBeNull();
	});

	it("turns typed-in batch, BBE and quantity into fields", () => {
		expect(withFields("BATCH: AN1210601   BBE: 12.10.27")).toBe("BATCH: {batch}   BBE: {bbe}");
		expect(withFields("BBE: 012.10.27")).toBe("BBE: {bbe}");
		expect(withFields("QTY: 152 UNITS")).toBe("QTY: {qty} UNITS");
	});
});

describe("importLabel", () => {
	const page = { widthMm: 99.8, heightMm: 99.8 };
	const text = (t: string, y: number, extra: Partial<OdgItem> = {}): OdgItem => ({
		kind: "text",
		xMm: 10,
		yMm: y,
		wMm: 60,
		hMm: 7,
		rotateDeg: 0,
		hAlign: "left",
		vAlign: "top",
		wrap: false,
		paddingMm: [0, 0, 0, 0],
		paragraphs: [{ align: "left", sizePt: 16, runs: [{ text: t, sizePt: 16, weight: 700, italic: false, font: "cambria", color: "#000000" }] }],
		...extra,
	}) as OdgItem;
	const doc = (items: OdgItem[], warnings: string[] = []): OdgDocument => ({ page, items, pictures: {}, warnings });
	const picture = (href: string): OdgItem => ({ kind: "image", xMm: 10, yMm: 60, wMm: 80, hMm: 25, rotateDeg: 0, href, mime: "", cropMm: [0, 0, 0, 0] });

	it("keeps every part where it was drawn, in the file's folders", () => {
		const label = importLabel(
			"LENHAMS/BILTONG LABELS/SRP LABELS/ORIGINAL BILTONG 45g SRP LABEL 10145.odg",
			doc([text("SKU: 10145", 40), text("BATCH: AN0610601", 57), text("AMBIENT", 48)]),
			{},
		);
		expect(label).toMatchObject({
			folderPath: ["LENHAMS", "BILTONG LABELS", "SRP LABELS"],
			customer: "Lenhams",
			kind: "srp",
			sku: "10145",
			storage: "ambient",
			design: { layout: "placed", widthMm: 99.8 },
		});
		expect(label.design.parts.map((p) => [p.id, p.yMm])).toEqual([["p1", 40], ["p2", 57], ["p3", 48]]);
		expect(label.design.parts[1]).toMatchObject({ paragraphs: [{ runs: [{ text: "BATCH: {batch}" }] }] });
		expect(parseDesign(label.design).ok).toBe(true);
	});

	it("takes the barcode from a picture, then drawn bars, then printed digits", () => {
		const scanned = { "Pictures/bars.png": { hash: "a".repeat(64), scanned: "15060534671000" } };
		expect(importLabel("X.odg", doc([picture("Pictures/bars.png"), text("5060534671003", 90)]), scanned).barcode).toBe("15060534671000");
		expect(importLabel("X.odg", doc([text("5060534671003", 90)]), {}).barcode).toBe("5060534671003");
		expect(importLabel("X.odg", doc([text("15060534671012", 90)]), {}).barcode).toBeNull();
	});

	it("keeps the pictures it can show and says which it can't", () => {
		const label = importLabel("X.odg", doc([picture("Pictures/logo.jpg"), picture("Pictures/fnsku.pdf")]), {
			"Pictures/logo.jpg": { hash: "b".repeat(64), scanned: null },
			"Pictures/fnsku.pdf": { hash: "c".repeat(64), scanned: null },
		});
		expect(label.design.parts.map((p) => p.kind === "image" && p.image)).toEqual(["b".repeat(64), null]);
		expect(label.warnings).toEqual(["A picture (PDF) can't be shown, so it's left blank."]);
	});
});

describe("productNameFor", () => {
	it("drops the SKU and the pack level from the label name", () => {
		expect(productNameFor("Original Biltong 45g SRP 10145", "10145")).toBe("Original Biltong 45g");
		expect(productNameFor("Chilli Biltong 15x45g Shipper Label - 10146", "10146")).toBe("Chilli Biltong 15x45g");
		expect(productNameFor("PALLET LABELS 10097", "10097")).toBe("Product 10097");
	});
});

describe("gtinFromScan", () => {
	it("finds the product number in each kind of barcode", () => {
		expect(gtinFromScan("15060534671000")).toBe("15060534671000"); // ITF-14
		expect(gtinFromScan("5060534671003")).toBe("5060534671003"); // EAN-13
		expect(gtinFromScan("(01)15060534671000(17)271012(10)AN1210601")).toBe("15060534671000"); // GS1-128
		expect(gtinFromScan("0115060534671000172710121" + "0AN1210601")).toBe("15060534671000"); // GS1-128, raw
		expect(gtinFromScan("506053467100")).toBeNull(); // UPC-A with a bad check digit
	});

	it("ignores what isn't a product number", () => {
		expect(gtinFromScan("X001ABCDEF")).toBeNull(); // Amazon FNSKU
		expect(gtinFromScan("(00)350605346710000017")).toBeNull(); // pallet SSCC
		expect(gtinFromScan("15060534671012")).toBeNull(); // wrong check digit
	});
});

describe("customerFor inside another folder", () => {
	it("finds the customer's folder further down", () => {
		expect(customerFor("Label Designs/LENHAMS/BILTONG LABELS/x.odg")).toBe("Lenhams");
		expect(customerFor("Label Designs/AMAZON/AMAZON EU/x.odg")).toBe("Amazon EU");
	});
});

describe("fileToSkip", () => {
	it("reads only .odg labels", () => {
		expect(fileToSkip("LENHAMS/SRP/ORIGINAL.odg")).toBeNull();
		expect(fileToSkip("LENHAMS/SRP/.~lock.ORIGINAL.odg#")).not.toBeNull();
		expect(fileToSkip("LENHAMS/desktop.ini")).not.toBeNull();
		expect(fileToSkip("LENHAMS/Labels - Shortcut.lnk")).not.toBeNull();
		expect(fileToSkip("LENHAMS/old.zip")).toMatch(/unzip/);
		expect(fileToSkip("LENHAMS/notes.pdf")).not.toBeNull();
	});
});
