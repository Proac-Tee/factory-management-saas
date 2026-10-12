// The browser barcode reader (ZXing in WebAssembly). The decoder is served
// from this app, not a CDN, so scanning works on the factory network without
// reaching a third party (public/vendor/).

import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";
import { gtinFromScan } from "@/entities/label-import";
import type { PictureScanner } from "./label-files";

prepareZXingModule({
	overrides: {
		locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path),
	},
});

export { BarcodeDetector };

let pictureReader: BarcodeDetector | null = null;

/** Reads a barcode picture on a label: a product number if there is one, else whatever it holds. */
export const scanPicture: PictureScanner = async ({ bytes, type }) => {
	pictureReader ??= new BarcodeDetector({
		formats: ["itf", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "codabar", "databar", "databar_expanded"],
	});
	const found = await pictureReader.detect(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
	return (found.find((f) => gtinFromScan(f.rawValue)) ?? found[0])?.rawValue ?? null;
};
