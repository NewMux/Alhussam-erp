/**
 * One-time cutover: copies every row from the old Supabase Postgres database
 * into a freshly provisioned PocketBase instance (run `pnpm pocketbase:schema`
 * against it first). Run with the OLD stack's DATABASE_URL plus the NEW
 * PocketBase instance's superuser credentials:
 *
 *   DATABASE_URL=postgres://... \
 *   PB_URL=https://tailor.example.com \
 *   PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... \
 *   pnpm pocketbase:migrate-data
 *
 * Auth accounts cannot be carried over as-is — Supabase and PocketBase hash
 * passwords differently, so this script creates each PocketBase user with a
 * random temporary password and writes them to migration-credentials.json
 * (git-ignored) for the shop owner to hand out. Delete that file once
 * everyone has signed in and changed their password.
 */
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import PocketBase from "pocketbase";
import * as schema from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;
const PB_URL = process.env.PB_URL;
const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL;
const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD;
if (!DATABASE_URL || !PB_URL || !PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
  throw new Error("Set DATABASE_URL, PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD before running this script.");
}

const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema });
const pb = new PocketBase(PB_URL);

// "table:oldNumericId" -> new PocketBase string id
const idMap = new Map<string, string>();
const mapId = (table: string, oldId: number | null | undefined) => (oldId === null || oldId === undefined ? null : idMap.get(`${table}:${oldId}`) ?? null);
const remember = (table: string, oldId: number, newId: string) => idMap.set(`${table}:${oldId}`, newId);
const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);
const randomPassword = () => randomBytes(18).toString("base64url");

