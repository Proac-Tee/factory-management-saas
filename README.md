This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase + Drizzle setup

1. Copy `.env.example` to `.env.local` and fill in the values from your Supabase project
   (API keys for the `NEXT_PUBLIC_*` vars; **Connect → ORMs → Drizzle** for `DATABASE_URL`).
2. Apply migrations: `pnpm db:migrate`.
3. In Supabase **Auth → URL Configuration**, add `http://localhost:3000/auth/confirm`
   (and your production URL) to the redirect allow list.

Schema changes: edit `lib/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
For SQL Drizzle can't express (triggers, functions), use `pnpm db:generate --custom --name <name>`.

Querying data:

- `withRls(claims, (tx) => ...)` from `lib/db/rls.ts` runs as the signed-in user, so RLS policies apply. Use it for user-facing queries.
- `db` from `lib/db` connects as `postgres` and **bypasses RLS**. Use it only for trusted server-side work.
- Get the current user with `getCurrentUser()` from `lib/auth.ts`. It verifies the JWT and redirects to `/login` when signed out.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
