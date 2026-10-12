"use client";

import Link from "next/link";
import { LinkPending } from "./link-pending";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { type Action, can, ROLE_NAMES, type Role } from "@/entities/roles";
import { LogoutIcon, MenuIcon, ScanIcon, TagsIcon, UsersIcon, XIcon } from "./icons";

type NavItem = { href: string; label: string; icon: ReactNode; action: Action };

// Matches who each page lets in: a hidden link isn't a permission.
const MAIN: NavItem[] = [
	{ href: "/labels", label: "Labels", icon: <TagsIcon />, action: "use-labels" },
	{ href: "/scan", label: "Scan", icon: <ScanIcon />, action: "use-labels" },
];
const SET_UP: NavItem[] = [
	{ href: "/access", label: "People and access", icon: <UsersIcon />, action: "manage-access" },
];

/** Touch screens get 56px targets (gloves, the packing floor). */
const tap = "h-11 pointer-coarse:h-14";

/**
 * The label studio frame (Paper: "Desktop – Label library"). Wide screens get
 * the 248px sidebar; below the tablet breakpoint it's a menu and a drawer.
 */
export function StudioShell({
	name,
	role,
	signOut,
	children,
}: {
	name: string;
	role: Role;
	signOut: () => Promise<void>;
	children: ReactNode;
}) {
	const drawer = useRef<HTMLDialogElement>(null);
	const pathname = usePathname();

	// Close the drawer after following a link.
	useEffect(() => {
		drawer.current?.close();
	}, [pathname]);

	const nav = <Nav pathname={pathname} role={role} />;
	const footer = (
		<div className="flex items-center gap-2.5 border-t border-rule px-3 pt-4">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm leading-4 font-bold text-stock">
				{initials(name)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-base leading-5 font-bold">{name}</span>
				<span className="text-sm leading-4 text-graphite">{ROLE_NAMES[role]}</span>
			</span>
			<form action={signOut}>
				<button
					type="submit"
					aria-label="Sign out"
					title="Sign out"
					className="flex size-11 items-center justify-center rounded-md transition-colors duration-150 hover:bg-wash pointer-coarse:size-14"
				>
					<LogoutIcon />
				</button>
			</form>
		</div>
	);

	return (
		<div className="flex min-h-dvh flex-col tablet:flex-row">
			<aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1 border-r border-ink px-4 pt-7 pb-5 tablet:flex">
				<Link href="/labels" className="mb-7 ml-3 w-fit">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/ember-logo.png" alt="Ember, labels" width={84} height={48} />
				</Link>
				{nav}
				<div className="mt-auto">{footer}</div>
			</aside>

			<header className="no-print flex h-16 shrink-0 items-center justify-between border-b border-rule px-4 tablet:hidden">
				<button
					type="button"
					onClick={() => drawer.current?.showModal()}
					className={`flex items-center gap-2 rounded-md px-2 text-base font-bold ${tap}`}
				>
					<MenuIcon size={22} />
					Menu
				</button>
				<Link href="/labels">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/ember-logo.png" alt="Ember, labels" width={64} height={37} />
				</Link>
			</header>

			<dialog
				ref={drawer}
				aria-label="Menu"
				className="sheet-left no-print m-0 h-dvh max-h-none w-[min(320px,85vw)] max-w-none flex-col gap-1 border-r border-ink bg-stock px-4 pt-4 pb-5 open:flex"
				onClick={(event) => {
					if (event.target === event.currentTarget) event.currentTarget.close();
				}}
			>
				<div className="mb-4 flex items-center justify-between pl-3">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/ember-logo.png" alt="Ember" width={72} height={42} />
					<button
						type="button"
						aria-label="Close menu"
						onClick={() => drawer.current?.close()}
						className="flex size-11 items-center justify-center rounded-md pointer-coarse:size-14"
					>
						<XIcon size={22} />
					</button>
				</div>
				{nav}
				<div className="mt-auto">{footer}</div>
			</dialog>

			<div className="flex min-w-0 flex-1 flex-col">{children}</div>
		</div>
	);
}

function Nav({ pathname, role }: { pathname: string; role: Role }) {
	const setUp = SET_UP.filter((item) => can(role, item.action));
	return (
		<nav aria-label="Main" className="flex flex-col gap-1">
			{MAIN.filter((item) => can(role, item.action)).map((item) => (
				<NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
			))}
			{setUp.length > 0 && (
				<>
					<p className="px-3 pt-6 pb-2 text-sm leading-4 font-bold text-graphite">Set up</p>
					{setUp.map((item) => (
						<NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
					))}
				</>
			)}
		</nav>
	);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
	return (
		<Link
			href={item.href}
			aria-current={active ? "page" : undefined}
			className={`flex items-center gap-3 rounded-md px-3 text-base leading-5 transition-colors duration-150 ${tap} ${
				active ? "bg-ink font-bold text-stock" : "font-medium hover:bg-wash"
			}`}
		>
			<LinkPending icon={item.icon} spinnerSize={20} />
			{item.label}
		</Link>
	);
}

function initials(name: string) {
	const parts = name.trim().split(/\s+/);
	return (parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : name.slice(0, 2)).toUpperCase();
}
