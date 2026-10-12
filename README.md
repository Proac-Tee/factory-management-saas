# Ember Factory OS — label studio

Edit, group, print and scan the Ember case labels. Next.js (App Router) on
Supabase (Postgres, Auth) with Drizzle. Designs live in the Paper file
"Ember – Factory OS", page "v3 – Label studio".

## Who can do what

Sign-in is email and password. Only emails on the **allowed list** can create
an account; the list also holds each person's role, and taking an email off
the list removes their access straight away.

| Role     | Find, scan, print | Edit labels, sizes, groups | Allow emails, change roles |
| -------- | ----------------- | -------------------------- | -------------------------- |
| Operator | Yes               | No                         | No                         |
| Editor   | Yes               | Yes                        | No                         |
| Admin    | Yes               | Yes                        | Yes                        |

The same rules are enforced twice: in the app (`entities/roles.ts`,
`lib/auth.ts`) and in Postgres row level security (`lib/db/schema.ts`,
`drizzle/0002_*` and `0004_*`). `pnpm test:db` checks the database side.

## Set up

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill it in. For `DATABASE_URL` use
   the **transaction pooler** URL (Supabase → Connect → ORMs → Drizzle, port
   6543); the direct `db.<ref>.supabase.co` host is IPv6-only and won't
   connect from most networks.
3. `pnpm db:migrate`
4. Add the first admin: `pnpm access:allow --email you@example.com --role admin`,
   then open the app and choose **Create your password**.
5. Import the LibreOffice labels (safe to rerun; `--replace` re-imports):
   `pnpm labels:import "/path/to/Label Designs"`
6. In Supabase Auth → URL Configuration, add `<your site>/auth/confirm` to the
   redirect URLs (password reset and email confirmation links land there).

### Local development

`supabase start` runs a local Supabase on ports 553xx (see
`supabase/config.toml`), so it can sit next to other local stacks.
`.env.development.local` points `next dev` at it and wins over `.env.local`.
Then `pnpm dev --port 3001`. Emails (password resets) arrive in Mailpit at
http://127.0.0.1:55324.

## Scripts

| Script                     | What it does                                         |
| -------------------------- | ---------------------------------------------------- |
| `pnpm dev`                 | The app                                              |
| `pnpm test`                | Unit tests (label rules, barcodes, import, roles)    |
| `pnpm test:db`             | Database rules against the local Supabase            |
| `pnpm db:generate`         | A migration from `lib/db/schema.ts`                  |
| `pnpm db:migrate`          | Apply migrations                                     |
| `pnpm access:allow`        | Put an email on the allowed list with a role         |
| `pnpm labels:import <dir>` | Import `.odg` labels (`--dry-run` to preview)        |

## Where things are

- `entities/` — the rules, no framework: label layout and fit, GTIN checks,
  ITF-14/EAN-13 bar patterns, roles, the `.odg` import rules. All tested.
- `data-access/` — Drizzle queries. User-facing ones run through `withRls`
  so the database policies apply.
- `use-cases/` — what the app does (save a label, check a printed label,
  manage access): permission check, entity rules, then data-access.
- `app/` — screens. `(auth)` sign-in, `(studio)` labels, scan, access.
- `components/label-render.tsx` — draws a label from its design; the library,
  editor preview and print all use it, so what you see is what prints.

## Printing

The print screen sets the page to the label's size (`@page`) and prints
through the browser to the PC's label printer driver. Set the printer's
paper size to the label size (e.g. 100 × 100 mm, no margins) once.

## Scanning

The phone camera reads case (ITF-14) and pouch (EAN-13) barcodes with
`barcode-detector` (ZXing in WebAssembly). The decoder is served from
`public/vendor/zxing_reader.wasm`; after upgrading `barcode-detector`, copy
the new `zxing_reader.wasm` from `node_modules/zxing-wasm/dist/reader/`.
Cameras only work on HTTPS (or localhost).
