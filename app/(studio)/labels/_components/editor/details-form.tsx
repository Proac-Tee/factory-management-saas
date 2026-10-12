"use client";

import { useId } from "react";
import { Chips, Segmented } from "@/components/controls";
import { Field } from "@/components/field";
import { panelFieldClass } from "@/components/ui";
import { BARCODE_KIND_NAMES } from "@/entities/gtin";
import { KIND_NAMES, LABEL_KINDS, type DetailsField } from "@/entities/label";
import { GENERAL } from "@/entities/library";
import { shortDate } from "@/lib/format";
import type { EditorView } from "@/use-cases/labels";
import { ArchiveControl } from "./archive-control";
import type { LabelEditorState } from "./use-label-editor";

const washField = panelFieldClass.replace("bg-stock", "bg-wash");
const KIND_OPTIONS = LABEL_KINDS.map((k) => [k, KIND_NAMES[k]] as const);
const STORAGE_OPTIONS = [
	["ambient", "Ambient"],
	["chilled", "Chilled"],
	["", "None"],
] as const;

/**
 * Where the label sits in the library (customer → product → type) and its
 * own details. Renaming a product here renames it on all its labels.
 */
export function DetailsForm({ editor, view }: { editor: LabelEditorState; view: EditorView }) {
	const { details, changeDetail, result, gtin, product } = editor;
	const { label, canEdit, customers, products } = view;
	const customerList = useId();
	const productList = useId();
	const errorFor = (field: DetailsField) => (result.field === field ? result.error : undefined);
	const hasSku = details.sku.trim() !== "";

	return (
		<fieldset disabled={!canEdit} className="flex flex-col gap-7">
			<legend className="sr-only">Details and group</legend>

			<section aria-labelledby="group-heading" className="flex flex-col gap-5">
				<div className="flex flex-col gap-1 border-b border-ink pb-2">
					<h2 id="group-heading" className="text-base leading-5 font-black">
						Where it sits in the library
					</h2>
					<p className="text-sm leading-5 text-graphite tabular-nums">
						{[details.customer.trim() || "Customer", hasSku ? details.productName.trim() || "Product" : GENERAL, KIND_NAMES[details.kind]].join(" → ")}
					</p>
				</div>

				<Field
					label="Customer"
					list={customerList}
					value={details.customer}
					maxLength={40}
					onChange={(e) => changeDetail("customer", e.target.value)}
					error={errorFor("customer")}
					hint="Use Ember for our own labels."
				/>
				<datalist id={customerList}>
					{customers.map((c) => (
						<option key={c} value={c} />
					))}
				</datalist>

				<div className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] gap-3">
					<Field
						label="SKU"
						list={productList}
						value={details.sku}
						maxLength={20}
						onChange={(e) => changeDetail("sku", e.target.value.toUpperCase())}
						error={errorFor("sku")}
						className={`${washField} uppercase tabular-nums`}
					/>
					<datalist id={productList}>
						{products.map((p) => (
							<option key={p.sku} value={p.sku}>
								{p.name}
							</option>
						))}
					</datalist>
					<Field
						label="Product"
						value={hasSku ? details.productName : ""}
						placeholder={hasSku ? "Original Biltong 15 × 45g" : "Add a SKU first"}
						disabled={!hasSku}
						maxLength={60}
						onChange={(e) => changeDetail("productName", e.target.value)}
						error={errorFor("productName")}
						className={washField}
					/>
				</div>
				<ProductHint hasSku={hasSku} product={product} typedName={details.productName} />

				<Chips label="Type" value={details.kind} options={KIND_OPTIONS} onChange={(kind) => changeDetail("kind", kind)} />
			</section>

			<section aria-labelledby="label-heading" className="flex flex-col gap-5">
				<h2 id="label-heading" className="border-b border-ink pb-2 text-base leading-5 font-black">
					This label
				</h2>
				<Field
					label="Name in the library"
					value={details.name}
					maxLength={80}
					onChange={(e) => changeDetail("name", e.target.value)}
					error={errorFor("name")}
				/>
				<div className="flex flex-col gap-1.5">
					<span className="text-sm leading-[18px] font-medium text-graphite">Storage</span>
					<Segmented
						label="Storage"
						hideLabel
						value={details.storage}
						options={STORAGE_OPTIONS}
						onChange={(storage) => changeDetail("storage", storage)}
					/>
				</div>
				<Field
					label="Barcode number (case ITF-14 or pouch EAN-13)"
					inputMode="numeric"
					value={details.barcode}
					onChange={(e) => changeDetail("barcode", e.target.value)}
					error={errorFor("barcode") ?? (gtin && !gtin.ok ? gtin.message : undefined)}
					hint={
						gtin?.ok
							? `${BARCODE_KIND_NAMES[gtin.kind]}. Scanning it finds this label.`
							: "From your GS1 account. Leave empty for labels with no barcode."
					}
					className={`${washField} tabular-nums`}
				/>
			</section>

			{label && canEdit && (
				<div className="flex flex-col gap-2 border-t border-rule pt-4">
					<ArchiveControl id={label.id} archived={label.archived} />
					{label.updatedByName && (
						<p className="text-sm leading-5 text-graphite tabular-nums">
							Last changed by {label.updatedByName}, {shortDate(label.updatedAt)}
						</p>
					)}
				</div>
			)}
		</fieldset>
	);
}

/** Says what saving will do to the product: add it, rename it, or nothing. */
function ProductHint({
	hasSku,
	product,
	typedName,
}: {
	hasSku: boolean;
	product: LabelEditorState["product"];
	typedName: string;
}) {
	if (!hasSku) {
		return (
			<p className="-mt-2 text-sm leading-5 text-graphite">
				No SKU: the label goes under {GENERAL}, for hold, waste and address labels.
			</p>
		);
	}
	if (!product) {
		return <p className="-mt-2 text-sm leading-5 text-graphite">A new product. Its labels will group under this name.</p>;
	}
	const others = product.labelCount;
	const renamed = typedName.trim().replace(/\s+/g, " ") !== product.name;
	return (
		<p className={`-mt-2 text-sm leading-5 ${renamed ? "font-bold" : "text-graphite"}`}>
			{renamed
				? `Saving renames “${product.name}” on ${others === 1 ? "its label" : `all ${others} of its labels`}.`
				: `${others === 1 ? "1 label is" : `${others} labels are`} filed under this product.`}
		</p>
	);
}
