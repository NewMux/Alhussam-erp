# Al-Mamlaka Tailor ERP — Client Delivery Handoff

**Release status:** Client-review ready after automated, backend, and interface verification. The current workspace intentionally contains clearly labelled `[DEMO]` records and must be loaded with the client’s own operational data before go-live.

## What has been delivered

The release provides an authenticated tailor-shop workspace with an owner dashboard, client directory and measurements, inventory control, direct-inventory point of sale, invoices with browser printing/PDF output, workforce operations, shop settings with role assignments, and an audit trail.

The point of sale is intentionally aligned to the active inventory records. It presents the three currently active demo materials exactly once, deducts stock atomically, creates an invoice, and opens a clean print window after checkout. Legacy duplicate demo materials remain archived in the database to preserve prior reference history but are not displayed in live inventory or POS workflows.

## Delivery audit summary

| Area | Outcome | Client note |
|---|---|---|
| Build and automated tests | `pnpm check`, `pnpm test`, and `pnpm build` pass. The current suite contains 26 tests. | Re-run all three commands before every release. |
| Backend access | ERP and POS procedures require an authenticated user. Business-role checks gate sales, inventory, payroll, and administration actions. | Assign least-privilege roles after each team member signs in. |
| Data integrity | Active inventory count is 3. The relational audit found zero invoices without sales, sale lines without sales, stock movements without materials, and duplicate business-role records. | Take a database backup before importing production records. |
| POS and stock | The POS sells direct inventory items, blocks quantities beyond available balance, records stock movement, creates sale/invoice records, and supports immediate print. | Confirm each material’s unit, opening balance, threshold, and initial checkout price before launch. |
| Customer and workforce journeys | Client name/phone search, measurements, attendance, production, and payroll areas are available. | Replace all `[DEMO]` contacts, attendance, production, and payout records. |
| Invoices | Invoice details render in an isolated print document to avoid application overlays. | Allow browser pop-ups for the POS/invoice print workflow. |
| Desktop and mobile | Owner, customer, inventory, POS, invoice, workforce, settings, and audit screens were reviewed. Tables retain horizontal scrolling on compact screens and now disclose how to reach hidden actions. | Test the client’s actual tablets and printer before launch. |

## Client operational setup checklist

1. In **Shop Settings**, replace the demo shop name, Arabic name, CR number, invoice prefix, contact information, and address.
2. Invite/sign in every team member, then assign the minimum required business role: **admin**, **sales**, **inventory**, **tailor**, or **payroll**.
3. Replace `[DEMO]` customers, stock records, staff, payroll, and historical invoices with approved client data. Retain only records the client explicitly wants as training data.
4. Confirm every active inventory material’s code, category, colour, width, unit, on-hand balance, minimum threshold, and cost. At checkout, staff can set the final unit price in the cart; establish a client policy for price overrides.
5. Create a test sale, check the inventory deduction and audit entry, then print the resulting invoice from the client’s actual browser and printer.
6. Set a backup schedule and nominate a business owner responsible for stock adjustments, payroll approvals, and role changes.

## Hosting requirements

The app is a React/Vite frontend with an Express/tRPC backend, backed by a **PocketBase** instance (SQLite database + authentication) running on a self-managed VPS — see `deploy/README.md` for full VPS provisioning, per-client onboarding, and backup setup. The frontend and API layer still deploy to **Vercel**: the frontend builds to static assets, and the backend runs as a single Vercel serverless function (`api/index.ts`, which wraps the same Express app used for local development — see `vercel.json` for the routing). Local/alternate-host development still uses:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Authentication is handled by **PocketBase's built-in auth** (email/password) — the browser talks to PocketBase directly via the `pocketbase` JS SDK, and the server verifies the resulting token by calling PocketBase's own auth-refresh endpoint (no separate JWT secret to manage).

To deploy: connect this repository in the Vercel dashboard (Vercel auto-detects `vercel.json`), set the env vars below on the project, and deploy. No CLI or account token needed beyond the GitHub connection. It must not commit `.env` files, credentials, or database dumps to source control.

| Required env var | Purpose |
|---|---|
| `POCKETBASE_URL` | This client's PocketBase instance URL (their subdomain on the shared VPS, e.g. `https://tailor-shop.example.com`). |
| `POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD` | The PocketBase superuser account the Node server authenticates as (created once per client instance — see `deploy/README.md`). |
| `OWNER_EMAIL` | The email address that automatically becomes the admin the first time it registers/signs in. Set this to the shop owner's real email before go-live. |
| `NODE_ENV` | Set to `production` **only on hosts that don't set it for you** (e.g. a plain VPS running `pnpm start`). On Vercel, don't set it — Vercel sets it automatically during builds, and setting it yourself makes `pnpm install` skip devDependencies, which breaks the API function's build. |
| `VITE_POCKETBASE_URL` | Same PocketBase URL as above. **Baked into the client bundle at build time** (must be set before the build runs) — the browser talks to PocketBase directly for sign-in/sign-up. |

Optional, only if the client enables the corresponding feature: `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` for the file storage proxy. Never expose server credentials to the browser.

Note: Vercel serverless functions have a request body size ceiling (a few MB depending on plan) — fine for this app's JSON/API traffic, but worth knowing if a future feature needs large file uploads through `/api`.

### First-time setup on a fresh PocketBase instance

1. Provision the client's PocketBase instance on the VPS and create its superuser account — follow "Onboarding a new client" in `deploy/README.md`.
2. Run `pnpm pocketbase:schema` against the new instance (see the same doc) to create all collections. Re-run it any time `scripts/pocketbase-schema.ts` gains new collections — it skips ones that already exist.
3. Set `OWNER_EMAIL` to the shop owner's email, then have them register through the app's sign-up form with that exact email — they'll land as admin automatically. Everyone else who registers lands in a pending-approval queue until the admin approves them (Shop Settings → Staff & Access).

## Go-live acceptance test

The client should sign in as an administrator and sales user, complete the following in a staging environment, and record the outcomes:

1. Create one test customer and measurement profile.
2. Add or adjust one material; confirm its stock movement and audit entry.
3. Complete a POS sale for an in-stock material; confirm stock decreases by the sold quantity.
4. Confirm the generated invoice prints or saves as a PDF without application chrome.
5. Review the dashboard over a preset range and a Custom period.
6. Confirm a payroll user cannot access administration actions and an inventory user cannot complete unauthorized workflows.
7. Restore a test database backup successfully before accepting production traffic.

## Remaining product decisions for the client

The application is ready for review, but the client should decide whether to add a stored **selling price** separate from inventory cost, barcode scanning, thermal receipt formatting, scheduled low-stock notifications, and a formal production-data import process before operating at scale.
