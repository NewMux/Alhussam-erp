import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type {
  Customer,
  DiscountCode,
  Id,
  Invoice,
  InventoryItem,
  MeasurementProfile,
  PosOrder,
  PosSession,
  Sale,
  SaleItem,
  Service,
  ShopSettings,
  StaffProfile,
  StockMovement,
  UserBusinessRole,
  UserCustomRole,
  CustomRole,
} from "@shared/pb-types";
import { findById, findOne, pbFilter, pbOrThrow } from "./pb-helpers";
import { protectedProcedure, router } from "./_core/trpc";

const money = (value: number) => Math.round(value * 1000) / 1000;
const idSchema = z.string().min(1);
const paymentMethod = z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]);
const returnMode = z.enum(["items", "amount"]);
const taxFor = (netAmount: number, shop: { vatEnabled?: boolean | null; vatRate?: string | number | null } | null | undefined) => { const vatRate = shop?.vatEnabled ? Number(shop.vatRate || 0) : 0; const vatAmount = Math.max(0, netAmount) * vatRate / 100; return { vatRate, vatAmount, netAmount: Math.max(0, netAmount), grossAmount: Math.max(0, netAmount) + vatAmount }; };
const taxFromGross = (grossAmount: number, shop: { vatEnabled?: boolean | null; vatRate?: string | number | null } | null | undefined) => { const vatRate = shop?.vatEnabled ? Number(shop.vatRate || 0) : 0; const gross = Math.max(0, grossAmount); const netAmount = gross / (1 + vatRate / 100); return { vatRate, vatAmount: gross - netAmount, netAmount, grossAmount: gross }; };
const cartItem = z.object({
  serviceId: idSchema.optional(),
  inventoryItemId: idSchema.optional(),
  name: z.string().min(1).max(160),
  quantity: z.number().positive().max(999),
  unitPrice: z.number().nonnegative().max(1000000),
  lineDiscount: z.number().min(0).max(1000000).default(0),
}).refine(item => Boolean(item.serviceId || item.inventoryItemId), "Choose an inventory item or catalog item.");
const paymentLine = z.object({ method: paymentMethod, amount: z.number().positive().max(1000000), reference: z.string().trim().max(160).optional() });

export const calculateCheckoutTotal = (items: Array<{ quantity: number; unitPrice: number; lineDiscount?: number }>, discount: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscount = items.reduce((sum, item) => sum + Math.min(item.quantity * item.unitPrice, item.lineDiscount || 0), 0);
  const total = Math.max(0, subtotal - lineDiscount - discount);
  return { subtotal, total };
};

/**
 * Same RBAC shape as server/erp.ts's `access()`, scoped to the "sales"
 * permission the POS counter needs. See that file's comment on why this is
 * a sequence of plain writes rather than a DB transaction.
 */
