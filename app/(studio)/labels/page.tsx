import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, ScanIcon, SearchIcon } from "@/components/icons";
import { LabelRender } from "@/components/label-render";
import { ErrorLine, outlineButton, PageHeader, primaryButton } from "@/components/ui";
import { type LabelSummary, listLabels } from "@/data-access/labels";
import { KIND_NAMES, LABEL_KINDS, type LabelKind } from "@/entities/label";
import { can } from "@/entities/roles";
import { getMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Labels" };

const GROUPINGS = { customer: "Customer", kind: "Type", size: "Size" } as const;
type Grouping = keyof typeof GROUPINGS;

const sizeName = (l: LabelSummary) => `${round(l.design.widthMm)} × ${round(l.design.heightMm)} mm`;
const round = (n: number) => Math.round(n);

export default function LabelsPage({ searchParams }: PageProps<"/labels">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading labels…</p>}>
			<Library searchParams={searchParams} />
		</Suspense>
	);
}

async function Library({ searchParams }: { searchParams: PageProps<"/labels">["searchParams"] }) {
	const member = await getMember();
	const params = await searchParams;
	const query = typeof params.q === "string" ? params.q.slice(0, 80) : "";
	const group: Grouping = params.group === "kind" || params.group === "size" ? params.group : "customer";
	const kind = LABEL_KINDS.find((k) => k === params.kind) as LabelKind | undefined;

	const labels = await listLabels(member.claims, { query, kind });
	const keyOf = (l: LabelSummary) => (group === "kind" ? KIND_NAMES[l.kind] : group === "size" ? sizeName(l) : l.customer);
	const groups = new Map<string, LabelSummary[]>();
	for (const label of labels) {
		const key = keyOf(label);
		groups.set(key, [...(groups.get(key) ?? []), label]);
	}
	const customers = new Set(labels.map((l) => l.customer)).size;

	const href = (change: Record<string, string | undefined>) => {
		const next = new URLSearchParams();
		const merged = { q: query || undefined, group: group === "customer" ? undefined : group, kind, ...change };
		for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
		const s = next.toString();
		return s ? `/labels?${s}` : "/labels";
	};

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader
				context={`${labels.length} ${labels.length === 1 ? "label" : "labels"}, ${customers} ${customers === 1 ? "customer" : "customers"}`}
				title="Labels"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<form action="/labels" role="search" className="flex min-w-0 sm:w-[300px]">
						{group !== "customer" && <input type="hidden" name="group" value={group} />}
						{kind && <input type="hidden" name="kind" value={kind} />}
						<label className="flex h-12 w-full items-center gap-2.5 rounded-md bg-wash px-3.5 focus-within:ring-2 focus-within:ring-ink pointer-coarse:h-14">
							<SearchIcon size={18} className="shrink-0 text-graphite" />
							<span className="sr-only">Find a label, SKU or barcode</span>
							<input
								type="search"
								name="q"
								defaultValue={query}
								placeholder="Find a label, SKU or barcode"
								className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-graphite"
							/>
						</label>
					</form>
					<div className="flex gap-3">
						<Link href="/scan" className={`${outlineButton} flex-1 pointer-coarse:h-14 sm:flex-none`}>
							<ScanIcon size={18} />
							Scan
						</Link>
						{can(member.role, "edit-labels") && (
							<Link href="/labels/new" className={`${primaryButton} h-12 flex-1 pointer-coarse:h-14 sm:flex-none`}>
								<PlusIcon size={18} strokeWidth={2.5} />
								New label
							</Link>
						)}
					</div>
				</div>
			</PageHeader>

			<div className="flex flex-col gap-6 px-4 pt-5 pb-12 md:px-10">
				{params.denied && <ErrorLine message="Your role can't open that page. Ask an admin if you need it." />}

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-3">
						<span className="text-sm leading-[18px] font-bold text-graphite">Group by</span>
						<nav aria-label="Group labels by" className="flex gap-1 rounded-md bg-wash p-1">
							{(Object.keys(GROUPINGS) as Grouping[]).map((g) => (
								<Link
									key={g}
									href={href({ group: g === "customer" ? undefined : g })}
									aria-current={g === group ? "true" : undefined}
									className={`flex h-10 items-center rounded-[6px] px-4 text-base pointer-coarse:h-12 ${
										g === group ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"
									}`}
								>
									{GROUPINGS[g]}
								</Link>
							))}
						</nav>
					</div>
					<KindFilter current={kind} href={href} />
				</div>

				{labels.length === 0 ? (
					<div className="flex flex-col gap-3 py-10">
						<p className="text-xl leading-8 font-black tracking-tight">
							{query ? `No label matches “${query}”` : "No labels yet"}
						</p>
						<p className="max-w-[60ch] text-base leading-normal text-graphite">
							{query
								? "Search looks at the name, customer, SKU and the full barcode number. Try fewer words."
								: "Make the first one, or import the LibreOffice labels with pnpm labels:import."}
						</p>
					</div>
				) : (
					[...groups.entries()]
						.sort(([a], [b]) => a.localeCompare(b, "en-GB", { numeric: true }))
						.map(([name, items]) => (
							<section key={name} aria-labelledby={`group-${slug(name)}`} className="flex flex-col gap-4">
								<div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
									<h2 id={`group-${slug(name)}`} className="text-lg leading-6 font-black tracking-[-0.01em]">
										{name}
									</h2>
									<span className="text-sm leading-[18px] font-bold text-graphite tabular-nums">
										{items.length} {items.length === 1 ? "label" : "labels"}
									</span>
								</div>
								<ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))] md:gap-x-6">
									{items.map((label) => (
										<li key={label.id}>
											<Tile label={label} />
										</li>
									))}
								</ul>
							</section>
						))
				)}
			</div>
		</div>
	);
}

function Tile({ label }: { label: LabelSummary }) {
	return (
		<Link href={`/labels/${label.id}`} className="group flex flex-col gap-2.5">
			<div className="flex aspect-square items-center justify-center rounded-[4px] border border-rule bg-stock p-2 [container-type:size] group-hover:border-ink">
				<LabelRender design={label.design} barcode={label.barcode} scale="fit" />
			</div>
			<div className="flex flex-col gap-0.5">
				<span className="text-base leading-5 font-bold group-hover:underline">{label.name}</span>
				<span className="text-sm leading-[18px] text-graphite tabular-nums">
					{[label.sku && `SKU ${label.sku}`, sizeName(label), KIND_NAMES[label.kind]].filter(Boolean).join(", ")}
				</span>
			</div>
		</Link>
	);
}

function KindFilter({ current, href }: { current?: LabelKind; href: (c: Record<string, string | undefined>) => string }) {
	return (
		<details className="group relative">
			<summary className="flex h-10 list-none items-center gap-2 rounded-md border border-rule px-4 text-base font-bold hover:border-ink pointer-coarse:h-12 [&::-webkit-details-marker]:hidden">
				{current ? KIND_NAMES[current] : "All types"}
			</summary>
			<ul className="absolute right-0 z-10 mt-2 flex w-56 flex-col rounded-md border border-ink bg-stock p-1 md:left-auto">
				<li>
					<Link href={href({ kind: undefined })} className="flex h-11 items-center rounded-[6px] px-3 hover:bg-wash">
						All types
					</Link>
				</li>
				{LABEL_KINDS.map((k) => (
					<li key={k}>
						<Link
							href={href({ kind: k })}
							aria-current={k === current ? "true" : undefined}
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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
