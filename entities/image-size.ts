// The natural size of a picture in mm, from its own header: pixels and
// resolution (DPI). LibreOffice crops pictures relative to this size.

const DEFAULT_DPI = 96;

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

const png = (b: Uint8Array) => {
	const width = u32(b, 16);
	const height = u32(b, 20);
	let dpi = { x: DEFAULT_DPI, y: DEFAULT_DPI };
	for (let i = 8; i + 8 < b.length; ) {
		const length = u32(b, i);
		const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
		// pHYs in pixels per metre, when the unit byte says metres.
		if (type === "pHYs" && b[i + 16] === 1) dpi = { x: u32(b, i + 8) * 0.0254, y: u32(b, i + 12) * 0.0254 };
		if (type === "IDAT" || type === "IEND") break;
		i += 12 + length;
	}
	return { width, height, dpi };
};

const jpeg = (b: Uint8Array) => {
	let dpi = { x: DEFAULT_DPI, y: DEFAULT_DPI };
	for (let i = 2; i + 9 < b.length; ) {
		if (b[i] !== 0xff) return null;
		const marker = b[i + 1];
		const length = u16(b, i + 2);
		// JFIF APP0: density unit 1 = dots per inch, 2 = dots per cm.
		if (marker === 0xe0 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === "JFIF") {
			const unit = b[i + 11];
			const x = u16(b, i + 12);
			const y = u16(b, i + 14);
			if (unit === 1 && x > 1) dpi = { x, y };
			if (unit === 2 && x > 1) dpi = { x: x * 2.54, y: y * 2.54 };
		}
		// Start of frame (any except DHT, JPG, DAC): height then width.
		if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
			return { width: u16(b, i + 7), height: u16(b, i + 5), dpi };
		}
		i += 2 + length;
	}
	return null;
};

/** The picture's size in mm, or null if the header can't be read. */
export const imageSizeMm = (bytes: Uint8Array): { widthMm: number; heightMm: number } | null => {
	const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
	const size = isPng ? png(bytes) : isJpeg ? jpeg(bytes) : null;
	if (!size || size.width <= 0 || size.height <= 0) return null;
	return { widthMm: (size.width / size.dpi.x) * 25.4, heightMm: (size.height / size.dpi.y) * 25.4 };
};

/** The picture's type from its first bytes (not its name), or null if it isn't one browsers draw. */
export const pictureType = (b: Uint8Array): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null => {
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
	const riff = String.fromCharCode(...b.slice(0, 4));
	const webp = String.fromCharCode(...b.slice(8, 12));
	if (riff === "RIFF" && webp === "WEBP") return "image/webp";
	return null;
};
