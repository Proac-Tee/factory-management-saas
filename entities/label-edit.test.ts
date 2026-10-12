import { describe, expect, it } from "vitest";
import { newDesign, parseDesign, SIZE_PRESETS } from "./label";
import { addPart, applyPreset, canAdd, matchingPreset, movePart, newPart, removePart, updatePart } from "./label-edit";

const ids = (d: { parts: { id: string }[] }) => d.parts.map((p) => p.id);

describe("editing a design", () => {
	const design = newDesign();

	it("moves parts and ignores moves off either end", () => {
		expect(ids(movePart(design, "name", -1)).slice(0, 2)).toEqual(["name", "logo"]);
		expect(movePart(design, "logo", -1)).toBe(design);
		expect(movePart(design, "barcode", 1)).toBe(design);
	});

	it("updates, removes and adds parts, and every result still parses", () => {
		const changed = addPart(removePart(updatePart(design, "sku", { sizePt: 18 }), "storage"), newPart("text", "extra"));
		expect(changed.parts.find((p) => p.id === "sku")).toMatchObject({ sizePt: 18 });
		expect(ids(changed)).not.toContain("storage");
		expect(ids(changed).at(-1)).toBe("extra");
		expect(parseDesign(changed).ok).toBe(true);
	});

	it("allows one logo and one barcode", () => {
		expect(canAdd(design, "logo")).toBe(false);
		expect(canAdd(removePart(design, "logo"), "logo")).toBe(true);
		expect(canAdd(design, "text")).toBe(true);
	});

	it("applies a stock size, with a small margin on small labels", () => {
		const small = applyPreset(design, { widthMm: 50, heightMm: 25 });
		expect(small).toMatchObject({ widthMm: 50, heightMm: 25, marginMm: 1.5 });
		expect(matchingPreset(small, SIZE_PRESETS)).toEqual({ widthMm: 50, heightMm: 25 });
		expect(matchingPreset({ ...design, widthMm: 99.6 }, SIZE_PRESETS)).toEqual({ widthMm: 100, heightMm: 100 });
	});
});
