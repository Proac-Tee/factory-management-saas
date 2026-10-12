import Link from "next/link";
import { LinkPending } from "@/components/link-pending";
import { ChevronDownIcon } from "@/components/icons";
import { KIND_NAMES, LABEL_KINDS } from "@/entities/label";
import { type LibraryQuery, libraryHref } from "@/entities/library";
import { GroupByNav } from "./group-by-nav";

/** Group by (links, so each view has its own URL) and the type filter. */
export function LibraryControls({ query }: { query: LibraryQuery }) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
				<span className="text-sm leading-[18px] font-bold text-graphite">Group by</span>
				<GroupByNav query={query} />
			</div>
			<KindFilter query={query} />
		</div>
	);
}

function KindFilter({ query }: { query: LibraryQuery }) {
	return (
		<details className="group relative">
			<summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-rule pr-3 pl-4 text-base font-bold transition-colors duration-150 group-open:border-ink hover:border-ink pointer-coarse:h-12 [&::-webkit-details-marker]:hidden">
				{query.kind ? KIND_NAMES[query.kind] : "All types"}
				<ChevronDownIcon size={18} className="transition-transform duration-200 ease-out-expo group-open:rotate-180" />
			</summary>
			<ul className="absolute right-0 z-10 mt-2 flex w-56 origin-top-right flex-col rounded-md border border-ink bg-stock p-1 animate-[fade-in_160ms_ease-out] md:left-auto">
				<li>
					<Link href={libraryHref(query, { kind: undefined })} className="flex h-11 items-center rounded-[6px] px-3 transition-colors duration-150 hover:bg-wash">
						All types
						<LinkPending />
					</Link>
				</li>
				{LABEL_KINDS.map((k) => (
					<li key={k}>
						<Link
							href={libraryHref(query, { kind: k })}
							aria-current={k === query.kind ? "true" : undefined}
							className="flex h-11 items-center rounded-[6px] px-3 transition-colors duration-150 hover:bg-wash aria-[current]:font-bold"
						>
							{KIND_NAMES[k]}
							<LinkPending />
						</Link>
					</li>
				))}
			</ul>
		</details>
	);
}
