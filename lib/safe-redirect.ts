// Where to send someone after a link from an email. `next` comes from the
// URL, so anyone can set it: only paths on this site are allowed, judged by
// how the browser will resolve them ("/\evil.com" is https://evil.com/).

export const safeRedirectPath = (next: string | null, origin: string, fallback = "/labels"): string => {
	if (!next || !next.startsWith("/")) return fallback;
	try {
		const url = new URL(next, origin);
		return url.origin === new URL(origin).origin ? `${url.pathname}${url.search}` : fallback;
	} catch {
		return fallback;
	}
};
