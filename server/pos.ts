import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, customRoles, customers, inventoryItems, invoices, measurementProfiles, saleItems, sales, services, shopSettings, staffProfiles, stockMovements, tailoringOrders, userBusinessRoles, userCustomRoles } from "../drizzle/schema";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const money = (value: number) => value.toFixed(3);
export const calculateCheckoutTotal = (items: Array<{ quantity: number; unitPrice: number }>, discount: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return { subtotal, total: Math.max(0, subtotal - discount) };
};

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}

async function requireCounterAccess(userId: number, frameworkRole: "user" | "admin") {
  const db = await dbOrThrow();
  let role = (await db.select().from(userBusinessRoles).where(eq(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!role) {
    await db.insert(userBusinessRoles).values({ userId, role: frameworkRole === "admin" ? "admin" : "sales", isActive: true });
    role = (await db.select().from(userBusinessRoles).where(eq(userBusinessRoles.userId, userId)).limit(1))[0];
  }
  if (!role?.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (role.role === "admin") return;
  const assignment = (await db.select().from(userCustomRoles).where(eq(userCustomRoles.userId, userId)).limit(1))[0];
  if (assignment) {
    const customRole = (await db.select().from(customRoles).where(eq(customRoles.id, assignment.customRoleId)).limit(1))[0];
    const permissions = Array.isArray(customRole?.permissionsJson) ? customRole.permissionsJson.filter((value): value is string => typeof value === "string") : [];
    if (!assignment.isActive || !customRole?.isActive || !permissions.includes("sales")) throw new TRPCError({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to complete counter sales." });
    return;
  }
  if (role.role !== "sales") throw new TRPCError({ code: "FORBIDDEN", message: "Your role is not permitted to complete counter sales." });
}

const checkoutInput = z.object({
  customerId: z.number().int().optional(),
  customerName: z.string().min(1).max(160),
  customerPhone: z.string().max(50).optional(),
  discount: z.number().min(0),
  paymentMethod: z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]),
  items: z.array(z.object({ serviceId: z.number().int().optional(), inventoryItemId: z.number().int().optional(), name: z.string().min(1).max(160), quantity: z.number().positive(), unitPrice: z.number().nonnegative() }).refine(item => Boolean(item.serviceId || item.inventoryItemId), "Choose an inventory item or catalog item.")).min(1),
});

const tailoringCheckoutInput = z.object({
  customerId: z.number().int().positive(),
  measurementProfileId: z.number().int().positive(),
  assignedTailorId: z.number().int().positive(),
  garmentType: z.string().trim().min(2).max(80),
  quantity: z.number().int().min(1).max(20),
  dueDate: z.string().optional(),
  orderPrice: z.number().positive(),
  paymentAmount: z.number().positive(),
  paymentMethod: z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]),
  notes: z.string().max(3000),
  productionNotes: z.string().max(3000),
}).superRefine((value, ctx) => {
  if (value.paymentAmount > value.orderPrice) ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: "The payment collected cannot exceed the quoted order price." });
});

