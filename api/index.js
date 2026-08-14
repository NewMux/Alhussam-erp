// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var DEFAULT_SUPABASE_URL = "https://cevoyflcdsdkhigyunlv.supabase.co";
function cleanEnvironmentValue(value) {
  return value?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}
function validSupabaseUrl(...candidates) {
  for (const candidate of candidates) {
    const value = cleanEnvironmentValue(candidate);
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")) {
        return parsed.toString().replace(/\/$/, "");
      }
    } catch {
    }
  }
  return DEFAULT_SUPABASE_URL;
}
var ENV = {
  databaseUrl: cleanEnvironmentValue(process.env.DATABASE_URL),
  // Prefer server-only Supabase settings for token verification. The VITE_
  // variables remain a backwards-compatible fallback for an existing deploy,
  // but should not be the server's source of truth.
  supabaseUrl: validSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL),
  supabaseAnonKey: cleanEnvironmentValue(
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  ),
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/erp.ts
import { and, desc, eq as eq2, gte, like, lte, max, or, sql } from "drizzle-orm";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// drizzle/schema.ts
import { boolean, date, decimal, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role", ["user", "admin"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 320 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var businessRoles = ["admin", "sales", "tailor", "inventory", "payroll"];
var businessRoleEnum = pgEnum("business_role", businessRoles);
var accessRequestStatusEnum = pgEnum("access_request_status", ["pending", "approved", "rejected"]);
var tailoringOrderStatusEnum = pgEnum("tailoring_order_status", ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"]);
var inventoryCategoryEnum = pgEnum("inventory_category", ["fabric", "lining", "buttons", "thread", "accessory", "other"]);
var stockMovementTypeEnum = pgEnum("stock_movement_type", ["opening", "adjustment", "sale", "return", "purchase"]);
var serviceCategoryEnum = pgEnum("service_category", ["tailoring", "fabric", "alteration", "accessory", "other"]);
var paymentMethodEnum = pgEnum("payment_method", ["cash", "benefitpay", "bank_transfer", "credit_card"]);
var paymentStatusEnum = pgEnum("payment_status", ["paid", "partial", "unpaid"]);
var saleSourceEnum = pgEnum("sale_source", ["counter", "manual", "tailoring"]);
var invoiceStatusEnum = pgEnum("invoice_status", ["paid", "partial", "unpaid", "void"]);
var attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "leave", "half_day"]);
var userBusinessRoles = pgTable("userBusinessRoles", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), role: businessRoleEnum("role").notNull().default("sales"), isActive: boolean("isActive").notNull().default(true), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var customRoles = pgTable("customRoles", { id: serial("id").primaryKey(), name: varchar("name", { length: 80 }).notNull().unique(), description: varchar("description", { length: 320 }), permissionsJson: jsonb("permissionsJson").notNull(), isActive: boolean("isActive").notNull().default(true), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var userCustomRoles = pgTable("userCustomRoles", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), customRoleId: integer("customRoleId").notNull(), isActive: boolean("isActive").notNull().default(true), updatedBy: integer("updatedBy").notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var pendingAccessRequests = pgTable("pendingAccessRequests", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), status: accessRequestStatusEnum("status").notNull().default("pending"), requestedAt: timestamp("requestedAt").defaultNow().notNull(), reviewedAt: timestamp("reviewedAt"), reviewedBy: integer("reviewedBy"), note: varchar("note", { length: 500 }) });
var staffAccessInvites = pgTable("staffAccessInvites", { id: serial("id").primaryKey(), name: varchar("name", { length: 160 }).notNull(), email: varchar("email", { length: 320 }).notNull().unique(), customRoleId: integer("customRoleId").notNull(), isActive: boolean("isActive").notNull().default(true), invitedBy: integer("invitedBy").notNull(), invitedAt: timestamp("invitedAt").defaultNow().notNull(), acceptedByUserId: integer("acceptedByUserId"), acceptedAt: timestamp("acceptedAt") });
var shopSettings = pgTable("shopSettings", { id: serial("id").primaryKey(), shopName: varchar("shopName", { length: 160 }).notNull(), arabicShopName: varchar("arabicShopName", { length: 160 }), crNumber: varchar("crNumber", { length: 80 }), currency: varchar("currency", { length: 8 }).notNull().default("BHD"), phone: varchar("phone", { length: 50 }), email: varchar("email", { length: 320 }), address: text("address"), invoicePrefix: varchar("invoicePrefix", { length: 16 }).notNull().default("INV"), updatedBy: integer("updatedBy"), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var customers = pgTable("customers", { id: serial("id").primaryKey(), name: varchar("name", { length: 160 }).notNull(), phone: varchar("phone", { length: 50 }).notNull(), email: varchar("email", { length: 320 }), address: text("address"), notes: text("notes"), preferredContact: varchar("preferredContact", { length: 40 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var measurementProfiles = pgTable("measurementProfiles", { id: serial("id").primaryKey(), customerId: integer("customerId").notNull(), version: integer("version").notNull(), measurementsJson: jsonb("measurementsJson").notNull(), fitPreference: varchar("fitPreference", { length: 100 }), collarStyle: varchar("collarStyle", { length: 100 }), pocketStyle: varchar("pocketStyle", { length: 100 }), notes: text("notes"), effectiveDate: date("effectiveDate", { mode: "date" }).notNull(), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var tailoringOrders = pgTable("tailoringOrders", { id: serial("id").primaryKey(), orderNumber: varchar("orderNumber", { length: 60 }).notNull().unique(), customerId: integer("customerId").notNull(), measurementProfileId: integer("measurementProfileId"), assignedTailorId: integer("assignedTailorId"), garmentType: varchar("garmentType", { length: 80 }).notNull().default("Thoub"), quantity: integer("quantity").notNull().default(1), status: tailoringOrderStatusEnum("status").notNull().default("draft"), dueDate: date("dueDate", { mode: "date" }), price: decimal("price", { precision: 12, scale: 3 }).notNull().default("0"), notes: text("notes"), productionNotes: text("productionNotes"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var inventoryItems = pgTable("inventoryItems", { id: serial("id").primaryKey(), code: varchar("code", { length: 60 }).notNull().unique(), name: varchar("name", { length: 160 }).notNull(), category: inventoryCategoryEnum("category").notNull(), color: varchar("color", { length: 60 }), widthInches: decimal("widthInches", { precision: 10, scale: 2 }), unit: varchar("unit", { length: 40 }).notNull().default("Meters"), quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull().default("0"), minThreshold: decimal("minThreshold", { precision: 12, scale: 3 }).notNull().default("0"), costPerUnit: decimal("costPerUnit", { precision: 12, scale: 3 }).notNull().default("0"), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var stockMovements = pgTable("stockMovements", { id: serial("id").primaryKey(), inventoryItemId: integer("inventoryItemId").notNull(), movementType: stockMovementTypeEnum("movementType").notNull(), quantityChange: decimal("quantityChange", { precision: 12, scale: 3 }).notNull(), quantityBefore: decimal("quantityBefore", { precision: 12, scale: 3 }).notNull(), quantityAfter: decimal("quantityAfter", { precision: 12, scale: 3 }).notNull(), referenceType: varchar("referenceType", { length: 40 }), referenceId: integer("referenceId"), notes: text("notes"), createdBy: integer("createdBy"), createdAt: timestamp("createdAt").defaultNow().notNull() });
var services = pgTable("services", { id: serial("id").primaryKey(), sku: varchar("sku", { length: 60 }).notNull().unique(), name: varchar("name", { length: 160 }).notNull(), category: serviceCategoryEnum("category").notNull(), description: text("description"), unitPrice: decimal("unitPrice", { precision: 12, scale: 3 }).notNull(), inventoryItemId: integer("inventoryItemId"), defaultFabricMeters: decimal("defaultFabricMeters", { precision: 12, scale: 3 }), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var sales = pgTable("sales", { id: serial("id").primaryKey(), saleNumber: varchar("saleNumber", { length: 60 }).notNull().unique(), customerId: integer("customerId"), customerNameSnapshot: varchar("customerNameSnapshot", { length: 160 }).notNull(), customerPhoneSnapshot: varchar("customerPhoneSnapshot", { length: 50 }), subtotal: decimal("subtotal", { precision: 12, scale: 3 }).notNull(), discount: decimal("discount", { precision: 12, scale: 3 }).notNull().default("0"), total: decimal("total", { precision: 12, scale: 3 }).notNull(), paymentMethod: paymentMethodEnum("paymentMethod").notNull(), paymentStatus: paymentStatusEnum("paymentStatus").notNull().default("paid"), source: saleSourceEnum("source").notNull().default("counter"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var saleItems = pgTable("saleItems", { id: serial("id").primaryKey(), saleId: integer("saleId").notNull(), serviceId: integer("serviceId"), inventoryItemId: integer("inventoryItemId"), nameSnapshot: varchar("nameSnapshot", { length: 160 }).notNull(), quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(), unitPrice: decimal("unitPrice", { precision: 12, scale: 3 }).notNull(), lineTotal: decimal("total", { precision: 12, scale: 3 }).notNull(), assignedTailorId: integer("assignedTailorId"), measurementProfileId: integer("measurementProfileId") });
var invoices = pgTable("invoices", { id: serial("id").primaryKey(), saleId: integer("saleId").notNull().unique(), invoiceNumber: varchar("invoiceNumber", { length: 60 }).notNull().unique(), status: invoiceStatusEnum("status").notNull(), issuedAt: timestamp("issuedAt").defaultNow().notNull(), dueDate: date("dueDate", { mode: "date" }), notes: text("notes") });
var staffProfiles = pgTable("staffProfiles", { id: serial("id").primaryKey(), userId: integer("userId"), name: varchar("name", { length: 160 }).notNull(), phone: varchar("phone", { length: 50 }), jobTitle: varchar("jobTitle", { length: 100 }).notNull(), baseSalary: decimal("baseSalary", { precision: 12, scale: 3 }).notNull(), commissionRate: decimal("commissionRate", { precision: 8, scale: 3 }).notNull().default("0"), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var attendance = pgTable("attendance", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), workDate: date("workDate", { mode: "date" }).notNull(), status: attendanceStatusEnum("status").notNull(), notes: text("notes"), recordedBy: integer("recordedBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var performanceRecords = pgTable("performanceRecords", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), workDate: date("workDate", { mode: "date" }).notNull(), metric: varchar("metric", { length: 120 }).notNull(), units: decimal("units", { precision: 12, scale: 3 }).notNull(), commissionEarned: decimal("commissionEarned", { precision: 12, scale: 3 }).notNull().default("0"), notes: text("notes"), recordedBy: integer("recordedBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var salaryPayouts = pgTable("salaryPayouts", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), payPeriod: varchar("payPeriod", { length: 20 }).notNull(), baseSalary: decimal("baseSalary", { precision: 12, scale: 3 }).notNull(), performanceBonus: decimal("performanceBonus", { precision: 12, scale: 3 }).notNull().default("0"), deductions: decimal("deductions", { precision: 12, scale: 3 }).notNull().default("0"), netSalary: decimal("netSalary", { precision: 12, scale: 3 }).notNull(), notes: text("notes"), approvedBy: integer("approvedBy").notNull(), paidAt: timestamp("paidAt").defaultNow().notNull() });
var auditLogs = pgTable("auditLogs", { id: serial("id").primaryKey(), actorId: integer("actorId").notNull(), action: varchar("action", { length: 100 }).notNull(), entityType: varchar("entityType", { length: 80 }).notNull(), entityId: integer("entityId"), detailsJson: text("detailsJson"), createdAt: timestamp("createdAt").defaultNow().notNull() });

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
var database = null;
async function getDb() {
  if (!database && ENV.databaseUrl) {
    const client = postgres(ENV.databaseUrl, { prepare: false });
    database = drizzle(client);
  }
  return database;
}
async function upsertUser(user) {
  const db = await getDb();
  if (!db || !user.openId) return;
  const isOwner = (user.email ?? "").toLowerCase() === ENV.ownerEmail && ENV.ownerEmail.length > 0;
  const values = { ...user, lastSignedIn: user.lastSignedIn || /* @__PURE__ */ new Date(), role: isOwner ? "admin" : user.role || "user" };
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
  if (isOwner) return;
  const signedInUser = (await db.select().from(users).where(eq(users.openId, values.openId)).limit(1))[0];
  if (!signedInUser) return;
  const existing = (await db.select().from(pendingAccessRequests).where(eq(pendingAccessRequests.userId, signedInUser.id)).limit(1))[0];
  if (!existing) await db.insert(pendingAccessRequests).values({ userId: signedInUser.id, status: "pending" });
  else if (existing.status === "rejected") await db.update(pendingAccessRequests).set({ status: "pending", requestedAt: /* @__PURE__ */ new Date(), reviewedAt: null, reviewedBy: null, note: null }).where(eq(pendingAccessRequests.id, existing.id));
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

// server/erp.ts
var adminRoles = ["admin"];
var salesRoles = ["admin", "sales"];
var inventoryRoles = ["admin", "inventory"];
var payrollRoles = ["admin", "payroll"];
var tailoringRoles = ["admin", "sales", "tailor"];
var staffDirectoryRoles = ["admin", "payroll", "sales", "tailor"];
var customPermissionValues = ["dashboard", "customers", "sales", "inventory", "payroll", "production"];
var legacyPermissions = { admin: ["dashboard", "customers", "sales", "inventory", "payroll", "production"], sales: ["dashboard", "customers", "sales"], tailor: ["customers", "production"], inventory: ["inventory"], payroll: ["payroll"] };
var customRoleCanAccess = (permissions, allowed) => allowed.some((role) => legacyPermissions[role].some((permission) => permissions.includes(permission)));
var three = (value) => value.toFixed(3);
var id = (result) => {
  const row = Array.isArray(result) ? result[0] : result;
  return Number(row?.id || 0);
};
var dashboardRange = z2.enum(["today", "7d", "30d", "90d", "all", "custom"]);
var getDashboardRangeStart = (range, now = /* @__PURE__ */ new Date()) => {
  const start = new Date(now);
  if (range === "all") return null;
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "90d") start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return start;
};
var getCustomDashboardRange = (startDate, endDate) => ({ start: /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`), end: /* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`) });
var dashboardInput = z2.object({ range: dashboardRange, startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.range === "custom" && (!value.startDate || !value.endDate)) ctx.addIssue({ code: "custom", message: "Choose both a start and end date for a custom period." });
  if (value.range === "custom" && value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The custom period end date must be on or after its start date." });
});
var salesSource = z2.enum(["counter", "manual", "tailoring"]);
var salesHistoryInput = z2.object({ search: z2.string().max(160).optional(), source: salesSource.optional(), paymentStatus: z2.enum(["paid", "partial", "unpaid"]).optional(), startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
var invoiceListInput = z2.object({ search: z2.string().max(160).optional(), status: z2.enum(["paid", "partial", "unpaid"]).optional(), source: salesSource.optional(), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]).optional(), startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
var manualSaleInput = z2.object({ customerId: z2.number().int().positive().optional(), customerName: z2.string().trim().min(2).max(160), customerPhone: z2.string().trim().max(50), description: z2.string().trim().min(2).max(160), quantity: z2.number().positive().max(999), unitPrice: z2.number().positive().max(1e6), discount: z2.number().min(0).max(1e6), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z2.enum(["paid", "partial", "unpaid"]), notes: z2.string().max(2e3) }).superRefine((value, ctx) => {
  if (value.discount > value.quantity * value.unitPrice) ctx.addIssue({ code: "custom", path: ["discount"], message: "Discount cannot exceed the sale subtotal." });
});
var monthInput = z2.object({ month: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid report month.") });
var getMonthWindow = (month) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthIndex - 1, 1)), end: new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)) };
};
async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}
async function access(userId, frameworkRole, allowed) {
  const db = await dbOrThrow();
  let record = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!record) {
    if (frameworkRole !== "admin") {
      const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.userId, userId)).limit(1))[0];
      const message = request?.status === "rejected" ? "Your ERP access request was not approved. Contact the shop owner." : "Your ERP access request is awaiting owner approval.";
      throw new TRPCError3({ code: "FORBIDDEN", message });
    }
    await db.insert(userBusinessRoles).values({ userId, role: "admin", isActive: true });
    record = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, userId)).limit(1))[0];
  }
  if (!record?.isActive) throw new TRPCError3({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (record.role === "admin") return record.role;
  const assignment = (await db.select().from(userCustomRoles).where(eq2(userCustomRoles.userId, userId)).limit(1))[0];
  if (assignment) {
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, assignment.customRoleId)).limit(1))[0];
    const permissions = Array.isArray(role?.permissionsJson) ? role.permissionsJson.filter((value) => typeof value === "string") : [];
    if (!assignment.isActive || !role?.isActive || !customRoleCanAccess(permissions, allowed)) throw new TRPCError3({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to perform this action." });
    return `custom:${role.name}`;
  }
  if (allowed.includes(record.role)) return record.role;
  throw new TRPCError3({ code: "FORBIDDEN", message: "Your assigned role is not permitted to perform this action." });
}
async function audit(userId, action, entityType, entityId, details) {
  const db = await dbOrThrow();
  await db.insert(auditLogs).values({ actorId: userId, action, entityType, entityId, detailsJson: details ? JSON.stringify(details) : null });
}
var customerInput = z2.object({ name: z2.string().min(2).max(160), phone: z2.string().min(4).max(50), email: z2.string().email().or(z2.literal("")), address: z2.string().max(1e3), notes: z2.string().max(3e3), preferredContact: z2.string().max(40) });
var tailoringOrderStatuses = ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"];
var tailoringStatus = z2.enum(tailoringOrderStatuses);
var tailoringRelationError = (customerId, measurementCustomerId, tailorActive) => {
  if (measurementCustomerId !== customerId) return "measurement";
  if (tailorActive === false) return "tailor";
  return null;
};
var canMoveTailoringOrder = (from, to) => {
  if (from === to) return true;
  const next = { draft: ["confirmed", "cancelled"], confirmed: ["cutting", "cancelled"], cutting: ["stitching", "cancelled"], stitching: ["fitting", "ready", "cancelled"], fitting: ["stitching", "ready", "cancelled"], ready: ["handed_over", "stitching", "cancelled"], handed_over: [], cancelled: [] };
  return next[from].includes(to);
};
var tailoringOrderInput = z2.object({ customerId: z2.number().int().positive(), measurementProfileId: z2.number().int().positive().optional(), assignedTailorId: z2.number().int().positive().optional(), garmentType: z2.string().min(2).max(80), quantity: z2.number().int().min(1).max(20), dueDate: z2.string().optional(), price: z2.number().min(0), notes: z2.string().max(3e3), productionNotes: z2.string().max(3e3) });
var erpRouter = router({
  shop: router({ get: protectedProcedure.query(async () => (await dbOrThrow()).select().from(shopSettings).limit(1).then((rows) => rows[0] || null)), save: protectedProcedure.input(z2.object({ shopName: z2.string().min(2), arabicShopName: z2.string(), crNumber: z2.string(), currency: z2.string(), phone: z2.string(), email: z2.string(), address: z2.string(), invoicePrefix: z2.string().min(1).max(16) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const values = { ...input, updatedBy: ctx.user.id };
    const existing = (await db.select().from(shopSettings).limit(1))[0];
    if (existing) await db.update(shopSettings).set(values).where(eq2(shopSettings.id, existing.id));
    else await db.insert(shopSettings).values(values);
    await audit(ctx.user.id, "SHOP_SETTINGS_SAVED", "shopSettings", existing?.id);
    return { success: true };
  }) }),
  dashboard: protectedProcedure.input(dashboardInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory", "tailor", "payroll"]);
    const db = await dbOrThrow();
    const range = input?.range || "30d";
    const customRange = range === "custom" && input?.startDate && input?.endDate ? getCustomDashboardRange(input.startDate, input.endDate) : null;
    const rangeStart = customRange?.start || getDashboardRangeStart(range);
    const salesWhere = customRange ? and(gte(sales.createdAt, customRange.start), lte(sales.createdAt, customRange.end)) : rangeStart ? gte(sales.createdAt, rangeStart) : void 0;
    const today = getDashboardRangeStart("today");
    const weekStart = getDashboardRangeStart("7d");
    const monthStart = getDashboardRangeStart("30d");
    const [customerCount] = await db.select({ count: sql`count(*)` }).from(customers);
    const [inventoryCount] = await db.select({ count: sql`count(*)` }).from(inventoryItems).where(eq2(inventoryItems.isActive, true));
    const [rangeMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)`, count: sql`count(*)` }).from(sales).where(salesWhere);
    const [todayMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, today));
    const [weekMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, weekStart));
    const [monthMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, monthStart));
    const low = await db.select().from(inventoryItems).where(sql`${inventoryItems.quantity} <= ${inventoryItems.minThreshold}`).orderBy(inventoryItems.quantity).limit(8);
    const filteredSales = await db.select().from(sales).where(salesWhere).orderBy(desc(sales.createdAt)).limit(250);
    const revenueByDayMap = /* @__PURE__ */ new Map();
    for (const sale of filteredSales) {
      const day = new Date(sale.createdAt).toISOString().slice(0, 10);
      revenueByDayMap.set(day, (revenueByDayMap.get(day) || 0) + Number(sale.total));
    }
    const revenueByDay = Array.from(revenueByDayMap.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([day, revenue]) => ({ day, revenue }));
    const topServices = await db.select({ name: saleItems.nameSnapshot, quantity: sql`coalesce(sum(${saleItems.quantity}), 0)`, revenue: sql`coalesce(sum(${saleItems.lineTotal}), 0)` }).from(saleItems).innerJoin(sales, eq2(saleItems.saleId, sales.id)).where(salesWhere).groupBy(saleItems.nameSnapshot).orderBy(desc(sql`sum(${saleItems.lineTotal})`)).limit(5);
    const [activeStaff] = await db.select({ count: sql`count(*)` }).from(staffProfiles).where(eq2(staffProfiles.isActive, true));
    const attendanceToday = await db.select({ status: attendance.status, count: sql`count(*)` }).from(attendance).where(eq2(attendance.workDate, today)).groupBy(attendance.status);
    const attendanceSummary = attendanceToday.reduce((summary, item) => ({ ...summary, [item.status]: Number(item.count || 0) }), { present: 0, absent: 0, leave: 0, half_day: 0 });
    const total = Number(rangeMetrics?.total || 0);
    const saleCount = Number(rangeMetrics?.count || 0);
    return { range, customerCount: Number(customerCount?.count || 0), inventoryCount: Number(inventoryCount?.count || 0), totalSales: total, saleCount, averageOrderValue: saleCount ? total / saleCount : 0, todayRevenue: Number(todayMetrics?.total || 0), weekRevenue: Number(weekMetrics?.total || 0), monthRevenue: Number(monthMetrics?.total || 0), lowStock: low, recentSales: filteredSales.slice(0, 8), revenueByDay, topServices: topServices.map((item) => ({ ...item, quantity: Number(item.quantity), revenue: Number(item.revenue) })), staff: { activeCount: Number(activeStaff?.count || 0), attendance: attendanceSummary } };
  }),
  customers: router({ list: protectedProcedure.input(z2.object({ search: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
    const db = await dbOrThrow();
    const search = input?.search?.trim();
    return search ? db.select().from(customers).where(or(like(customers.name, `%${search}%`), like(customers.phone, `%${search}%`))).orderBy(desc(customers.createdAt)).limit(20) : db.select().from(customers).orderBy(desc(customers.createdAt)).limit(20);
  }), create: protectedProcedure.input(customerInput).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const result = await db.insert(customers).values({ ...input, email: input.email || null, address: input.address || null, notes: input.notes || null }).returning({ id: customers.id });
    const customerId = id(result);
    await audit(ctx.user.id, "CUSTOMER_CREATED", "customer", customerId);
    return { id: customerId };
  }), update: protectedProcedure.input(customerInput.extend({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    await db.update(customers).set({ ...input, email: input.email || null, address: input.address || null, notes: input.notes || null }).where(eq2(customers.id, input.id));
    await audit(ctx.user.id, "CUSTOMER_UPDATED", "customer", input.id);
    return { success: true };
  }), measurements: protectedProcedure.input(z2.object({ customerId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
    return (await dbOrThrow()).select().from(measurementProfiles).where(eq2(measurementProfiles.customerId, input.customerId)).orderBy(desc(measurementProfiles.version));
  }), addMeasurement: protectedProcedure.input(z2.object({ customerId: z2.number().int(), measurements: z2.record(z2.string(), z2.string()), fitPreference: z2.string(), collarStyle: z2.string(), pocketStyle: z2.string(), notes: z2.string(), effectiveDate: z2.string() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "tailor", "sales"]);
    const db = await dbOrThrow();
    const latest = (await db.select({ version: max(measurementProfiles.version) }).from(measurementProfiles).where(eq2(measurementProfiles.customerId, input.customerId)))[0];
    const result = await db.insert(measurementProfiles).values({ ...input, measurementsJson: input.measurements, version: Number(latest?.version || 0) + 1, effectiveDate: new Date(input.effectiveDate), createdBy: ctx.user.id }).returning({ id: measurementProfiles.id });
    const profileId = id(result);
    await audit(ctx.user.id, "MEASUREMENT_VERSION_CREATED", "measurementProfile", profileId);
    return { id: profileId };
  }) }),
  inventory: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory"]);
    return (await dbOrThrow()).select().from(inventoryItems).where(eq2(inventoryItems.isActive, true)).orderBy(inventoryItems.name);
  }), create: protectedProcedure.input(z2.object({ code: z2.string().min(1), name: z2.string().min(2), category: z2.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z2.string(), widthInches: z2.number().optional(), unit: z2.string().min(1), minThreshold: z2.number().min(0), costPerUnit: z2.number().min(0), openingQuantity: z2.number().min(0) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const result = await db.insert(inventoryItems).values({ ...input, color: input.color || null, widthInches: input.widthInches?.toString(), quantity: three(input.openingQuantity), minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit) }).returning({ id: inventoryItems.id });
    const itemId = id(result);
    if (input.openingQuantity) await db.insert(stockMovements).values({ inventoryItemId: itemId, movementType: "opening", quantityChange: three(input.openingQuantity), quantityBefore: "0.000", quantityAfter: three(input.openingQuantity), createdBy: ctx.user.id, notes: "Opening balance" });
    await audit(ctx.user.id, "INVENTORY_CREATED", "inventoryItem", itemId);
    return { id: itemId };
  }), update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), code: z2.string().min(1), name: z2.string().min(2), category: z2.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z2.string(), widthInches: z2.number().optional(), unit: z2.string().min(1), minThreshold: z2.number().min(0), costPerUnit: z2.number().min(0) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const item = (await db.select({ id: inventoryItems.id }).from(inventoryItems).where(eq2(inventoryItems.id, input.id)).limit(1))[0];
    if (!item) throw new TRPCError3({ code: "NOT_FOUND", message: "Inventory item not found." });
    await db.update(inventoryItems).set({ code: input.code, name: input.name, category: input.category, color: input.color || null, widthInches: input.widthInches?.toString(), unit: input.unit, minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit) }).where(eq2(inventoryItems.id, input.id));
    await audit(ctx.user.id, "INVENTORY_UPDATED", "inventoryItem", input.id, input);
    return { success: true };
  }), adjust: protectedProcedure.input(z2.object({ inventoryItemId: z2.number().int(), quantityChange: z2.number().refine((value) => value !== 0), notes: z2.string().max(1e3) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const item = (await db.select().from(inventoryItems).where(eq2(inventoryItems.id, input.inventoryItemId)).limit(1))[0];
    if (!item) throw new TRPCError3({ code: "NOT_FOUND", message: "Inventory item not found." });
    const before = Number(item.quantity);
    const after = before + input.quantityChange;
    if (after < 0) throw new TRPCError3({ code: "BAD_REQUEST", message: "Stock cannot drop below zero." });
    await db.update(inventoryItems).set({ quantity: three(after) }).where(eq2(inventoryItems.id, item.id));
    await db.insert(stockMovements).values({ inventoryItemId: item.id, movementType: "adjustment", quantityChange: three(input.quantityChange), quantityBefore: three(before), quantityAfter: three(after), createdBy: ctx.user.id, notes: input.notes || null });
    await audit(ctx.user.id, "STOCK_ADJUSTED", "inventoryItem", item.id, input);
    return { quantity: after };
  }) }),
  services: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const records = await (await dbOrThrow()).select({ service: services, inventory: inventoryItems }).from(services).leftJoin(inventoryItems, eq2(services.inventoryItemId, inventoryItems.id)).where(eq2(services.isActive, true)).orderBy(services.name);
    return records.map((record) => ({ ...record.service, inventory: record.inventory?.id ? { id: record.inventory.id, code: record.inventory.code, name: record.inventory.name, quantity: record.inventory.quantity, unit: record.inventory.unit, isActive: record.inventory.isActive } : null }));
  }), create: protectedProcedure.input(z2.object({ sku: z2.string().min(1), name: z2.string().min(2), category: z2.enum(["tailoring", "fabric", "alteration", "accessory", "other"]), description: z2.string(), unitPrice: z2.number().positive(), inventoryItemId: z2.number().int().optional(), defaultFabricMeters: z2.number().optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const result = await (await dbOrThrow()).insert(services).values({ ...input, description: input.description || null, unitPrice: three(input.unitPrice), defaultFabricMeters: input.defaultFabricMeters?.toString() }).returning({ id: services.id });
    const serviceId = id(result);
    await audit(ctx.user.id, "SERVICE_CREATED", "service", serviceId);
    return { id: serviceId };
  }) }),
  sales: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    return (await dbOrThrow()).select().from(sales).orderBy(desc(sales.createdAt)).limit(100);
  }), create: protectedProcedure.input(z2.object({ customerId: z2.number().int().optional(), customerName: z2.string().min(1), customerPhone: z2.string().optional(), discount: z2.number().min(0), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z2.enum(["paid", "partial", "unpaid"]), items: z2.array(z2.object({ serviceId: z2.number().int().optional(), inventoryItemId: z2.number().int().optional(), name: z2.string().min(1), quantity: z2.number().positive(), unitPrice: z2.number().nonnegative() })).min(1) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = Math.max(0, subtotal - input.discount);
    const saleNumber = `SALE-${Date.now()}`;
    const invoicePrefix = shop?.invoicePrefix || "INV";
    const saleId = await db.transaction(async (tx) => {
      const saleResult = await tx.insert(sales).values({ saleNumber, customerId: input.customerId, customerNameSnapshot: input.customerName, customerPhoneSnapshot: input.customerPhone || null, subtotal: three(subtotal), discount: three(input.discount), total: three(total), paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, createdBy: ctx.user.id }).returning({ id: sales.id });
      const createdId = id(saleResult);
      for (const item of input.items) {
        await tx.insert(saleItems).values({ saleId: createdId, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: three(item.quantity), unitPrice: three(item.unitPrice), lineTotal: three(item.quantity * item.unitPrice) });
        if (item.inventoryItemId) {
          const stock = (await tx.select().from(inventoryItems).where(eq2(inventoryItems.id, item.inventoryItemId)).limit(1))[0];
          if (!stock) throw new TRPCError3({ code: "BAD_REQUEST", message: "Linked inventory item was not found." });
          const before = Number(stock.quantity);
          const after = before - item.quantity;
          if (after < 0) throw new TRPCError3({ code: "BAD_REQUEST", message: `${stock.name} does not have enough stock.` });
          await tx.update(inventoryItems).set({ quantity: three(after) }).where(eq2(inventoryItems.id, stock.id));
          await tx.insert(stockMovements).values({ inventoryItemId: stock.id, movementType: "sale", quantityChange: three(-item.quantity), quantityBefore: three(before), quantityAfter: three(after), referenceType: "sale", referenceId: createdId, createdBy: ctx.user.id, notes: saleNumber });
        }
      }
      await tx.insert(invoices).values({ saleId: createdId, invoiceNumber: `${invoicePrefix}-${String(createdId).padStart(6, "0")}`, status: input.paymentStatus });
      return createdId;
    });
    await audit(ctx.user.id, "SALE_COMPLETED", "sale", saleId, { total });
    return { id: saleId, total };
  }) }),
  salesHistory: router({ list: protectedProcedure.input(salesHistoryInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const [saleRows, invoiceRows] = await Promise.all([db.select().from(sales).orderBy(desc(sales.createdAt)).limit(500), db.select().from(invoices)]);
    const invoiceBySale = new Map(invoiceRows.map((invoice) => [invoice.saleId, invoice]));
    const search = input?.search?.trim().toLowerCase();
    const start = input?.startDate ? /* @__PURE__ */ new Date(`${input.startDate}T00:00:00.000Z`) : null;
    const end = input?.endDate ? /* @__PURE__ */ new Date(`${input.endDate}T23:59:59.999Z`) : null;
    return saleRows.filter((sale) => (!input?.source || sale.source === input.source) && (!input?.paymentStatus || sale.paymentStatus === input.paymentStatus) && (!start || sale.createdAt >= start) && (!end || sale.createdAt <= end) && (!search || [sale.saleNumber, sale.customerNameSnapshot, sale.customerPhoneSnapshot || ""].some((value) => value.toLowerCase().includes(search)))).map((sale) => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null }));
  }), createManual: protectedProcedure.input(manualSaleInput).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const [shop, customer] = await Promise.all([db.select().from(shopSettings).limit(1).then((rows) => rows[0]), input.customerId ? db.select().from(customers).where(eq2(customers.id, input.customerId)).limit(1).then((rows) => rows[0]) : Promise.resolve(void 0)]);
    if (input.customerId && !customer) throw new TRPCError3({ code: "NOT_FOUND", message: "Choose a valid customer or record this as a walk-in sale." });
    const subtotal = input.quantity * input.unitPrice;
    const total = subtotal - input.discount;
    const saleNumber = `MAN-${Date.now()}`;
    const saleId = await db.transaction(async (tx) => {
      const result = await tx.insert(sales).values({ saleNumber, customerId: customer?.id || null, customerNameSnapshot: customer?.name || input.customerName, customerPhoneSnapshot: customer?.phone || input.customerPhone || null, subtotal: three(subtotal), discount: three(input.discount), total: three(total), paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, source: "manual", createdBy: ctx.user.id }).returning({ id: sales.id });
      const createdId = id(result);
      await tx.insert(saleItems).values({ saleId: createdId, serviceId: null, inventoryItemId: null, nameSnapshot: input.description, quantity: three(input.quantity), unitPrice: three(input.unitPrice), lineTotal: three(subtotal), assignedTailorId: null, measurementProfileId: null });
      await tx.insert(invoices).values({ saleId: createdId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(createdId).padStart(6, "0")}`, status: input.paymentStatus, notes: input.notes || "Manual sale entry \u2014 no inventory was deducted." });
      return createdId;
    });
    await audit(ctx.user.id, "MANUAL_SALE_RECORDED", "sale", saleId, { saleNumber, total, paymentStatus: input.paymentStatus });
    return { id: saleId, saleNumber, total };
  }), monthlyReport: protectedProcedure.input(monthInput).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const { start, end } = getMonthWindow(input.month);
    const [allSales, invoiceRows, allItems, shop] = await Promise.all([db.select().from(sales).orderBy(desc(sales.createdAt)).limit(1e3), db.select().from(invoices), db.select().from(saleItems), db.select().from(shopSettings).limit(1).then((rows2) => rows2[0] || null)]);
    const rows = allSales.filter((sale) => sale.createdAt >= start && sale.createdAt <= end);
    const invoiceBySale = new Map(invoiceRows.map((invoice) => [invoice.saleId, invoice]));
    const includedIds = new Set(rows.map((sale) => sale.id));
    const bySource = /* @__PURE__ */ new Map();
    const byPayment = /* @__PURE__ */ new Map();
    const topLines = /* @__PURE__ */ new Map();
    for (const sale of rows) {
      const source = bySource.get(sale.source) || { count: 0, total: 0 };
      source.count += 1;
      source.total += Number(sale.total);
      bySource.set(sale.source, source);
      const payment = byPayment.get(sale.paymentMethod) || { count: 0, total: 0 };
      payment.count += 1;
      payment.total += Number(sale.total);
      byPayment.set(sale.paymentMethod, payment);
    }
    for (const line of allItems) if (includedIds.has(line.saleId)) {
      const current = topLines.get(line.nameSnapshot) || { quantity: 0, total: 0 };
      current.quantity += Number(line.quantity);
      current.total += Number(line.lineTotal);
      topLines.set(line.nameSnapshot, current);
    }
    const total = rows.reduce((sum, sale) => sum + Number(sale.total), 0);
    return { month: input.month, shop, totals: { saleCount: rows.length, revenue: total, averageOrder: rows.length ? total / rows.length : 0, paidCount: rows.filter((sale) => sale.paymentStatus === "paid").length, partialCount: rows.filter((sale) => sale.paymentStatus === "partial").length, unpaidCount: rows.filter((sale) => sale.paymentStatus === "unpaid").length }, bySource: Array.from(bySource, ([source, values]) => ({ source, ...values })), byPayment: Array.from(byPayment, ([paymentMethod, values]) => ({ paymentMethod, ...values })), topLines: Array.from(topLines, ([name, values]) => ({ name, ...values })).sort((left, right) => right.total - left.total).slice(0, 8), sales: rows.map((sale) => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null })) };
  }) }),
  invoices: router({ list: protectedProcedure.input(invoiceListInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const search = input?.search?.trim().toLowerCase();
    const start = input?.startDate ? /* @__PURE__ */ new Date(`${input.startDate}T00:00:00.000Z`) : null;
    const end = input?.endDate ? /* @__PURE__ */ new Date(`${input.endDate}T23:59:59.999Z`) : null;
    const [invoiceRows, saleRows] = await Promise.all([db.select().from(invoices).orderBy(desc(invoices.issuedAt)).limit(500), db.select().from(sales).orderBy(desc(sales.createdAt)).limit(500)]);
    const saleById = new Map(saleRows.map((sale) => [sale.id, sale]));
    return invoiceRows.map((invoice) => ({ ...invoice, sale: saleById.get(invoice.saleId) || null })).filter((row) => (!input?.status || row.status === input.status) && (!input?.source || row.sale?.source === input.source) && (!input?.paymentMethod || row.sale?.paymentMethod === input.paymentMethod) && (!start || row.issuedAt >= start) && (!end || row.issuedAt <= end) && (!search || [row.invoiceNumber, row.sale?.saleNumber || "", row.sale?.customerNameSnapshot || "", row.sale?.customerPhoneSnapshot || ""].some((value) => value.toLowerCase().includes(search))));
  }), detail: protectedProcedure.input(z2.object({ invoiceId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const invoice = (await db.select().from(invoices).where(eq2(invoices.id, input.invoiceId)).limit(1))[0];
    if (!invoice) throw new TRPCError3({ code: "NOT_FOUND", message: "Invoice not found." });
    const sale = (await db.select().from(sales).where(eq2(sales.id, invoice.saleId)).limit(1))[0];
    if (!sale) throw new TRPCError3({ code: "NOT_FOUND", message: "Sale for this invoice was not found." });
    const items = await db.select().from(saleItems).where(eq2(saleItems.saleId, sale.id));
    const shop = (await db.select().from(shopSettings).limit(1))[0] || null;
    return { invoice, sale, items, shop };
  }) }),
  staff: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, staffDirectoryRoles);
    return (await dbOrThrow()).select().from(staffProfiles).where(eq2(staffProfiles.isActive, true)).orderBy(staffProfiles.name);
  }), create: protectedProcedure.input(z2.object({ name: z2.string().min(2), phone: z2.string(), jobTitle: z2.string().min(2), baseSalary: z2.number().min(0), commissionRate: z2.number().min(0) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    const result = await (await dbOrThrow()).insert(staffProfiles).values({ ...input, phone: input.phone || null, baseSalary: three(input.baseSalary), commissionRate: three(input.commissionRate) }).returning({ id: staffProfiles.id });
    const staffId = id(result);
    await audit(ctx.user.id, "STAFF_CREATED", "staffProfile", staffId);
    return { id: staffId };
  }), recordAttendance: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int(), workDate: z2.string(), status: z2.enum(["present", "absent", "leave", "half_day"]), notes: z2.string() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    await (await dbOrThrow()).insert(attendance).values({ ...input, workDate: new Date(input.workDate), notes: input.notes || null, recordedBy: ctx.user.id });
    await audit(ctx.user.id, "ATTENDANCE_RECORDED", "attendance", input.staffProfileId);
    return { success: true };
  }), attendanceHistory: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    return (await dbOrThrow()).select().from(attendance).orderBy(desc(attendance.workDate)).limit(100);
  }), performance: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    return (await dbOrThrow()).select().from(performanceRecords).orderBy(desc(performanceRecords.workDate)).limit(100);
  }), addPerformance: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int(), workDate: z2.string(), metric: z2.string().min(2), units: z2.number().min(0), commissionEarned: z2.number().min(0), notes: z2.string() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    await (await dbOrThrow()).insert(performanceRecords).values({ ...input, workDate: new Date(input.workDate), units: three(input.units), commissionEarned: three(input.commissionEarned), notes: input.notes || null, recordedBy: ctx.user.id });
    await audit(ctx.user.id, "PERFORMANCE_RECORDED", "performanceRecord", input.staffProfileId);
    return { success: true };
  }), payouts: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    return (await dbOrThrow()).select().from(salaryPayouts).orderBy(desc(salaryPayouts.paidAt)).limit(100);
  }), createPayout: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive(), payPeriod: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid pay period."), amount: z2.number().positive("Enter a payout amount greater than zero.").max(1e6), deductions: z2.number().min(0).max(1e6), notes: z2.string().max(2e3) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, payrollRoles);
    const db = await dbOrThrow();
    const staff = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
    if (!staff) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
    const finalAmount = input.amount;
    const result = await db.insert(salaryPayouts).values({ staffProfileId: staff.id, payPeriod: input.payPeriod, baseSalary: staff.baseSalary, performanceBonus: three(0), deductions: three(input.deductions), netSalary: three(finalAmount), notes: input.notes.trim() || null, approvedBy: ctx.user.id }).returning({ id: salaryPayouts.id });
    const payoutId = id(result);
    await audit(ctx.user.id, "SALARY_PAYOUT_CREATED", "salaryPayout", payoutId, { staffProfileId: staff.id, payPeriod: input.payPeriod, finalAmount: three(finalAmount), deductions: three(input.deductions) });
    return { id: payoutId, netSalary: finalAmount };
  }) }),
  tailoring: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const [orders, clientRows, tailorRows, measurementRows] = await Promise.all([db.select().from(tailoringOrders).orderBy(desc(tailoringOrders.createdAt)).limit(100), db.select().from(customers), db.select().from(staffProfiles), db.select().from(measurementProfiles)]);
    const clients = new Map(clientRows.map((client) => [client.id, client]));
    const tailors = new Map(tailorRows.map((tailor) => [tailor.id, tailor]));
    const measurements = new Map(measurementRows.map((profile) => [profile.id, profile]));
    return orders.map((order) => ({ ...order, customerName: clients.get(order.customerId)?.name || "Archived customer", customerPhone: clients.get(order.customerId)?.phone || null, tailorName: order.assignedTailorId ? tailors.get(order.assignedTailorId)?.name || "Former tailor" : null, measurementVersion: order.measurementProfileId ? measurements.get(order.measurementProfileId)?.version || null : null }));
  }), create: protectedProcedure.input(tailoringOrderInput).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const customer = (await db.select().from(customers).where(eq2(customers.id, input.customerId)).limit(1))[0];
    if (!customer) throw new TRPCError3({ code: "NOT_FOUND", message: "Choose a valid customer for the tailoring order." });
    const profile = input.measurementProfileId ? (await db.select().from(measurementProfiles).where(eq2(measurementProfiles.id, input.measurementProfileId)).limit(1))[0] : null;
    const tailor = input.assignedTailorId ? (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.assignedTailorId)).limit(1))[0] : null;
    const relationError = tailoringRelationError(input.customerId, profile?.customerId, input.assignedTailorId ? Boolean(tailor?.isActive) : null);
    if (relationError === "measurement") throw new TRPCError3({ code: "BAD_REQUEST", message: "Save or choose a measurement version belonging to this customer before confirming the tailoring order." });
    if (relationError === "tailor") throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active tailor." });
    const orderNumber = `TO-${Date.now()}`;
    const result = await db.insert(tailoringOrders).values({ ...input, orderNumber, measurementProfileId: input.measurementProfileId || null, assignedTailorId: input.assignedTailorId || null, dueDate: input.dueDate ? new Date(input.dueDate) : null, price: three(input.price), notes: input.notes || null, productionNotes: input.productionNotes || null, createdBy: ctx.user.id, status: "confirmed" }).returning({ id: tailoringOrders.id });
    const orderId = id(result);
    await audit(ctx.user.id, "TAILORING_ORDER_CREATED", "tailoringOrder", orderId, { orderNumber, customerId: input.customerId, garmentType: input.garmentType, dueDate: input.dueDate });
    return { id: orderId, orderNumber };
  }), update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), assignedTailorId: z2.number().int().positive().optional(), status: tailoringStatus, dueDate: z2.string().optional(), productionNotes: z2.string().max(3e3) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const current = (await db.select().from(tailoringOrders).where(eq2(tailoringOrders.id, input.id)).limit(1))[0];
    if (!current) throw new TRPCError3({ code: "NOT_FOUND", message: "Tailoring order not found." });
    if (!canMoveTailoringOrder(current.status, input.status)) throw new TRPCError3({ code: "BAD_REQUEST", message: "Move the order through the production stages in sequence before handover." });
    if (input.assignedTailorId) {
      const tailor = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.assignedTailorId)).limit(1))[0];
      if (!tailor?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active tailor." });
    }
    await db.update(tailoringOrders).set({ assignedTailorId: input.assignedTailorId || null, status: input.status, dueDate: input.dueDate ? new Date(input.dueDate) : null, productionNotes: input.productionNotes || null }).where(eq2(tailoringOrders.id, input.id));
    await audit(ctx.user.id, "TAILORING_ORDER_UPDATED", "tailoringOrder", input.id, input);
    return { success: true };
  }) }),
  team: router({ listRoles: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const baseRoles = await db.select({ userId: userBusinessRoles.userId, businessRole: userBusinessRoles.role, isActive: userBusinessRoles.isActive, name: users.name, email: users.email }).from(userBusinessRoles).leftJoin(users, eq2(userBusinessRoles.userId, users.id));
    const assignments = await db.select().from(userCustomRoles);
    const definitions = await db.select().from(customRoles);
    const byUser = new Map(assignments.map((assignment) => [assignment.userId, assignment]));
    const byId = new Map(definitions.map((role) => [role.id, role]));
    return baseRoles.map((base) => {
      const assignment = byUser.get(base.userId);
      const customRole = assignment ? byId.get(assignment.customRoleId) : void 0;
      return { ...base, customRoleId: customRole?.id || null, customRoleName: customRole?.name || null, customRoleActive: Boolean(assignment?.isActive && customRole?.isActive) };
    });
  }), removeUser: protectedProcedure.input(z2.object({ userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    if (input.userId === ctx.user.id) throw new TRPCError3({ code: "FORBIDDEN", message: "The owner account cannot be removed." });
    const db = await dbOrThrow();
    const target = (await db.select({ id: users.id, role: users.role }).from(users).where(eq2(users.id, input.userId)).limit(1))[0];
    if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "This user no longer exists." });
    const targetBusinessRole = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, input.userId)).limit(1))[0];
    if (target.role === "admin" || targetBusinessRole?.role === "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Owner accounts cannot be removed." });
    await db.transaction(async (tx) => {
      await tx.delete(userCustomRoles).where(eq2(userCustomRoles.userId, input.userId));
      await tx.delete(userBusinessRoles).where(eq2(userBusinessRoles.userId, input.userId));
      await tx.delete(pendingAccessRequests).where(eq2(pendingAccessRequests.userId, input.userId));
      await tx.delete(staffAccessInvites).where(eq2(staffAccessInvites.acceptedByUserId, input.userId));
      await tx.update(staffProfiles).set({ userId: null, isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(staffProfiles.userId, input.userId));
      await tx.delete(users).where(eq2(users.id, input.userId));
    });
    await audit(ctx.user.id, "USER_REMOVED", "user", input.userId, { access: "revoked", records: "preserved" });
    return { success: true };
  }), listCustomRoles: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const rows = await (await dbOrThrow()).select().from(customRoles).orderBy(customRoles.name);
    return rows.map((role) => ({ ...role, permissions: Array.isArray(role.permissionsJson) ? role.permissionsJson.filter((value) => typeof value === "string") : [] }));
  }), createCustomRole: protectedProcedure.input(z2.object({ name: z2.string().min(2).max(80), description: z2.string().max(320), permissions: z2.array(z2.enum(customPermissionValues)).min(1) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const result = await (await dbOrThrow()).insert(customRoles).values({ name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, createdBy: ctx.user.id }).returning({ id: customRoles.id });
    const roleId = id(result);
    await audit(ctx.user.id, "CUSTOM_ROLE_CREATED", "customRole", roleId, input);
    return { id: roleId };
  }), updateCustomRole: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), name: z2.string().min(2).max(80), description: z2.string().max(320), permissions: z2.array(z2.enum(customPermissionValues)).min(1), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    await (await dbOrThrow()).update(customRoles).set({ name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, isActive: input.isActive }).where(eq2(customRoles.id, input.id));
    await audit(ctx.user.id, "CUSTOM_ROLE_UPDATED", "customRole", input.id, input);
    return { success: true };
  }), assignCustomRole: protectedProcedure.input(z2.object({ userId: z2.number().int().positive(), customRoleId: z2.number().int().positive(), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1))[0];
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
    await db.insert(userCustomRoles).values({ ...input, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: input.customRoleId, isActive: input.isActive, updatedBy: ctx.user.id } });
    await audit(ctx.user.id, "CUSTOM_ROLE_ASSIGNED", "user", input.userId, input);
    return { success: true };
  }), clearCustomRole: protectedProcedure.input(z2.object({ userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    await (await dbOrThrow()).delete(userCustomRoles).where(eq2(userCustomRoles.userId, input.userId));
    await audit(ctx.user.id, "CUSTOM_ROLE_CLEARED", "user", input.userId);
    return { success: true };
  }), assignRole: protectedProcedure.input(z2.object({ userId: z2.number().int(), role: z2.enum(["admin", "sales", "tailor", "inventory", "payroll"]), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    await db.insert(userBusinessRoles).values(input).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { role: input.role, isActive: input.isActive } });
    await audit(ctx.user.id, "BUSINESS_ROLE_ASSIGNED", "user", input.userId, input);
    return { success: true };
  }) }),
  demo: router({ populate: protectedProcedure.mutation(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const settings = (await db.select().from(shopSettings).limit(1))[0];
    const [existingCustomers] = await db.select({ count: sql`count(*)` }).from(customers);
    const [existingSales] = await db.select({ count: sql`count(*)` }).from(sales);
    const resumingDemo = Boolean(settings?.shopName?.startsWith("[DEMO]"));
    if (Number(existingSales?.count || 0) > 0) {
      const existingInvoice = (await db.select().from(invoices).limit(1))[0];
      const latestSale = (await db.select().from(sales).orderBy(desc(sales.id)).limit(1))[0];
      if (!existingInvoice && latestSale?.saleNumber.startsWith("DEMO-")) {
        await db.insert(invoices).values({ saleId: latestSale.id, invoiceNumber: `${settings?.invoicePrefix || "DEMO"}-${String(latestSale.id).padStart(6, "0")}`, status: latestSale.paymentStatus, notes: "Demo invoice \u2014 not a real transaction." });
        await audit(ctx.user.id, "DEMO_INVOICE_BACKFILLED", "invoice", latestSale.id);
      }
      return { success: true, customers: Number(existingCustomers?.count || 0), saleId: latestSale?.id || 0 };
    }
    if (Number(existingCustomers?.count || 0) > 0 && !resumingDemo) throw new TRPCError3({ code: "CONFLICT", message: "Demo data can only be loaded into an empty operational workspace." });
    const shopValues = { shopName: "[DEMO] Al-Mamlaka Tailoring", arabicShopName: "[\u062A\u062C\u0631\u064A\u0628\u064A] \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0644\u0644\u062E\u064A\u0627\u0637\u0629", crNumber: "DEMO-2026", currency: "BHD", phone: "+973 1700 0000", email: "demo@almamlaka.example", address: "[DEMO] Manama, Bahrain", invoicePrefix: "DEMO", updatedBy: ctx.user.id };
    if (settings) await db.update(shopSettings).set(shopValues).where(eq2(shopSettings.id, settings.id));
    else await db.insert(shopSettings).values(shopValues);
    await db.insert(customers).values([{ name: "[DEMO] Ahmed Al-Hassan", phone: "+973 3330 0011", email: "ahmed.demo@example.com", address: "[DEMO] Manama", notes: "Demo client \u2014 not a real customer.", preferredContact: "WhatsApp" }, { name: "[DEMO] Faisal Al-Rashid", phone: "+973 3330 0022", email: "faisal.demo@example.com", address: "[DEMO] Riffa", notes: "Demo client \u2014 not a real customer.", preferredContact: "Phone" }, { name: "[DEMO] Omar Al-Sayed", phone: "+973 3330 0033", email: "omar.demo@example.com", address: "[DEMO] Muharraq", notes: "Demo client \u2014 not a real customer.", preferredContact: "WhatsApp" }]);
    const firstCustomer = (await db.select().from(customers).where(eq2(customers.phone, "+973 3330 0011")).orderBy(desc(customers.id)).limit(1))[0];
    if (!firstCustomer) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Demo customer record could not be resolved." });
    const firstCustomerId = firstCustomer.id;
    await db.insert(measurementProfiles).values({ customerId: firstCustomerId, version: 1, measurementsJson: { neck: "15.5", chest: "42", waist: "36", shoulder: "18", sleeve: "24", length: "58" }, fitPreference: "Classic", collarStyle: "Band", pocketStyle: "Single", notes: "Demo measurement profile.", effectiveDate: /* @__PURE__ */ new Date("2026-08-01"), createdBy: ctx.user.id });
    await db.insert(inventoryItems).values([{ code: `DEMO-FAB-NAVY-${Date.now()}`, name: "[DEMO] Navy Premium Cotton", category: "fabric", color: "Navy", unit: "Meters", quantity: "18.000", minThreshold: "8.000", costPerUnit: "7.500" }, { code: `DEMO-FAB-WHT-${Date.now()}`, name: "[DEMO] White Cotton Blend", category: "fabric", color: "White", unit: "Meters", quantity: "5.000", minThreshold: "7.000", costPerUnit: "6.250" }, { code: `DEMO-BTN-GOLD-${Date.now()}`, name: "[DEMO] Gold Cuff Buttons", category: "accessory", color: "Gold", unit: "Pairs", quantity: "24.000", minThreshold: "10.000", costPerUnit: "2.000" }]);
    const navyItem = (await db.select().from(inventoryItems).where(like(inventoryItems.name, "[DEMO] Navy Premium Cotton%")).orderBy(desc(inventoryItems.id)).limit(1))[0];
    if (!navyItem) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Demo inventory record could not be resolved." });
    const navyId = navyItem.id;
    await db.insert(stockMovements).values([{ inventoryItemId: navyId, movementType: "opening", quantityChange: "18.000", quantityBefore: "0.000", quantityAfter: "18.000", createdBy: ctx.user.id, notes: "Demo opening balance" }]);
    const serviceResult = await db.insert(services).values([{ sku: `DEMO-THOBE-${Date.now()}`, name: "[DEMO] Bespoke Thobe", category: "tailoring", description: "Demo bespoke thobe service.", unitPrice: "45.000", defaultFabricMeters: "3.000" }, { sku: `DEMO-FABRIC-${Date.now()}`, name: "[DEMO] Navy Cotton Fabric", category: "fabric", description: "Demo tracked fabric line.", unitPrice: "12.000", inventoryItemId: navyId }, { sku: `DEMO-ALT-${Date.now()}`, name: "[DEMO] Sleeve Alteration", category: "alteration", description: "Demo alteration service.", unitPrice: "8.000" }]).returning({ id: services.id });
    const thobeId = id(serviceResult);
    const saleResult = await db.insert(sales).values({ saleNumber: `DEMO-SALE-${Date.now()}`, customerId: firstCustomerId, customerNameSnapshot: "[DEMO] Ahmed Al-Hassan", customerPhoneSnapshot: "+973 3330 0011", subtotal: "57.000", discount: "2.000", total: "55.000", paymentMethod: "benefitpay", paymentStatus: "paid", createdBy: ctx.user.id }).returning({ id: sales.id });
    const saleId = id(saleResult);
    await db.insert(saleItems).values([{ saleId, serviceId: thobeId, nameSnapshot: "[DEMO] Bespoke Thobe", quantity: "1.000", unitPrice: "45.000", lineTotal: "45.000" }, { saleId, nameSnapshot: "[DEMO] Navy Cotton Fabric", inventoryItemId: navyId, quantity: "1.000", unitPrice: "12.000", lineTotal: "12.000" }]);
    await db.update(inventoryItems).set({ quantity: "17.000" }).where(eq2(inventoryItems.id, navyId));
    await db.insert(stockMovements).values({ inventoryItemId: navyId, movementType: "sale", quantityChange: "-1.000", quantityBefore: "18.000", quantityAfter: "17.000", referenceType: "sale", referenceId: saleId, createdBy: ctx.user.id, notes: "Demo sale" });
    await db.insert(invoices).values({ saleId, invoiceNumber: `DEMO-${String(saleId).padStart(6, "0")}`, status: "paid", notes: "Demo invoice \u2014 not a real transaction." });
    await db.insert(staffProfiles).values([{ name: "[DEMO] Khalid Tailor", phone: "+973 3330 0101", jobTitle: "Senior Tailor", baseSalary: "520.000", commissionRate: "3.000" }, { name: "[DEMO] Sara Counter", phone: "+973 3330 0102", jobTitle: "Sales Associate", baseSalary: "420.000", commissionRate: "2.000" }]);
    await audit(ctx.user.id, "DEMO_DATA_POPULATED", "demo", saleId, { label: "All records are clearly marked [DEMO]" });
    return { success: true, customers: Number(existingCustomers?.count || 0) + 3, saleId };
  }) }),
  demoRecovery: router({ completeInvoice: protectedProcedure.mutation(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const existingInvoice = (await db.select().from(invoices).limit(1))[0];
    if (existingInvoice) return { created: false };
    const latestSale = (await db.select().from(sales).orderBy(desc(sales.id)).limit(1))[0];
    if (!latestSale || !latestSale.saleNumber.startsWith("DEMO-")) return { created: false };
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    await db.insert(invoices).values({ saleId: latestSale.id, invoiceNumber: `${shop?.invoicePrefix || "DEMO"}-${String(latestSale.id).padStart(6, "0")}`, status: latestSale.paymentStatus, notes: "Demo invoice \u2014 not a real transaction." });
    await audit(ctx.user.id, "DEMO_INVOICE_BACKFILLED", "invoice", latestSale.id);
    return { created: true };
  }) }),
  demoWorkforce: router({ seed: protectedProcedure.mutation(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    let staff = (await db.select().from(staffProfiles).where(eq2(staffProfiles.isActive, true)).orderBy(staffProfiles.id).limit(1))[0];
    if (!staff) {
      await db.insert(staffProfiles).values({ name: "[DEMO] Khalid Tailor", phone: "+973 3330 0101", jobTitle: "Senior Tailor", baseSalary: "520.000", commissionRate: "3.000" });
      staff = (await db.select().from(staffProfiles).where(eq2(staffProfiles.isActive, true)).orderBy(desc(staffProfiles.id)).limit(1))[0];
    }
    if (!staff) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Demo staff profile could not be resolved." });
    const [attendanceCount] = await db.select({ count: sql`count(*)` }).from(attendance);
    const [performanceCount] = await db.select({ count: sql`count(*)` }).from(performanceRecords);
    const [payoutCount] = await db.select({ count: sql`count(*)` }).from(salaryPayouts);
    if (Number(attendanceCount?.count || 0) === 0) await db.insert(attendance).values({ staffProfileId: staff.id, workDate: /* @__PURE__ */ new Date("2026-08-12"), status: "present", notes: "Demo attendance record \u2014 not a real workforce entry.", recordedBy: ctx.user.id });
    if (Number(performanceCount?.count || 0) === 0) await db.insert(performanceRecords).values({ staffProfileId: staff.id, workDate: /* @__PURE__ */ new Date("2026-08-12"), metric: "Demo thobe completions", units: "4.000", commissionEarned: "12.000", notes: "Demo production record \u2014 not a real workforce entry.", recordedBy: ctx.user.id });
    if (Number(payoutCount?.count || 0) === 0) await db.insert(salaryPayouts).values({ staffProfileId: staff.id, payPeriod: "2026-08", baseSalary: staff.baseSalary, performanceBonus: "12.000", deductions: "0.000", netSalary: (Number(staff.baseSalary) + 12).toFixed(3), notes: "Demo payout \u2014 not a real payroll transaction.", approvedBy: ctx.user.id });
    await audit(ctx.user.id, "DEMO_WORKFORCE_DATA_POPULATED", "staffProfile", staff.id);
    return { created: true };
  }) }),
  access: router({ listInvites: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [invites, roles] = await Promise.all([db.select().from(staffAccessInvites).orderBy(desc(staffAccessInvites.invitedAt)), db.select().from(customRoles)]);
    const roleById = new Map(roles.map((role) => [role.id, role]));
    return invites.map((invite) => ({ ...invite, roleName: roleById.get(invite.customRoleId)?.name || "Archived role" }));
  }), inviteStaff: protectedProcedure.input(z2.object({ name: z2.string().trim().min(2).max(160), email: z2.string().trim().email().max(320), customRoleId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1))[0];
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active role before preparing staff access." });
    const email = input.email.toLowerCase();
    await db.insert(staffAccessInvites).values({ name: input.name, email, customRoleId: role.id, invitedBy: ctx.user.id, isActive: true }).onConflictDoUpdate({ target: staffAccessInvites.email, set: { name: input.name, customRoleId: role.id, invitedBy: ctx.user.id, invitedAt: /* @__PURE__ */ new Date(), isActive: true, acceptedByUserId: null, acceptedAt: null } });
    await audit(ctx.user.id, "STAFF_ACCESS_PREPARED", "staffAccessInvite", void 0, { email, roleId: role.id });
    return { email, roleName: role.name };
  }), cancelInvite: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    await db.update(staffAccessInvites).set({ isActive: false }).where(eq2(staffAccessInvites.id, input.id));
    await audit(ctx.user.id, "STAFF_ACCESS_CANCELLED", "staffAccessInvite", input.id);
    return { success: true };
  }), listPending: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [requests, people] = await Promise.all([db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.status, "pending")).orderBy(desc(pendingAccessRequests.requestedAt)), db.select().from(users)]);
    const byId = new Map(people.map((person) => [person.id, person]));
    return requests.map((request) => ({ ...request, name: byId.get(request.userId)?.name || `User #${request.userId}`, email: byId.get(request.userId)?.email || null }));
  }), approvePending: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), customRoleId: z2.number().int().positive(), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [request, role] = await Promise.all([db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1).then((rows) => rows[0]), db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1).then((rows) => rows[0])]);
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
    await db.transaction(async (tx) => {
      await tx.insert(userBusinessRoles).values({ userId: request.userId, role: "sales", isActive: true }).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { isActive: true } });
      await tx.insert(userCustomRoles).values({ userId: request.userId, customRoleId: role.id, isActive: true, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: role.id, isActive: true, updatedBy: ctx.user.id } });
      await tx.update(pendingAccessRequests).set({ status: "approved", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
    });
    await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED", "pendingAccessRequest", request.id, { userId: request.userId, roleId: role.id });
    return { success: true };
  }), rejectPending: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1))[0];
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    await db.update(pendingAccessRequests).set({ status: "rejected", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
    await audit(ctx.user.id, "ACCESS_REQUEST_REJECTED", "pendingAccessRequest", request.id, { userId: request.userId });
    return { success: true };
  }) }),
  accessApproval: router({ approveWithPermissions: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), name: z2.string().trim().min(2).max(80), description: z2.string().trim().max(320), permissions: z2.array(z2.enum(["dashboard", "customers", "sales", "inventory", "production", "payroll"])).min(1), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1))[0];
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    const transaction = await db.transaction(async (tx) => {
      const roleResult = await tx.insert(customRoles).values({ name: input.name, description: input.description || null, permissionsJson: input.permissions, isActive: true, createdBy: ctx.user.id }).returning({ id: customRoles.id });
      const roleId = id(roleResult);
      await tx.insert(userBusinessRoles).values({ userId: request.userId, role: "sales", isActive: true }).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { isActive: true } });
      await tx.insert(userCustomRoles).values({ userId: request.userId, customRoleId: roleId, isActive: true, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: roleId, isActive: true, updatedBy: ctx.user.id } });
      await tx.update(pendingAccessRequests).set({ status: "approved", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
      return roleId;
    });
    await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED_WITH_PERMISSIONS", "pendingAccessRequest", request.id, { userId: request.userId, roleId: transaction });
    return { roleId: transaction };
  }) }),
  audit: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    return (await dbOrThrow()).select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
  })
});

