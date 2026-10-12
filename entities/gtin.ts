// GS1 barcode numbers. Case labels carry a GTIN-14 printed as ITF-14
// (e.g. 15060534671000); pouches carry a GTIN-13 printed as EAN-13.

import { z } from "zod";

export type BarcodeKind = "itf14" | "ean13";

export const BARCODE_KIND_NAMES: Record<BarcodeKind, string> = {
	itf14: "ITF-14 (case)",
	ean13: "EAN-13 (pouch)",
};

/** GS1 mod-10 check digit: from the right, digits are weighted 3, 1, 3, 1, ... */
export const gtinCheckDigit = (digitsWithoutCheck: string): number => {
	if (!/^\d+$/.test(digitsWithoutCheck)) {
		throw new Error("A barcode number can only contain digits.");
	}
	let sum = 0;
	for (let i = 0; i < digitsWithoutCheck.length; i++) {
		const digit = Number(digitsWithoutCheck[digitsWithoutCheck.length - 1 - i]);
		sum += digit * (i % 2 === 0 ? 3 : 1);
	}
	return (10 - (sum % 10)) % 10;
};

export type GtinCheck =
	| { ok: true; gtin: string; kind: BarcodeKind }
	| { ok: false; message: string };

/**
 * Checks a barcode number typed or scanned by a person. Spaces are ignored
 * because GS1 certificates print the number in groups. 14 digits is a case
 * barcode (ITF-14), 13 a pouch barcode (EAN-13).
 */
export const checkGtin = (input: string): GtinCheck => {
	const gtin = input.replace(/\s+/g, "");
	if (gtin === "") return { ok: false, message: "Enter the barcode number." };
	if (!/^\d+$/.test(gtin)) return { ok: false, message: "Use digits only." };
	if (gtin.length !== 13 && gtin.length !== 14) {
		return {
			ok: false,
			message: `A barcode has 13 digits (pouch) or 14 (case). This has ${gtin.length}.`,
		};
	}
	const expected = gtinCheckDigit(gtin.slice(0, -1));
	if (Number(gtin.at(-1)) !== expected) {
		return {
			ok: false,
			message: `The last digit should be ${expected}. Check the number on your GS1 account.`,
		};
	}
	return { ok: true, gtin, kind: gtin.length === 14 ? "itf14" : "ean13" };
};

const toGtin = (input: string, ctx: z.RefinementCtx) => {
	const check = checkGtin(input);
	if (check.ok) return check.gtin;
	ctx.addIssue({ code: "custom", message: check.message });
	return z.NEVER;
};

/** A barcode number as Zod: checks it with checkGtin and gives back the digits. */
export const gtinSchema = z.string().transform(toGtin);

/** An optional barcode number: empty means "no barcode" (null). */
export const optionalGtinSchema = z
	.string()
	.transform((input, ctx) => (input.trim() === "" ? null : toGtin(input, ctx)));

/**
 * The same product's numbers match across pack levels: a case GTIN-14 is the
 * pouch GTIN-13 with an indicator digit in front and a new check digit. So two
 * barcodes belong together when their 12-digit item reference matches.
 */
export const sameItem = (a: string, b: string): boolean => {
	const item = (gtin: string) =>
		gtin.length === 14 ? gtin.slice(1, 13) : gtin.slice(0, 12);
	return a.length >= 13 && b.length >= 13 && item(a) === item(b);
};
