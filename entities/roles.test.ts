import { describe, expect, it } from "vitest";
import { can, checkEmail } from "./roles";

describe("can", () => {
	it("lets operators use labels but not edit them or manage access", () => {
		expect(can("operator", "use-labels")).toBe(true);
		expect(can("operator", "edit-labels")).toBe(false);
		expect(can("operator", "manage-access")).toBe(false);
	});

	it("keeps access management for admins", () => {
		expect(can("editor", "edit-labels")).toBe(true);
		expect(can("editor", "manage-access")).toBe(false);
		expect(can("admin", "manage-access")).toBe(true);
	});

	it("lets nobody in without a role", () => {
		expect(can(null, "use-labels")).toBe(false);
	});
});

describe("checkEmail", () => {
	it("lower-cases and trims", () => {
		expect(checkEmail("  Zoe@EmberSnacks.co.uk ")).toEqual({ ok: true, email: "zoe@embersnacks.co.uk" });
	});

	it("refuses things that aren't emails", () => {
		expect(checkEmail("zoe")).toMatchObject({ ok: false });
		expect(checkEmail("")).toMatchObject({ ok: false });
	});
});
