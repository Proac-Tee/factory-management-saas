# Handover — label studio (2026-10-12)

Read this first in a new session, then README.md.

## Done

- Paper: file "Ember – Factory OS", page **v3 – Label studio**: Desktop – Label library,
  Label editor, People and access; Phone – Scan, Check: label matches, Sign in (password).
  Design system: the Ember "thermal print" look (Archivo, ink on white, colour only for status,
  56px touch targets). Design in Paper first, then build from it.
- Auth: email + password; only emails on `allowed_emails` can sign up (app check + DB trigger).
  Roles admin / editor / operator live on the allowed list (`private.has_role()` in RLS).
- Labels: library (group by customer/type/size, search), editor (size presets, per-part sizes,
  show/hide, reorder, fields {batch} {bbe} {qty}, fit meter, too-wide check), print at true size.
- Scan: phone camera (barcode-detector, local wasm) to find labels by ITF-14/EAN-13 and to check
  a printed label (saved in `label_checks`).
- Access screen for admins. Scripts: `pnpm access:allow`, `pnpm labels:import`.
- Tests: `pnpm test` (34), `pnpm test:db` (6, needs a database with the migrations).

## Not done / next

1. **Cloud database**: `.env.local` DATABASE_URL used the IPv6-only direct host. Use the
   transaction pooler URL, then `pnpm db:migrate`, `pnpm access:allow --email … --role admin`,
   `pnpm labels:import "<Label Designs folder>"` (the folder is on Babatunde's Mac, not in git).
2. **Barcode numbers**: 102 imported labels have a barcode part but no number (the old files
   held the barcode as a picture). Plan: load a SKU → GTIN list (CSV) in bulk.
3. Tidy imports that stacked awkwardly (some duplicate logos, cramped lines) in the editor.
4. Try scanning on a real phone over HTTPS (the camera needs HTTPS; it couldn't be tested here).
5. Later: label categories, the Windows print helper, stock.

## Working rules

pnpm only. Conventional Commits on `main`. Commit only when asked. Follow the design PDF:
Paper design first, then build, then run the impeccable audit. Make every screen responsive;
buttons get the pointer cursor.
