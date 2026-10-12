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
5. Upload the LibreOffice labels: sign in as an editor or admin, open
   **Labels → Upload** and drag in a customer folder (AMAZON, CULINA,
   LENHAMS…). Its folders are kept; existing labels can be skipped or replaced.
6. In Supabase Auth → URL Configuration, add `<your site>/auth/confirm` to the
   redirect URLs (password reset and email confirmation links land there).
7. In production, set `SITE_URL` to the app's address. Email links are built
   from it; without it they fall back to the request's Origin header, which
   a request can fake.

### Local development

`supabase start` runs a local Supabase on ports 553xx (see
`supabase/config.toml`), so it can sit next to other local stacks.
`.env.development.local` points `next dev` at it and wins over `.env.local`,
for the app, the scripts and `pnpm db:migrate` alike. To migrate the cloud
database from your machine, name it in the shell, which wins over both:
`DATABASE_URL="<pooler url>" pnpm db:migrate`.
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
| `pnpm labels:reset`        | Delete all labels, products, folders and pictures (`--yes` to confirm) |

## Where things are

Each layer only calls the one below it:

- `entities/` — the rules, no framework: label layout and fit, design edits,
  library grouping, GTIN checks, ITF-14/EAN-13 bar patterns, roles, account
  forms, the `.odg` reader and import rules, folders. Input is checked with **Zod** schemas that
  live here next to the rule they enforce (`designSchema`,
  `labelDetailsSchema`, `emailSchema`, …). All tested.
- `data-access/` — Drizzle queries. User-facing ones run through `withRls`
  so the database policies apply.
- `use-cases/` — what the app does, for pages and server actions: check the
  person may do it, parse the input with Zod (server actions are public
  endpoints, so their input is `unknown` until parsed), apply the entity
  rules, then read or save through data-access.
- `app/` — screens. Pages only call a use-case and render; server actions
  only call a use-case and refresh. `(auth)` sign-in, `(studio)` labels,
  scan, access. Screen parts live next to their route in `_components/`
  (e.g. the label editor is split into a state hook and small panels).
- `components/` — shared UI: `label-render.tsx` draws a label from its
  design (library, editor preview and print all use it, so what you see is
  what prints), `scaled-label.tsx`, form `controls.tsx`, `ui.tsx`.
- `lib/` — sign-in (`auth.ts`), database client, env checks, date formats.

## How the library is arranged

**Folders** by default, as on the Label Designs drive (AMAZON → AMAZON EU →
SRP LABELS…): a tree beside the library, the open folder's folders and
labels in the middle (`?folder=<id>`). Editors make, rename, move and delete
(empty) folders there, and move a label on its **Details and group** tab.
The database keeps names unique within a folder and stops a folder going
inside itself (`folders` table, `drizzle/0007_*.sql`).

**Customer** groups customer → product → type: labels for the same product
share its SKU, so an SRP, shipper and pallet label sit side by side under one
product name (the `products` table); labels with no SKU go under **General**.
**Type** and **Size** give flat views. Search covers every folder.

## Downloading labels

A label's page has **Download PDF**; a folder has **Download folder** (at
the top level, **Download all**), which gives a zip of PDFs in the same
sub-folders, including every folder inside it. The browser draws each label
with the same renderer the print page uses, at 600 dpi on a page of the
label's true size (`lib/label-pdf.ts`). Batch, BBE and quantity come out as
blank lines to write on, never example values.

## Uploading LibreOffice labels

**Labels → Upload** (editors and admins). Drag in a folder, or choose one.
The browser reads each `.odg` itself (`lib/label-files.ts` →
`entities/odg.ts` → `entities/label-import.ts`) and shows every label as it
will look before anything is sent. Each label keeps its layout: every text
box, picture, shape and barcode where it was drawn (a "placed" design,
`entities/placed.ts`), text still editable and batch/BBE/quantity turned into
fields. Barcode numbers come from the barcode picture (ZXing), bars drawn as
shapes (ITF-14, EAN-13, Code 128) or the printed digits. Pictures are stored
once by SHA-256 (`label_images`) and served from `/label-images/<hash>`.
A label is matched on its path in the library, so uploading again can skip
or replace. Lock files, shortcuts, archives and other files are left out.

## Security

- Every page checks the signed-in person and their role on the server
  (`lib/auth.ts`); Postgres row level security enforces the same rules again.
- Server actions parse their input with Zod before using it.
- Links from emails only redirect within the site (`lib/safe-redirect.ts`).
- Security headers are set in `next.config.ts`. There's no script-src CSP:
  a nonce-based one would make every page render per request.
- In the Supabase dashboard, keep email confirmation on and turn on leaked
  password protection (Auth → Providers → Email).

## Printing

The print screen sets the page to the label's size (`@page`) and prints
through the browser to the PC's label printer driver. Set the printer's
paper size to the label size (e.g. 100 × 100 mm, no margins) once.

## Barcode numbers on imported labels

The old labels hold the barcode as a picture. The importer reads the number
from the bars with ZXing (the same reader as the scan screen) and prints
which labels it couldn't read and why: a vector picture (SVG/WMF/EMF), a
linked picture, or no barcode found. Fill those in on the label's Details
tab. To start again: `pnpm labels:reset --yes`, then import.

## Scanning

The phone camera reads case (ITF-14) and pouch (EAN-13) barcodes with
`barcode-detector` (ZXing in WebAssembly). The decoder is served from
`public/vendor/zxing_reader.wasm`; after upgrading `barcode-detector`, copy
the new `zxing_reader.wasm` from `node_modules/zxing-wasm/dist/reader/`.
Cameras only work on HTTPS (or localhost).