export const posRouter = router({
  checkout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const db = await dbOrThrow();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const saleNumber = `POS-${Date.now()}`;
    const checkout = await db.transaction(async tx => {
      const resolved = [] as Array<{ serviceId: number | null; inventoryItemId: number | null; name: string; quantity: number; unitPrice: number; stockPerSaleUnit: number; stock: { id: number; name: string; quantity: string; unit: string } | null }>;
      for (const item of input.items) {
        if (item.inventoryItemId && !item.serviceId) {
          const stock = (await tx.select().from(inventoryItems).where(eq(inventoryItems.id, item.inventoryItemId)).limit(1))[0];
          if (!stock?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "This inventory item is no longer available at POS." });
          resolved.push({ serviceId: null, inventoryItemId: stock.id, name: stock.name, quantity: item.quantity, unitPrice: item.unitPrice, stockPerSaleUnit: 1, stock });
          continue;
        }
        const catalogItem = (await tx.select().from(services).where(eq(services.id, item.serviceId!)).limit(1))[0];
        if (!catalogItem || !catalogItem.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: `${item.name} is no longer available at POS.` });
        if (item.inventoryItemId && item.inventoryItemId !== catalogItem.inventoryItemId) throw new TRPCError({ code: "BAD_REQUEST", message: `${catalogItem.name} no longer matches the selected inventory item.` });
        const stock = catalogItem.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq(inventoryItems.id, catalogItem.inventoryItemId)).limit(1))[0] : null;
        if (catalogItem.inventoryItemId && !stock?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: `${catalogItem.name} has no active inventory link.` });
        resolved.push({ serviceId: catalogItem.id, inventoryItemId: catalogItem.inventoryItemId, name: catalogItem.name, quantity: item.quantity, unitPrice: Number(catalogItem.unitPrice), stockPerSaleUnit: catalogItem.inventoryItemId ? Number(catalogItem.defaultFabricMeters || 1) : 0, stock: stock || null });
      }
      const { subtotal, total } = calculateCheckoutTotal(resolved, input.discount);
      const saleResult = await tx.insert(sales).values({ saleNumber, customerId: input.customerId, customerNameSnapshot: input.customerName, customerPhoneSnapshot: input.customerPhone || null, subtotal: money(subtotal), discount: money(input.discount), total: money(total), paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, createdBy: ctx.user.id });
      const saleHeader = Array.isArray(saleResult) ? saleResult[0] : saleResult;
      const saleId = Number((saleHeader as { insertId?: number }).insertId || 0);
      if (!saleId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The sale header could not be created." });
      for (const item of resolved) {
        await tx.insert(saleItems).values({ saleId, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: money(item.quantity), unitPrice: money(item.unitPrice), lineTotal: money(item.quantity * item.unitPrice), assignedTailorId: null, measurementProfileId: null });
        if (item.inventoryItemId && item.stock) {
          const before = Number(item.stock.quantity);
          const quantityDeducted = item.quantity * item.stockPerSaleUnit;
          const after = before - quantityDeducted;
          if (after < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `${item.stock.name} does not have enough stock.` });
          await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq(inventoryItems.id, item.stock.id));
          await tx.insert(stockMovements).values({ inventoryItemId: item.stock.id, movementType: "sale", quantityChange: money(-quantityDeducted), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: saleId, createdBy: ctx.user.id, notes: `${saleNumber} · ${money(item.stockPerSaleUnit)} ${item.stock.unit} per sale unit` });
        }
      }
      const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: input.paymentStatus, notes: "Issued from touch POS." });
      const invoiceHeader = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult;
      const invoiceId = Number((invoiceHeader as { insertId?: number }).insertId || 0);
      if (!invoiceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The invoice could not be created." });
      return { saleId, invoiceId, total, lineCount: resolved.length };
    });
    await db.insert(auditLogs).values({ actorId: ctx.user.id, action: "POS_CHECKOUT_COMPLETED", entityType: "sale", entityId: checkout.saleId, detailsJson: JSON.stringify({ saleNumber, total: checkout.total, lineCount: checkout.lineCount }) });
    return { id: checkout.saleId, invoiceId: checkout.invoiceId, total: checkout.total, saleNumber };
  }),
  tailoringCheckout: protectedProcedure.input(tailoringCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const db = await dbOrThrow();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const orderNumber = `TO-${Date.now()}`;
    const saleNumber = `POS-TO-${Date.now()}`;
    const paymentStatus = input.paymentAmount >= input.orderPrice ? "paid" : "partial" as const;
    const transaction = await db.transaction(async tx => {
      const customer = (await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Choose a valid customer before creating a tailoring order." });
      const measurement = (await tx.select().from(measurementProfiles).where(eq(measurementProfiles.id, input.measurementProfileId)).limit(1))[0];
      if (!measurement || measurement.customerId !== customer.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a saved measurement version belonging to this customer." });
      const tailor = (await tx.select().from(staffProfiles).where(eq(staffProfiles.id, input.assignedTailorId)).limit(1))[0];
      if (!tailor?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active tailor for this production order." });

      const orderResult = await tx.insert(tailoringOrders).values({
        orderNumber,
        customerId: customer.id,
        measurementProfileId: measurement.id,
        assignedTailorId: tailor.id,
        garmentType: input.garmentType,
        quantity: input.quantity,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        price: money(input.orderPrice),
        status: "confirmed",
        notes: input.notes || null,
        productionNotes: input.productionNotes || null,
        createdBy: ctx.user.id,
      });
      const orderHeader = Array.isArray(orderResult) ? orderResult[0] : orderResult;
      const orderId = Number((orderHeader as { insertId?: number }).insertId || 0);
      if (!orderId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring order could not be created." });

      const saleResult = await tx.insert(sales).values({
        saleNumber,
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        customerPhoneSnapshot: customer.phone || null,
        subtotal: money(input.paymentAmount),
        discount: "0.000",
        total: money(input.paymentAmount),
        paymentMethod: input.paymentMethod,
        paymentStatus,
        source: "tailoring",
        createdBy: ctx.user.id,
      });
      const saleHeader = Array.isArray(saleResult) ? saleResult[0] : saleResult;
      const saleId = Number((saleHeader as { insertId?: number }).insertId || 0);
      if (!saleId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring payment could not be recorded." });

      const paymentLabel = paymentStatus === "paid" ? "full payment" : "deposit";
      await tx.insert(saleItems).values({
        saleId,
        serviceId: null,
        inventoryItemId: null,
        nameSnapshot: `${input.garmentType} tailoring order · ${paymentLabel}`,
        quantity: "1.000",
        unitPrice: money(input.paymentAmount),
        lineTotal: money(input.paymentAmount),
        assignedTailorId: tailor.id,
        measurementProfileId: measurement.id,
      });
      const invoiceResult = await tx.insert(invoices).values({
        saleId,
        invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`,
        status: paymentStatus,
        notes: `${orderNumber} · ${input.garmentType} · quoted ${money(input.orderPrice)} BHD · ${paymentLabel} collected from POS.`,
      });
      const invoiceHeader = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult;
      const invoiceId = Number((invoiceHeader as { insertId?: number }).insertId || 0);
      if (!invoiceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring invoice could not be created." });
      return { orderId, saleId, invoiceId };
    });
    await db.insert(auditLogs).values({ actorId: ctx.user.id, action: "POS_TAILORING_CHECKOUT_COMPLETED", entityType: "tailoringOrder", entityId: transaction.orderId, detailsJson: JSON.stringify({ orderNumber, saleNumber, paymentAmount: input.paymentAmount, orderPrice: input.orderPrice, paymentStatus }) });
    return { ...transaction, orderNumber, saleNumber, total: input.paymentAmount, paymentStatus };
  }),
});
