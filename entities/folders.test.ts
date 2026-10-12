import { describe, expect, it } from "vitest";
import { buildTree, folderNameSchema, folderOptions, pathTo, withDescendants } from "./folders";

const rows = [
	{ id: "a", name: "AMAZON", parentId: null, labelCount: 0 },
	{ id: "eu", name: "AMAZON EU", parentId: "a", labelCount: 2 },
	{ id: "srp", name: "SRP LABELS", parentId: "eu", labelCount: 5 },
	{ id: "uk", name: "AMAZON UK", parentId: "a", labelCount: 1 },
	{ id: "c", name: "CULINA", parentId: null, labelCount: 3 },
];

describe("buildTree", () => {
	it("nests folders by name and counts labels inside them", () => {
		const tree = buildTree(rows);
		expect(tree.map((n) => n.name)).toEqual(["AMAZON", "CULINA"]);
		expect(tree[0].children.map((n) => n.name)).toEqual(["AMAZON EU", "AMAZON UK"]);
		expect(tree[0].totalCount).toBe(8);
		expect(tree[0].children[0].totalCount).toBe(7);
	});
});

describe("pathTo", () => {
	it("gives the folders from the top", () => {
		expect(pathTo(rows, "srp").map((f) => f.name)).toEqual(["AMAZON", "AMAZON EU", "SRP LABELS"]);
		expect(pathTo(rows, null)).toEqual([]);
		expect(pathTo(rows, "nope")).toEqual([]);
	});
});

describe("withDescendants", () => {
	it("includes every folder inside", () => {
		expect([...withDescendants(rows, "a")].sort()).toEqual(["a", "eu", "srp", "uk"]);
	});
});

describe("folderOptions", () => {
	it("names each folder by its path", () => {
		expect(folderOptions(buildTree(rows)).map((o) => o.label)).toContain("AMAZON / AMAZON EU / SRP LABELS");
	});
});

describe("folderNameSchema", () => {
	it("trims and refuses blank names and slashes", () => {
		expect(folderNameSchema.parse("  SRP LABELS ")).toBe("SRP LABELS");
		expect(folderNameSchema.safeParse("  ").success).toBe(false);
		expect(folderNameSchema.safeParse("A/B").success).toBe(false);
	});
});
