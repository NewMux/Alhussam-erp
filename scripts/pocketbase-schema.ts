/**
 * Bootstraps the PocketBase collection schema for a fresh instance.
 * Run once per new PocketBase deployment (a new VPS, a new client instance):
 *
 *   PB_URL=http://127.0.0.1:8090 PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... pnpm pocketbase:schema
 *
 * Safe to re-run: existing collections are left untouched (schema changes to
 * an already-provisioned collection are not auto-migrated by this script).
 */
import PocketBase from "pocketbase";

type Field = Record<string, unknown>;

const text = (name: string, opts: Field = {}): Field => ({ name, type: "text", ...opts });
const num = (name: string, opts: Field = {}): Field => ({ name, type: "number", ...opts });
const bool = (name: string, opts: Field = {}): Field => ({ name, type: "bool", ...opts });
const date = (name: string, opts: Field = {}): Field => ({ name, type: "date", ...opts });
const json = (name: string, opts: Field = {}): Field => ({ name, type: "json", ...opts });
const sel = (name: string, values: readonly string[], opts: Field = {}): Field => ({ name, type: "select", maxSelect: 1, values, ...opts });
const rel = (name: string, target: string, opts: Field = {}): Field => ({ name, type: "relation", collectionId: `@rel:${target}`, cascadeDelete: false, minSelect: 0, maxSelect: 1, ...opts });

const businessRoles = ["admin", "sales", "tailor", "inventory", "payroll"] as const;

