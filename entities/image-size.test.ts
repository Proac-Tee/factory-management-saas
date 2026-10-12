import { describe, expect, it } from "vitest";
import { imageSizeMm, pictureType } from "./image-size";

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (type: string, data: number[]) => [...be32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
const png = (w: number, h: number, ppm?: number) =>
	new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		...chunk("IHDR", [...be32(w), ...be32(h), 8, 6, 0, 0, 0]),
		...(ppm ? chunk("pHYs", [...be32(ppm), ...be32(ppm), 1]) : []),
		...chunk("IEND", []),
	]);
const jpeg = (w: number, h: number, dpi?: number) =>
	new Uint8Array([
		0xff, 0xd8,
		...(dpi ? [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0] : []),
		0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	]);

describe("imageSizeMm", () => {
	it("reads a PNG at 96 DPI when it names none", () => {
		const size = imageSizeMm(png(96, 192));
		expect(size?.widthMm).toBeCloseTo(25.4);
		expect(size?.heightMm).toBeCloseTo(50.8);
	});

	it("uses a PNG's own resolution", () => {
		expect(imageSizeMm(png(300, 300, 11811))?.widthMm).toBeCloseTo(25.4, 1);
	});

	it("reads a JPEG's size and JFIF DPI", () => {
		const size = imageSizeMm(jpeg(600, 300, 300));
		expect(size?.widthMm).toBeCloseTo(50.8);
		expect(size?.heightMm).toBeCloseTo(25.4);
	});

	it("gives null for anything else", () => {
		expect(imageSizeMm(new Uint8Array([1, 2, 3, 4]))).toBeNull();
	});
});

describe("pictureType", () => {
	it("goes by the bytes, not the name", () => {
		expect(pictureType(png(1, 1))).toBe("image/png");
		expect(pictureType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
		expect(pictureType(new TextEncoder().encode("<html>"))).toBeNull();
	});
});
