"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangleIcon, CheckIcon, ChevronRightIcon, KeyboardIcon, PrinterIcon, ScanIcon } from "@/components/icons";
import { ErrorLine, fieldClass, PageHeader, primaryButton } from "@/components/ui";
import { BARCODE_KIND_NAMES, checkGtin } from "@/entities/gtin";
import { time } from "@/lib/format";
import type { CheckResult, FindResult } from "@/use-cases/labels";
import { checkLabelAction, findLabelsAction } from "./actions";

// The decoder is browser-only (camera + WebAssembly).
const CameraScanner = dynamic(() => import("@/components/camera-scanner").then((m) => m.CameraScanner), {
	ssr: false,
	loading: () => <div className="aspect-[3/4] max-h-[60dvh] w-full bg-ink sm:aspect-video" />,
});

type Mode = "find" | "check";
type CheckLabel = { id: string; name: string; barcode: string | null };

/** Scan to find a label, or to check a printed one (Paper: "Phone – Scan"). */
export function ScanScreen({ mode, label }: { mode: Mode; label: CheckLabel | null }) {
	const [found, setFound] = useState<FindResult | null>(null);
	const [check, setCheck] = useState<CheckResult | null>(null);
	const [typed, setTyped] = useState("");
	const [typing, setTyping] = useState(false);
	const [pending, start] = useTransition();

	const handle = (value: string) =>
		start(async () => {
			if (mode === "find") setFound(await findLabelsAction(value));
			else if (label) setCheck(await checkLabelAction(label.id, value));
		});

	const reset = () => {
		setFound(null);
		setCheck(null);
		setTyped("");
	};

	const canScan = mode === "find" || (label !== null && label.barcode !== null);
	const showing = (mode === "find" && found) || (mode === "check" && check);

	if (mode === "check" && check?.ok) return <CheckOutcome result={check} label={label!} onNext={reset} />;

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader title="Scan" context={mode === "check" && label ? `Checking ${label.name}` : "Point the camera at a barcode"} />
			<div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 px-4 py-5 md:px-10">
				<div role="tablist" aria-label="This scan is to" className="flex gap-2">
					<Link
						href="/scan"
						role="tab"
						aria-selected={mode === "find"}
						className={`flex h-tap flex-1 items-center justify-center rounded-md text-base font-bold ${mode === "find" ? "bg-ink text-stock" : "border border-rule hover:border-ink"}`}
					>
						Find a label
					</Link>
					<Link
						href={label ? `/scan?mode=check&label=${label.id}` : "/scan?mode=check"}
						role="tab"
						aria-selected={mode === "check"}
						className={`flex h-tap flex-1 items-center justify-center rounded-md text-base font-bold ${mode === "check" ? "bg-ink text-stock" : "border border-rule hover:border-ink"}`}
					>
						Check a printed label
					</Link>
				</div>

				{mode === "check" && !label && (
					<div className="flex flex-col gap-3 rounded-md border-2 border-ink p-4">
						<p className="text-base leading-normal">
							To check a printed label, open that label first, then tap <strong>Check a printed label</strong> on its print screen.
						</p>
						<Link href="/labels" className="inline-flex h-12 w-fit items-center gap-1.5 font-bold underline underline-offset-2">
							Go to labels
							<ChevronRightIcon size={18} />
						</Link>
					</div>
				)}
				{mode === "check" && label && !label.barcode && (
					<ErrorLine message={`${label.name} has no barcode number yet, so there's nothing to check against. An editor can add it in Details.`} />
				)}

				{canScan && (
					<>
						<div className="-mx-4 md:mx-0 md:overflow-hidden md:rounded-md">
							<CameraScanner onRead={handle} paused={pending || Boolean(showing)} />
						</div>
						<p className="text-base leading-normal">
							Line the barcode up inside the frame. Case (ITF‑14) and pouch (EAN‑13) barcodes both work.
							{mode === "check" && label?.barcode && (
								<>
									{" "}
									This label should carry <strong className="tabular-nums">{label.barcode}</strong>.
								</>
							)}
						</p>

						{typing ? (
							<form
								className="flex flex-col gap-2"
								onSubmit={(e) => {
									e.preventDefault();
									handle(typed);
								}}
							>
								<label htmlFor="typed" className="text-sm leading-[18px] font-medium text-graphite">
									Barcode number
								</label>
								<div className="flex gap-2">
									<input
										id="typed"
										inputMode="numeric"
										autoComplete="off"
										autoFocus
										value={typed}
										onChange={(e) => setTyped(e.target.value)}
										className={`${fieldClass} min-w-0 flex-1 tabular-nums`}
									/>
									<button type="submit" disabled={pending} className={primaryButton}>
										{mode === "find" ? "Find" : "Check"}
									</button>
								</div>
								{typed.replace(/\s/g, "").length >= 13 && !checkGtin(typed).ok && (
									<p className="text-sm leading-5 text-graphite">{(checkGtin(typed) as { message: string }).message}</p>
								)}
							</form>
						) : (
							<button
								type="button"
								onClick={() => setTyping(true)}
								className="inline-flex h-12 items-center justify-center gap-2 border-t border-rule pt-2 text-base font-bold underline underline-offset-2"
							>
								<KeyboardIcon size={20} />
								Type the barcode instead
							</button>
						)}
					</>
				)}

				{pending && (
					<p role="status" className="text-base text-graphite">
						Looking it up…
					</p>
				)}
				{mode === "check" && check && !check.ok && <ErrorLine message={check.message} />}
				{mode === "find" && found && <FindResults result={found} onAgain={reset} />}
			</div>
		</div>
	);
}

