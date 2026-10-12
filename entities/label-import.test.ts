import { describe, expect, it } from "vitest";
import { checkFit } from "./label";
import {
	customerFor,
	importLabel,
	kindFor,
	nameFor,
	type OdgItem,
	gtinFromScan,
	productNameFor,
	skuFor,
	storageFor,
	withFields,
} from "./label-import";

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
	// The Lenhams 10145 SRP label, as laid out in LibreOffice.
	const items: OdgItem[] = [
		{ kind: "image", xMm: 36, yMm: 1, widthMm: 27.5, heightMm: 25 },
		{ kind: "text", xMm: 15, yMm: 20, widthMm: 70, lines: [{ text: "ORIGINAL BILTONG", sizePt: 22 }] },
		{ kind: "text", xMm: 35, yMm: 47.5, widthMm: 32, lines: [{ text: " AMBIENT", sizePt: 20 }] },
		{ kind: "text", xMm: 25, yMm: 30, widthMm: 52, lines: [{ text: "PACK SIZE: 15 x 45g", sizePt: 16 }] },
		{ kind: "text", xMm: 10, yMm: 55.5, widthMm: 47, lines: [{ text: "BATCH: AN1210601", sizePt: 14 }] },
		{ kind: "text", xMm: 57.5, yMm: 55.5, widthMm: 35, lines: [{ text: "BBE: 12.10.27", sizePt: 14 }] },
		{ kind: "text", xMm: 25, yMm: 37.5, widthMm: 53, lines: [{ text: "SKU: 10145", sizePt: 20 }] },
		{ kind: "image", xMm: 10, yMm: 62.5, widthMm: 77.5, heightMm: 35.5 },
	];

	it("stacks the parts top to bottom, joining boxes on one line", () => {
		const label = importLabel("LENHAMS/SRP LABELS/ORIGINAL BILTONG 45g SRP LABEL 10145.odg", { widthMm: 99.8, heightMm: 99.8 }, items);
		expect(label).toMatchObject({ name: "Original Biltong 45g SRP 10145", customer: "Lenhams", kind: "srp", sku: "10145", storage: "ambient" });
		expect(label.design.parts.map((p) => (p.kind === "text" ? p.text : p.kind))).toEqual([
			"logo",
			"ORIGINAL BILTONG",
			"PACK SIZE: 15 x 45g",
			"SKU: 10145",
			"AMBIENT",
			"BATCH: {batch}   BBE: {bbe}",
			"barcode",
		]);
		expect(checkFit(label.design).fits).toBe(true);
	});

	it("takes a barcode number printed as text into the barcode", () => {
		const label = importLabel("CULINA/BARCODES/WILD VENISON 15x37g  10097  BARCODE.odg", { widthMm: 50, heightMm: 25 }, [
			{ kind: "image", xMm: 5, yMm: 3, widthMm: 40, heightMm: 12 },
			{ kind: "text", xMm: 8, yMm: 16, widthMm: 34, lines: [{ text: "15060534670737", sizePt: 9 }] },
		]);
		expect(label.barcode).toBe("15060534670737");
		expect(label.design.parts).toHaveLength(1);
		expect(label.design.parts[0]).toMatchObject({ kind: "barcode", numberSizePt: 9 });
	});
});

describe("productNameFor", () => {
	it("drops the SKU and the pack level from the label name", () => {
		expect(productNameFor("Original Biltong 45g SRP 10145", "10145")).toBe("Original Biltong 45g");
		expect(productNameFor("Chilli Biltong 15x45g Shipper Label - 10146", "10146")).toBe("Chilli Biltong 15x45g");
		expect(productNameFor("PALLET LABELS 10097", "10097")).toBe("Product 10097");
	});
});

describe("barcode pictures", () => {
	const page = { widthMm: 100, heightMm: 100 };
	const picture = (decoded: string | null) =>
		({ kind: "image", xMm: 10, yMm: 60, widthMm: 80, heightMm: 25, decoded }) satisfies OdgItem;

	it("takes the number read from the barcode picture", () => {
		expect(importLabel("EMBER/ORIGINAL SRP 10145.odg", page, [picture("15060534671000")]).barcode).toBe("15060534671000");
	});

	it("prefers the picture over a number typed beside it, and ignores misreads", () => {
		const typed = { kind: "text", xMm: 10, yMm: 90, widthMm: 80, lines: [{ text: "5060534671003", sizePt: 9 }] } satisfies OdgItem;
		expect(importLabel("X.odg", page, [picture("15060534671000"), typed]).barcode).toBe("15060534671000");
		expect(importLabel("X.odg", page, [picture("15060534671012"), typed]).barcode).toBe("5060534671003");
		expect(importLabel("X.odg", page, [picture(null)]).barcode).toBeNull();
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
