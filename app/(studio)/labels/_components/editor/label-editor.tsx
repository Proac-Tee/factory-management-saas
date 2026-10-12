"use client";

import Link from "next/link";
import { PrinterIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { button, ErrorLine, PageHeader } from "@/components/ui";
import { KIND_NAMES } from "@/entities/label";
import type { EditorView } from "@/use-cases/labels";
import { DetailsForm } from "./details-form";
import { EditorPreview } from "./editor-preview";
import { PartsPanel } from "./parts-panel";
import { type Tab, useLabelEditor } from "./use-label-editor";

const TABS: [Tab, string][] = [
	["parts", "Size and parts"],
	["details", "Details and group"],
];

/**
 * Edit a label's size, parts, details and where it sits in the library,
 * with a to-scale preview (Paper: "Desktop – Label editor"). Operators see
 * it read-only.
 */
export function LabelEditor({ view, justSaved }: { view: EditorView; justSaved: boolean }) {
	const { label, canEdit } = view;
	const editor = useLabelEditor(view, justSaved);

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader
				context={label ? `${label.customer}${label.productName ? `, ${label.productName}` : ""}, ${KIND_NAMES[label.kind]}` : "Labels"}
				title={label ? label.name : "New label"}
				sticky
			>
				<div className="flex flex-wrap items-center gap-3 md:shrink-0 md:flex-nowrap">
					{canEdit && editor.dirty && (
						<span role="status" className="w-full text-sm leading-5 font-bold whitespace-nowrap text-graphite md:w-auto">
							Unsaved changes
						</span>
					)}
					{label && (
						<Link href={`/labels/${label.id}/print`} className={`${button({ variant: "outline", size: "md" })} flex-1 sm:flex-none`}>
							<PrinterIcon size={18} />
							{canEdit ? "Print test label" : "Print labels"}
						</Link>
					)}
					{canEdit && (
						<button
							type="button"
							onClick={editor.save}
							disabled={editor.saving}
							className={`${button({ size: "md" })} flex-1 sm:flex-none`}
						>
							{editor.saving && <Spinner />}
							{editor.saving ? "Saving…" : label ? "Save label" : "Create label"}
						</button>
					)}
				</div>
			</PageHeader>

			<div className="flex flex-1 flex-col-reverse tablet:flex-row">
				<div className="flex w-full flex-col gap-5 px-4 py-6 md:px-10 tablet:w-[512px] tablet:shrink-0">
					{!canEdit && (
						<p className="rounded-md border-2 border-graphite px-4 py-3 text-base leading-[22px]">
							You can print and scan this label. To change it, ask an editor or admin.
						</p>
					)}
					{label?.archived && <ErrorLine message="This label is archived, so it's hidden from the library." />}

					<div role="tablist" aria-label="Edit" className="flex gap-1 rounded-md bg-wash p-1">
						{TABS.map(([key, name]) => (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={editor.tab === key}
								onClick={() => editor.setTab(key)}
								className={`flex h-11 flex-1 items-center justify-center rounded-[6px] text-base pointer-coarse:h-12 ${
									editor.tab === key ? "bg-ink font-bold text-stock" : "font-medium hover:bg-rule"
								}`}
							>
								{name}
							</button>
						))}
					</div>

					{editor.tab === "parts" ? (
						<PartsPanel editor={editor} canEdit={canEdit} />
					) : (
						<DetailsForm editor={editor} view={view} />
					)}
				</div>

				<EditorPreview
					design={editor.design}
					barcode={editor.previewBarcode}
					selectedId={editor.selectedId}
				/>
			</div>
		</div>
	);
}
