# Handover — label studio (2026-10-12, evening)

Read this first in a new session, then README.md (setup, scripts, where things are).

## Where it stands

- **Live data**: the cloud Supabase project holds all **199 imported labels** (from
  `~/Downloads/label_designs` on Babatunde's Mac, not in git). 165 have a barcode number;
  34 don't yet (see Next, 2). Products were backfilled from the labels; check their names.
- **Migrations** run to `0006`. `pnpm db:migrate` says which database it's using and prints
  the real Postgres error if one fails. `.env.development.local` wins over `.env.local`
  (app, scripts and migrations alike); a `DATABASE_URL` set in the shell wins over both.
- **Cloud DB URL**: use the transaction pooler (`postgres.<ref>@…pooler.supabase.com:6543`).
  The direct `db.<ref>.supabase.co` host is IPv6-only and fails with ENOTFOUND.
- **Not deployed yet.** Runs locally with `pnpm dev --port 3001`.

## Done (PRs #1–#11, all merged)

- **Auth**: email + password, only for emails on `allowed_emails` (app check + DB trigger).
  Roles admin / editor / operator (`private.has_role()` in RLS). Removed people are signed
  out via `/auth/removed`. Sign-in: `pnpm access:allow --email … --role admin`, then
  "Create your password" in the app.
- **Layers**: `entities/` (rules + Zod schemas, tested) → `data-access/` (Drizzle, `withRls`)
  → `use-cases/` (permission check, Zod-parse input) → `app/` (pages and actions only call a
  use-case). Screen parts live in `_components/` next to their route.
- **Library**: grouped **Customer → Product → Type** (`products` table: SKU + name; labels
  link by SKU; no SKU = "General"). Type and Size views too. Search covers product names.
- **Editor**: "Size and parts" and "Details and group" tabs. Renaming a product renames it on
  all its labels. Ctrl/⌘+S saves; header shows "Unsaved changes".
- **Import**: `pnpm labels:import <dir>` (`--dry-run`, `--replace`). Reads barcode numbers
  from the barcode pictures with ZXing (any 1D type, GS1-128 included). `pnpm labels:reset`
  deletes labels, products and checks (`--yes`), keeping accounts.
- **UI**: own toast (`components/toast.tsx`) on every action, archive has Undo; spinners for
  loading (`components/spinner.tsx`); `button({ variant, size })` for all buttons; branded
  error and 404 pages.
- **Security audit** (PR #11): open redirect fixed (`lib/safe-redirect.ts`), security headers
  in `next.config.ts`, `SITE_URL` for email links, RLS role checks wrapped in `(select …)`.
- **Tests**: `pnpm test` (55), `pnpm test:db` (8, needs a database with the migrations).

## Not done / next

1. **Deploy** (Vercel): set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `DATABASE_URL` (pooler) and `SITE_URL`; add `<site>/auth/confirm` to Supabase Auth →
   Redirect URLs. Then test scanning on a real phone (the camera needs HTTPS).
2. **The last 34 barcode numbers**:
   - 29 "no barcode found in the picture" (mostly Amazon EU/UK shippers). Need one sample
     `.odg` to see why, e.g. `AMAZON/AMAZON EU/SHIPPER LABELS/CHILLI BILTONG 1Kg SHIPPER LABEL 10010.odg`.
   - 4 Amazon FNSKUs (Code 128, e.g. `X000X1GX37`): the app only stores and prints GS1
     numbers (ITF-14/EAN-13). Needs a barcode type per label + Code 128 rendering + scan match.
   - 1 Lidl pallet label is a vector picture: type its number in the editor.
   - Repeated numbers across SKUs are correct (confirmed by Babatunde); don't flag them.
3. **CI**: no GitHub Action yet. Add lint, typecheck, `pnpm test` and `next build` on PRs.
4. **Compare imported labels with the originals.** If some don't reproduce, extend the editor
   (two texts on one line, placed parts, more pictures) rather than building an .odg editor
   (decided against: format too large, loses the database, grouping, roles and history).
5. **Supabase dashboard**: keep email confirmation on; turn on leaked password protection.
6. **Later**: the line tablet from the Paper designs (PIN sign-in, start a mix, print case
   labels, first-label check; needs lines, tablets, mixes and an audit log). Export the screens
   into the repo first. Also: label categories, the Windows print helper, stock.

## Working rules

pnpm only. Conventional Commits. Commit only when asked; cloud sessions work on a branch and
open a PR for Babatunde to merge. Paper design first, then build, then a design check with the
`frontend-design` skill (impeccable was removed). Make every screen responsive; buttons get the
pointer cursor. Zod for any input; pages and actions go through `use-cases/`.
