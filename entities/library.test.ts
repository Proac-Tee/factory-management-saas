import { describe, expect, it } from "vitest";
import { GENERAL, groupByCustomer, groupFlat, libraryHref, libraryQuerySchema, type Placeable } from "./library";

const label = (name: string, change: Partial<Placeable>): Placeable => ({
	name,
	customer: "Ember",
	kind: "srp",
	sku: null,
	productName: null,
	design: { widthMm: 100, heightMm: 100 },
	...change,
});

const labels = [
	label("Original pallet", { sku: "10145", productName: "Original Biltong 15 × 45g", kind: "pallet" }),
	label("Hold", { kind: "hold" }),
	label("Original SRP", { sku: "10145", productName: "Original Biltong 15 × 45g", kind: "srp" }),
	label("Chilli shipper", { sku: "10146", productName: "Chilli Biltong 15 × 45g", kind: "shipper" }),
	label("Amazon SRP", { customer: "Amazon UK", sku: "10145", productName: "Original Biltong 15 × 45g" }),
];

describe("groupByCustomer", () => {
	it("nests customer, then product, then labels in pack order", () => {
		const groups = groupByCustomer(labels);
		expect(groups.map((g) => [g.name, g.count])).toEqual([
			["Amazon UK", 1],
			["Ember", 4],
		]);
		const ember = groups[1].products;
		expect(ember.map((p) => p.name)).toEqual(["Chilli Biltong 15 × 45g", "Original Biltong 15 × 45g", GENERAL]);
		expect(ember[1].labels.map((l) => l.name)).toEqual(["Original SRP", "Original pallet"]);
		expect(ember[2]).toMatchObject({ sku: null, labels: [{ name: "Hold" }] });
	});
});

describe("groupFlat", () => {
	it("groups by type name or size", () => {
		expect(groupFlat(labels, "kind").map((g) => g.name)).toEqual(["Hold", "Pallet", "Shipper", "SRP"]);
		expect(groupFlat(labels, "size")).toMatchObject([{ name: "100 × 100 mm" }]);
	});
});

describe("libraryQuerySchema", () => {
	it("falls back for anything it doesn't know", () => {
		expect(libraryQuerySchema.parse({ group: "colour", kind: ["srp", "pallet"], q: "  tesco " })).toEqual({
			q: "tesco",
			group: "customer",
			kind: undefined,
			denied: undefined,
		});
		expect(libraryQuerySchema.parse({ group: "size", kind: "pallet" })).toMatchObject({ group: "size", kind: "pallet" });
	});
});

describe("libraryHref", () => {
	const query = libraryQuerySchema.parse({ q: "tesco", group: "kind" });
	it("keeps the current search and leaves defaults out", () => {
		expect(libraryHref(query, { kind: "srp" })).toBe("/labels?q=tesco&group=kind&kind=srp");
		expect(libraryHref(query, { group: "customer", q: "" })).toBe("/labels");
	});
});
