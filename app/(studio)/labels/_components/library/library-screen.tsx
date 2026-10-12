import Link from "next/link";
import { PlusIcon, ScanIcon, UploadIcon } from "@/components/icons";
import { FlashToast } from "@/components/toast";
import { button, PageHeader } from "@/components/ui";
import type { LibraryView } from "@/use-cases/labels";
import { FolderView } from "./folder-view";
import { CustomerSection, FlatSection } from "./label-groups";
import { LibraryControls } from "./library-controls";
import { SearchBox } from "./search-box";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The label library (Paper: "Desktop – Label library"). */
export function LibraryScreen({ view }: { view: LibraryView }) {
	const { query, library, total, customerCount, canEdit } = view;
	return (
		<div className="flex flex-1 flex-col">
			<PageHeader
				context={`${plural(total, "label", "labels")}, ${plural(customerCount, "customer", "customers")}`}
				title="Labels"
			>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
					<SearchBox query={query} />
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
						<Link href="/scan" className={`${button({ variant: "outline", size: "md" })} ${canEdit ? "" : "col-span-2 sm:col-span-1"}`}>
							<ScanIcon size={18} />
							Scan
						</Link>
						{canEdit && (
							<Link href="/labels/upload" className={button({ variant: "outline", size: "md" })}>
								<UploadIcon size={18} />
								Upload
							</Link>
						)}
						{canEdit && (
							<Link href="/labels/new" className={`${button({ size: "md" })} col-span-2 sm:col-span-1`}>
								<PlusIcon size={18} strokeWidth={2.5} />
								New label
							</Link>
						)}
					</div>
				</div>
			</PageHeader>

			<div className="flex flex-col gap-6 px-4 pt-5 pb-12 md:px-10">
				{query.denied && (
					<FlashToast clearParam="denied" tone="problem" message="Your role can't open that page. Ask an admin if you need it." />
				)}
				<LibraryControls query={query} />

				{library.group === "folder" && !(library.results && total === 0) ? (
					<FolderView library={library} query={query} canEdit={canEdit} />
				) : total === 0 ? (
					<EmptyLibrary search={query.q} />
				) : library.group === "folder" ? null : library.group === "customer" ? (
					library.customers.map((customer) => <CustomerSection key={customer.name} customer={customer} />)
				) : (
					library.groups.map((group) => <FlatSection key={group.name} group={group} />)
				)}
			</div>
		</div>
	);
}

function EmptyLibrary({ search }: { search: string }) {
	return (
		<div className="flex flex-col gap-3 py-10">
			<p className="text-xl leading-8 font-black tracking-tight">{search ? `No label matches “${search}”` : "No labels yet"}</p>
			<p className="max-w-[60ch] text-base leading-normal text-graphite">
				{search
					? "Search looks at the name, customer, product, SKU and the full barcode number. Try fewer words."
					: "Make the first one, or upload a folder of LibreOffice labels."}
			</p>
		</div>
	);
}
