// How dates and times read in the app: UK style, factory time.

const ZONE = "Europe/London";

/** 12.10.26 */
export const shortDate = (iso: string) =>
	new Date(iso)
		.toLocaleDateString("en-GB", { timeZone: ZONE, day: "2-digit", month: "2-digit", year: "2-digit" })
		.replaceAll("/", ".");

/** 14:05 */
export const time = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });

/** "today 14:05", or the date for any other day. */
export const whenShort = (iso: string) =>
	new Date(iso).toDateString() === new Date().toDateString() ? `today ${time(iso)}` : shortDate(iso);
