import { describe, expect, it } from "vitest";
import { clipOf } from "./odg";

describe("clipOf", () => {
	it("reads a crop as top, right, bottom, left in mm", () => {
		expect(clipOf("rect(2.591cm, 2.594cm, 0cm, 2.443cm)")).toEqual([25.91, 25.94, 0, 24.43].map((v) => expect.closeTo(v, 5)));
	});

	it("treats no crop, auto sides and bad values as no cut", () => {
		expect(clipOf(undefined)).toEqual([0, 0, 0, 0]);
		expect(clipOf("rect(auto, auto, 1mm, auto)")).toEqual([0, 0, 1, 0]);
		expect(clipOf("rect(1cm)")).toEqual([0, 0, 0, 0]);
	});
});
