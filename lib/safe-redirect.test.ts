import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

const origin = "https://labels.ember.example";

describe("safeRedirectPath", () => {
	it("keeps paths on this site", () => {
		expect(safeRedirectPath("/labels", origin)).toBe("/labels");
		expect(safeRedirectPath("/reset-password?x=1", origin)).toBe("/reset-password?x=1");
	});

	it("refuses anything that leaves the site", () => {
		for (const next of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "", null]) {
			expect(safeRedirectPath(next, origin)).toBe("/labels");
		}
	});
});
