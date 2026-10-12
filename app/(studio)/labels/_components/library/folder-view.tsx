import Link from "next/link";
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from "@/components/icons";
import { folderOptions, type FolderNode } from "@/entities/folders";
import { KIND_NAMES } from "@/entities/label";
import { type LibraryQuery, libraryHref, sizeName } from "@/entities/library";
import type { FolderView as FolderLibrary } from "@/use-cases/labels";
import { DownloadButton } from "@/components/download-button";
import { folderDownloadAction } from "../../actions";
import { FolderTools } from "./folder-tools";
import { FlatSection, LabelGrid } from "./label-groups";

const countText = (n: number) => `${n} ${n === 1 ? "label" : "labels"}`;

/** The library as folders: the tree beside, the open folder's folders and labels. */
export function FolderView({ library, query, canEdit }: { library: FolderLibrary; query: LibraryQuery; canEdit: boolean }) {
	const { tree, path, folders, labels, results } = library;
	const open = path.at(-1) ?? null;
	const openIds = new Set(path.map((f) => f.id));

	return (
		<div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
			<nav aria-label="Folders" className="hidden lg:block">
				<div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-1 overflow-y-auto pr-2">
					<Link
						href={libraryHref(query, { folder: undefined, q: "", kind: undefined })}
						aria-current={!open && !results ? "page" : undefined}
						className="flex h-10 items-center gap-2 rounded-[6px] px-2 text-base font-bold transition-colors duration-150 hover:bg-wash aria-[current]:bg-ink aria-[current]:text-stock"
					>
						All folders
					</Link>
					<TreeLevel nodes={tree} query={query} openIds={openIds} openId={open?.id ?? null} depth={0} />
					{tree.length === 0 && (
						<p className="mt-2 border-t border-rule px-2 pt-4 text-sm leading-5 text-graphite">
							No folders yet.{" "}
							{canEdit ? "Make one with New folder, or upload a folder of labels and its folders come with it." : "Every label sits at the top of the library."}
						</p>
					)}
				</div>
			</nav>

			<div className="flex min-w-0 flex-col gap-6">
				{results ? (
					results.length === 0 ? null : (
						results.map((group) => <FlatSection key={group.name} group={group} />)
					)
				) : (
					<>
						{canEdit ? (
							<FolderTools
								open={open}
								parentId={path.at(-2)?.id ?? null}
								moveTo={moveTargets(tree, path)}
								download={<DownloadButton kind="folder" folderId={open?.id ?? null} load={folderDownloadAction} />}
							>
								<Breadcrumbs path={path} query={query} />
							</FolderTools>
						) : (
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<Breadcrumbs path={path} query={query} />
								<DownloadButton kind="folder" folderId={open?.id ?? null} load={folderDownloadAction} className="w-fit" />
							</div>
						)}

						{folders.length > 0 && (
							<ul className="grid border-t border-ink lg:grid-cols-2 lg:gap-x-8">
								{folders.map((folder) => (
									<li key={folder.id} className="border-b border-rule">
										<Link
											href={libraryHref(query, { folder: folder.id })}
											className="group flex min-h-14 items-center gap-3 py-2.5 pr-1 transition-colors duration-150 hover:bg-wash"
										>
											<FolderIcon size={22} className="shrink-0" />
											<span className="min-w-0 flex-1 truncate text-base leading-5 font-bold group-hover:underline">{folder.name}</span>
											<span className="shrink-0 text-sm leading-[18px] text-graphite tabular-nums">
												{folder.children.length > 0 &&
													`${folder.children.length} ${folder.children.length === 1 ? "folder" : "folders"}, `}
												{countText(folder.totalCount)}
											</span>
											<ChevronRightIcon size={18} className="shrink-0 text-graphite" />
										</Link>
									</li>
								))}
							</ul>
						)}

						{labels.length > 0 && (
							<section aria-label={open ? `Labels in ${open.name}` : "Labels in no folder"} className="flex flex-col gap-4">
								{!open && (
									<h2 className="border-b border-ink pb-2 text-lg leading-6 font-black tracking-[-0.01em]">Not in a folder</h2>
								)}
								<LabelGrid labels={labels} caption={(l) => [KIND_NAMES[l.kind], sizeName(l.design)]} />
							</section>
						)}

						{folders.length === 0 && labels.length === 0 && (
							<p className="py-6 text-base leading-normal text-graphite">
								{open ? "This folder is empty." : "No folders yet."}
								{canEdit && " Make a folder, or upload a folder of LibreOffice labels."}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
}

/** Where the open folder can move: anywhere but itself and the folders inside it. */
const moveTargets = (tree: FolderNode[], path: { name: string }[]) => {
	const own = path.map((f) => f.name).join(" / ");
	return folderOptions(tree).filter((o) => o.label !== own && !o.label.startsWith(`${own} / `));
};

function TreeLevel({
	nodes,
	query,
	openIds,
	openId,
	depth,
}: {
	nodes: FolderNode[];
	query: LibraryQuery;
	openIds: Set<string>;
	openId: string | null;
	depth: number;
}) {
	return (
		<ul className="flex flex-col gap-0.5">
			{nodes.map((node) => {
				const current = node.id === openId;
				const expanded = openIds.has(node.id);
				return (
					<li key={node.id}>
						<Link
							href={libraryHref(query, { folder: node.id, q: "", kind: undefined })}
							aria-current={current ? "page" : undefined}
							style={{ paddingLeft: `${8 + depth * 16}px` }}
							className="flex min-h-10 items-center gap-2 rounded-[6px] pr-2 text-base transition-colors duration-150 hover:bg-wash aria-[current]:bg-ink aria-[current]:font-bold aria-[current]:text-stock"
						>
							{expanded ? <FolderOpenIcon size={18} className="shrink-0" /> : <FolderIcon size={18} className="shrink-0" />}
							<span className="min-w-0 flex-1 truncate">{node.name}</span>
							<span className={`text-sm tabular-nums ${current ? "" : "text-graphite"}`}>{node.totalCount}</span>
						</Link>
						{expanded && node.children.length > 0 && (
							<TreeLevel nodes={node.children} query={query} openIds={openIds} openId={openId} depth={depth + 1} />
						)}
					</li>
				);
			})}
		</ul>
	);
}

function Breadcrumbs({ path, query }: { path: { id: string; name: string }[]; query: LibraryQuery }) {
	return (
		<nav aria-label="Folder path" className="min-w-0">
			<ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-base leading-6">
				<li>
					{path.length === 0 ? (
						<span aria-current="page" className="font-black">
							All folders
						</span>
					) : (
						<Link href={libraryHref(query, { folder: undefined })} className="font-bold underline underline-offset-2">
							All folders
						</Link>
					)}
				</li>
				{path.map((folder, i) => (
					<li key={folder.id} className="flex min-w-0 items-center gap-1">
						<ChevronRightIcon size={16} className="shrink-0 text-graphite" />
						{i === path.length - 1 ? (
							<span aria-current="page" className="truncate font-black">
								{folder.name}
							</span>
						) : (
							<Link href={libraryHref(query, { folder: folder.id })} className="truncate font-bold underline underline-offset-2">
								{folder.name}
							</Link>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
