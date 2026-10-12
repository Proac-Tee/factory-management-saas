import { describe, expect, it } from "vitest";
import { databaseUrl, siteOrigin } from "./env";

describe("siteOrigin", () => {
	it("uses SITE_URL over whatever the request claims", () => {
		expect(siteOrigin("https://evil.example", "https://labels.ember.example/some/path")).toBe("https://labels.ember.example");
	});
	it("falls back to the request origin only when SITE_URL isn't set", () => {
		expect(siteOrigin("http://localhost:3001", "")).toBe("http://localhost:3001");
		expect(() => siteOrigin(null, "")).toThrow(/SITE_URL/);
	});
});

describe("databaseUrl", () => {
	it("drops the Supabase integration's supa flag and keeps the rest", () => {
		expect(databaseUrl("postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x")).toBe(
			"postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres?sslmode=require",
		);
		expect(databaseUrl("postgresql://postgres@localhost:5432/app")).toBe("postgresql://postgres@localhost:5432/app");
	});
});
