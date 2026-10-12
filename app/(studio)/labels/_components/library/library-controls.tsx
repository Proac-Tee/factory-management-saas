import Link from "next/link";
import { KIND_NAMES, LABEL_KINDS } from "@/entities/label";
import { GROUPINGS, type Grouping, type LibraryQuery, libraryHref } from "@/entities/library";

/** Group by (links, so each view has its own URL) and the type filter. */
export function LibraryControls({ query }: { query: LibraryQuery }) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="flex items-center gap-3">
				<span className="text-sm leading-[18px] font-bold text-graphite">Group by</span>
				<nav aria-label="Group labels by" className="flex gap-1 rounded-md bg-wash p-1">
					{(Object.keys(GROUPINGS) as Grouping[]).map((g) => (
						<Link
							key={g}
							href={libraryHref(query, { group: g })}
							aria-current={g === query.group ? "true" : undefined}
							className={`flex h-10 items-center rounded-[6px] px-4 text-base pointer-coarse:h-12 ${
								g === query.group ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"
							}`}
						>
							{GROUPINGS[g]}
						</Link>
					))}
				</nav>
			</div>
			<KindFilter query={query} />
		</div>
	);
}

function KindFilter({ query }: { query: LibraryQuery }) {
	return (
		<details className="group relative">
			<summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-rule px-4 text-base font-bold hover:border-ink pointer-coarse:h-12 [&::-webkit-details-marker]:hidden">
				{query.kind ? KIND_NAMES[query.kind] : "All types"}
			</summary>
			<ul className="absolute right-0 z-10 mt-2 flex w-56 flex-col rounded-md border border-ink bg-stock p-1 md:left-auto">
				<li>
					<Link href={libraryHref(query, { kind: undefined })} className="flex h-11 items-center rounded-[6px] px-3 hover:bg-wash">
						All types
					</Link>
				</li>
				{LABEL_KINDS.map((k) => (
					<li key={k}>
						<Link
							href={libraryHref(query, { kind: k })}
							aria-current={k === query.kind ? "true" : undefined}
							className="flex h-11 items-center rounded-[6px] px-3 hover:bg-wash aria-[current]:font-bold"
						>
							{KIND_NAMES[k]}
						</Link>
					</li>
				))}
			</ul>
		</details>
	);
}
