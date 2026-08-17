import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  businessRoleValues,
  tailoringOrderStatusValues,
  type Attendance,
  type AuditLog,
  type BusinessRole,
  type Customer,
  type CustomerBalanceDelivery,
  type CustomRole,
  type Id,
  type Invoice,
  type InvoiceDelivery,
  type InventoryItem,
  type MeasurementProfile,
  type PendingAccessRequest,
  type PerformanceRecord,
  type SalaryPayout,
  type Sale,
  type SaleItem,
  type Service,
  type ShopSettings,
  type StaffAccessInvite,
  type StaffProfile,
  type StockMovement,
  type TailoringOrder,
  type User,
  type UserBusinessRole,
  type UserCustomRole,
} from "@shared/pb-types";
import { protectedProcedure, router } from "./_core/trpc";
import { findById, findOne, pbFilter, pbOrThrow, upsert } from "./pb-helpers";

const adminRoles: BusinessRole[] = ["admin"];
const salesRoles: BusinessRole[] = ["admin", "sales"];
const inventoryRoles: BusinessRole[] = ["admin", "inventory"];
const payrollRoles: BusinessRole[] = ["admin", "payroll"];
const tailoringRoles: BusinessRole[] = ["admin", "sales", "tailor"];
const staffDirectoryRoles: BusinessRole[] = ["admin", "payroll", "sales", "tailor"];

export const customPermissionValues = ["dashboard", "customers", "sales", "inventory", "payroll", "production"] as const;
export type CustomPermission = (typeof customPermissionValues)[number];
const legacyPermissions: Record<BusinessRole, CustomPermission[]> = {
  admin: ["dashboard", "customers", "sales", "inventory", "payroll", "production"],
  sales: ["dashboard", "customers", "sales"],
  tailor: ["customers", "production"],
  inventory: ["inventory"],
  payroll: ["payroll"],
};
export const customRoleCanAccess = (permissions: string[], allowed: BusinessRole[]) =>
  allowed.some(role => legacyPermissions[role].some(permission => permissions.includes(permission)));

const three = (value: number) => Math.round(value * 1000) / 1000;
const idSchema = z.string().min(1);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dashboardRange = z.enum(["today", "7d", "30d", "90d", "all", "custom"]);
export const getDashboardRangeStart = (range: z.infer<typeof dashboardRange>, now = new Date()) => {
  const start = new Date(now);
  if (range === "all") return null;
  if (range === "today") { start.setHours(0, 0, 0, 0); return start; }
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "90d") start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return start;
};
export const getCustomDashboardRange = (startDate: string, endDate: string) => ({ start: new Date(`${startDate}T00:00:00.000Z`), end: new Date(`${endDate}T23:59:59.999Z`) });
const dashboardInput = z.object({ range: dashboardRange, startDate: dateStr.optional(), endDate: dateStr.optional() }).superRefine((value, ctx) => {
  if (value.range === "custom" && (!value.startDate || !value.endDate)) ctx.addIssue({ code: "custom", message: "Choose both a start and end date for a custom period." });
  if (value.range === "custom" && value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The custom period end date must be on or after its start date." });
});

const salesSource = z.enum(["counter", "manual", "tailoring"]);
const salesHistoryInput = z.object({ search: z.string().max(160).optional(), source: salesSource.optional(), paymentStatus: z.enum(["paid", "partial", "unpaid"]).optional(), startDate: dateStr.optional(), endDate: dateStr.optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
const invoiceListInput = z.object({ search: z.string().max(160).optional(), status: z.enum(["paid", "partial", "unpaid"]).optional(), source: salesSource.optional(), paymentMethod: z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]).optional(), startDate: dateStr.optional(), endDate: dateStr.optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
const manualSaleInput = z.object({ customerId: idSchema.optional(), customerName: z.string().trim().min(2).max(160), customerPhone: z.string().trim().max(50), description: z.string().trim().min(2).max(160), quantity: z.number().positive().max(999), unitPrice: z.number().positive().max(1000000), discount: z.number().min(0).max(1000000), paymentMethod: z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z.enum(["paid", "partial", "unpaid"]), notes: z.string().max(2000) }).superRefine((value, ctx) => {
  if (value.discount > value.quantity * value.unitPrice) ctx.addIssue({ code: "custom", path: ["discount"], message: "Discount cannot exceed the sale subtotal." });
});
const monthInput = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid report month.") });
export const getMonthWindow = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthIndex - 1, 1)), end: new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)) };
};

/**
 * RBAC gate. PocketBase has no server-side transactions reachable from this
 * Node client, so the auto-provision-on-first-access path below (creating a
 * userBusinessRoles row) is a plain sequential write like everything else in
 * this file — acceptable for a single shop's low write concurrency.
 */
