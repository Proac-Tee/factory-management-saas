"use client";

import Link from "next/link";
import { useEffect } from "react";
import { button } from "./ui";

/**
 * When a page fails. Says what to do, never what broke: error details stay
 * in the server log (the digest ties the two together).
 */
export function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);
	return (
		<main className="flex flex-1 flex-col items-start justify-center gap-5 px-4 py-16 md:px-10">
			<h1 className="text-xl leading-8 font-black tracking-tight md:text-2xl md:leading-12">This page didn&apos;t load</h1>
			<p className="max-w-[60ch] text-base leading-normal text-graphite">
				Try again. If it keeps happening, tell an admin
				{error.digest ? ` and quote code ${error.digest}` : ""}.
			</p>
			<div className="flex flex-wrap gap-3">
				<button type="button" onClick={retry} className={button({ size: "md" })}>
					Try again
				</button>
				<Link href="/labels" className={button({ variant: "outline", size: "md" })}>
					Go to labels
				</Link>
			</div>
		</main>
	);
}
