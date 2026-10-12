import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

// One row per Supabase Auth user, created by the on_auth_user_created
// trigger (see drizzle/0001_*.sql).
export const profiles = pgTable(
	"profiles",
	{
		id: uuid()
			.primaryKey()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		email: text().notNull(),
		fullName: text("full_name"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(t) => [
		pgPolicy("profiles_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${t.id} = ${authUid}`,
		}),
		pgPolicy("profiles_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${t.id} = ${authUid}`,
			withCheck: sql`${t.id} = ${authUid}`,
		}),
	],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
