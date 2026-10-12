// Checks the database rules themselves (RLS policies, the sign-up trigger,
// check constraints) against a real Postgres. Each test runs in a
// transaction that is rolled back, so nothing is left behind.
//
//   pnpm test:db   (needs the local Supabase: supabase start)

import { randomUUID } from "node:crypto";
import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { newDesign } from "../../entities/label";

const url = process.env.TEST_DATABASE_URL;
const sql = url ? postgres(url, { prepare: false, onnotice: () => {} }) : null;

afterAll(async () => {
	await sql?.end();
});

class Rollback extends Error {}

/** Runs fn in a transaction and always rolls it back. */
const inRollback = async (fn: (tx: TransactionSql) => Promise<void>) => {
	try {
		await sql!.begin(async (tx) => {
			await fn(tx);
			throw new Rollback();
		});
	} catch (error) {
		if (!(error instanceof Rollback)) throw error;
	}
};

/** Adds people to the allowed list and creates their accounts. */
const people = async (tx: TransactionSql, roles: Record<string, "admin" | "editor" | "operator" | null>) => {
	const ids: Record<string, string> = {};
	for (const [name, role] of Object.entries(roles)) {
		const email = `${name}-${randomUUID().slice(0, 8)}@ember.test`;
		if (role) await tx`insert into public.allowed_emails (email, role) values (${email}, ${role})`;
		const id = randomUUID();
		if (role) await tx`insert into auth.users (id, email, aud, role) values (${id}, ${email}, 'authenticated', 'authenticated')`;
		ids[name] = id;
		ids[`${name}:email`] = email;
	}
	return ids;
};