async function access(userId: Id, frameworkRole: "user" | "admin", allowed: BusinessRole[]) {
  const pb = await pbOrThrow();
  let record = await findOne<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:userId}", { userId }));
  if (!record) {
    if (frameworkRole !== "admin") {
      const request = await findOne<PendingAccessRequest>("pendingAccessRequests", await pbFilter("userId = {:userId}", { userId }));
      const message = request?.status === "rejected" ? "Your ERP access request was not approved. Contact the shop owner." : "Your ERP access request is awaiting owner approval.";
      throw new TRPCError({ code: "FORBIDDEN", message });
    }
    record = await pb.collection("userBusinessRoles").create<UserBusinessRole>({ userId, role: "admin", isActive: true });
  }
  if (!record.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (record.role === "admin") return record.role as string;
  const assignment = await findOne<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:userId}", { userId }));
  if (assignment) {
    const role = await findById<CustomRole>("customRoles", assignment.customRoleId);
    const permissions = Array.isArray(role?.permissionsJson) ? role.permissionsJson.filter((value): value is string => typeof value === "string") : [];
    if (!assignment.isActive || !role?.isActive || !customRoleCanAccess(permissions, allowed)) throw new TRPCError({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to perform this action." });
    return `custom:${role.name}`;
  }
  if (allowed.includes(record.role)) return record.role as string;
  throw new TRPCError({ code: "FORBIDDEN", message: "Your assigned role is not permitted to perform this action." });
}

async function audit(userId: Id, action: string, entityType: string, entityId?: Id | null, details?: unknown) {
  const pb = await pbOrThrow();
  await pb.collection("auditLogs").create<AuditLog>({ actorId: userId, action, entityType, entityId: entityId ?? null, detailsJson: details ? JSON.stringify(details) : null, createdAt: new Date().toISOString() });
}

const customerInput = z.object({ name: z.string().min(2).max(160), phone: z.string().min(4).max(50), email: z.string().email().or(z.literal("")), address: z.string().max(1000), notes: z.string().max(3000), preferredContact: z.string().max(40) });
export const tailoringOrderStatuses = tailoringOrderStatusValues;
const tailoringStatus = z.enum(tailoringOrderStatuses);
export const tailoringRelationError = (customerId: Id, measurementCustomerId: Id | null | undefined, tailorActive: boolean | null | undefined) => {
  if (measurementCustomerId !== customerId) return "measurement" as const;
  if (tailorActive === false) return "tailor" as const;
  return null;
};
export const canMoveTailoringOrder = (from: (typeof tailoringOrderStatuses)[number], to: (typeof tailoringOrderStatuses)[number]) => {
  if (from === to) return true;
  const next: Record<(typeof tailoringOrderStatuses)[number], (typeof tailoringOrderStatuses)[number][]> = {
    draft: ["confirmed", "cancelled"], confirmed: ["cutting", "cancelled"], cutting: ["stitching", "cancelled"],
    stitching: ["fitting", "ready", "cancelled"], fitting: ["stitching", "ready", "cancelled"],
    ready: ["handed_over", "stitching", "cancelled"], handed_over: [], cancelled: [],
  };
  return next[from].includes(to);
};
const tailoringOrderInput = z.object({ customerId: idSchema, measurementProfileId: idSchema.optional(), assignedTailorId: idSchema.optional(), garmentType: z.string().min(2).max(80), quantity: z.number().int().min(1).max(20), dueDate: z.string().optional(), price: z.number().min(0), customerSuppliedFabric: z.boolean().default(false), fabricNotes: z.string().max(2000).optional(), notes: z.string().max(3000), productionNotes: z.string().max(3000) });

export const erpRouter = router({
  shop: router({
    get: protectedProcedure.query(async () => {
      const pb = await pbOrThrow();
      const rows = await pb.collection("shopSettings").getFullList<ShopSettings>();
      return rows[0] || null;
    }),
    save: protectedProcedure.input(z.object({ shopName: z.string().min(2), arabicShopName: z.string(), crNumber: z.string(), currency: z.string(), phone: z.string(), email: z.string(), address: z.string(), invoicePrefix: z.string().min(1).max(16), vatEnabled: z.boolean().default(false), vatRate: z.number().min(0).max(100).default(10), vatNumber: z.string().max(80).optional() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const values = { ...input, vatRate: three(input.vatRate), vatNumber: input.vatNumber || null, updatedBy: ctx.user.id };
      const existing = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
      const saved = existing ? await pb.collection("shopSettings").update<ShopSettings>(existing.id, values) : await pb.collection("shopSettings").create<ShopSettings>(values);
      await audit(ctx.user.id, "SHOP_SETTINGS_SAVED", "shopSettings", saved.id);
      return { success: true };
    }),
  }),

  dashboard: protectedProcedure.input(dashboardInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory", "tailor", "payroll"]);
    const pb = await pbOrThrow();
    const range = input?.range || "30d";
    const customRange = range === "custom" && input?.startDate && input?.endDate ? getCustomDashboardRange(input.startDate, input.endDate) : null;
    const rangeStart = customRange?.start || getDashboardRangeStart(range);
    const today = getDashboardRangeStart("today")!;
    const weekStart = getDashboardRangeStart("7d")!;
    const monthStart = getDashboardRangeStart("30d")!;

    const since = (start: Date) => pbFilter("createdAt >= {:start}", { start: start.toISOString() });
    const rangeFilter = customRange ? await pbFilter("createdAt >= {:start} && createdAt <= {:end}", { start: customRange.start.toISOString(), end: customRange.end.toISOString() }) : rangeStart ? await since(rangeStart) : "";

    const [customerCount, inventoryItems, staffActiveCount, rangeSales, todaySales, weekSales, monthSales, allAttendance, allSaleItems] = await Promise.all([
      pb.collection("customers").getList(1, 1).then(r => r.totalItems),
      pb.collection("inventoryItems").getFullList<InventoryItem>({ filter: "isActive = true", sort: "quantity" }),
      pb.collection("staffProfiles").getList(1, 1, { filter: "isActive = true" }).then(r => r.totalItems),
      pb.collection("sales").getFullList<Sale>(rangeFilter ? { filter: rangeFilter } : {}),
      pb.collection("sales").getFullList<Sale>({ filter: await since(today) }),
      pb.collection("sales").getFullList<Sale>({ filter: await since(weekStart) }),
      pb.collection("sales").getFullList<Sale>({ filter: await since(monthStart) }),
      pb.collection("attendance").getFullList<Attendance>(),
      pb.collection("saleItems").getFullList<SaleItem>(),
    ]);

    const low = inventoryItems.filter(item => item.quantity <= item.minThreshold).slice(0, 8);
    const sum = (rows: Sale[]) => rows.reduce((total, sale) => total + Number(sale.total), 0);
    const sortedRangeSales = [...rangeSales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const revenueByDayMap = new Map<string, number>();
    for (const sale of sortedRangeSales) {
      const day = sale.createdAt.slice(0, 10);
      revenueByDayMap.set(day, (revenueByDayMap.get(day) || 0) + Number(sale.total));
    }
    const revenueByDay = Array.from(revenueByDayMap.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([day, revenue]) => ({ day, revenue }));
    const rangeIds = new Set(rangeSales.map(sale => sale.id));
    const topServicesMap = new Map<string, { quantity: number; revenue: number }>();
    for (const item of allSaleItems) if (rangeIds.has(item.saleId)) {
      const current = topServicesMap.get(item.nameSnapshot) || { quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity);
      current.revenue += Number(item.lineTotal);
      topServicesMap.set(item.nameSnapshot, current);
    }
    const topServices = Array.from(topServicesMap.entries()).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 5).map(([name, values]) => ({ name, ...values }));
    const todayKey = today.toISOString().slice(0, 10);
    const attendanceSummary = allAttendance.filter(row => row.workDate.slice(0, 10) === todayKey).reduce((summary, row) => ({ ...summary, [row.status]: (summary[row.status] || 0) + 1 }), { present: 0, absent: 0, leave: 0, half_day: 0 } as Record<string, number>);

    const total = sum(rangeSales);
    const saleCount = rangeSales.length;
    return {
      range, customerCount, inventoryCount: inventoryItems.length, totalSales: total, saleCount,
      averageOrderValue: saleCount ? total / saleCount : 0, todayRevenue: sum(todaySales), weekRevenue: sum(weekSales), monthRevenue: sum(monthSales),
      lowStock: low, recentSales: sortedRangeSales.slice(0, 8), revenueByDay, topServices,
      staff: { activeCount: staffActiveCount, attendance: attendanceSummary },
    };
  }),

  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
      const pb = await pbOrThrow();
      const search = input?.search?.trim();
      const filter = search ? await pbFilter("name ~ {:search} || phone ~ {:search}", { search }) : "";
      return (await pb.collection("customers").getFullList<Customer>({ filter, sort: "-createdAt" })).slice(0, 20);
    }),
    create: protectedProcedure.input(customerInput).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const created = await pb.collection("customers").create<Customer>({ ...input, email: input.email || null, address: input.address || null, notes: input.notes || null });
      await audit(ctx.user.id, "CUSTOMER_CREATED", "customer", created.id);
      return { id: created.id };
    }),
    update: protectedProcedure.input(customerInput.extend({ id: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      await pb.collection("customers").update(input.id, { ...input, email: input.email || null, address: input.address || null, notes: input.notes || null });
      await audit(ctx.user.id, "CUSTOMER_UPDATED", "customer", input.id);
      return { success: true };
    }),
    balance: protectedProcedure.input(z.object({ customerId: idSchema })).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const customer = await findById<Customer>("customers", input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      const rows = (await pb.collection("sales").getFullList<Sale>({ filter: await pbFilter("customerId = {:id}", { id: input.customerId }), sort: "-createdAt" })).slice(0, 500);
      const balance = rows.reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paidAmount)), 0);
      return { customer, balance, openInvoices: rows.filter(sale => Number(sale.total) - Number(sale.paidAmount) > 0.001).map(sale => ({ saleNumber: sale.saleNumber, total: Number(sale.total), paidAmount: Number(sale.paidAmount), outstanding: Number(sale.total) - Number(sale.paidAmount), createdAt: sale.createdAt })) };
    }),
    sendBalance: protectedProcedure.input(z.object({ customerId: idSchema, channel: z.enum(["email", "whatsapp", "share"]), recipient: z.string().trim().max(320).optional(), message: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const customer = await findById<Customer>("customers", input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      const recipient = input.recipient || (input.channel === "email" ? customer.email || undefined : customer.phone || undefined);
      if (!recipient) throw new TRPCError({ code: "BAD_REQUEST", message: `Add a ${input.channel === "email" ? "customer email" : "customer phone number"} before sending the balance.` });
      const rows = (await pb.collection("sales").getFullList<Sale>({ filter: await pbFilter("customerId = {:id}", { id: input.customerId }) })).slice(0, 500);
      const balance = rows.reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paidAmount)), 0);
      const message = input.message || `Dear ${customer.name}, your current outstanding balance is ${balance.toFixed(3)} BHD.`;
      const created = await pb.collection("customerBalanceDeliveries").create<CustomerBalanceDelivery>({ customerId: customer.id, channel: input.channel, recipient, message, status: "prepared", createdBy: ctx.user.id });
      await audit(ctx.user.id, "CUSTOMER_BALANCE_DELIVERY_PREPARED", "customer", customer.id, { channel: input.channel, recipient, balance });
      return { id: created.id, channel: input.channel, recipient, balance, message };
    }),
    measurements: protectedProcedure.input(z.object({ customerId: idSchema })).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
      const pb = await pbOrThrow();
      return pb.collection("measurementProfiles").getFullList<MeasurementProfile>({ filter: await pbFilter("customerId = {:id}", { id: input.customerId }), sort: "-version" });
    }),
    addMeasurement: protectedProcedure.input(z.object({ customerId: idSchema, measurements: z.record(z.string(), z.string()), fitPreference: z.string(), collarStyle: z.string(), pocketStyle: z.string(), notes: z.string(), effectiveDate: z.string() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, ["admin", "tailor", "sales"]);
      const pb = await pbOrThrow();
      const latest = (await pb.collection("measurementProfiles").getFullList<MeasurementProfile>({ filter: await pbFilter("customerId = {:id}", { id: input.customerId }), sort: "-version" }))[0];
      const created = await pb.collection("measurementProfiles").create<MeasurementProfile>({ customerId: input.customerId, measurementsJson: input.measurements, fitPreference: input.fitPreference, collarStyle: input.collarStyle, pocketStyle: input.pocketStyle, notes: input.notes, version: (latest?.version || 0) + 1, effectiveDate: new Date(input.effectiveDate).toISOString(), createdBy: ctx.user.id });
      await audit(ctx.user.id, "MEASUREMENT_VERSION_CREATED", "measurementProfile", created.id);
      return { id: created.id };
    }),
  }),

  inventory: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory"]);
      const pb = await pbOrThrow();
      return pb.collection("inventoryItems").getFullList<InventoryItem>({ filter: "isActive = true", sort: "name" });
    }),
    create: protectedProcedure.input(z.object({ code: z.string().min(1), name: z.string().min(2), category: z.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z.string(), widthInches: z.number().optional(), unit: z.string().min(1), minThreshold: z.number().min(0), costPerUnit: z.number().min(0), openingQuantity: z.number().min(0) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, inventoryRoles);
      const pb = await pbOrThrow();
      const created = await pb.collection("inventoryItems").create<InventoryItem>({ ...input, color: input.color || null, widthInches: input.widthInches ?? null, quantity: three(input.openingQuantity), minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit), isActive: true });
      if (input.openingQuantity) await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: created.id, movementType: "opening", quantityChange: three(input.openingQuantity), quantityBefore: 0, quantityAfter: three(input.openingQuantity), createdBy: ctx.user.id, notes: "Opening balance" });
      await audit(ctx.user.id, "INVENTORY_CREATED", "inventoryItem", created.id);
      return { id: created.id };
    }),
    update: protectedProcedure.input(z.object({ id: idSchema, code: z.string().min(1), name: z.string().min(2), category: z.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z.string(), widthInches: z.number().optional(), unit: z.string().min(1), minThreshold: z.number().min(0), costPerUnit: z.number().min(0) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, inventoryRoles);
      const pb = await pbOrThrow();
      const item = await findById<InventoryItem>("inventoryItems", input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found." });
      await pb.collection("inventoryItems").update(input.id, { code: input.code, name: input.name, category: input.category, color: input.color || null, widthInches: input.widthInches ?? null, unit: input.unit, minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit) });
      await audit(ctx.user.id, "INVENTORY_UPDATED", "inventoryItem", input.id, input);
      return { success: true };
    }),
    adjust: protectedProcedure.input(z.object({ inventoryItemId: idSchema, quantityChange: z.number().refine(value => value !== 0), notes: z.string().max(1000) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, inventoryRoles);
      const pb = await pbOrThrow();
      const item = await findById<InventoryItem>("inventoryItems", input.inventoryItemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found." });
      const before = Number(item.quantity);
      const after = before + input.quantityChange;
      if (after < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Stock cannot drop below zero." });
      await pb.collection("inventoryItems").update(item.id, { quantity: three(after) });
      await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: item.id, movementType: "adjustment", quantityChange: three(input.quantityChange), quantityBefore: three(before), quantityAfter: three(after), createdBy: ctx.user.id, notes: input.notes || null });
      await audit(ctx.user.id, "STOCK_ADJUSTED", "inventoryItem", item.id, input);
      return { quantity: after };
    }),
  }),

  services: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const [services, inventoryItems] = await Promise.all([
        pb.collection("services").getFullList<Service>({ filter: "isActive = true", sort: "name" }),
        pb.collection("inventoryItems").getFullList<InventoryItem>(),
      ]);
      const inventoryById = new Map(inventoryItems.map(item => [item.id, item]));
      return services.map(service => ({ ...service, inventory: service.inventoryItemId ? (() => { const item = inventoryById.get(service.inventoryItemId!); return item ? { id: item.id, code: item.code, name: item.name, quantity: item.quantity, unit: item.unit, isActive: item.isActive } : null; })() : null }));
    }),
    create: protectedProcedure.input(z.object({ sku: z.string().min(1), name: z.string().min(2), category: z.enum(["tailoring", "fabric", "alteration", "accessory", "other"]), description: z.string(), unitPrice: z.number().positive(), inventoryItemId: idSchema.optional(), defaultFabricMeters: z.number().optional() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, inventoryRoles);
      const pb = await pbOrThrow();
      const created = await pb.collection("services").create<Service>({ ...input, description: input.description || null, unitPrice: three(input.unitPrice), defaultFabricMeters: input.defaultFabricMeters ?? null, isActive: true });
      await audit(ctx.user.id, "SERVICE_CREATED", "service", created.id);
      return { id: created.id };
    }),
  }),

  sales: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      return (await pb.collection("sales").getFullList<Sale>({ sort: "-createdAt" })).slice(0, 100);
    }),
    create: protectedProcedure.input(z.object({ customerId: idSchema.optional(), customerName: z.string().min(1), customerPhone: z.string().optional(), discount: z.number().min(0), paymentMethod: z.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z.enum(["paid", "partial", "unpaid"]), items: z.array(z.object({ serviceId: idSchema.optional(), inventoryItemId: idSchema.optional(), name: z.string().min(1), quantity: z.number().positive(), unitPrice: z.number().nonnegative() })).min(1) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const total = Math.max(0, subtotal - input.discount);
      const saleNumber = `SALE-${Date.now()}`;
      const invoicePrefix = shop?.invoicePrefix || "INV";
      const sale = await pb.collection("sales").create<Sale>({ saleNumber, customerId: input.customerId ?? null, customerNameSnapshot: input.customerName, customerPhoneSnapshot: input.customerPhone || null, subtotal: three(subtotal), discount: three(input.discount), total: three(total), paidAmount: input.paymentStatus === "paid" ? three(total) : 0, paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, source: "manual", createdBy: ctx.user.id });
      for (const item of input.items) {
        await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: item.serviceId ?? null, inventoryItemId: item.inventoryItemId ?? null, nameSnapshot: item.name, quantity: three(item.quantity), unitPrice: three(item.unitPrice), lineTotal: three(item.quantity * item.unitPrice) });
        if (item.inventoryItemId) {
          const stock = await findById<InventoryItem>("inventoryItems", item.inventoryItemId);
          if (!stock) throw new TRPCError({ code: "BAD_REQUEST", message: "Linked inventory item was not found." });
          const before = Number(stock.quantity);
          const after = before - item.quantity;
          if (after < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `${stock.name} does not have enough stock.` });
          await pb.collection("inventoryItems").update(stock.id, { quantity: three(after) });
          await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: stock.id, movementType: "sale", quantityChange: three(-item.quantity), quantityBefore: three(before), quantityAfter: three(after), referenceType: "sale", referenceId: sale.id, createdBy: ctx.user.id, notes: saleNumber });
        }
      }
      await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `${invoicePrefix}-${sale.id}`, status: input.paymentStatus, issuedAt: new Date().toISOString() });
      await audit(ctx.user.id, "SALE_COMPLETED", "sale", sale.id, { total });
      return { id: sale.id, total };
    }),
  }),

  salesHistory: router({
    list: protectedProcedure.input(salesHistoryInput.optional()).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const [saleRows, invoiceRows] = await Promise.all([
        pb.collection("sales").getFullList<Sale>({ sort: "-createdAt" }).then(rows => rows.slice(0, 500)),
        pb.collection("invoices").getFullList<Invoice>(),
      ]);
      const invoiceBySale = new Map(invoiceRows.map(invoice => [invoice.saleId, invoice]));
      const search = input?.search?.trim().toLowerCase();
      const start = input?.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null;
      const end = input?.endDate ? new Date(`${input.endDate}T23:59:59.999Z`) : null;
      return saleRows.filter(sale =>
        (!input?.source || sale.source === input.source) &&
        (!input?.paymentStatus || sale.paymentStatus === input.paymentStatus) &&
        (!start || new Date(sale.createdAt) >= start) &&
        (!end || new Date(sale.createdAt) <= end) &&
        (!search || [sale.saleNumber, sale.customerNameSnapshot, sale.customerPhoneSnapshot || ""].some(value => value.toLowerCase().includes(search)))
      ).map(sale => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null }));
    }),
    monthlyReport: protectedProcedure.input(monthInput).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const { start, end } = getMonthWindow(input.month);
      const [allSales, invoiceRows, allItems, shop] = await Promise.all([
        pb.collection("sales").getFullList<Sale>({ sort: "-createdAt" }).then(rows => rows.slice(0, 1000)),
        pb.collection("invoices").getFullList<Invoice>(),
        pb.collection("saleItems").getFullList<SaleItem>(),
        pb.collection("shopSettings").getFullList<ShopSettings>().then(rows => rows[0] || null),
      ]);
      const rows = allSales.filter(sale => { const created = new Date(sale.createdAt); return created >= start && created <= end; });
      const invoiceBySale = new Map(invoiceRows.map(invoice => [invoice.saleId, invoice]));
      const includedIds = new Set(rows.map(sale => sale.id));
      const bySource = new Map<string, { count: number; total: number }>();
      const byPayment = new Map<string, { count: number; total: number }>();
      const topLines = new Map<string, { quantity: number; total: number }>();
      for (const sale of rows) {
        const source = bySource.get(sale.source) || { count: 0, total: 0 };
        source.count += 1; source.total += Number(sale.total); bySource.set(sale.source, source);
        const payment = byPayment.get(sale.paymentMethod) || { count: 0, total: 0 };
        payment.count += 1; payment.total += Number(sale.total); byPayment.set(sale.paymentMethod, payment);
      }
      for (const line of allItems) if (includedIds.has(line.saleId)) {
        const current = topLines.get(line.nameSnapshot) || { quantity: 0, total: 0 };
        current.quantity += Number(line.quantity); current.total += Number(line.lineTotal);
        topLines.set(line.nameSnapshot, current);
      }
      const total = rows.reduce((sum, sale) => sum + Number(sale.total), 0);
      return {
        month: input.month, shop,
        totals: { saleCount: rows.length, revenue: total, averageOrder: rows.length ? total / rows.length : 0, paidCount: rows.filter(sale => sale.paymentStatus === "paid").length, partialCount: rows.filter(sale => sale.paymentStatus === "partial").length, unpaidCount: rows.filter(sale => sale.paymentStatus === "unpaid").length },
        bySource: Array.from(bySource, ([source, values]) => ({ source, ...values })),
        byPayment: Array.from(byPayment, ([paymentMethod, values]) => ({ paymentMethod, ...values })),
        topLines: Array.from(topLines, ([name, values]) => ({ name, ...values })).sort((left, right) => right.total - left.total).slice(0, 8),
        sales: rows.map(sale => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null })),
      };
    }),
  }),

  invoices: router({
    list: protectedProcedure.input(invoiceListInput.optional()).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const search = input?.search?.trim().toLowerCase();
      const start = input?.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null;
      const end = input?.endDate ? new Date(`${input.endDate}T23:59:59.999Z`) : null;
      const [invoiceRows, saleRows] = await Promise.all([
        pb.collection("invoices").getFullList<Invoice>({ sort: "-issuedAt" }).then(rows => rows.slice(0, 500)),
        pb.collection("sales").getFullList<Sale>({ sort: "-createdAt" }).then(rows => rows.slice(0, 500)),
      ]);
      const saleById = new Map(saleRows.map(sale => [sale.id, sale]));
      return invoiceRows.map(invoice => ({ ...invoice, sale: saleById.get(invoice.saleId) || null })).filter(row =>
        (!input?.status || row.status === input.status) &&
        (!input?.source || row.sale?.source === input.source) &&
        (!input?.paymentMethod || row.sale?.paymentMethod === input.paymentMethod) &&
        (!start || new Date(row.issuedAt) >= start) &&
        (!end || new Date(row.issuedAt) <= end) &&
        (!search || [row.invoiceNumber, row.sale?.saleNumber || "", row.sale?.customerNameSnapshot || "", row.sale?.customerPhoneSnapshot || ""].some(value => value.toLowerCase().includes(search)))
      );
    }),
    detail: protectedProcedure.input(z.object({ invoiceId: idSchema })).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const invoice = await findById<Invoice>("invoices", input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      const sale = await findById<Sale>("sales", invoice.saleId);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sale for this invoice was not found." });
      const [items, shop, deliveries] = await Promise.all([
        pb.collection("saleItems").getFullList<SaleItem>({ filter: await pbFilter("saleId = {:id}", { id: sale.id }) }),
        pb.collection("shopSettings").getFullList<ShopSettings>().then(rows => rows[0] || null),
        pb.collection("invoiceDeliveries").getFullList<InvoiceDelivery>({ filter: await pbFilter("invoiceId = {:id}", { id: invoice.id }), sort: "-createdAt" }).then(rows => rows.slice(0, 20)),
      ]);
      return { invoice, sale, items, shop, deliveries };
    }),
    prepareDelivery: protectedProcedure.input(z.object({ invoiceId: idSchema, channel: z.enum(["email", "whatsapp", "share"]), recipient: z.string().trim().max(320).optional(), message: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, salesRoles);
      const pb = await pbOrThrow();
      const invoice = await findById<Invoice>("invoices", input.invoiceId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      const created = await pb.collection("invoiceDeliveries").create<InvoiceDelivery>({ invoiceId: input.invoiceId, channel: input.channel, recipient: input.recipient || null, status: "prepared", message: input.message || null, createdBy: ctx.user.id });
      await audit(ctx.user.id, "INVOICE_DELIVERY_PREPARED", "invoice", input.invoiceId, { channel: input.channel, recipient: input.recipient });
      return { id: created.id, status: "prepared" as const };
    }),
  }),

  staff: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, staffDirectoryRoles);
      const pb = await pbOrThrow();
      return pb.collection("staffProfiles").getFullList<StaffProfile>({ filter: "isActive = true", sort: "name" });
    }),
    linkAccess: protectedProcedure.input(z.object({ staffProfileId: idSchema, userId: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const profile = await findById<StaffProfile>("staffProfiles", input.staffProfileId);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Staff profile not found." });
      const user = await findById<User>("users", input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "ERP access account not found." });
      const existing = await findOne<StaffProfile>("staffProfiles", await pbFilter("userId = {:id}", { id: input.userId }));
      if (existing && existing.id !== input.staffProfileId) throw new TRPCError({ code: "CONFLICT", message: "This ERP account is already linked to another payroll profile." });
      await pb.collection("staffProfiles").update(input.staffProfileId, { userId: input.userId });
      await audit(ctx.user.id, "STAFF_ACCESS_LINKED", "staffProfile", input.staffProfileId, { userId: input.userId });
      return { success: true };
    }),
    unlinkAccess: protectedProcedure.input(z.object({ staffProfileId: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      await pb.collection("staffProfiles").update(input.staffProfileId, { userId: null });
      await audit(ctx.user.id, "STAFF_ACCESS_UNLINKED", "staffProfile", input.staffProfileId);
      return { success: true };
    }),
    create: protectedProcedure.input(z.object({ name: z.string().min(2), phone: z.string(), jobTitle: z.string().min(2), baseSalary: z.number().min(0), commissionRate: z.number().min(0) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      const created = await pb.collection("staffProfiles").create<StaffProfile>({ ...input, phone: input.phone || null, baseSalary: three(input.baseSalary), commissionRate: three(input.commissionRate), isActive: true });
      await audit(ctx.user.id, "STAFF_CREATED", "staffProfile", created.id);
      return { id: created.id };
    }),
    recordAttendance: protectedProcedure.input(z.object({ staffProfileId: idSchema, workDate: z.string(), status: z.enum(["present", "absent", "leave", "half_day"]), notes: z.string() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      await pb.collection("attendance").create<Attendance>({ ...input, workDate: new Date(input.workDate).toISOString(), notes: input.notes || null, recordedBy: ctx.user.id });
      await audit(ctx.user.id, "ATTENDANCE_RECORDED", "attendance", input.staffProfileId);
      return { success: true };
    }),
    attendanceHistory: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      return (await pb.collection("attendance").getFullList<Attendance>({ sort: "-workDate" })).slice(0, 100);
    }),
    performance: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      return (await pb.collection("performanceRecords").getFullList<PerformanceRecord>({ sort: "-workDate" })).slice(0, 100);
    }),
    addPerformance: protectedProcedure.input(z.object({ staffProfileId: idSchema, workDate: z.string(), metric: z.string().min(2), units: z.number().min(0), commissionEarned: z.number().min(0), notes: z.string() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      await pb.collection("performanceRecords").create<PerformanceRecord>({ ...input, workDate: new Date(input.workDate).toISOString(), units: three(input.units), commissionEarned: three(input.commissionEarned), notes: input.notes || null, recordedBy: ctx.user.id });
      await audit(ctx.user.id, "PERFORMANCE_RECORDED", "performanceRecord", input.staffProfileId);
      return { success: true };
    }),
    payouts: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      return (await pb.collection("salaryPayouts").getFullList<SalaryPayout>({ sort: "-paidAt" })).slice(0, 100);
    }),
    calculate: protectedProcedure.input(z.object({ staffProfileId: idSchema, payPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid pay period.") })).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      const staff = await findById<StaffProfile>("staffProfiles", input.staffProfileId);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff profile not found." });
      const start = new Date(`${input.payPeriod}-01T00:00:00.000Z`);
      const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      const rows = (await pb.collection("performanceRecords").getFullList<PerformanceRecord>({ filter: await pbFilter("staffProfileId = {:id}", { id: staff.id }) })).filter(row => { const workDate = new Date(row.workDate); return workDate >= start && workDate <= new Date(end.getTime() - 1); });
      const performanceBonus = rows.reduce((sum, row) => sum + Number(row.commissionEarned), 0);
      const baseSalary = Number(staff.baseSalary);
      return { staffProfileId: staff.id, staffName: staff.name, payPeriod: input.payPeriod, baseSalary, allowances: 0, overtime: 0, performanceBonus, deductions: 0, grossSalary: baseSalary + performanceBonus, netSalary: baseSalary + performanceBonus };
    }),
    createPayout: protectedProcedure.input(z.object({ staffProfileId: idSchema, payPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid pay period."), amount: z.number().positive().max(1000000).optional(), allowances: z.number().min(0).max(1000000).default(0), overtime: z.number().min(0).max(1000000).default(0), performanceBonus: z.number().min(0).max(1000000).optional(), deductions: z.number().min(0).max(1000000).default(0), deductionDetails: z.string().max(2000).optional(), notes: z.string().max(2000) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const pb = await pbOrThrow();
      const staff = await findById<StaffProfile>("staffProfiles", input.staffProfileId);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff profile not found." });
      const start = new Date(`${input.payPeriod}-01T00:00:00.000Z`);
      const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      const rows = (await pb.collection("performanceRecords").getFullList<PerformanceRecord>({ filter: await pbFilter("staffProfileId = {:id}", { id: staff.id }) })).filter(row => { const workDate = new Date(row.workDate); return workDate >= start && workDate <= new Date(end.getTime() - 1); });
      const performanceBonus = input.performanceBonus ?? rows.reduce((sum, row) => sum + Number(row.commissionEarned), 0);
      const grossSalary = Number(staff.baseSalary) + input.allowances + input.overtime + performanceBonus;
      const finalAmount = input.amount ?? grossSalary - input.deductions;
      if (finalAmount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The calculated net salary must be greater than zero." });
      const payslipNumber = `PS-${input.payPeriod.replace("-", "")}-${staff.id}-${Date.now()}`;
      const created = await pb.collection("salaryPayouts").create<SalaryPayout>({ staffProfileId: staff.id, payPeriod: input.payPeriod, payslipNumber, baseSalary: staff.baseSalary, allowances: three(input.allowances), overtime: three(input.overtime), performanceBonus: three(performanceBonus), deductions: three(input.deductions), deductionDetails: input.deductionDetails?.trim() || null, netSalary: three(finalAmount), notes: input.notes.trim() || null, approvedBy: ctx.user.id, paidAt: new Date().toISOString() });
      await audit(ctx.user.id, "SALARY_PAYOUT_CREATED", "salaryPayout", created.id, { staffProfileId: staff.id, payPeriod: input.payPeriod, finalAmount: three(finalAmount), deductions: three(input.deductions), payslipNumber });
      return { id: created.id, netSalary: finalAmount, payslipNumber };
    }),
  }),

  tailoring: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, tailoringRoles);
      const pb = await pbOrThrow();
      const [orders, clientRows, tailorRows, measurementRows] = await Promise.all([
        pb.collection("tailoringOrders").getFullList<TailoringOrder>({ sort: "-createdAt" }).then(rows => rows.slice(0, 100)),
        pb.collection("customers").getFullList<Customer>(),
        pb.collection("staffProfiles").getFullList<StaffProfile>(),
        pb.collection("measurementProfiles").getFullList<MeasurementProfile>(),
      ]);
      const clients = new Map(clientRows.map(client => [client.id, client]));
      const tailors = new Map(tailorRows.map(tailor => [tailor.id, tailor]));
      const measurements = new Map(measurementRows.map(profile => [profile.id, profile]));
      return orders.map(order => ({ ...order, customerName: clients.get(order.customerId)?.name || "Archived customer", customerPhone: clients.get(order.customerId)?.phone || null, tailorName: order.assignedTailorId ? tailors.get(order.assignedTailorId)?.name || "Former tailor" : null, measurementVersion: order.measurementProfileId ? measurements.get(order.measurementProfileId)?.version || null : null }));
    }),
    create: protectedProcedure.input(tailoringOrderInput).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, tailoringRoles);
      const pb = await pbOrThrow();
      const customer = await findById<Customer>("customers", input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Choose a valid customer for the tailoring order." });
      const profile = input.measurementProfileId ? await findById<MeasurementProfile>("measurementProfiles", input.measurementProfileId) : null;
      const tailor = input.assignedTailorId ? await findById<StaffProfile>("staffProfiles", input.assignedTailorId) : null;
      const relationError = tailoringRelationError(input.customerId, profile?.customerId, input.assignedTailorId ? Boolean(tailor?.isActive) : null);
      if (relationError === "measurement") throw new TRPCError({ code: "BAD_REQUEST", message: "Save or choose a measurement version belonging to this customer before confirming the tailoring order." });
      if (relationError === "tailor") throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active tailor." });
      const orderNumber = `TO-${Date.now()}`;
      const created = await pb.collection("tailoringOrders").create<TailoringOrder>({ ...input, orderNumber, measurementProfileId: input.measurementProfileId || null, assignedTailorId: input.assignedTailorId || null, dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null, price: three(input.price), customerSuppliedFabric: input.customerSuppliedFabric, fabricNotes: input.fabricNotes || null, notes: input.notes || null, productionNotes: input.productionNotes || null, createdBy: ctx.user.id, status: "confirmed" });
      await audit(ctx.user.id, "TAILORING_ORDER_CREATED", "tailoringOrder", created.id, { orderNumber, customerId: input.customerId, garmentType: input.garmentType, dueDate: input.dueDate });
      return { id: created.id, orderNumber };
    }),
    update: protectedProcedure.input(z.object({ id: idSchema, assignedTailorId: idSchema.optional(), status: tailoringStatus, dueDate: z.string().optional(), productionNotes: z.string().max(3000) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, tailoringRoles);
      const pb = await pbOrThrow();
      const current = await findById<TailoringOrder>("tailoringOrders", input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Tailoring order not found." });
      if (!canMoveTailoringOrder(current.status, input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Move the order through the production stages in sequence before handover." });
      if (input.assignedTailorId) {
        const tailor = await findById<StaffProfile>("staffProfiles", input.assignedTailorId);
        if (!tailor?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active tailor." });
      }
      await pb.collection("tailoringOrders").update(input.id, { assignedTailorId: input.assignedTailorId || null, status: input.status, dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null, productionNotes: input.productionNotes || null });
      await audit(ctx.user.id, "TAILORING_ORDER_UPDATED", "tailoringOrder", input.id, input);
      return { success: true };
    }),
  }),

  team: router({
    listRoles: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const [baseRoles, users, assignments, definitions] = await Promise.all([
        pb.collection("userBusinessRoles").getFullList<UserBusinessRole>(),
        pb.collection("users").getFullList<User>(),
        pb.collection("userCustomRoles").getFullList<UserCustomRole>(),
        pb.collection("customRoles").getFullList<CustomRole>(),
      ]);
      const userById = new Map(users.map(user => [user.id, user]));
      const byUser = new Map(assignments.map(assignment => [assignment.userId, assignment]));
      const byId = new Map(definitions.map(role => [role.id, role]));
      return baseRoles.map(base => {
        const user = userById.get(base.userId);
        const assignment = byUser.get(base.userId);
        const customRole = assignment ? byId.get(assignment.customRoleId) : undefined;
        return { userId: base.userId, businessRole: base.role, isActive: base.isActive, name: user?.name || null, email: user?.email || null, customRoleId: customRole?.id || null, customRoleName: customRole?.name || null, customRoleActive: Boolean(assignment?.isActive && customRole?.isActive) };
      });
    }),
    removeUser: protectedProcedure.input(z.object({ userId: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "The owner account cannot be removed." });
      const pb = await pbOrThrow();
      const target = await findById<User>("users", input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This user no longer exists." });
      const targetBusinessRole = await findOne<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: input.userId }));
      if (target.role === "admin" || targetBusinessRole?.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Owner accounts cannot be removed." });
      const [customRoleAssignment, businessRole, pendingRequest, staffProfile] = await Promise.all([
        findOne<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: input.userId })),
        findOne<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: input.userId })),
        findOne<PendingAccessRequest>("pendingAccessRequests", await pbFilter("userId = {:id}", { id: input.userId })),
        findOne<StaffProfile>("staffProfiles", await pbFilter("userId = {:id}", { id: input.userId })),
      ]);
      if (customRoleAssignment) await pb.collection("userCustomRoles").delete(customRoleAssignment.id);
      if (businessRole) await pb.collection("userBusinessRoles").delete(businessRole.id);
      if (pendingRequest) await pb.collection("pendingAccessRequests").delete(pendingRequest.id);
      if (staffProfile) await pb.collection("staffProfiles").update(staffProfile.id, { userId: null, isActive: false });
      await pb.collection("users").delete(input.userId);
      await audit(ctx.user.id, "USER_REMOVED", "user", input.userId, { access: "revoked", records: "preserved" });
      return { success: true };
    }),
    listCustomRoles: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const rows = await pb.collection("customRoles").getFullList<CustomRole>({ sort: "name" });
      return rows.map(role => ({ ...role, permissions: Array.isArray(role.permissionsJson) ? role.permissionsJson.filter((value): value is string => typeof value === "string") : [] }));
    }),
    createCustomRole: protectedProcedure.input(z.object({ name: z.string().min(2).max(80), description: z.string().max(320), permissions: z.array(z.enum(customPermissionValues)).min(1) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const created = await pb.collection("customRoles").create<CustomRole>({ name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, isActive: true, createdBy: ctx.user.id });
      await audit(ctx.user.id, "CUSTOM_ROLE_CREATED", "customRole", created.id, input);
      return { id: created.id };
    }),
    updateCustomRole: protectedProcedure.input(z.object({ id: idSchema, name: z.string().min(2).max(80), description: z.string().max(320), permissions: z.array(z.enum(customPermissionValues)).min(1), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      await pb.collection("customRoles").update(input.id, { name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, isActive: input.isActive });
      await audit(ctx.user.id, "CUSTOM_ROLE_UPDATED", "customRole", input.id, input);
      return { success: true };
    }),
    assignCustomRole: protectedProcedure.input(z.object({ userId: idSchema, customRoleId: idSchema, isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const role = await findById<CustomRole>("customRoles", input.customRoleId);
      if (!role?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
      await upsert<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: input.userId }), { ...input, updatedBy: ctx.user.id });
      await audit(ctx.user.id, "CUSTOM_ROLE_ASSIGNED", "user", input.userId, input);
      return { success: true };
    }),
    clearCustomRole: protectedProcedure.input(z.object({ userId: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const assignment = await findOne<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: input.userId }));
      if (assignment) await pb.collection("userCustomRoles").delete(assignment.id);
      await audit(ctx.user.id, "CUSTOM_ROLE_CLEARED", "user", input.userId);
      return { success: true };
    }),
    assignRole: protectedProcedure.input(z.object({ userId: idSchema, role: z.enum(businessRoleValues), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      await upsert<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: input.userId }), input);
      await audit(ctx.user.id, "BUSINESS_ROLE_ASSIGNED", "user", input.userId, input);
      return { success: true };
    }),
  }),

  access: router({
    listInvites: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const [invites, roles] = await Promise.all([
        pb.collection("staffAccessInvites").getFullList<StaffAccessInvite>({ sort: "-invitedAt" }),
        pb.collection("customRoles").getFullList<CustomRole>(),
      ]);
      const roleById = new Map(roles.map(role => [role.id, role]));
      return invites.map(invite => ({ ...invite, roleName: roleById.get(invite.customRoleId)?.name || "Archived role" }));
    }),
    inviteStaff: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320), customRoleId: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const role = await findById<CustomRole>("customRoles", input.customRoleId);
      if (!role?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active role before preparing staff access." });
      const email = input.email.toLowerCase();
      await upsert<StaffAccessInvite>("staffAccessInvites", await pbFilter("email = {:email}", { email }), { name: input.name, email, customRoleId: role.id, invitedBy: ctx.user.id, invitedAt: new Date().toISOString(), isActive: true, acceptedByUserId: null, acceptedAt: null });
      await audit(ctx.user.id, "STAFF_ACCESS_PREPARED", "staffAccessInvite", undefined, { email, roleId: role.id });
      return { email, roleName: role.name };
    }),
    cancelInvite: protectedProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      await pb.collection("staffAccessInvites").update(input.id, { isActive: false });
      await audit(ctx.user.id, "STAFF_ACCESS_CANCELLED", "staffAccessInvite", input.id);
      return { success: true };
    }),
    listPending: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const [requests, people] = await Promise.all([
        pb.collection("pendingAccessRequests").getFullList<PendingAccessRequest>({ filter: "status = 'pending'", sort: "-requestedAt" }),
        pb.collection("users").getFullList<User>(),
      ]);
      const byId = new Map(people.map(person => [person.id, person]));
      return requests.map(request => ({ ...request, name: byId.get(request.userId)?.name || `User #${request.userId}`, email: byId.get(request.userId)?.email || null }));
    }),
    approvePending: protectedProcedure.input(z.object({ requestId: idSchema, customRoleId: idSchema, note: z.string().max(500) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const [request, role] = await Promise.all([findById<PendingAccessRequest>("pendingAccessRequests", input.requestId), findById<CustomRole>("customRoles", input.customRoleId)]);
      if (!request || request.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
      if (!role?.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
      await upsert<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: request.userId }), { userId: request.userId, role: "sales", isActive: true });
      await upsert<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: request.userId }), { userId: request.userId, customRoleId: role.id, isActive: true, updatedBy: ctx.user.id });
      await pb.collection("pendingAccessRequests").update(request.id, { status: "approved", reviewedAt: new Date().toISOString(), reviewedBy: ctx.user.id, note: input.note || null });
      await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED", "pendingAccessRequest", request.id, { userId: request.userId, roleId: role.id });
      return { success: true };
    }),
    rejectPending: protectedProcedure.input(z.object({ requestId: idSchema, note: z.string().max(500) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const request = await findById<PendingAccessRequest>("pendingAccessRequests", input.requestId);
      if (!request || request.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
      await pb.collection("pendingAccessRequests").update(request.id, { status: "rejected", reviewedAt: new Date().toISOString(), reviewedBy: ctx.user.id, note: input.note || null });
      await audit(ctx.user.id, "ACCESS_REQUEST_REJECTED", "pendingAccessRequest", request.id, { userId: request.userId });
      return { success: true };
    }),
  }),

  accessApproval: router({
    approveWithPermissions: protectedProcedure.input(z.object({ requestId: idSchema, name: z.string().trim().min(2).max(80), description: z.string().trim().max(320), permissions: z.array(z.enum(["dashboard", "customers", "sales", "inventory", "production", "payroll"])).min(1), note: z.string().max(500) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const request = await findById<PendingAccessRequest>("pendingAccessRequests", input.requestId);
      if (!request || request.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
      const role = await pb.collection("customRoles").create<CustomRole>({ name: input.name, description: input.description || null, permissionsJson: input.permissions, isActive: true, createdBy: ctx.user.id });
      await upsert<UserBusinessRole>("userBusinessRoles", await pbFilter("userId = {:id}", { id: request.userId }), { userId: request.userId, role: "sales", isActive: true });
      await upsert<UserCustomRole>("userCustomRoles", await pbFilter("userId = {:id}", { id: request.userId }), { userId: request.userId, customRoleId: role.id, isActive: true, updatedBy: ctx.user.id });
      await pb.collection("pendingAccessRequests").update(request.id, { status: "approved", reviewedAt: new Date().toISOString(), reviewedBy: ctx.user.id, note: input.note || null });
      await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED_WITH_PERMISSIONS", "pendingAccessRequest", request.id, { userId: request.userId, roleId: role.id });
      return { roleId: role.id };
    }),
  }),

  demo: router({
    populate: protectedProcedure.mutation(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const settings = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
      const [existingCustomers, existingSales] = await Promise.all([pb.collection("customers").getList(1, 1), pb.collection("sales").getList(1, 1)]);
      const resumingDemo = Boolean(settings?.shopName?.startsWith("[DEMO]"));
      if (existingSales.totalItems > 0) {
        const existingInvoice = (await pb.collection("invoices").getFullList<Invoice>())[0];
        const latestSale = (await pb.collection("sales").getFullList<Sale>({ sort: "-created" })).slice(0, 1)[0];
        if (!existingInvoice && latestSale?.saleNumber.startsWith("DEMO-")) {
          await pb.collection("invoices").create<Invoice>({ saleId: latestSale.id, invoiceNumber: `${settings?.invoicePrefix || "DEMO"}-${latestSale.id}`, status: latestSale.paymentStatus, notes: "Demo invoice — not a real transaction.", issuedAt: new Date().toISOString() });
          await audit(ctx.user.id, "DEMO_INVOICE_BACKFILLED", "invoice", latestSale.id);
        }
        return { success: true, customers: existingCustomers.totalItems, saleId: latestSale?.id || "" };
      }
      if (existingCustomers.totalItems > 0 && !resumingDemo) throw new TRPCError({ code: "CONFLICT", message: "Demo data can only be loaded into an empty operational workspace." });
      const shopValues = { shopName: "[DEMO] Al-Mamlaka Tailoring", arabicShopName: "[تجريبي] المملكة للخياطة", crNumber: "DEMO-2026", currency: "BHD", phone: "+973 1700 0000", email: "demo@almamlaka.example", address: "[DEMO] Manama, Bahrain", invoicePrefix: "DEMO", updatedBy: ctx.user.id };
      if (settings) await pb.collection("shopSettings").update(settings.id, shopValues);
      else await pb.collection("shopSettings").create(shopValues);
      const firstCustomer = await pb.collection("customers").create<Customer>({ name: "[DEMO] Ahmed Al-Hassan", phone: "+973 3330 0011", email: "ahmed.demo@example.com", address: "[DEMO] Manama", notes: "Demo client — not a real customer.", preferredContact: "WhatsApp" });
      await pb.collection("customers").create<Customer>({ name: "[DEMO] Faisal Al-Rashid", phone: "+973 3330 0022", email: "faisal.demo@example.com", address: "[DEMO] Riffa", notes: "Demo client — not a real customer.", preferredContact: "Phone" });
      await pb.collection("customers").create<Customer>({ name: "[DEMO] Omar Al-Sayed", phone: "+973 3330 0033", email: "omar.demo@example.com", address: "[DEMO] Muharraq", notes: "Demo client — not a real customer.", preferredContact: "WhatsApp" });
      await pb.collection("measurementProfiles").create<MeasurementProfile>({ customerId: firstCustomer.id, version: 1, measurementsJson: { neck: "15.5", chest: "42", waist: "36", shoulder: "18", sleeve: "24", length: "58" }, fitPreference: "Classic", collarStyle: "Band", pocketStyle: "Single", notes: "Demo measurement profile.", effectiveDate: new Date("2026-08-01").toISOString(), createdBy: ctx.user.id });
      const navyItem = await pb.collection("inventoryItems").create<InventoryItem>({ code: `DEMO-FAB-NAVY-${Date.now()}`, name: "[DEMO] Navy Premium Cotton", category: "fabric", color: "Navy", unit: "Meters", quantity: 18, minThreshold: 8, costPerUnit: 7.5, isActive: true });
      await pb.collection("inventoryItems").create<InventoryItem>({ code: `DEMO-FAB-WHT-${Date.now()}`, name: "[DEMO] White Cotton Blend", category: "fabric", color: "White", unit: "Meters", quantity: 5, minThreshold: 7, costPerUnit: 6.25, isActive: true });
      await pb.collection("inventoryItems").create<InventoryItem>({ code: `DEMO-BTN-GOLD-${Date.now()}`, name: "[DEMO] Gold Cuff Buttons", category: "accessory", color: "Gold", unit: "Pairs", quantity: 24, minThreshold: 10, costPerUnit: 2, isActive: true });
      await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: navyItem.id, movementType: "opening", quantityChange: 18, quantityBefore: 0, quantityAfter: 18, createdBy: ctx.user.id, notes: "Demo opening balance" });
      const thobe = await pb.collection("services").create<Service>({ sku: `DEMO-THOBE-${Date.now()}`, name: "[DEMO] Bespoke Thobe", category: "tailoring", description: "Demo bespoke thobe service.", unitPrice: 45, defaultFabricMeters: 3, isActive: true });
      await pb.collection("services").create<Service>({ sku: `DEMO-FABRIC-${Date.now()}`, name: "[DEMO] Navy Cotton Fabric", category: "fabric", description: "Demo tracked fabric line.", unitPrice: 12, inventoryItemId: navyItem.id, isActive: true });
      await pb.collection("services").create<Service>({ sku: `DEMO-ALT-${Date.now()}`, name: "[DEMO] Sleeve Alteration", category: "alteration", description: "Demo alteration service.", unitPrice: 8, isActive: true });
      const sale = await pb.collection("sales").create<Sale>({ saleNumber: `DEMO-SALE-${Date.now()}`, customerId: firstCustomer.id, customerNameSnapshot: "[DEMO] Ahmed Al-Hassan", customerPhoneSnapshot: "+973 3330 0011", subtotal: 57, discount: 2, total: 55, paidAmount: 55, paymentMethod: "benefitpay", paymentStatus: "paid", source: "counter", createdBy: ctx.user.id });
      await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, serviceId: thobe.id, nameSnapshot: "[DEMO] Bespoke Thobe", quantity: 1, unitPrice: 45, lineTotal: 45 });
      await pb.collection("saleItems").create<SaleItem>({ saleId: sale.id, nameSnapshot: "[DEMO] Navy Cotton Fabric", inventoryItemId: navyItem.id, quantity: 1, unitPrice: 12, lineTotal: 12 });
      await pb.collection("inventoryItems").update(navyItem.id, { quantity: 17 });
      await pb.collection("stockMovements").create<StockMovement>({ inventoryItemId: navyItem.id, movementType: "sale", quantityChange: -1, quantityBefore: 18, quantityAfter: 17, referenceType: "sale", referenceId: sale.id, createdBy: ctx.user.id, notes: "Demo sale" });
      await pb.collection("invoices").create<Invoice>({ saleId: sale.id, invoiceNumber: `DEMO-${sale.id}`, status: "paid", notes: "Demo invoice — not a real transaction.", issuedAt: new Date().toISOString() });
      await pb.collection("staffProfiles").create<StaffProfile>({ name: "[DEMO] Khalid Tailor", phone: "+973 3330 0101", jobTitle: "Senior Tailor", baseSalary: 520, commissionRate: 3, isActive: true });
      await pb.collection("staffProfiles").create<StaffProfile>({ name: "[DEMO] Sara Counter", phone: "+973 3330 0102", jobTitle: "Sales Associate", baseSalary: 420, commissionRate: 2, isActive: true });
      await audit(ctx.user.id, "DEMO_DATA_POPULATED", "demo", sale.id, { label: "All records are clearly marked [DEMO]" });
      return { success: true, customers: existingCustomers.totalItems + 3, saleId: sale.id };
    }),
  }),

  demoRecovery: router({
    completeInvoice: protectedProcedure.mutation(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      const existingInvoice = (await pb.collection("invoices").getFullList<Invoice>())[0];
      if (existingInvoice) return { created: false };
      const latestSale = (await pb.collection("sales").getFullList<Sale>({ sort: "-created" })).slice(0, 1)[0];
      if (!latestSale || !latestSale.saleNumber.startsWith("DEMO-")) return { created: false };
      const shop = (await pb.collection("shopSettings").getFullList<ShopSettings>())[0];
      await pb.collection("invoices").create<Invoice>({ saleId: latestSale.id, invoiceNumber: `${shop?.invoicePrefix || "DEMO"}-${latestSale.id}`, status: latestSale.paymentStatus, notes: "Demo invoice — not a real transaction.", issuedAt: new Date().toISOString() });
      await audit(ctx.user.id, "DEMO_INVOICE_BACKFILLED", "invoice", latestSale.id);
      return { created: true };
    }),
  }),

  demoWorkforce: router({
    seed: protectedProcedure.mutation(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const pb = await pbOrThrow();
      let staff = (await pb.collection("staffProfiles").getFullList<StaffProfile>({ filter: "isActive = true", sort: "created" }))[0];
      if (!staff) {
        await pb.collection("staffProfiles").create<StaffProfile>({ name: "[DEMO] Khalid Tailor", phone: "+973 3330 0101", jobTitle: "Senior Tailor", baseSalary: 520, commissionRate: 3, isActive: true });
        staff = (await pb.collection("staffProfiles").getFullList<StaffProfile>({ filter: "isActive = true", sort: "-created" }))[0];
      }
      if (!staff) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Demo staff profile could not be resolved." });
      const [attendanceCount, performanceCount, payoutCount] = await Promise.all([pb.collection("attendance").getList(1, 1), pb.collection("performanceRecords").getList(1, 1), pb.collection("salaryPayouts").getList(1, 1)]);
      if (attendanceCount.totalItems === 0) await pb.collection("attendance").create<Attendance>({ staffProfileId: staff.id, workDate: new Date("2026-08-12").toISOString(), status: "present", notes: "Demo attendance record — not a real workforce entry.", recordedBy: ctx.user.id });
      if (performanceCount.totalItems === 0) await pb.collection("performanceRecords").create<PerformanceRecord>({ staffProfileId: staff.id, workDate: new Date("2026-08-12").toISOString(), metric: "Demo thobe completions", units: 4, commissionEarned: 12, notes: "Demo production record — not a real workforce entry.", recordedBy: ctx.user.id });
      if (payoutCount.totalItems === 0) await pb.collection("salaryPayouts").create<SalaryPayout>({ staffProfileId: staff.id, payPeriod: "2026-08", baseSalary: staff.baseSalary, performanceBonus: 12, deductions: 0, netSalary: Number(staff.baseSalary) + 12, notes: "Demo payout — not a real payroll transaction.", approvedBy: ctx.user.id, paidAt: new Date().toISOString() });
      await audit(ctx.user.id, "DEMO_WORKFORCE_DATA_POPULATED", "staffProfile", staff.id);
      return { created: true };
    }),
  }),

  audit: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const pb = await pbOrThrow();
    return (await pb.collection("auditLogs").getFullList<AuditLog>({ sort: "-createdAt" })).slice(0, 200);
  }),
});
