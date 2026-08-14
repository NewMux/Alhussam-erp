# Al-Mamlaka Tailor ERP — Client Delivery Handoff

**Release status:** Client-review ready after automated, backend, and interface verification. The current workspace intentionally contains clearly labelled `[DEMO]` records and must be loaded with the client’s own operational data before go-live.

## What has been delivered

The release provides an authenticated tailor-shop workspace with an owner dashboard, client directory and measurements, inventory control, direct-inventory point of sale, invoices with browser printing/PDF output, workforce operations, shop settings with role assignments, and an audit trail.

The point of sale is intentionally aligned to the active inventory records. It presents the three currently active demo materials exactly once, deducts stock atomically, creates an invoice, and opens a clean print window after checkout. Legacy duplicate demo materials remain archived in the database to preserve prior reference history but are not displayed in live inventory or POS workflows.

## Delivery audit summary

| Area | Outcome | Client note |
|---|---|---|
| Build and automated tests | `pnpm check`, `pnpm test`, and `pnpm build` pass. The current suite contains 14 tests. | Re-run all three commands before every release. |
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

## Externally managed hosting requirements

The current app is a Node.js 22 application using React/Vite on the frontend, Express/tRPC on the backend, Drizzle ORM, and MySQL/TiDB-compatible storage. The verified production commands are:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The host must expose the application through HTTPS, provide a managed MySQL-compatible database, inject secrets securely, and configure the application’s external base URL. It must not commit `.env` files, credentials, or database dumps to source control.

| Required configuration category | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection used by Drizzle and all ERP data operations. Require TLS where the database provider supports it. |
| Session and authentication configuration | The current implementation uses the integrated Manus OAuth/session layer. A move to a non-Manus host requires a compatible authentication migration or continued access to the configured OAuth service and callback URLs. This is a pre-launch dependency, not a cosmetic setting. |
| Public application/OAuth URLs | Must match the final HTTPS domain and callback URLs exactly. |
| Server-side service credentials | Required only when the client enables the corresponding storage, notification, or platform services. Never expose server credentials to the browser. |

> **External-hosting decision:** The managed hosting route supports custom domains and remains the lowest-risk option for the current authentication integration. If the client chooses another hosting provider, the hosting team should first validate the OAuth callback/session model in a staging environment; a direct lift-and-shift has not been certified outside the integrated deployment environment.

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