function FindResults({ result, onAgain }: { result: FindResult; onAgain: () => void }) {
	if (!result.ok) {
		return (
			<div className="flex flex-col gap-3">
				<ErrorLine message={result.message} />
				<AgainButton onAgain={onAgain} />
			</div>
		);
	}
	return (
		<section aria-label="Labels for this barcode" className="flex flex-col gap-4 border-t border-ink pt-4">
			<div className="flex flex-col gap-1">
				<span className="text-sm leading-[18px] text-graphite">{result.kindName}</span>
				<span className="text-xl leading-8 font-black tracking-tight tabular-nums">{result.gtin}</span>
			</div>
			{result.labels.length === 0 ? (
				<p className="text-base leading-normal">
					No label carries this barcode yet. An editor can add the number to a label in its Details.
				</p>
			) : (
				<ul className="flex flex-col border-t border-rule">
					{result.labels.map((label) => (
						<li key={label.id} className="flex items-center gap-3 border-b border-rule py-2">
							<Link href={`/labels/${label.id}`} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center">
								<span className="text-base leading-5 font-bold">{label.name}</span>
								<span className="text-sm leading-[18px] text-graphite">{label.detail}</span>
							</Link>
							<Link href={`/labels/${label.id}/print`} className="inline-flex h-tap shrink-0 items-center gap-2 rounded-md border border-ink px-4 font-bold">
								<PrinterIcon size={18} />
								Print
							</Link>
						</li>
					))}
				</ul>
			)}
			<AgainButton onAgain={onAgain} />
		</section>
	);
}

function AgainButton({ onAgain }: { onAgain: () => void }) {
	return (
		<button type="button" onClick={onAgain} className={`${primaryButton} w-full`}>
			<ScanIcon size={20} />
			Scan another
		</button>
	);
}

/** Full-screen result, coloured by status (Paper: "Phone – Check: label matches"). */
function CheckOutcome({ result, label, onNext }: { result: Extract<CheckResult, { ok: true }>; label: CheckLabel; onNext: () => void }) {
	const pass = result.result === "pass";
	const checkedAt = time(result.checkedAt);
	const scannedKind = checkGtin(result.scanned);
	return (
		<div className="flex flex-1 flex-col">
			<header className={`flex flex-col gap-1 px-5 pt-8 pb-6 text-stock md:px-10 ${pass ? "bg-pass" : "bg-hold"}`} role="status">
				<span className="flex items-center gap-3 text-xl leading-8 font-black tracking-tight md:text-2xl md:leading-12">
					{pass ? <CheckIcon size={30} strokeWidth={3} /> : <AlertTriangleIcon size={30} strokeWidth={2.5} />}
					{pass ? "Label matches" : "Wrong barcode on this label"}
				</span>
				<span className="text-base leading-5">
					{pass ? `Checked against ${label.name}` : "Put these labels aside and reprint. Don't send them out."}
				</span>
			</header>
			<div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-5 py-6 md:px-10">
				<div className="flex flex-col gap-1">
					<span className="text-sm leading-[18px] text-graphite">Barcode read</span>
					<span className="text-xl leading-8 font-black tracking-tight break-all tabular-nums md:text-2xl md:leading-12">{result.scanned}</span>
				</div>
				<dl className="flex flex-col border-t border-ink">
					{(
						[
							["Label should carry", result.expected],
							["Barcode type", scannedKind.ok ? BARCODE_KIND_NAMES[scannedKind.kind] : "Not a valid product barcode"],
							["Label", label.name],
							["Checked", `${checkedAt} by ${result.checkedBy}`],
						] as const
					).map(([name, value]) => (
						<div key={name} className="flex min-h-[52px] items-center justify-between gap-4 border-b border-rule py-2">
							<dt className="text-[15px] text-graphite">{name}</dt>
							<dd className="text-right text-base font-bold tabular-nums">{value}</dd>
						</div>
					))}
				</dl>
				<div className="mt-auto flex flex-col gap-3">
					<button type="button" onClick={onNext} className={`${primaryButton} h-[60px] w-full text-lg`}>
						<ScanIcon size={22} />
						Check next label
					</button>
					<Link href={`/labels/${label.id}`} className="flex h-12 items-center justify-center font-bold underline underline-offset-2">
						Back to the label
					</Link>
				</div>
			</div>
		</div>
	);
}
