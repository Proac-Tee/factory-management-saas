import { describe, expect, it } from "vitest";
import { parseDesign } from "./label";
import type { PlacedDesign } from "./placed";
import { addPlacedPart, newTextPart, nudgePart, removePlacedPart, setParagraphText, setTextSize, textSizeOf } from "./placed-edit";

const design: PlacedDesign = { layout: "placed", widthMm: 100, heightMm: 100, parts: [newTextPart("a")] };

describe("editing a placed design", () => {
	it("nudges a part and keeps it on the label", () => {
		expect(nudgePart(design, "a", 2.5, -1).parts[0]).toMatchObject({ xMm: 7.5, yMm: 4 });
		expect(nudgePart(design, "a", 500, 0).parts[0].xMm).toBe(100);
	});

	it("edits a line's text and the box's size, and every result still parses", () => {
		const text = design.parts[0];
		if (text.kind !== "text") throw new Error();
		const edited = setTextSize(setParagraphText(text, 0, "BATCH: {batch}"), 20);
		expect(edited.paragraphs[0].runs).toMatchObject([{ text: "BATCH: {batch}", sizePt: 20, weight: 700 }]);
		expect(textSizeOf(edited)).toBe(20);
		const next = addPlacedPart(removePlacedPart(design, "a"), { ...edited, id: "b" });
		expect(parseDesign(next).ok).toBe(true);
	});
});
