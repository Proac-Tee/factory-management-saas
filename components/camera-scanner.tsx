"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "@/lib/barcode-detector";
import { Spinner } from "./spinner";

type Status = "starting" | "scanning" | "blocked" | "unavailable";

const MESSAGES: Record<Exclude<Status, "scanning">, string> = {
	starting: "Starting the camera…",
	blocked: "The camera is blocked for this site. Allow it in your browser settings, or type the barcode below.",
	unavailable: "This device's camera can't be used here. Type the barcode below instead.",
};

/**
 * The back camera with a scanning frame. Reads case (ITF-14) and pouch
 * (EAN-13) barcodes and calls onRead once per new barcode; it pauses while
 * `paused` is true (e.g. while a result is on screen).
 */
export function CameraScanner({ onRead, paused }: { onRead: (value: string) => void; paused: boolean }) {
	const video = useRef<HTMLVideoElement>(null);
	const [status, setStatus] = useState<Status>("starting");
	// The scan loop reads the newest callback and pause flag without restarting the camera.
	const latest = useRef({ onRead, paused });
	useEffect(() => {
		latest.current = { onRead, paused };
	});

	useEffect(() => {
		let stream: MediaStream | null = null;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		let lastValue = "";
		let lastAt = 0;

		const start = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setStatus("unavailable");
				return;
			}
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
					audio: false,
				});
			} catch (error) {
				setStatus((error as DOMException).name === "NotAllowedError" ? "blocked" : "unavailable");
				return;
			}
			if (stopped || !video.current) return;
			video.current.srcObject = stream;
			await video.current.play().catch(() => undefined);
			setStatus("scanning");

			const detector = new BarcodeDetector({ formats: ["itf", "ean_13"] });
			const tick = async () => {
				if (stopped) return;
				const v = video.current;
				if (v && v.readyState >= 2 && !latest.current.paused) {
					try {
						const [code] = await detector.detect(v);
						const value = code?.rawValue?.replace(/\D/g, "");
						// The same barcode held in view only counts once every 3 seconds.
						if (value && (value.length === 13 || value.length === 14) && (value !== lastValue || Date.now() - lastAt > 3000)) {
							lastValue = value;
							lastAt = Date.now();
							navigator.vibrate?.(60);
							latest.current.onRead(value);
						}
					} catch {
						// A frame that can't be read is normal; try the next one.
					}
				}
				timer = setTimeout(tick, 200);
			};
			tick();
		};
		start();

		return () => {
			stopped = true;
			clearTimeout(timer);
			stream?.getTracks().forEach((t) => t.stop());
		};
	}, []);

	return (
		<div className="relative aspect-[3/4] max-h-[60dvh] w-full overflow-hidden bg-ink sm:aspect-video">
			<video ref={video} muted playsInline className="h-full w-full object-cover" aria-label="Camera view" />
			{status === "scanning" && (
				<div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[34%] -translate-y-1/2">
					<Corner className="top-0 left-0" />
					<Corner className="top-0 right-0 rotate-90" />
					<Corner className="right-0 bottom-0 rotate-180" />
					<Corner className="bottom-0 left-0 -rotate-90" />
					<span className="absolute inset-x-3 top-1/2 h-0.5 bg-pass motion-safe:animate-pulse" />
				</div>
			)}
			{status !== "scanning" && (
				<p role="status" className="absolute inset-0 flex items-center justify-center gap-3 p-8 text-center text-lg leading-normal text-stock">
					{status === "starting" && <Spinner size={24} />}
					{MESSAGES[status]}
				</p>
			)}
		</div>
	);
}

/** One bracket of the viewfinder, drawn as the top-left corner and rotated into place. */
function Corner({ className }: { className: string }) {
	return (
		<svg viewBox="0 0 32 32" className={`absolute size-8 text-pass ${className}`} fill="none">
			<path d="M2 30V10a8 8 0 0 1 8-8h20" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
		</svg>
	);
}
