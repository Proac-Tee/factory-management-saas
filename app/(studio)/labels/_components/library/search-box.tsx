import { SearchIcon } from "@/components/icons";
import type { LibraryQuery } from "@/entities/library";

/** A plain GET form, so search works before any JavaScript loads. */
export function SearchBox({ query }: { query: LibraryQuery }) {
	return (
		<form action="/labels" role="search" className="flex min-w-0 lg:w-[300px]">
			{query.group !== "folder" && <input type="hidden" name="group" value={query.group} />}
			{query.kind && <input type="hidden" name="kind" value={query.kind} />}
			<label className="flex h-12 w-full items-center gap-2.5 rounded-md bg-wash px-3.5 focus-within:ring-2 focus-within:ring-ink pointer-coarse:h-14">
				<SearchIcon size={18} className="shrink-0 text-graphite" />
				<span className="sr-only">Find a label, product, SKU or barcode</span>
				<input
					type="search"
					name="q"
					defaultValue={query.q}
					placeholder="Name, SKU or barcode"
					className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-graphite"
				/>
			</label>
		</form>
	);
}
