"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Field } from "@/components/field";
import { PlusIcon, XIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { button, ErrorLine, labelClass, PageHeader, panelFieldClass } from "@/components/ui";
import { ACTION_NAMES, ACTIONS, can, ROLE_NAMES, ROLES, type Role } from "@/entities/roles";
import { whenShort } from "@/lib/format";
import type { AccessResult, AccessRow } from "@/use-cases/access";
import { allowEmailAction, changeRoleAction, removeAccessAction } from "./actions";

/** The allowed list and roles (Paper: "Desktop – People and access"). */
export function AccessScreen({ rows, myEmail }: { rows: AccessRow[]; myEmail: string }) {
	const [selected, setSelected] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const person = rows.find((r) => r.email === selected) ?? null;
	const panelOpen = adding || person !== null;
	const sheet = useRef<HTMLDialogElement>(null);

	// Narrow screens show the panel as a modal sheet.
	useEffect(() => {
		const dialog = sheet.current;
		if (!dialog) return;
		const narrow = window.matchMedia("(max-width: 1179px)").matches;
		if (narrow && panelOpen && !dialog.open) dialog.showModal();
		if (!panelOpen && dialog.open) dialog.close();
	}, [panelOpen]);

	const close = () => {
		setSelected(null);
		setAdding(false);
	};
	const panel = adding ? (
		<AddPanel onClose={close} />
	) : person ? (
		<PersonPanel key={person.email} person={person} isMe={person.email === myEmail} onClose={close} />
	) : (
		<RoleGuide />
	);

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader title="People and access" context={`${rows.length} ${rows.length === 1 ? "email" : "emails"} on the allowed list`}>
				<button
					type="button"
					onClick={() => {
						setSelected(null);
						setAdding(true);
					}}
					className={button({ size: "md" })}
				>
					<PlusIcon size={18} strokeWidth={2.5} />
					Allow an email
				</button>
			</PageHeader>

			<div className="flex flex-1">
				<section aria-label="Allowed list" className="@container min-w-0 flex-1 px-4 pt-2 pb-10 md:px-10 md:pt-6">
					<div className="hidden h-10 items-center gap-3 border-b border-ink px-3 text-sm leading-[18px] font-bold text-graphite @xl:flex">
						<span className="flex-1">Person</span>
						<span className="w-[110px] shrink-0">Role</span>
						<span className="w-[150px] shrink-0 text-right">Status</span>
					</div>
					<ul>
						{rows.map((row) => {
							const isSelected = row.email === selected;
							const status = row.signedUp ? (row.lastSignInAt ? `Signed in ${whenShort(row.lastSignInAt)}` : "Signed up") : "Waiting";
							return (
								<li key={row.email} className="border-b border-rule">
									<button
										type="button"
										aria-pressed={isSelected}
										onClick={() => {
											setAdding(false);
											setSelected(row.email);
										}}
										className={`flex min-h-16 items-center gap-3 rounded-md py-2 text-left ${
											isSelected ? "-mx-3 my-1 w-[calc(100%+24px)] border-2 border-ink px-2.5" : "w-full px-3 hover:bg-wash/60"
										}`}
									>
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className={`truncate text-base leading-5 font-bold ${row.signedUp ? "" : "text-graphite"}`}>
												{row.name ?? (row.signedUp ? row.email.split("@")[0] : "Not signed up yet")}
												{row.email === myEmail && <span className="font-medium text-graphite"> (you)</span>}
											</span>
											<span className="truncate text-sm leading-[18px] text-graphite">{row.email}</span>
										</span>
										<span className="hidden w-[110px] shrink-0 text-base @xl:block">{ROLE_NAMES[row.role]}</span>
										<span className={`shrink-0 text-right text-sm leading-[18px] font-bold tabular-nums @xl:w-[150px] ${row.signedUp ? "" : "text-graphite"}`}>
											<span className="@xl:hidden">{ROLE_NAMES[row.role]}, </span>
											{status}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</section>

				<aside className="hidden w-[440px] shrink-0 flex-col border-l border-rule bg-wash tablet:flex">{panel}</aside>
				<dialog
					ref={sheet}
					aria-label={adding ? "Allow an email" : (person?.email ?? "Person")}
					onCancel={(e) => {
						e.preventDefault();
						close();
					}}
					className="m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto bg-wash p-0 open:flex tablet:hidden"
				>
					{panelOpen && panel}
				</dialog>
			</div>
		</div>
	);
}

function PanelHead({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-1">
				{subtitle && <p className="truncate text-sm leading-[18px] text-graphite">{subtitle}</p>}
				<h2 className="text-xl leading-8 font-black tracking-tight">{title}</h2>
			</div>
			<button type="button" onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-rule pointer-coarse:size-14">
				<XIcon size={22} />
			</button>
		</div>
	);
}

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className={labelClass}>Role</span>
			<div role="radiogroup" aria-label="Role" className="flex gap-1 rounded-md border border-rule bg-stock p-1">
				{ROLES.map((role) => (
					<button
						key={role}
						type="button"
						role="radio"
						aria-checked={value === role}
						disabled={disabled}
						onClick={() => onChange(role)}
						className={`flex h-11 flex-1 items-center justify-center rounded-[6px] text-base pointer-coarse:h-12 ${
							value === role ? "bg-ink font-bold text-stock" : "font-medium hover:bg-wash"
						}`}
					>
						{ROLE_NAMES[role]}
					</button>
				))}
			</div>
		</div>
	);
}

function Permissions({ role }: { role: Role }) {
	return (
		<dl className="flex flex-col border-t border-ink">
			{ACTIONS.map((action) => (
				<div key={action} className="flex min-h-11 items-center justify-between gap-3 border-b border-rule py-2">
					<dt className="text-[15px]">{ACTION_NAMES[action]}</dt>
					<dd className={`text-[15px] ${can(role, action) ? "font-bold" : "text-graphite"}`}>{can(role, action) ? "Yes" : "No"}</dd>
				</div>
			))}
		</dl>
	);
}

function RoleGuide() {
	return (
		<div className="flex flex-col gap-5 px-8 py-7">
			<h2 className="text-lg leading-6 font-black tracking-[-0.01em]">What each role can do</h2>
			{ROLES.map((role) => (
				<div key={role} className="flex flex-col gap-2">
					<span className="text-base font-bold">{ROLE_NAMES[role]}</span>
					<Permissions role={role} />
				</div>
			))}
			<p className="text-sm leading-5 text-graphite">
				Only emails on this list can create a password. Removing an email signs that person out on their next click.
			</p>
		</div>
	);
}

function AddPanel({ onClose }: { onClose: () => void }) {
	const [state, action, pending] = useActionState<AccessResult | null, FormData>(allowEmailAction, null);
	const [role, setRole] = useState<Role>("operator");
	const toast = useToast();

	// Added: say so once and close; the new row is already in the list.
	const shown = useRef<AccessResult | null>(null);
	useEffect(() => {
		if (!state?.ok || shown.current === state) return;
		shown.current = state;
		toast.show(state.message);
		onClose();
	}, [state, toast, onClose]);
	return (
		<form action={action} className="flex flex-1 flex-col gap-5 px-4 py-5 md:px-8 md:py-7">
			<PanelHead title="Allow an email" subtitle="They create their own password" onClose={onClose} />
			<Field
				label="Work email"
				name="email"
				type="email"
				autoComplete="off"
				autoCapitalize="none"
				spellCheck={false}
				required
				className={panelFieldClass}
				error={state && !state.ok && state.field === "email" ? state.message : undefined}
			/>
			<input type="hidden" name="role" value={role} />
			<RolePicker value={role} onChange={setRole} />
			<Permissions role={role} />
			<div className="mt-auto flex flex-col gap-3 pt-2">
				{state && !state.ok && state.field !== "email" && <ErrorLine message={state.message} />}
				<button type="submit" disabled={pending} className={`${button()} w-full`}>
					{pending ? "Adding…" : "Allow this email"}
				</button>
				<p className="text-sm leading-5 text-graphite">Then tell them to open the app and choose Create your password.</p>
			</div>
		</form>
	);
}

function PersonPanel({ person, isMe, onClose }: { person: AccessRow; isMe: boolean; onClose: () => void }) {
	const [role, setRole] = useState<Role>(person.role);
	const [confirming, setConfirming] = useState(false);
	const toast = useToast();
	const [busy, start] = useTransition();
	const name = person.name ?? person.email;

	return (
		<div className="flex flex-1 flex-col gap-5 px-4 py-5 md:px-8 md:py-7">
			<PanelHead title={name} subtitle={person.name ? person.email : person.signedUp ? undefined : "Not signed up yet"} onClose={onClose} />
			<RolePicker
				value={role}
				disabled={busy}
				onChange={(next) => {
					const previous = role;
					setRole(next);
					start(async () => {
						const saved = await changeRoleAction(person.email, next);
						if (saved.ok) {
							toast.show(`${name} is now an ${ROLE_NAMES[next].toLowerCase()}`);
						} else {
							setRole(previous);
							toast.show(saved.message, { tone: "problem" });
						}
					});
				}}
			/>
			<Permissions role={role} />

			{!isMe && (
				<div className="mt-auto flex flex-col gap-2 pt-2">
					{confirming ? (
						<div className="flex flex-col gap-3 rounded-md border-2 border-hold bg-stock p-4">
							<p className="text-[15px] leading-5">
								Remove {name}? They&apos;re signed out on their next click and can&apos;t sign in again. Labels they edited keep their name.
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={busy}
									onClick={() =>
										start(async () => {
											const removed = await removeAccessAction(person.email);
											toast.show(removed.message, { tone: removed.ok ? "done" : "problem" });
											if (removed.ok) onClose();
										})
									}
									className="h-12 flex-1 rounded-md bg-hold px-3 font-bold text-stock disabled:bg-rule"
								>
									{busy ? "Removing…" : "Remove access"}
								</button>
								<button type="button" onClick={() => setConfirming(false)} className="h-12 flex-1 rounded-md border border-ink font-bold">
									Keep access
								</button>
							</div>
						</div>
					) : (
						<button type="button" onClick={() => setConfirming(true)} className="h-12 w-fit text-base font-bold text-hold underline underline-offset-2">
							Remove {person.name ? `${person.name.split(" ")[0]}'s` : "this person's"} access
						</button>
					)}
				</div>
			)}
		</div>
	);
}