// Number/bool fields are intentionally never `required: true` — PocketBase
// treats 0/false as the field's empty value, so a required numeric/boolean
// field rejects legitimate zero amounts (discount: 0, vatEnabled: false).
// Requiredness for those is enforced by the zod schemas in server/erp.ts and
// server/pos.ts instead.
const collections: Array<[string, Field[], string[]]> = [
  ["userBusinessRoles", [rel("userId", "users", { required: true }), sel("role", businessRoles, { required: true }), bool("isActive")], ["CREATE UNIQUE INDEX idx_ubr_user ON userBusinessRoles (userId)"]],
  ["customRoles", [text("name", { required: true, max: 80 }), text("description", { max: 320 }), json("permissionsJson", { required: true }), bool("isActive"), rel("createdBy", "users", { required: true })], ["CREATE UNIQUE INDEX idx_cr_name ON customRoles (name)"]],
  ["userCustomRoles", [rel("userId", "users", { required: true }), rel("customRoleId", "customRoles", { required: true }), bool("isActive"), rel("updatedBy", "users", { required: true })], ["CREATE UNIQUE INDEX idx_ucr_user ON userCustomRoles (userId)"]],
  ["pendingAccessRequests", [rel("userId", "users", { required: true }), sel("status", ["pending", "approved", "rejected"], { required: true }), date("requestedAt", { required: true }), date("reviewedAt"), rel("reviewedBy", "users"), text("note", { max: 500 })], ["CREATE UNIQUE INDEX idx_par_user ON pendingAccessRequests (userId)"]],
  ["staffAccessInvites", [text("name", { required: true, max: 160 }), text("email", { required: true, max: 320 }), rel("customRoleId", "customRoles", { required: true }), bool("isActive"), rel("invitedBy", "users", { required: true }), date("invitedAt", { required: true }), rel("acceptedByUserId", "users"), date("acceptedAt")], ["CREATE UNIQUE INDEX idx_sai_email ON staffAccessInvites (email)"]],
  ["shopSettings", [text("shopName", { required: true, max: 160 }), text("arabicShopName", { max: 160 }), text("crNumber", { max: 80 }), text("currency", { required: true, max: 8 }), text("phone", { max: 50 }), text("email", { max: 320 }), text("address"), text("invoicePrefix", { required: true, max: 16 }), bool("vatEnabled"), num("vatRate"), text("vatNumber", { max: 80 }), rel("updatedBy", "users")], []],
  ["customers", [text("name", { required: true, max: 160 }), text("phone", { required: true, max: 50 }), text("email", { max: 320 }), text("address"), text("notes"), text("preferredContact", { max: 40 })], []],
  ["measurementProfiles", [rel("customerId", "customers", { required: true }), num("version"), json("measurementsJson", { required: true }), text("fitPreference", { max: 100 }), text("collarStyle", { max: 100 }), text("pocketStyle", { max: 100 }), text("notes"), date("effectiveDate", { required: true }), rel("createdBy", "users", { required: true })], []],
  ["staffProfiles", [rel("userId", "users"), text("name", { required: true, max: 160 }), text("phone", { max: 50 }), text("jobTitle", { required: true, max: 100 }), num("baseSalary"), num("commissionRate"), bool("isActive")], []],
  ["tailoringOrders", [text("orderNumber", { required: true, max: 60 }), rel("customerId", "customers", { required: true }), rel("measurementProfileId", "measurementProfiles"), rel("assignedTailorId", "staffProfiles"), text("garmentType", { required: true, max: 80 }), num("quantity"), sel("status", ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"], { required: true }), date("dueDate"), num("price"), bool("customerSuppliedFabric"), text("fabricNotes"), text("notes"), text("productionNotes"), rel("createdBy", "users", { required: true })], ["CREATE UNIQUE INDEX idx_to_number ON tailoringOrders (orderNumber)"]],
  ["inventoryItems", [text("code", { required: true, max: 60 }), text("name", { required: true, max: 160 }), sel("category", ["fabric", "lining", "buttons", "thread", "accessory", "other"], { required: true }), text("color", { max: 60 }), num("widthInches"), text("unit", { required: true, max: 40 }), num("quantity"), num("minThreshold"), num("costPerUnit"), bool("isActive")], ["CREATE UNIQUE INDEX idx_ii_code ON inventoryItems (code)"]],
  ["stockMovements", [rel("inventoryItemId", "inventoryItems", { required: true }), sel("movementType", ["opening", "adjustment", "sale", "return", "purchase"], { required: true }), num("quantityChange"), num("quantityBefore"), num("quantityAfter"), text("referenceType", { max: 40 }), text("referenceId", { max: 40 }), text("notes"), rel("createdBy", "users")], []],
  ["services", [text("sku", { required: true, max: 60 }), text("name", { required: true, max: 160 }), sel("category", ["tailoring", "fabric", "alteration", "accessory", "other"], { required: true }), text("description"), num("unitPrice"), rel("inventoryItemId", "inventoryItems"), num("defaultFabricMeters"), bool("isActive")], ["CREATE UNIQUE INDEX idx_svc_sku ON services (sku)"]],
  ["posSessions", [text("sessionNumber", { required: true, max: 60 }), sel("status", ["open", "closed"], { required: true }), rel("openedBy", "users", { required: true }), num("openingCash"), num("closingCash"), date("openedAt", { required: true }), date("closedAt"), text("notes")], ["CREATE UNIQUE INDEX idx_ps_number ON posSessions (sessionNumber)"]],
  ["discountCodes", [text("code", { required: true, max: 80 }), sel("type", ["percent", "amount"], { required: true }), num("value"), num("maxDiscount"), num("minSubtotal"), num("usageLimit"), num("usedCount"), bool("isActive"), date("expiresAt"), rel("createdBy", "users", { required: true })], ["CREATE UNIQUE INDEX idx_dc_code ON discountCodes (code)"]],
  ["sales", [text("saleNumber", { required: true, max: 60 }), text("clientReference", { max: 120 }), rel("customerId", "customers"), text("customerNameSnapshot", { required: true, max: 160 }), text("customerPhoneSnapshot", { max: 50 }), num("subtotal"), num("discount"), num("vatRate"), num("vatAmount"), num("total"), num("paidAmount"), sel("paymentMethod", ["cash", "benefitpay", "bank_transfer", "credit_card"], { required: true }), sel("paymentStatus", ["paid", "partial", "unpaid"], { required: true }), sel("source", ["counter", "manual", "tailoring"], { required: true }), rel("sessionId", "posSessions"), rel("discountCodeId", "discountCodes"), text("discountCodeSnapshot", { max: 80 }), text("returnMode", { max: 20 }), text("returnReason"), rel("createdBy", "users", { required: true })], ["CREATE UNIQUE INDEX idx_sales_number ON sales (saleNumber)", "CREATE UNIQUE INDEX idx_sales_clientref ON sales (clientReference) WHERE clientReference != ''"]],
  ["saleItems", [rel("saleId", "sales", { required: true }), rel("serviceId", "services"), rel("inventoryItemId", "inventoryItems"), text("nameSnapshot", { required: true, max: 160 }), num("quantity"), num("unitPrice"), num("lineDiscount"), num("lineTotal"), rel("assignedTailorId", "staffProfiles"), rel("measurementProfileId", "measurementProfiles")], []],
  ["posOrders", [text("orderNumber", { required: true, max: 60 }), rel("sessionId", "posSessions"), rel("customerId", "customers"), sel("status", ["held", "open", "paid", "cancelled", "refunded"], { required: true }), json("cartJson", { required: true }), text("note"), rel("createdBy", "users", { required: true }), date("heldAt", { required: true })], ["CREATE UNIQUE INDEX idx_po_number ON posOrders (orderNumber)"]],
  ["posPayments", [rel("saleId", "sales", { required: true }), sel("method", ["cash", "benefitpay", "bank_transfer", "credit_card"], { required: true }), num("amount"), text("reference", { max: 160 }), rel("createdBy", "users", { required: true })], []],
  ["invoices", [rel("saleId", "sales", { required: true }), text("invoiceNumber", { required: true, max: 60 }), sel("status", ["paid", "partial", "unpaid", "void"], { required: true }), date("issuedAt", { required: true }), date("dueDate"), text("notes")], ["CREATE UNIQUE INDEX idx_inv_sale ON invoices (saleId)", "CREATE UNIQUE INDEX idx_inv_number ON invoices (invoiceNumber)"]],
  ["invoiceDeliveries", [rel("invoiceId", "invoices", { required: true }), sel("channel", ["email", "whatsapp", "share"], { required: true }), text("recipient", { max: 320 }), sel("status", ["prepared", "sent", "failed"], { required: true }), text("message"), text("error"), rel("createdBy", "users", { required: true })], []],
  ["customerBalanceDeliveries", [rel("customerId", "customers", { required: true }), sel("channel", ["email", "whatsapp", "share"], { required: true }), text("recipient", { max: 320 }), sel("status", ["prepared", "sent", "failed"], { required: true }), text("message"), text("error"), rel("createdBy", "users", { required: true })], []],
  ["attendance", [rel("staffProfileId", "staffProfiles", { required: true }), date("workDate", { required: true }), sel("status", ["present", "absent", "leave", "half_day"], { required: true }), text("notes"), rel("recordedBy", "users", { required: true })], []],
  ["performanceRecords", [rel("staffProfileId", "staffProfiles", { required: true }), date("workDate", { required: true }), text("metric", { required: true, max: 120 }), num("units"), num("commissionEarned"), text("notes"), rel("recordedBy", "users", { required: true })], []],
  ["salaryPayouts", [rel("staffProfileId", "staffProfiles", { required: true }), text("payPeriod", { required: true, max: 20 }), text("payslipNumber", { max: 60 }), num("baseSalary"), num("allowances"), num("overtime"), num("performanceBonus"), num("deductions"), text("deductionDetails"), num("netSalary"), text("notes"), rel("approvedBy", "users", { required: true }), date("paidAt", { required: true })], ["CREATE UNIQUE INDEX idx_sp_payslip ON salaryPayouts (payslipNumber) WHERE payslipNumber != ''"]],
  ["auditLogs", [rel("actorId", "users", { required: true }), text("action", { required: true, max: 100 }), text("entityType", { required: true, max: 80 }), text("entityId", { max: 40 }), text("detailsJson"), date("createdAt", { required: true })], []],
];

function resolveRelations(fields: Field[], idByName: Map<string, string>): Field[] {
  return fields.map(f => {
    if (f.type !== "relation") return f;
    const targetName = String(f.collectionId).replace("@rel:", "");
    const targetId = idByName.get(targetName);
    if (!targetId) throw new Error(`Unresolved relation target: ${targetName}`);
    return { ...f, collectionId: targetId };
  });
}

/** Applies the collection schema to an already-authenticated superuser client. Reused by the test harness. */
export async function applyPocketbaseSchema(pb: PocketBase) {
  const existing = await pb.collections.getFullList();
  const idByName = new Map(existing.map(c => [c.name, c.id]));

  for (const [name, fields, indexes] of collections) {
    if (idByName.has(name)) {
      console.log(`${name} already exists, skipping (schema changes to existing collections are not auto-migrated)`);
      continue;
    }
    const resolvedFields = [
      ...resolveRelations(fields, idByName),
      { name: "createdAt", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updatedAt", type: "autodate", onCreate: true, onUpdate: true },
    ];
    const authRule = '@request.auth.id != ""';
    console.log(`creating ${name}`);
    const created = await pb.collections.create({
      name,
      type: "base",
      fields: resolvedFields,
      indexes,
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
    });
    idByName.set(name, created.id);
  }

  // Self-referencing relation (a return sale points back at the original
  // sale) has to be added after the `sales` collection already exists.
  const salesId = idByName.get("sales")!;
  const salesCollection = await pb.collections.getOne(salesId);
  if (!salesCollection.fields.some((f: Field) => f.name === "returnOfSaleId")) {
    console.log("patching sales.returnOfSaleId self-relation");
    await pb.collections.update(salesId, { fields: [...salesCollection.fields, rel("returnOfSaleId", "sales", { collectionId: salesId })] });
  }

  // Extend the built-in `users` auth collection with the app's own fields
  // (idempotent: only appends whatever's missing, never edits in place).
  const usersId = idByName.get("users") || existing.find(c => c.name === "users")!.id;
  const usersCollection = await pb.collections.getOne(usersId);
  const missing: Field[] = [];
  if (!usersCollection.fields.some((f: Field) => f.name === "role")) missing.push(sel("role", ["user", "admin"], { required: true }));
  if (!usersCollection.fields.some((f: Field) => f.name === "loginMethod")) missing.push(text("loginMethod", { max: 64 }));
  if (!usersCollection.fields.some((f: Field) => f.name === "lastSignedIn")) missing.push(date("lastSignedIn", { required: true }));
  if (missing.length) {
    console.log("patching users with", missing.map(f => f.name));
    await pb.collections.update(usersCollection.id, { fields: [...usersCollection.fields, ...missing] });
  }

  console.log("PocketBase schema is up to date.");
}

async function main() {
  const url = process.env.PB_URL;
  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;
  if (!url || !email || !password) throw new Error("Set PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD before running this script.");

  const pb = new PocketBase(url);
  await pb.collection("_superusers").authWithPassword(email, password);
  await applyPocketbaseSchema(pb);
}

// Only run the CLI entrypoint when executed directly (not when imported by the test harness).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err?.response ? JSON.stringify(err.response, null, 2) : err);
    process.exit(1);
  });
}
