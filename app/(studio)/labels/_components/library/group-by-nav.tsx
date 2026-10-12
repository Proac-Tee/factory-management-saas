"use client";

import Link from "next/link";
import { useState } from "react";
import { segmentClass, useSegmentPill } from "@/components/segment-pill";
import { GROUPINGS, type Grouping, type LibraryQuery, libraryHref } from "@/entities/library";

/** Group by, as links (each view has its own URL); the pill moves on tap, before the page arrives. */
export function GroupByNav({ query }: { query: LibraryQuery }) {
	const [shown, setShown] = useState(query.group);
	const [prev, setPrev] = useState(query.group);
	if (prev !== query.group) {
		setPrev(query.group);
		setShown(query.group);
	}
	const { ref, pill, ready } = useSegmentPill<HTMLElement>(shown);

	return (
		<nav ref={ref} aria-label="Group labels by" className="relative isolate flex gap-1 rounded-md bg-wash p-1">
			{pill}
			{(Object.keys(GROUPINGS) as Grouping[]).map((g) => (
				<Link
					key={g}
					href={libraryHref(query, { group: g })}
					aria-current={g === query.group ? "true" : undefined}
					data-active={g === shown || undefined}
					onClick={() => setShown(g)}
					className={`flex h-10 flex-1 items-center justify-center rounded-[6px] px-3 text-base sm:flex-none sm:px-4 pointer-coarse:h-12 ${segmentClass(g === shown, ready)}`}
				>
					{GROUPINGS[g]}
				</Link>
			))}
		</nav>
	);
}
