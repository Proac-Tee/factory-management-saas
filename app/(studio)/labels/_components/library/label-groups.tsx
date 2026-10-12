import Link from "next/link";
import { LabelRender } from "@/components/label-render";
import { KIND_NAMES } from "@/entities/label";
import { type CustomerGroup, type FlatGroup, type ProductGroup, sizeName } from "@/entities/library";
import type { LabelSummary } from "@/use-cases/labels";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const countText = (n: number) => `${n} ${n === 1 ? "label" : "labels"}`;

/** A customer, then each of its products with that product's labels. */
export function CustomerSection({ customer }: { customer: CustomerGroup<LabelSummary> }) {
	const id = `customer-${slug(customer.name)}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-5">
			<GroupHeading id={id} title={customer.name} count={customer.count} />
			{customer.products.map((product) => (
				<ProductBlock key={product.sku ?? "general"} customer={customer.name} product={product} />
			))}
		</section>
	);
}

function ProductBlock({ customer, product }: { customer: string; product: ProductGroup<LabelSummary> }) {
	const id = `product-${slug(customer)}-${slug(product.sku ?? "general")}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3 md:pl-4">
			<h3 id={id} className="flex flex-wrap items-baseline gap-x-3 text-base leading-5 font-bold">
				{product.name}
				{product.sku && <span className="text-sm leading-[18px] font-medium text-graphite tabular-nums">SKU {product.sku}</span>}
			</h3>
			<LabelGrid labels={product.labels} caption={(l) => [KIND_NAMES[l.kind], sizeName(l.design)]} />
		</section>
	);
}

/** One level of grouping: by type or by size. */
export function FlatSection({ group }: { group: FlatGroup<LabelSummary> }) {
	const id = `group-${slug(group.name)}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-4">
			<GroupHeading id={id} title={group.name} count={group.labels.length} />
			<LabelGrid
				labels={group.labels}
				caption={(l) => [l.sku && `SKU ${l.sku}`, sizeName(l.design), KIND_NAMES[l.kind]]}
			/>
		</section>
	);
}

function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
			<h2 id={id} className="text-lg leading-6 font-black tracking-[-0.01em]">
				{title}
			</h2>
			<span className="text-sm leading-[18px] font-bold text-graphite tabular-nums">{countText(count)}</span>
		</div>
	);
}

export function LabelGrid({
	labels,
	caption,
}: {
	labels: LabelSummary[];
	caption: (label: LabelSummary) => (string | null | false)[];
}) {
	return (
		<ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))] md:gap-x-6">
			{labels.map((label) => (
				<li key={label.id}>
					<Link href={`/labels/${label.id}`} className="group flex flex-col gap-2.5">
						<div className="flex aspect-square items-center justify-center rounded-[4px] border border-rule bg-stock p-2 [container-type:size] group-hover:border-ink">
							<LabelRender design={label.design} barcode={label.barcode} scale="fit" />
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-base leading-5 font-bold group-hover:underline">{label.name}</span>
							<span className="text-sm leading-[18px] text-graphite tabular-nums">
								{caption(label).filter(Boolean).join(", ")}
							</span>
						</div>
					</Link>
				</li>
			))}
		</ul>
	);
}