async function requireCounterAccess(userId: Id, frameworkRole: "user" | "admin") {
  const pb = await pbOrThrow();
  let role = await findOne<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: userId }));
  if (!role) {
    role = await pb.collection("userBusinessRoles").create<UserBusinessRole>({ userId, role: frameworkRole === "admin" ? "admin" : "sales", isActive: true });
  }
  if (!role.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (role.role === "admin") return;
  const assignment = await findOne<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: userId }));
  if (assignment) {
    const customRole = await findById<CustomRole>("customRoles", assignment.customRoleId);
    const permissions = Array.isArray(customRole?.permissionsJson) ? customRole.permissionsJson.filter((value): value is string => typeof value === "string") : [];
    if (!assignment.isActive || !customRole?.isActive || !permissions.includes("sales")) throw new TRPCError({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to complete counter sales." });
    return;
  }
  if (role.role !== "sales") throw new TRPCError({ code: "FORBIDDEN", message: "Your role is not permitted to complete counter sales." });
}

async function audit(userId: Id, action: string, entityType: string, entityId: Id | undefined, details: unknown) {
  const pb = await pbOrThrow();
  await pb.collection("auditLogs").create({ actorId: userId, action, entityType, entityId: entityId ?? null, detailsJson: JSON.stringify(details), createdAt: new Date().toISOString() });
}

async function existingCheckoutByReference(clientReference: string | undefined) {
  if (!clientReference) return null;
  const sale = await findOne<Sale>("sales", await pbFilter("clientReference = {:ref}", { ref: clientReference }));
  if (!sale) return null;
  const invoice = await findOne<Invoice>("invoices", await pbFilter("saleId = {:id}", { id: sale.id }));
  if (!invoice) return null;
  return { id: sale.id, invoiceId: invoice.id, total: Number(sale.total), paidAmount: Number(sale.paidAmount), paymentStatus: sale.paymentStatus, saleNumber: sale.saleNumber };
}

const sessionInput = z.object({ openingCash: z.number().min(0).max(1000000), notes: z.string().trim().max(2000).optional() });
const checkoutInput = z.object({
  clientReference: z.string().trim().max(120).optional(),
  sessionId: idSchema.optional(),
  heldOrderId: idSchema.optional(),
  customerId: idSchema.optional(),
  customerName: z.string().min(1).max(160),
  customerPhone: z.string().max(50).optional(),
  note: z.string().trim().max(2000).optional(),
  discount: z.number().min(0).max(1000000).default(0),
  discountCode: z.string().trim().max(80).optional(),
  paymentMethod: paymentMethod.default("cash"),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]).default("paid"),
  payments: z.array(paymentLine).max(8).optional(),
  items: z.array(cartItem).min(1),
}).superRefine((value, ctx) => {
  for (const item of value.items) if (item.lineDiscount > item.quantity * item.unitPrice) ctx.addIssue({ code: "custom", path: ["items"], message: `The discount for ${item.name} cannot exceed its line subtotal.` });
});

const quickCheckoutInput = z.object({
  clientReference: z.string().trim().max(120).optional(),
  sessionId: idSchema.optional(),
  customerId: idSchema.optional(),
  customerName: z.string().min(1).max(160).default("Walk-in customer"),
  customerPhone: z.string().max(50).optional(),
  amount: z.number().positive().max(1000000),
  paymentMethod: paymentMethod.default("cash"),
  note: z.string().trim().max(2000).optional(),
});

const tailoringCheckoutInput = z.object({
  sessionId: idSchema,
  customerId: idSchema,
  measurementProfileId: idSchema,
  assignedTailorId: idSchema,
  garmentType: z.string().trim().min(2).max(80),
  quantity: z.number().int().min(1).max(20),
  dueDate: z.string().optional(),
  orderPrice: z.number().positive(),
  paymentAmount: z.number().positive(),
  customerSuppliedFabric: z.boolean().default(false),
  fabricNotes: z.string().max(2000).optional(),
  paymentMethod,
  notes: z.string().max(3000),
  productionNotes: z.string().max(3000),
}).superRefine((value, ctx) => {
  if (value.paymentAmount > value.orderPrice) ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: "The payment collected cannot exceed the quoted order price." });
});

const heldOrderInput = z.object({
  sessionId: idSchema,
  customerId: idSchema.optional(),
  note: z.string().trim().max(2000).optional(),
  items: z.array(cartItem).min(1),
});

export const returnItemSelection = z.array(z.object({ saleItemId: idSchema, quantity: z.number().positive() })).max(1, "Choose only one item to return.");

