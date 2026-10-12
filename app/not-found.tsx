import Link from "next/link";
import { button } from "@/components/ui";

export default function NotFound() {
	return (
		<main className="flex flex-1 flex-col items-start justify-center gap-5 px-4 py-16 md:px-10">
			<h1 className="text-xl leading-8 font-black tracking-tight md:text-2xl md:leading-12">Nothing here</h1>
			<p className="max-w-[60ch] text-base leading-normal text-graphite">
				Check the link, or find the label in the library.
			</p>
			<Link href="/labels" className={button({ size: "md" })}>
				Go to labels
			</Link>
		</main>
	);
}
