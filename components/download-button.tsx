"use client";

import { useState } from "react";
import { safeFileName } from "@/entities/download";
import type { LabelDesign } from "@/entities/label";
import { DownloadIcon } from "./icons";
import { Spinner } from "./spinner";
import { useToast } from "./toast";
import { button } from "./ui";

type Props = { size?: "sm" | "md"; className?: string } & (
	| { kind: "label"; label: { name: string; design: LabelDesign; barcode: string | null } }
	| {
			kind: "folder";
			/** Null: the whole library. */
			folderId: string | null;
			/** Gets the folder's labels from the server. */
			load: (folderId: string | null) => Promise<
				| { ok: true; zipName: string; labels: { name: string; folderPath: string[]; design: LabelDesign; barcode: string | null }[] }
				| { ok: false; message: string }
			>;
	  }
);

/** Downloads a label as a PDF, or a folder as a zip of PDFs in its sub-folders. */
export function DownloadButton(props: Props) {
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const toast = useToast();
	const busy = progress !== null;

	const download = async () => {
		setProgress({ done: 0, total: 1 });
		try {
			// The PDF and zip code loads only when it's needed.
			const pdf = await import("@/lib/label-pdf");
			if (props.kind === "label") {
				pdf.saveFile(await pdf.labelPdf(props.label), `${safeFileName(props.label.name)}.pdf`);
				toast.show("Label downloaded");
				return;
			}
			const result = await props.load(props.folderId);
			if (!result.ok) {
				toast.show(result.message, { tone: "problem" });
				return;
			}
			if (result.labels.length === 0) {
				toast.show("There are no labels in this folder to download.", { tone: "info" });
				return;
			}
			const total = result.labels.length;
			setProgress({ done: 0, total });
			const zip = await pdf.labelsZip(result.labels, (done) => setProgress({ done, total }));
			pdf.saveFile(zip, `${safeFileName(result.zipName, "Labels")}.zip`);
			toast.show(`${total} ${total === 1 ? "label" : "labels"} downloaded`);
		} catch {
			toast.show("The download couldn't be made. Refresh the page and try again.", { tone: "problem" });
		} finally {
			setProgress(null);
		}
	};

	const text =
		props.kind === "label"
			? busy
				? "Making the PDF…"
				: "Download PDF"
			: busy
				? progress.total > 1
					? `Making PDFs, ${progress.done} of ${progress.total}…`
					: "Getting the labels…"
				: props.folderId
					? "Download folder"
					: "Download all";

	return (
		<button
			type="button"
			onClick={download}
			disabled={busy}
			aria-live="polite"
			className={`${button({ variant: "outline", size: props.size ?? "sm" })} tabular-nums ${props.className ?? ""}`}
		>
			{busy ? <Spinner /> : <DownloadIcon size={18} />}
			{text}
		</button>
	);
}