/** Acts as a signed-in person for the rest of the transaction (until reset). */
const as = async (tx: TransactionSql, id: string, email: string) => {
	await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, email, role: "authenticated" })}, true)`;
	await tx`set local role authenticated`;
};
const asOwner = (tx: TransactionSql) => tx`reset role`;

/** Runs a statement expected to fail inside a savepoint, so the test can go on. */
const errorOf = async (tx: TransactionSql, run: (sp: TransactionSql) => Promise<unknown>) => {
	try {
		await tx.savepoint((sp) => run(sp) as Promise<unknown[]>);
	} catch (error) {
		return (error as Error).message;
	}
	return "";
};

describe.skipIf(!sql)("database rules", () => {
	it("refuses a sign-up from an email that isn't on the allowed list", async () => {
		await inRollback(async (tx) => {
			const message = await errorOf(tx, (sp) => sp`insert into auth.users (id, email, aud, role) values (${randomUUID()}, 'stranger@ember.test', 'authenticated', 'authenticated')`,
			);
			expect(message).toMatch(/not on the allowed list/);
		});
	});

	it("lets editors add and change labels in their own name, and operators only read them", async () => {
		await inRollback(async (tx) => {
			const p = await people(tx, { editor: "editor", operator: "operator" });
			const design = tx.json(newDesign());

			await as(tx, p.operator, p["operator:email"]);
			const refused = await errorOf(tx, (sp) => sp`insert into public.labels (name, customer, kind, design, created_by, updated_by)
					values ('Sneaky', 'Ember', 'srp', ${design}, ${p.operator}, ${p.operator})`,
			);
			expect(refused).toMatch(/row-level security/);
			await asOwner(tx);

			await as(tx, p.editor, p["editor:email"]);
			const [label] = await tx`insert into public.labels (name, customer, kind, design, created_by, updated_by)
				values ('Test label', 'Ember', 'srp', ${design}, ${p.editor}, ${p.editor}) returning id`;
			await asOwner(tx);

			await as(tx, p.operator, p["operator:email"]);
			const seen = await tx`select id from public.labels where id = ${label.id}`;
			expect(seen).toHaveLength(1);
			const changed = await tx`update public.labels set name = 'Renamed', updated_by = ${p.operator} where id = ${label.id} returning id`;
			expect(changed).toHaveLength(0);
		});
	});

	it("lets nobody off the allowed list see labels, even when signed in", async () => {
		await inRollback(async (tx) => {
			const p = await people(tx, { editor: "editor" });
			await tx`delete from public.allowed_emails where email = ${p["editor:email"]}`;
			await as(tx, p.editor, p["editor:email"]);
			const rows = await tx`select id from public.labels limit 1`;
			expect(rows).toHaveLength(0);
		});
	});

	it("keeps the allowed list to admins", async () => {
		await inRollback(async (tx) => {
			const p = await people(tx, { admin: "admin", editor: "editor" });

			await as(tx, p.editor, p["editor:email"]);
			const own = await tx`select email, role from public.allowed_emails`;
			expect(own).toEqual([{ email: p["editor:email"], role: "editor" }]);
			const refused = await errorOf(tx, (sp) => sp`insert into public.allowed_emails (email, role, added_by) values ('friend@ember.test', 'admin', ${p.editor})`,
			);
			expect(refused).toMatch(/row-level security/);
			const promoted = await tx`update public.allowed_emails set role = 'admin' where email = ${p["editor:email"]} returning email`;
			expect(promoted).toHaveLength(0);
			await asOwner(tx);

			await as(tx, p.admin, p["admin:email"]);
			await tx`insert into public.allowed_emails (email, role, added_by) values ('new@ember.test', 'operator', ${p.admin})`;
			const all = await tx`select email from public.allowed_emails where email in (${p["editor:email"]}, 'new@ember.test')`;
			expect(all).toHaveLength(2);
		});
	});

	it("records label checks in the checker's own name, with a result that matches", async () => {
		await inRollback(async (tx) => {
			const p = await people(tx, { editor: "editor", operator: "operator" });
			const [label] = await tx`insert into public.labels (name, customer, kind, design, barcode)
				values ('Checked label', 'Ember', 'srp', ${tx.json(newDesign())}, '15060534671000') returning id`;

			await as(tx, p.operator, p["operator:email"]);
			await tx`insert into public.label_checks (label_id, expected, scanned, result, checked_by)
				values (${label.id}, '15060534671000', '15060534671000', 'pass', ${p.operator})`;
			const forged = await errorOf(tx, (sp) => sp`insert into public.label_checks (label_id, expected, scanned, result, checked_by)
					values (${label.id}, '15060534671000', '15060534671000', 'pass', ${p.editor})`,
			);
			expect(forged).toMatch(/row-level security/);
			await asOwner(tx);

			const lying = await errorOf(tx, (sp) => sp`insert into public.label_checks (label_id, expected, scanned, result, checked_by)
					values (${label.id}, '15060534671000', '15060534671017', 'pass', ${p.operator})`,
			);
			expect(lying).toMatch(/label_checks_result_matches/);
		});
	});

	it("refuses barcodes and SKUs in the wrong shape", async () => {
		await inRollback(async (tx) => {
			const design = tx.json(newDesign());
			expect(
				await errorOf(tx, (sp) => sp`insert into public.labels (name, customer, kind, design, barcode) values ('X', 'Ember', 'srp', ${design}, '12345')`),
			).toMatch(/labels_barcode_format/);
			expect(
				await errorOf(tx, (sp) => sp`insert into public.labels (name, customer, kind, design, sku) values ('X', 'Ember', 'srp', ${design}, 'sku 1')`),
			).toMatch(/labels_sku_format/);
		});
	});
	it("lets editors add and rename products in their own name, and operators only read them", async () => {
		await inRollback(async (tx) => {
			const p = await people(tx, { editor: "editor", operator: "operator" });

			await as(tx, p.editor, p["editor:email"]);
			await tx`insert into public.products (sku, name, created_by, updated_by) values ('TEST-1', 'Test Biltong', ${p.editor}, ${p.editor})`;
			const [label] = await tx`insert into public.labels (name, customer, kind, sku, design, created_by, updated_by)
				values ('Test SRP', 'Ember', 'srp', 'TEST-1', ${tx.json(newDesign())}, ${p.editor}, ${p.editor}) returning id`;
			const renamed = await tx`update public.products set name = 'Test Biltong 15 × 45g', updated_by = ${p.editor} where sku = 'TEST-1' returning name`;
			expect(renamed).toEqual([{ name: "Test Biltong 15 × 45g" }]);
			const skuChange = await errorOf(tx, (sp) => sp`update public.products set sku = 'TEST-2' where sku = 'TEST-1'`);
			expect(skuChange).toMatch(/permission denied/);
			await asOwner(tx);

			await as(tx, p.operator, p["operator:email"]);
			const [seen] = await tx`select p.name from public.labels l join public.products p using (sku) where l.id = ${label.id}`;
			expect(seen).toEqual({ name: "Test Biltong 15 × 45g" });
			const refused = await errorOf(tx, (sp) => sp`insert into public.products (sku, name, created_by, updated_by) values ('TEST-3', 'Nope', ${p.operator}, ${p.operator})`);
			expect(refused).toMatch(/row-level security/);
			const changed = await tx`update public.products set name = 'Hacked', updated_by = ${p.operator} where sku = 'TEST-1' returning sku`;
			expect(changed).toHaveLength(0);
		});
	});

	it("refuses a label for a product that doesn't exist", async () => {
		await inRollback(async (tx) => {
			expect(
				await errorOf(tx, (sp) => sp`insert into public.labels (name, customer, kind, design, sku) values ('X', 'Ember', 'srp', ${tx.json(newDesign())}, 'NO-SUCH')`),
			).toMatch(/labels_sku_products_sku_fk/);
		});
	});
});
