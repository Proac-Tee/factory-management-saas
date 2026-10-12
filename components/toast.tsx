"use client";

// Short confirmations after an action ("Label saved", "Role changed"), in the
// Ember thermal-print look: an ink slip, with colour only for status. Field
// problems stay next to their field; toasts are for what happened.

import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, CheckIcon, XIcon } from "./icons";

export type ToastTone = "done" | "problem" | "info";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: ToastTone; action?: ToastAction; leaving?: boolean };
type ShowOptions = { tone?: ToastTone; action?: ToastAction };

type ToastApi = { show: (message: string, options?: ShowOptions) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** How long a toast stays, by tone. Problems stay longer so they can be read. */
const DURATION_MS: Record<ToastTone, number> = { done: 4000, info: 5000, problem: 8000 };
const MAX_SHOWN = 3;
/** Matches the toast-out animation, so a toast is removed once it has faded. */
const EXIT_MS = 160;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const nextId = useRef(1);

	const dismiss = useCallback((id: number) => {
		setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
		setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), EXIT_MS);
	}, []);
	const show = useCallback((message: string, { tone = "done", action }: ShowOptions = {}) => {
		const id = nextId.current++;
		setToasts((all) => [...all, { id, message, tone, action }].slice(-MAX_SHOWN));
	}, []);
	const api = useMemo(() => ({ show }), [show]);

	return (
		<ToastContext value={api}>
			{children}
			{/* Two live regions, so problems interrupt and confirmations wait their turn. */}
			<div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
				<div role="status" aria-live="polite" className="contents">
					{toasts.filter((t) => t.tone !== "problem").map((t) => (
						<ToastSlip key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
					))}
				</div>
				<div role="alert" aria-live="assertive" className="contents">
					{toasts.filter((t) => t.tone === "problem").map((t) => (
						<ToastSlip key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
					))}
				</div>
			</div>
		</ToastContext>
	);
}

/** Show a toast: `toast.show("Label saved")`, or with `{ tone: "problem" }`. */
export function useToast(): ToastApi {
	const api = use(ToastContext);
	if (!api) throw new Error("useToast needs a <ToastProvider> above it (app/layout.tsx).");
	return api;
}

const STRIPE: Record<ToastTone, string> = { done: "bg-pass", problem: "bg-hold", info: "bg-stock" };

function ToastSlip({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
	const [paused, setPaused] = useState(false);

	// Leaves by itself unless the pointer or keyboard is on it.
	useEffect(() => {
		if (paused) return;
		const timer = setTimeout(onDismiss, DURATION_MS[toast.tone]);
		return () => clearTimeout(timer);
	}, [paused, onDismiss, toast.tone]);

	return (
		<div
			onPointerEnter={() => setPaused(true)}
			onPointerLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
			onKeyDown={(e) => e.key === "Escape" && onDismiss()}
			className={`pointer-events-auto flex w-full max-w-[420px] items-stretch overflow-hidden rounded-md bg-ink text-stock shadow-[0_2px_0_0_var(--color-ink)] ${
				toast.leaving
					? "pointer-events-none animate-[toast-out_160ms_var(--ease-in-quick)_forwards] motion-reduce:animate-[fade-out_160ms_ease-in_forwards]"
					: "animate-[toast-in_360ms_var(--ease-out-expo)] motion-reduce:animate-[fade-in_160ms_ease-out]"
			}`}
		>
			<span aria-hidden="true" className={`w-1.5 shrink-0 ${STRIPE[toast.tone]}`} />
			<div className="flex min-h-14 flex-1 items-center gap-3 py-3 pr-2 pl-3.5">
				{toast.tone === "problem" ? (
					<AlertTriangleIcon size={20} className="shrink-0" />
				) : toast.tone === "done" ? (
					<CheckIcon size={20} strokeWidth={2.5} className="shrink-0" />
				) : null}
				<p className="flex-1 text-base leading-5 font-bold">{toast.message}</p>
				{toast.action && (
					<button
						type="button"
						onClick={() => {
							toast.action?.onClick();
							onDismiss();
						}}
						className="h-10 shrink-0 rounded-[6px] px-3 text-base font-bold underline underline-offset-2 hover:bg-graphite pointer-coarse:h-12"
					>
						{toast.action.label}
					</button>
				)}
				<button
					type="button"
					aria-label="Dismiss"
					onClick={onDismiss}
					className="flex size-10 shrink-0 items-center justify-center rounded-[6px] hover:bg-graphite pointer-coarse:size-12"
				>
					<XIcon size={18} />
				</button>
			</div>
		</div>
	);
}

/**
 * A toast for a message that arrives with a page (e.g. after a redirect):
 * shows once, then removes the query flag so a refresh doesn't repeat it.
 */
export function FlashToast({ message, tone = "info", clearParam }: { message: string; tone?: ToastTone; clearParam: string }) {
	const toast = useToast();
	const shown = useRef(false);
	useEffect(() => {
		if (shown.current) return;
		shown.current = true;
		toast.show(message, { tone });
		const url = new URL(window.location.href);
		url.searchParams.delete(clearParam);
		window.history.replaceState(window.history.state, "", url);
	}, [toast, message, tone, clearParam]);
	return null;
}
