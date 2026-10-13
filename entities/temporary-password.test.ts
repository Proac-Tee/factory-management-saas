import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { temporaryPassword } from "./temporary-password";

const real = (n: number) => new Uint8Array(randomBytes(n));

describe("temporaryPassword", () => {
	it("is three groups of four easy-to-read characters", () => {
		for (let i = 0; i < 200; i++) {
			const password = temporaryPassword(real);
			expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
			expect(password).not.toMatch(/[01OoIlL]/);
			expect(password).toMatch(/[A-Z]/);
			expect(password).toMatch(/[a-z]/);
			expect(password).toMatch(/[2-9]/);
		}
	});

	it("tries again until it mixes capitals, small letters and digits", () => {
		// First draw: only "A" (byte 0); then a mixed draw.
		let call = 0;
		const fake = (n: number) => (call++ === 0 ? new Uint8Array(n) : new Uint8Array(Array.from({ length: n }, (_, i) => i * 7)));
		expect(temporaryPassword(fake)).toMatch(/[a-z]/);
	});

	it("doesn't repeat", () => {
		expect(new Set(Array.from({ length: 50 }, () => temporaryPassword(real))).size).toBe(50);
	});
});
