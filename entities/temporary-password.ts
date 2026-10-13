// The one-time password an admin hands to a new person (no email is sent).
// Easy to read out and type: no 0/O, 1/l/I, grouped in fours, and always
// mixing capitals, small letters and digits so password rules accept it.

const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;
const LENGTH = 12;

/** Whether an account must choose its own password before using the app (set by the server). */
export const MUST_CHANGE_PASSWORD = "must_change_password";

/**
 * A new temporary password like "Kp7m-Xq4R-t9wB". `random` gives `n`
 * random bytes (crypto.getRandomValues in the app; fixed in tests).
 */
export const temporaryPassword = (random: (n: number) => Uint8Array): string => {
	for (;;) {
		// Rejection sampling keeps every character equally likely.
		const chars: string[] = [];
		while (chars.length < LENGTH) {
			for (const byte of random(LENGTH * 2)) {
				if (byte < 256 - (256 % ALL.length) && chars.length < LENGTH) chars.push(ALL[byte % ALL.length]);
			}
		}
		const has = (set: string) => chars.some((c) => set.includes(c));
		if (has(UPPER) && has(LOWER) && has(DIGITS)) return chars.join("").match(/.{4}/g)!.join("-");
	}
};