const returnInput = z.object({
  sessionId: idSchema,
  originalSaleId: idSchema,
  paymentMethod,
  mode: returnMode.default("items"),
  amount: z.number().positive().max(1000000).optional(),
  reason: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
  items: returnItemSelection.optional(),
}).superRefine((value, ctx) => {
  if (value.mode === "items" && (!value.items || value.items.length === 0)) ctx.addIssue({ code: "custom", path: ["items"], message: "Choose at least one item to return." });
  if (value.mode === "amount" && (!value.amount || value.amount <= 0)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a refund amount." });
});

async function validateSession(sessionId: Id) {
  const session = await findById<PosSession>("posSessions", sessionId);
  if (!session || session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Open a POS session before completing this order." });
  return session;
}

async function resolveSession(sessionId: Id | undefined, userId: Id) {
  if (sessionId) return validateSession(sessionId);
  const pb = await pbOrThrow();
  const existing = await findOne<PosSession>("posSessions", "status = 'open'", "-openedAt");
  if (existing) return existing;
  const sessionNumber = `POS-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  return pb.collection("posSessions").create<PosSession>({ sessionNumber, status: "open", openedBy: userId, openingCash: money(0), openedAt: new Date().toISOString(), notes: "Opened automatically while synchronizing offline sales" });
}

async function resolveDiscount(code: string | undefined, subtotal: number) {
  if (!code) return { id: null as Id | null, snapshot: null as string | null, amount: 0 };
  const record = await findOne<DiscountCode>("discountCodes", await pbFilter("code = {:code}", { code: code.toUpperCase() }));
  if (!record || !record.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code is not active." });
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code has expired." });
  if (record.usageLimit !== null && record.usedCount >= record.usageLimit) throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code has reached its usage limit." });
  if (subtotal < Number(record.minSubtotal)) throw new TRPCError({ code: "BAD_REQUEST", message: `This code requires a subtotal of at least ${money(Number(record.minSubtotal))} BHD.` });
  const raw = record.type === "percent" ? subtotal * Number(record.value) / 100 : Number(record.value);
  const amount = Math.min(subtotal, record.maxDiscount ? Math.min(raw, Number(record.maxDiscount)) : raw);
  return { id: record.id, snapshot: record.code, amount };
}

export const posRouter = router({
  session: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      return findOne<PosSession>("posSessions", "status = 'open'", "-openedAt");
    }),
    open: protectedProcedure.input(sessionInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      const existing = await findOne<PosSession>("posSessions", "status = 'open'", "-openedAt");
      if (existing) return existing;
      const sessionNumber = `POS-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
      const session = await pb.collection("posSessions").create<PosSession>({ sessionNumber, status: "open", openedBy: ctx.user.id, openingCash: money(input.openingCash), openedAt: new Date().toISOString(), notes: input.notes || null });
      await audit(ctx.user.id, "POS_SESSION_OPENED", "posSession", session.id, { sessionNumber, openingCash: input.openingCash });
      return session;
    }),
    close: protectedProcedure.input(z.object({ sessionId: idSchema, closingCash: z.number().min(0), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      const session = await findById<PosSession>("posSessions", input.sessionId);
      if (!session || session.status !== "open") throw new TRPCError({ code: "NOT_FOUND", message: "The POS session is not open." });
      await pb.collection("posSessions").update(session.id, { status: "closed", closingCash: money(input.closingCash), closedAt: new Date().toISOString(), notes: input.notes || session.notes });
      await audit(ctx.user.id, "POS_SESSION_CLOSED", "posSession", session.id, { sessionNumber: session.sessionNumber, closingCash: input.closingCash });
      return { success: true };
    }),
  }),
  orders: router({
    held: protectedProcedure.query(async ({ ctx }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      return (await pb.collection("posOrders").getFullList<PosOrder>({ filter: "status = 'held'", sort: "-updatedAt" })).slice(0, 100);
    }),
    hold: protectedProcedure.input(heldOrderInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      const orderNumber = `HOLD-${Date.now()}`;
      const order = await pb.collection("posOrders").create<PosOrder>({ orderNumber, sessionId: input.sessionId, customerId: input.customerId ?? null, status: "held", cartJson: input.items, note: input.note || null, createdBy: ctx.user.id, heldAt: new Date().toISOString() });
      await audit(ctx.user.id, "POS_ORDER_HELD", "posOrder", order.id, { orderNumber, lineCount: input.items.length });
      return { id: order.id, orderNumber };
    }),
    cancel: protectedProcedure.input(z.object({ orderId: idSchema })).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      await pb.collection("posOrders").update(input.orderId, { status: "cancelled" });
      await audit(ctx.user.id, "POS_ORDER_CANCELLED", "posOrder", input.orderId, {});
      return { success: true };
    }),
  }),
  discounts: router({
    validate: protectedProcedure.input(z.object({ code: z.string().trim().min(1).max(80), subtotal: z.number().min(0) })).query(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      return resolveDiscount(input.code, input.subtotal);
    }),
  }),
  checkout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const replay = await existingCheckoutByReference(input.clientReference);
    if (replay) return replay;
    const pb = await pbOrThrow();
    const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
    const saleNumber = `POS-${Date.now()}`;
    const resolvedSession = await resolveSession(input.sessionId, ctx.user.id);

    const resolved: Array<{ serviceId: Id | null; inventoryItemId: Id | null; name: string; quantity: number; unitPrice: number; lineDiscount: number; stockPerSaleUnit: number; stock: InventoryItem | null }> = [];
    for (const item of input.items) {
      if (item.inventoryItemId && !item.serviceId) {
        const stock = await findById<InventoryItem>("inventoryItems", item.inventoryItemId);
        if (!stock?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "This inventory item is no longer available at POS." });
        const lineSubtotal = item.quantity * item.unitPrice;
        resolved.push({ serviceId: null, inventoryItemId: stock.id, name: stock.name, quantity: item.quantity, unitPrice: item.unitPrice, lineDiscount: Math.min(item.lineDiscount, lineSubtotal), stockPerSaleUnit: 1, stock });
        continue;
      }
      const catalogItem = await findById<Service>("services", item.serviceId);
      if (!catalogItem || !catalogItem.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: `${item.name} is no longer available at POS.` });
      if (item.inventoryItemId && item.inventoryItemId !== catalogItem.inventoryItemId) throw new TRPCError({ code: "BAD_REQUEST", message: `${catalogItem.name} no longer matches the selected inventory item.` });
      const stock = catalogItem.inventoryItemId ? await findById<InventoryItem>("inventoryItems", catalogItem.inventoryItemId) : null;
      if (catalogItem.inventoryItemId && !stock?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: `${catalogItem.name} has no active inventory link.` });
      const unitPrice = Number(catalogItem.unitPrice);
      const lineSubtotal = item.quantity * unitPrice;
      resolved.push({ serviceId: catalogItem.id, inventoryItemId: catalogItem.inventoryItemId, name: catalogItem.name, quantity: item.quantity, unitPrice, lineDiscount: Math.min(item.lineDiscount, lineSubtotal), stockPerSaleUnit: catalogItem.inventoryItemId ? Number(catalogItem.defaultFabricMeters || 1) : 0, stock: stock || null });
    }
    const subtotal = resolved.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const lineDiscount = resolved.reduce((sum, item) => sum + item.lineDiscount, 0);
    const code = await resolveDiscount(input.discountCode, subtotal - lineDiscount);
    const customer = input.customerId ? await findById<Customer>("customers", input.customerId) : null;
    if (input.customerId && !customer) throw new TRPCError({ code: "NOT_FOUND", message: "The selected customer was not found." });
    const taxableSubtotal = Math.max(0, subtotal - lineDiscount - input.discount - code.amount);
    const tax = taxFor(taxableSubtotal, shop);
    const total = tax.grossAmount;
    const payments = input.payments?.length ? input.payments : input.paymentStatus === "paid" ? [{ method: input.paymentMethod, amount: total }] : [];
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidAmount > total + 0.001) throw new TRPCError({ code: "BAD_REQUEST", message: "Payments cannot exceed the order total." });
    const calculatedStatus = paidAmount >= total - 0.001 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

    const sale = await pb.collection("sales").create<Sale>({ saleNumber, clientReference: input.clientReference || null, customerId: customer?.id || null, customerNameSnapshot: customer?.name || input.customerName, customerPhoneSnapshot: customer?.phone || input.customerPhone || null, subtotal: money(subtotal), discount: money(lineDiscount + input.discount + code.amount), vatRate: money(tax.vatRate), vatAmount: money(tax.vatAmount), total: money(total), paidAmount: money(paidAmount), paymentMethod: payments[0]?.method || input.paymentMethod, paymentStatus: calculatedStatus, source: "counter", sessionId: resolvedSession.id, discountCodeId: code.id, discountCodeSnapshot: code.snapshot, createdBy: ctx.user.id });
    for (const item of resolved) {
      await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: money(item.quantity), unitPrice: money(item.unitPrice), lineDiscount: money(item.lineDiscount), lineTotal: money(Math.max(0, item.quantity * item.unitPrice - item.lineDiscount)), assignedTailorId: null, measurementProfileId: null });
      if (item.inventoryItemId && item.stock) {
        const before = Number(item.stock.quantity);
        const quantityDeducted = item.quantity * item.stockPerSaleUnit;
        const after = before - quantityDeducted;
        if (after < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `${item.stock.name} does not have enough stock.` });
        await pb.collection("inventoryItems").update(item.stock.id, { quantity: money(after) });
        await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: item.stock.id, movementType: "sale", quantityChange: money(-quantityDeducted), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: sale.id, createdBy: ctx.user.id, notes: `${saleNumber} · ${money(item.stockPerSaleUnit)} ${item.stock.unit} per sale unit` });
      }
    }
    if (payments.length) for (const payment of payments) await pb.collection("posPayments").create({ saleId: sale.id, method: payment.method, amount: money(payment.amount), reference: payment.reference || null, createdBy: ctx.user.id });
    if (code.id) {
      const current = await findById<DiscountCode>("discountCodes", code.id);
      await pb.collection("discountCodes").update(code.id, { usedCount: (current?.usedCount || 0) + 1 });
    }
    const invoice = await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${sale.id}`, status: calculatedStatus, issuedAt: new Date().toISOString(), notes: `${input.note || "Issued from Odoo-style POS register."}${tax.vatAmount > 0 ? ` VAT ${money(tax.vatRate)}% included.` : ""}` });
    if (input.heldOrderId) await pb.collection("posOrders").update(input.heldOrderId, { status: "paid" });
    await audit(ctx.user.id, "POS_CHECKOUT_COMPLETED", "sale", sale.id, { saleNumber, total, paidAmount, paymentStatus: calculatedStatus, lineCount: resolved.length });
    return { id: sale.id, invoiceId: invoice.id, total, paidAmount, paymentStatus: calculatedStatus, saleNumber };
  }),
  quickCheckout: protectedProcedure.input(quickCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const replay = await existingCheckoutByReference(input.clientReference);
    if (replay) return replay;
    const pb = await pbOrThrow();
    const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
    const saleNumber = `POS-${Date.now()}`;
    const tax = taxFor(input.amount, shop);
    const total = tax.grossAmount;
    const resolvedSession = await resolveSession(input.sessionId, ctx.user.id);
    const customer = input.customerId ? await findById<Customer>("customers", input.customerId) : null;
    if (input.customerId && !customer) throw new TRPCError({ code: "NOT_FOUND", message: "The selected customer was not found." });
    const sale = await pb.collection("sales").create<Sale>({ saleNumber, clientReference: input.clientReference || null, customerId: customer?.id || null, customerNameSnapshot: customer?.name || input.customerName, customerPhoneSnapshot: customer?.phone || input.customerPhone || null, subtotal: money(input.amount), discount: money(0), vatRate: money(tax.vatRate), vatAmount: money(tax.vatAmount), total: money(total), paidAmount: money(total), paymentMethod: input.paymentMethod, paymentStatus: "paid", source: "counter", sessionId: resolvedSession.id, createdBy: ctx.user.id });
    await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: null, inventoryItemId: null, nameSnapshot: "Walk-in sale", quantity: money(1), unitPrice: money(input.amount), lineDiscount: money(0), lineTotal: money(input.amount), assignedTailorId: null, measurementProfileId: null });
    await pb.collection("posPayments").create({ saleId: sale.id, method: input.paymentMethod, amount: money(total), reference: null, createdBy: ctx.user.id });
    const invoice = await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${sale.id}`, status: "paid", issuedAt: new Date().toISOString(), notes: `${input.note || "Walk-in amount sale from POS register."}${tax.vatAmount > 0 ? ` VAT ${money(tax.vatRate)}% added.` : ""}` });
    await audit(ctx.user.id, "POS_WALKIN_CHECKOUT_COMPLETED", "sale", sale.id, { saleNumber, total, paymentMethod: input.paymentMethod });
    return { id: sale.id, invoiceId: invoice.id, total, paidAmount: total, paymentStatus: "paid" as const, saleNumber };
  }),
  returns: router({
    lookup: protectedProcedure.input(z.object({ saleNumber: z.string().trim().min(1).max(60) })).query(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      const sale = await findOne<Sale>("sales", await pbFilter("saleNumber = {:number}", { number: input.saleNumber }));
      if (!sale || sale.returnOfSaleId) return null;
      const items = await pb.collection("saleItems").getFullList<SaleItem>({ filter: await pbFilter("saleId = {:id}", { id: sale.id }) });
      return { sale, items };
    }),
    create: protectedProcedure.input(returnInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id, ctx.user.role);
      const pb = await pbOrThrow();
      const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
      const resolvedSession = await resolveSession(input.sessionId, ctx.user.id);
      const original = await findById<Sale>("sales", input.originalSaleId);
      if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "The original sale was not found." });
      const originalItems = await pb.collection("saleItems").getFullList<SaleItem>({ filter: await pbFilter("saleId = {:id}", { id: original.id }) });
      const priorReturns = await pb.collection("sales").getFullList<Sale>({ filter: await pbFilter("returnOfSaleId = {:id}", { id: original.id }) });
      const priorReturnIds = new Set(priorReturns.map(row => row.id));
      const priorReturnItems = (await pb.collection("saleItems").getFullList<SaleItem>()).filter(item => priorReturnIds.has(item.saleId));
      const lines = input.mode === "items" ? (input.items || []).map(request => {
        const source = originalItems.find(item => item.id === request.saleItemId);
        if (!source) throw new TRPCError({ code: "BAD_REQUEST", message: "A returned item does not belong to the original sale." });
        const alreadyReturned = priorReturnItems.filter(item => item.nameSnapshot === source.nameSnapshot).reduce((sum, item) => sum + Math.abs(Number(item.quantity)), 0);
        if (alreadyReturned + request.quantity > Number(source.quantity) + 0.001) throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot return more ${source.nameSnapshot} than was sold.` });
        const originalQuantity = Math.max(Number(source.quantity), 0.001);
        return { source, quantity: request.quantity, lineTotal: request.quantity * (Number(source.lineTotal) / originalQuantity) };
      }) : [];
      const originalGross = Math.max(0, Number(original.total));
      const alreadyRefundedGross = priorReturns.reduce((sum, row) => sum + Math.abs(Number(row.total)), 0);
      const requestedGross = input.mode === "amount" ? Number(input.amount || 0) : lines.reduce((sum, line) => sum + line.lineTotal, 0) * (1 + Number(original.vatRate || 0) / 100);
      if (requestedGross <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The refund amount must be greater than zero." });
      if (alreadyRefundedGross + requestedGross > originalGross + 0.001) throw new TRPCError({ code: "BAD_REQUEST", message: "The refund cannot exceed the remaining amount on the original sale." });
      if (input.mode === "amount" && !input.reason?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a reason for an amount-based refund." });
      const vatRate = Number(original.vatRate || 0);
      const netTotal = input.mode === "amount" ? requestedGross / (1 + vatRate / 100) : lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const vatAmount = requestedGross - netTotal;
      const saleNumber = `RET-${Date.now()}`;
      const sale = await pb.collection("sales").create<Sale>({ saleNumber, customerId: original.customerId, customerNameSnapshot: original.customerNameSnapshot, customerPhoneSnapshot: original.customerPhoneSnapshot, subtotal: money(-netTotal), discount: 0, vatRate: money(vatRate), vatAmount: money(-vatAmount), total: money(-requestedGross), paidAmount: money(-requestedGross), paymentMethod: input.paymentMethod, paymentStatus: "paid", source: "counter", sessionId: resolvedSession.id, returnOfSaleId: original.id, returnMode: input.mode, returnReason: input.reason || input.note || null, createdBy: ctx.user.id });
      if (input.mode === "items") for (const line of lines) {
        await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: line.source.serviceId, inventoryItemId: line.source.inventoryItemId, nameSnapshot: line.source.nameSnapshot, quantity: money(-line.quantity), unitPrice: money(Number(line.source.unitPrice)), lineDiscount: money(Number(line.source.lineDiscount)), lineTotal: money(-line.lineTotal), assignedTailorId: line.source.assignedTailorId, measurementProfileId: line.source.measurementProfileId });
        if (line.source.inventoryItemId) {
          const stock = await findById<InventoryItem>("inventoryItems", line.source.inventoryItemId);
          if (stock) {
            const before = Number(stock.quantity);
            const after = before + line.quantity;
            await pb.collection("inventoryItems").update(stock.id, { quantity: money(after) });
            await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: stock.id, movementType: "return", quantityChange: money(line.quantity), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: sale.id, createdBy: ctx.user.id, notes: `${saleNumber} · return of ${original.saleNumber}` });
          }
        }
      } else {
        await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: null, inventoryItemId: null, nameSnapshot: `Refund · ${input.reason}`, quantity: 1, unitPrice: money(netTotal), lineDiscount: 0, lineTotal: money(-netTotal), assignedTailorId: null, measurementProfileId: null });
      }
      await pb.collection("posPayments").create({ saleId: sale.id, method: input.paymentMethod, amount: money(-requestedGross), reference: `Refund of ${original.saleNumber}${input.reason ? ` · ${input.reason}` : ""}`, createdBy: ctx.user.id });
      const invoice = await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${sale.id}`, status: "paid", issuedAt: new Date().toISOString(), notes: input.note || `${input.mode === "amount" ? "Amount refund" : "Item return"} of ${original.saleNumber}${input.reason ? ` · ${input.reason}` : ""}.` });
      const result = { saleId: sale.id, invoiceId: invoice.id, saleNumber, total: -requestedGross };
      await audit(ctx.user.id, "POS_RETURN_COMPLETED", "sale", result.saleId, { originalSaleId: input.originalSaleId, total: result.total });
      return result;
    }),
  }),
  tailoringCheckout: protectedProcedure.input(tailoringCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const pb = await pbOrThrow();
    const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
    const orderNumber = `TO-${Date.now()}`;
    const saleNumber = `POS-TO-${Date.now()}`;
    const paymentStatus = input.paymentAmount >= input.orderPrice - 0.001 ? "paid" : ("partial" as const);
    const paymentTax = taxFromGross(input.paymentAmount, shop);
    await resolveSession(input.sessionId, ctx.user.id);
    const customer = await findById<Customer>("customers", input.customerId);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Choose a valid customer before creating a tailoring order." });
    const measurement = await findById<MeasurementProfile>("measurementProfiles", input.measurementProfileId);
    if (!measurement || measurement.customerId !== customer.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a saved measurement version belonging to this customer." });
    const tailor = await findById<StaffProfile>("staffProfiles", input.assignedTailorId);
    if (!tailor?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active tailor for this production order." });
    const order = await pb.collection("tailoringOrders").create({ orderNumber, customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: input.garmentType, quantity: input.quantity, dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null, price: money(input.orderPrice), customerSuppliedFabric: input.customerSuppliedFabric, fabricNotes: input.fabricNotes || null, status: "confirmed", notes: input.notes || null, productionNotes: input.productionNotes || null, createdBy: ctx.user.id });
    const sale = await pb.collection("sales").create<Sale>({ saleNumber, customerId: customer.id, customerNameSnapshot: customer.name, customerPhoneSnapshot: customer.phone || null, subtotal: money(paymentTax.netAmount), discount: 0, vatRate: money(paymentTax.vatRate), vatAmount: money(paymentTax.vatAmount), total: money(input.paymentAmount), paidAmount: money(input.paymentAmount), paymentMethod: input.paymentMethod, paymentStatus, source: "tailoring", sessionId: input.sessionId, createdBy: ctx.user.id });
    await pb.collection("posPayments").create({ saleId: sale.id, method: input.paymentMethod, amount: money(input.paymentAmount), reference: `${orderNumber} initial payment`, createdBy: ctx.user.id });
    await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: null, inventoryItemId: null, nameSnapshot: `${input.garmentType} tailoring order · ${paymentStatus === "paid" ? "full payment" : "deposit"}`, quantity: 1, unitPrice: money(paymentTax.netAmount), lineDiscount: 0, lineTotal: money(paymentTax.netAmount), assignedTailorId: tailor.id, measurementProfileId: measurement.id });
    const invoice = await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${sale.id}`, status: paymentStatus, issuedAt: new Date().toISOString(), notes: `${orderNumber} · ${input.garmentType} · quoted ${money(input.orderPrice)} BHD incl. VAT · ${paymentStatus === "paid" ? "full payment" : "deposit"} collected from POS.${input.customerSuppliedFabric ? " Customer supplied fabric." : " Shop fabric."}` });
    await audit(ctx.user.id, "POS_TAILORING_CHECKOUT_COMPLETED", "tailoringOrder", order.id, { orderNumber, saleNumber, paymentAmount: input.paymentAmount, orderPrice: input.orderPrice, paymentStatus });
    return { orderId: order.id, saleId: sale.id, invoiceId: invoice.id, orderNumber, saleNumber, total: input.paymentAmount, paymentStatus };
  }),
});