// server/pos.ts
import { eq as eq3 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
var money = (value) => value.toFixed(3);
var calculateCheckoutTotal = (items, discount) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return { subtotal, total: Math.max(0, subtotal - discount) };
};
async function dbOrThrow2() {
  const db = await getDb();
  if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}
async function requireCounterAccess(userId, frameworkRole) {
  const db = await dbOrThrow2();
  let role = (await db.select().from(userBusinessRoles).where(eq3(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!role) {
    await db.insert(userBusinessRoles).values({ userId, role: frameworkRole === "admin" ? "admin" : "sales", isActive: true });
    role = (await db.select().from(userBusinessRoles).where(eq3(userBusinessRoles.userId, userId)).limit(1))[0];
  }
  if (!role?.isActive) throw new TRPCError4({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (role.role === "admin") return;
  const assignment = (await db.select().from(userCustomRoles).where(eq3(userCustomRoles.userId, userId)).limit(1))[0];
  if (assignment) {
    const customRole = (await db.select().from(customRoles).where(eq3(customRoles.id, assignment.customRoleId)).limit(1))[0];
    const permissions = Array.isArray(customRole?.permissionsJson) ? customRole.permissionsJson.filter((value) => typeof value === "string") : [];
    if (!assignment.isActive || !customRole?.isActive || !permissions.includes("sales")) throw new TRPCError4({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to complete counter sales." });
    return;
  }
  if (role.role !== "sales") throw new TRPCError4({ code: "FORBIDDEN", message: "Your role is not permitted to complete counter sales." });
}
var checkoutInput = z3.object({
  customerId: z3.number().int().optional(),
  customerName: z3.string().min(1).max(160),
  customerPhone: z3.string().max(50).optional(),
  discount: z3.number().min(0),
  paymentMethod: z3.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]),
  paymentStatus: z3.enum(["paid", "partial", "unpaid"]),
  items: z3.array(z3.object({ serviceId: z3.number().int().optional(), inventoryItemId: z3.number().int().optional(), name: z3.string().min(1).max(160), quantity: z3.number().positive(), unitPrice: z3.number().nonnegative() }).refine((item) => Boolean(item.serviceId || item.inventoryItemId), "Choose an inventory item or catalog item.")).min(1)
});
var tailoringCheckoutInput = z3.object({
  customerId: z3.number().int().positive(),
  measurementProfileId: z3.number().int().positive(),
  assignedTailorId: z3.number().int().positive(),
  garmentType: z3.string().trim().min(2).max(80),
  quantity: z3.number().int().min(1).max(20),
  dueDate: z3.string().optional(),
  orderPrice: z3.number().positive(),
  paymentAmount: z3.number().positive(),
  paymentMethod: z3.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]),
  notes: z3.string().max(3e3),
  productionNotes: z3.string().max(3e3)
}).superRefine((value, ctx) => {
  if (value.paymentAmount > value.orderPrice) ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: "The payment collected cannot exceed the quoted order price." });
});
var posRouter = router({
  checkout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const db = await dbOrThrow2();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const saleNumber = `POS-${Date.now()}`;
    const checkout = await db.transaction(async (tx) => {
      const resolved = [];
      for (const item of input.items) {
        if (item.inventoryItemId && !item.serviceId) {
          const stock2 = (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, item.inventoryItemId)).limit(1))[0];
          if (!stock2?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "This inventory item is no longer available at POS." });
          resolved.push({ serviceId: null, inventoryItemId: stock2.id, name: stock2.name, quantity: item.quantity, unitPrice: item.unitPrice, stockPerSaleUnit: 1, stock: stock2 });
          continue;
        }
        const catalogItem = (await tx.select().from(services).where(eq3(services.id, item.serviceId)).limit(1))[0];
        if (!catalogItem || !catalogItem.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: `${item.name} is no longer available at POS.` });
        if (item.inventoryItemId && item.inventoryItemId !== catalogItem.inventoryItemId) throw new TRPCError4({ code: "BAD_REQUEST", message: `${catalogItem.name} no longer matches the selected inventory item.` });
        const stock = catalogItem.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, catalogItem.inventoryItemId)).limit(1))[0] : null;
        if (catalogItem.inventoryItemId && !stock?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: `${catalogItem.name} has no active inventory link.` });
        resolved.push({ serviceId: catalogItem.id, inventoryItemId: catalogItem.inventoryItemId, name: catalogItem.name, quantity: item.quantity, unitPrice: Number(catalogItem.unitPrice), stockPerSaleUnit: catalogItem.inventoryItemId ? Number(catalogItem.defaultFabricMeters || 1) : 0, stock: stock || null });
      }
      const { subtotal, total } = calculateCheckoutTotal(resolved, input.discount);
      const saleResult = await tx.insert(sales).values({ saleNumber, customerId: input.customerId, customerNameSnapshot: input.customerName, customerPhoneSnapshot: input.customerPhone || null, subtotal: money(subtotal), discount: money(input.discount), total: money(total), paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, createdBy: ctx.user.id }).returning({ id: sales.id });
      const saleId = Number(saleResult[0]?.id || 0);
      if (!saleId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The sale header could not be created." });
      for (const item of resolved) {
        await tx.insert(saleItems).values({ saleId, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: money(item.quantity), unitPrice: money(item.unitPrice), lineTotal: money(item.quantity * item.unitPrice), assignedTailorId: null, measurementProfileId: null });
        if (item.inventoryItemId && item.stock) {
          const before = Number(item.stock.quantity);
          const quantityDeducted = item.quantity * item.stockPerSaleUnit;
          const after = before - quantityDeducted;
          if (after < 0) throw new TRPCError4({ code: "BAD_REQUEST", message: `${item.stock.name} does not have enough stock.` });
          await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq3(inventoryItems.id, item.stock.id));
          await tx.insert(stockMovements).values({ inventoryItemId: item.stock.id, movementType: "sale", quantityChange: money(-quantityDeducted), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: saleId, createdBy: ctx.user.id, notes: `${saleNumber} \xB7 ${money(item.stockPerSaleUnit)} ${item.stock.unit} per sale unit` });
        }
      }
      const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: input.paymentStatus, notes: "Issued from touch POS." }).returning({ id: invoices.id });
      const invoiceId = Number(invoiceResult[0]?.id || 0);
      if (!invoiceId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The invoice could not be created." });
      return { saleId, invoiceId, total, lineCount: resolved.length };
    });
    await db.insert(auditLogs).values({ actorId: ctx.user.id, action: "POS_CHECKOUT_COMPLETED", entityType: "sale", entityId: checkout.saleId, detailsJson: JSON.stringify({ saleNumber, total: checkout.total, lineCount: checkout.lineCount }) });
    return { id: checkout.saleId, invoiceId: checkout.invoiceId, total: checkout.total, saleNumber };
  }),
  tailoringCheckout: protectedProcedure.input(tailoringCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id, ctx.user.role);
    const db = await dbOrThrow2();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const orderNumber = `TO-${Date.now()}`;
    const saleNumber = `POS-TO-${Date.now()}`;
    const paymentStatus = input.paymentAmount >= input.orderPrice ? "paid" : "partial";
    const transaction = await db.transaction(async (tx) => {
      const customer = (await tx.select().from(customers).where(eq3(customers.id, input.customerId)).limit(1))[0];
      if (!customer) throw new TRPCError4({ code: "NOT_FOUND", message: "Choose a valid customer before creating a tailoring order." });
      const measurement = (await tx.select().from(measurementProfiles).where(eq3(measurementProfiles.id, input.measurementProfileId)).limit(1))[0];
      if (!measurement || measurement.customerId !== customer.id) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose a saved measurement version belonging to this customer." });
      const tailor = (await tx.select().from(staffProfiles).where(eq3(staffProfiles.id, input.assignedTailorId)).limit(1))[0];
      if (!tailor?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose an active tailor for this production order." });
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
        createdBy: ctx.user.id
      }).returning({ id: tailoringOrders.id });
      const orderId = Number(orderResult[0]?.id || 0);
      if (!orderId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring order could not be created." });
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
        createdBy: ctx.user.id
      }).returning({ id: sales.id });
      const saleId = Number(saleResult[0]?.id || 0);
      if (!saleId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring payment could not be recorded." });
      const paymentLabel = paymentStatus === "paid" ? "full payment" : "deposit";
      await tx.insert(saleItems).values({
        saleId,
        serviceId: null,
        inventoryItemId: null,
        nameSnapshot: `${input.garmentType} tailoring order \xB7 ${paymentLabel}`,
        quantity: "1.000",
        unitPrice: money(input.paymentAmount),
        lineTotal: money(input.paymentAmount),
        assignedTailorId: tailor.id,
        measurementProfileId: measurement.id
      });
      const invoiceResult = await tx.insert(invoices).values({
        saleId,
        invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`,
        status: paymentStatus,
        notes: `${orderNumber} \xB7 ${input.garmentType} \xB7 quoted ${money(input.orderPrice)} BHD \xB7 ${paymentLabel} collected from POS.`
      }).returning({ id: invoices.id });
      const invoiceId = Number(invoiceResult[0]?.id || 0);
      if (!invoiceId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The tailoring invoice could not be created." });
      return { orderId, saleId, invoiceId };
    });
    await db.insert(auditLogs).values({ actorId: ctx.user.id, action: "POS_TAILORING_CHECKOUT_COMPLETED", entityType: "tailoringOrder", entityId: transaction.orderId, detailsJson: JSON.stringify({ orderNumber, saleNumber, paymentAmount: input.paymentAmount, orderPrice: input.orderPrice, paymentStatus }) });
    return { ...transaction, orderNumber, saleNumber, total: input.paymentAmount, paymentStatus };
  })
});

// server/routers.ts
var authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user)
});
var appRouter = router({ system: systemRouter, auth: authRouter, erp: erpRouter, pos: posRouter });

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
var SUPABASE_AUTH_USER_URL = "https://cevoyflcdsdkhigyunlv.supabase.co/auth/v1/user";
async function getSupabaseUser(accessToken) {
  if (!ENV.supabaseAnonKey) {
    throw ForbiddenError("Server authentication is not configured");
  }
  let response;
  try {
    response = await fetch(SUPABASE_AUTH_USER_URL, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
  } catch {
    throw ForbiddenError("Session verification unavailable");
  }
  if (!response.ok) {
    throw ForbiddenError("Invalid session");
  }
  const data = await response.json();
  if (!data?.id) {
    throw ForbiddenError("Invalid session");
  }
  return data;
}
var SDKServer = class {
  /**
   * Verifies the Supabase access token sent as `Authorization: Bearer <token>`
   * against the Supabase Auth user endpoint, then syncs it to the app-level
   * `users` row (role/pending-approval gating lives there, not in Supabase).
   */
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : void 0;
    if (!token) {
      throw ForbiddenError("Missing session");
    }
    const authUser = await getSupabaseUser(token);
    const metadata = authUser.user_metadata;
    const name = typeof metadata?.name === "string" && metadata.name || typeof metadata?.full_name === "string" && metadata.full_name || authUser.email || "";
    await upsertUser({
      openId: authUser.id,
      name,
      email: authUser.email ?? null,
      loginMethod: "supabase",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    const user = await getUserByOpenId(authUser.id);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/vercel.ts
var vercel_default = createApp();
export {
  vercel_default as default
};
