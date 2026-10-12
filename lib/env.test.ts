import { describe, expect, it } from "vitest";
import { siteOrigin } from "./env";

describe("siteOrigin", () => {
	it("uses SITE_URL over whatever the request claims", () => {
		expect(siteOrigin("https://evil.example", "https://labels.ember.example/some/path")).toBe("https://labels.ember.example");
	});
	it("falls back to the request origin only when SITE_URL isn't set", () => {
		expect(siteOrigin("http://localhost:3001", "")).toBe("http://localhost:3001");
		expect(() => siteOrigin(null, "")).toThrow(/SITE_URL/);
	});
});
