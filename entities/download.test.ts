import { describe, expect, it } from "vitest";
import { BLANK_FIELDS, downloadPaths, safeFileName } from "./download";

describe("safeFileName", () => {
	it("takes out characters files can't have", () => {
		expect(safeFileName('Chilli 45g / SRP: "new"')).toBe("Chilli 45g SRP new");
		expect(safeFileName(" .hidden. ")).toBe("hidden");
		expect(safeFileName("???")).toBe("Label");
	});
});

describe("downloadPaths", () => {
	it("keeps folders and numbers repeated names", () => {
		expect(
			downloadPaths([
				{ name: "Original SRP", folderPath: ["SRP LABELS"] },
				{ name: "original srp", folderPath: ["SRP LABELS"] },
				{ name: "Original SRP", folderPath: [] },
			]),
		).toEqual(["SRP LABELS/Original SRP.pdf", "SRP LABELS/original srp (2).pdf", "Original SRP.pdf"]);
	});
});

describe("BLANK_FIELDS", () => {
	it("leaves every field as a line to write on", () => {
		expect(Object.values(BLANK_FIELDS).every((v) => /^_+$/.test(v ?? ""))).toBe(true);
	});
});