async function main() {
  await pb.collection("_superusers").authWithPassword(PB_SUPERUSER_EMAIL!, PB_SUPERUSER_PASSWORD!);
  const credentials: Array<{ email: string; temporaryPassword: string }> = [];

  console.log("Migrating users...");
  for (const user of await db.select().from(schema.users)) {
    if (!user.email) { console.warn(`Skipping user #${user.id} — no email on record.`); continue; }
    const password = randomPassword();
    const created = await pb.collection("users").create({
      email: user.email, password, passwordConfirm: password, name: user.name || "",
      role: user.role, loginMethod: "migrated", lastSignedIn: iso(user.lastSignedIn) || new Date().toISOString(),
    });
    remember("users", user.id, created.id);
    credentials.push({ email: user.email, temporaryPassword: password });
  }
  writeFileSync("migration-credentials.json", JSON.stringify(credentials, null, 2));
  console.log(`Wrote ${credentials.length} temporary passwords to migration-credentials.json — distribute privately, then delete the file.`);

  console.log("Migrating customRoles...");
  for (const row of await db.select().from(schema.customRoles)) {
    const created = await pb.collection("customRoles").create({ name: row.name, description: row.description, permissionsJson: row.permissionsJson, isActive: row.isActive, createdBy: mapId("users", row.createdBy) });
    remember("customRoles", row.id, created.id);
  }

  console.log("Migrating userBusinessRoles...");
  for (const row of await db.select().from(schema.userBusinessRoles)) {
    const userId = mapId("users", row.userId);
    if (!userId) continue;
    await pb.collection("userBusinessRoles").create({ userId, role: row.role, isActive: row.isActive });
  }

  console.log("Migrating userCustomRoles...");
  for (const row of await db.select().from(schema.userCustomRoles)) {
    const userId = mapId("users", row.userId);
    const customRoleId = mapId("customRoles", row.customRoleId);
    if (!userId || !customRoleId) continue;
    await pb.collection("userCustomRoles").create({ userId, customRoleId, isActive: row.isActive, updatedBy: mapId("users", row.updatedBy) });
  }

  console.log("Migrating pendingAccessRequests...");
  for (const row of await db.select().from(schema.pendingAccessRequests)) {
    const userId = mapId("users", row.userId);
    if (!userId) continue;
    await pb.collection("pendingAccessRequests").create({ userId, status: row.status, requestedAt: iso(row.requestedAt), reviewedAt: iso(row.reviewedAt), reviewedBy: mapId("users", row.reviewedBy), note: row.note });
  }

  console.log("Migrating staffAccessInvites...");
  for (const row of await db.select().from(schema.staffAccessInvites)) {
    const customRoleId = mapId("customRoles", row.customRoleId);
    if (!customRoleId) continue;
    await pb.collection("staffAccessInvites").create({ name: row.name, email: row.email, customRoleId, isActive: row.isActive, invitedBy: mapId("users", row.invitedBy), invitedAt: iso(row.invitedAt), acceptedByUserId: mapId("users", row.acceptedByUserId), acceptedAt: iso(row.acceptedAt) });
  }

  console.log("Migrating shopSettings...");
  for (const row of await db.select().from(schema.shopSettings)) {
    await pb.collection("shopSettings").create({ shopName: row.shopName, arabicShopName: row.arabicShopName, crNumber: row.crNumber, currency: row.currency, phone: row.phone, email: row.email, address: row.address, invoicePrefix: row.invoicePrefix, vatEnabled: row.vatEnabled, vatRate: Number(row.vatRate), vatNumber: row.vatNumber, updatedBy: mapId("users", row.updatedBy) });
  }

  console.log("Migrating customers...");
  for (const row of await db.select().from(schema.customers)) {
    const created = await pb.collection("customers").create({ name: row.name, phone: row.phone, email: row.email, address: row.address, notes: row.notes, preferredContact: row.preferredContact });
    remember("customers", row.id, created.id);
  }

  console.log("Migrating staffProfiles...");
  for (const row of await db.select().from(schema.staffProfiles)) {
    const created = await pb.collection("staffProfiles").create({ userId: mapId("users", row.userId), name: row.name, phone: row.phone, jobTitle: row.jobTitle, baseSalary: Number(row.baseSalary), commissionRate: Number(row.commissionRate), isActive: row.isActive });
    remember("staffProfiles", row.id, created.id);
  }

  console.log("Migrating measurementProfiles...");
  for (const row of await db.select().from(schema.measurementProfiles)) {
    const customerId = mapId("customers", row.customerId);
    if (!customerId) continue;
    const created = await pb.collection("measurementProfiles").create({ customerId, version: row.version, measurementsJson: row.measurementsJson, fitPreference: row.fitPreference, collarStyle: row.collarStyle, pocketStyle: row.pocketStyle, notes: row.notes, effectiveDate: iso(row.effectiveDate), createdBy: mapId("users", row.createdBy) });
    remember("measurementProfiles", row.id, created.id);
  }

  console.log("Migrating tailoringOrders...");
  for (const row of await db.select().from(schema.tailoringOrders)) {
    const customerId = mapId("customers", row.customerId);
    if (!customerId) continue;
    const created = await pb.collection("tailoringOrders").create({ orderNumber: row.orderNumber, customerId, measurementProfileId: mapId("measurementProfiles", row.measurementProfileId), assignedTailorId: mapId("staffProfiles", row.assignedTailorId), garmentType: row.garmentType, quantity: row.quantity, status: row.status, dueDate: iso(row.dueDate), price: Number(row.price), customerSuppliedFabric: row.customerSuppliedFabric, fabricNotes: row.fabricNotes, notes: row.notes, productionNotes: row.productionNotes, createdBy: mapId("users", row.createdBy) });
    remember("tailoringOrders", row.id, created.id);
  }

  console.log("Migrating inventoryItems...");
  for (const row of await db.select().from(schema.inventoryItems)) {
    const created = await pb.collection("inventoryItems").create({ code: row.code, name: row.name, category: row.category, color: row.color, widthInches: row.widthInches ? Number(row.widthInches) : null, unit: row.unit, quantity: Number(row.quantity), minThreshold: Number(row.minThreshold), costPerUnit: Number(row.costPerUnit), isActive: row.isActive });
    remember("inventoryItems", row.id, created.id);
  }

  console.log("Migrating stockMovements...");
  for (const row of await db.select().from(schema.stockMovements)) {
    const inventoryItemId = mapId("inventoryItems", row.inventoryItemId);
    if (!inventoryItemId) continue;
    await pb.collection("stockMovements").create({ inventoryItemId, movementType: row.movementType, quantityChange: Number(row.quantityChange), quantityBefore: Number(row.quantityBefore), quantityAfter: Number(row.quantityAfter), referenceType: row.referenceType, referenceId: row.referenceId ? String(row.referenceId) : null, notes: row.notes, createdBy: mapId("users", row.createdBy) });
  }

  console.log("Migrating services...");
  for (const row of await db.select().from(schema.services)) {
    const created = await pb.collection("services").create({ sku: row.sku, name: row.name, category: row.category, description: row.description, unitPrice: Number(row.unitPrice), inventoryItemId: mapId("inventoryItems", row.inventoryItemId), defaultFabricMeters: row.defaultFabricMeters ? Number(row.defaultFabricMeters) : null, isActive: row.isActive });
    remember("services", row.id, created.id);
  }

  console.log("Migrating posSessions...");
  for (const row of await db.select().from(schema.posSessions)) {
    const openedBy = mapId("users", row.openedBy);
    if (!openedBy) continue;
    const created = await pb.collection("posSessions").create({ sessionNumber: row.sessionNumber, status: row.status, openedBy, openingCash: Number(row.openingCash), closingCash: row.closingCash ? Number(row.closingCash) : null, openedAt: iso(row.openedAt), closedAt: iso(row.closedAt), notes: row.notes });
    remember("posSessions", row.id, created.id);
  }

  console.log("Migrating discountCodes...");
  for (const row of await db.select().from(schema.discountCodes)) {
    const createdBy = mapId("users", row.createdBy);
    if (!createdBy) continue;
    const created = await pb.collection("discountCodes").create({ code: row.code, type: row.type, value: Number(row.value), maxDiscount: row.maxDiscount ? Number(row.maxDiscount) : null, minSubtotal: Number(row.minSubtotal), usageLimit: row.usageLimit, usedCount: row.usedCount, isActive: row.isActive, expiresAt: iso(row.expiresAt), createdBy });
    remember("discountCodes", row.id, created.id);
  }

  console.log("Migrating sales...");
  for (const row of await db.select().from(schema.sales)) {
    const createdBy = mapId("users", row.createdBy);
    if (!createdBy) continue;
    const created = await pb.collection("sales").create({
      saleNumber: row.saleNumber, clientReference: row.clientReference, customerId: mapId("customers", row.customerId),
      customerNameSnapshot: row.customerNameSnapshot, customerPhoneSnapshot: row.customerPhoneSnapshot,
      subtotal: Number(row.subtotal), discount: Number(row.discount), vatRate: Number(row.vatRate), vatAmount: Number(row.vatAmount),
      total: Number(row.total), paidAmount: Number(row.paidAmount), paymentMethod: row.paymentMethod, paymentStatus: row.paymentStatus,
      source: row.source, sessionId: mapId("posSessions", row.sessionId), discountCodeId: mapId("discountCodes", row.discountCodeId),
      discountCodeSnapshot: row.discountCodeSnapshot, returnMode: row.returnMode, returnReason: row.returnReason, createdBy,
      createdAt: iso(row.createdAt),
    });
    remember("sales", row.id, created.id);
  }
  // Second pass: patch in the self-referencing returnOfSaleId now that every sale has a new id.
  for (const row of await db.select().from(schema.sales)) {
    if (!row.returnOfSaleId) continue;
    const saleId = mapId("sales", row.id);
    const returnOfSaleId = mapId("sales", row.returnOfSaleId);
    if (saleId && returnOfSaleId) await pb.collection("sales").update(saleId, { returnOfSaleId });
  }

  console.log("Migrating saleItems...");
  for (const row of await db.select().from(schema.saleItems)) {
    const saleId = mapId("sales", row.saleId);
    if (!saleId) continue;
    await pb.collection("saleItems").create({ saleId, serviceId: mapId("services", row.serviceId), inventoryItemId: mapId("inventoryItems", row.inventoryItemId), nameSnapshot: row.nameSnapshot, quantity: Number(row.quantity), unitPrice: Number(row.unitPrice), lineDiscount: Number(row.lineDiscount), lineTotal: Number(row.lineTotal), assignedTailorId: mapId("staffProfiles", row.assignedTailorId), measurementProfileId: mapId("measurementProfiles", row.measurementProfileId) });
  }

  console.log("Migrating posOrders...");
  for (const row of await db.select().from(schema.posOrders)) {
    const createdBy = mapId("users", row.createdBy);
    if (!createdBy) continue;
    await pb.collection("posOrders").create({ orderNumber: row.orderNumber, sessionId: mapId("posSessions", row.sessionId), customerId: mapId("customers", row.customerId), status: row.status, cartJson: row.cartJson, note: row.note, createdBy, heldAt: iso(row.heldAt) });
  }

  console.log("Migrating posPayments...");
  for (const row of await db.select().from(schema.posPayments)) {
    const saleId = mapId("sales", row.saleId);
    const createdBy = mapId("users", row.createdBy);
    if (!saleId || !createdBy) continue;
    await pb.collection("posPayments").create({ saleId, method: row.method, amount: Number(row.amount), reference: row.reference, createdBy });
  }

  console.log("Migrating invoices...");
  for (const row of await db.select().from(schema.invoices)) {
    const saleId = mapId("sales", row.saleId);
    if (!saleId) continue;
    const created = await pb.collection("invoices").create({ saleId, invoiceNumber: row.invoiceNumber, status: row.status, issuedAt: iso(row.issuedAt), dueDate: iso(row.dueDate), notes: row.notes });
    remember("invoices", row.id, created.id);
  }

  console.log("Migrating invoiceDeliveries...");
  for (const row of await db.select().from(schema.invoiceDeliveries)) {
    const invoiceId = mapId("invoices", row.invoiceId);
    const createdBy = mapId("users", row.createdBy);
    if (!invoiceId || !createdBy) continue;
    await pb.collection("invoiceDeliveries").create({ invoiceId, channel: row.channel, recipient: row.recipient, status: row.status, message: row.message, error: row.error, createdBy });
  }

  console.log("Migrating customerBalanceDeliveries...");
  for (const row of await db.select().from(schema.customerBalanceDeliveries)) {
    const customerId = mapId("customers", row.customerId);
    const createdBy = mapId("users", row.createdBy);
    if (!customerId || !createdBy) continue;
    await pb.collection("customerBalanceDeliveries").create({ customerId, channel: row.channel, recipient: row.recipient, status: row.status, message: row.message, error: row.error, createdBy });
  }

  console.log("Migrating attendance...");
  for (const row of await db.select().from(schema.attendance)) {
    const staffProfileId = mapId("staffProfiles", row.staffProfileId);
    const recordedBy = mapId("users", row.recordedBy);
    if (!staffProfileId || !recordedBy) continue;
    await pb.collection("attendance").create({ staffProfileId, workDate: iso(row.workDate), status: row.status, notes: row.notes, recordedBy });
  }

  console.log("Migrating performanceRecords...");
  for (const row of await db.select().from(schema.performanceRecords)) {
    const staffProfileId = mapId("staffProfiles", row.staffProfileId);
    const recordedBy = mapId("users", row.recordedBy);
    if (!staffProfileId || !recordedBy) continue;
    await pb.collection("performanceRecords").create({ staffProfileId, workDate: iso(row.workDate), metric: row.metric, units: Number(row.units), commissionEarned: Number(row.commissionEarned), notes: row.notes, recordedBy });
  }

  console.log("Migrating salaryPayouts...");
  for (const row of await db.select().from(schema.salaryPayouts)) {
    const staffProfileId = mapId("staffProfiles", row.staffProfileId);
    const approvedBy = mapId("users", row.approvedBy);
    if (!staffProfileId || !approvedBy) continue;
    await pb.collection("salaryPayouts").create({ staffProfileId, payPeriod: row.payPeriod, payslipNumber: row.payslipNumber, baseSalary: Number(row.baseSalary), allowances: Number(row.allowances), overtime: Number(row.overtime), performanceBonus: Number(row.performanceBonus), deductions: Number(row.deductions), deductionDetails: row.deductionDetails, netSalary: Number(row.netSalary), notes: row.notes, approvedBy, paidAt: iso(row.paidAt) });
  }

  console.log("Migrating auditLogs...");
  for (const row of await db.select().from(schema.auditLogs)) {
    const actorId = mapId("users", row.actorId);
    if (!actorId) continue;
    await pb.collection("auditLogs").create({ actorId, action: row.action, entityType: row.entityType, entityId: row.entityId ? String(row.entityId) : null, detailsJson: row.detailsJson, createdAt: iso(row.createdAt) });
  }

  console.log("Migration complete.");
  await client.end();
}

main().catch(err => { console.error(err?.response ? JSON.stringify(err.response, null, 2) : err); process.exit(1); });
