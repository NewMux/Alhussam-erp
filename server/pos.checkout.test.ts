import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@shared/pb-types";
import { isPocketbaseTestBinaryAvailable, startTestPocketBase, useTestPocketBaseEnv, type TestPocketBase } from "./test/pocketbaseHarness";

// Real PocketBase integration test (not a Drizzle mock) — see server/test/pocketbaseHarness.ts.
describe.skipIf(!isPocketbaseTestBinaryAvailable())("pos.checkout", () => {
  let instance: TestPocketBase;
  let posRouter: typeof import("./pos").posRouter;
  let actor: User;

  beforeAll(async () => {
    instance = await startTestPocketBase();
    useTestPocketBaseEnv(instance);
    ({ posRouter } = await import("./pos"));
    actor = await instance.pb.collection("users").create<User>({ email: "cashier@example.com", password: "CashierPass123!", passwordConfirm: "CashierPass123!", name: "Cashier", role: "admin", loginMethod: "test", lastSignedIn: new Date().toISOString() });
    await instance.pb.collection("userBusinessRoles").create({ userId: actor.id, role: "admin", isActive: true });
    await instance.pb.collection("shopSettings").create({ shopName: "Test Shop", currency: "BHD", invoicePrefix: "POS" });
  }, 60000);

  afterAll(async () => { await instance?.stop(); });

  function makeContext() {
    return { user: actor, req: { headers: {} }, res: {} } as never;
  }
  const openSession = () => instance.pb.collection("posSessions").create({ sessionNumber: `POS-${crypto.randomUUID()}`, status: "open", openedBy: actor.id, openingCash: 0, openedAt: new Date().toISOString() });

  it("persists the live-mapped line, linked stock update, and invoice within the sale transaction", async () => {
    const session = await openSession();
    const inventoryItem = await instance.pb.collection("inventoryItems").create({ code: `FAB-${crypto.randomUUID()}`, name: "Navy cotton", category: "fabric", unit: "Meters", quantity: 4, minThreshold: 0, costPerUnit: 5, isActive: true });
    const service = await instance.pb.collection("services").create({ sku: `SKU-${crypto.randomUUID()}`, name: "Navy cotton", category: "fabric", unitPrice: 45, inventoryItemId: inventoryItem.id, defaultFabricMeters: 2, isActive: true });
    const caller = posRouter.createCaller(makeContext());

    const result = await caller.checkout({ sessionId: session.id, customerName: "Counter client", customerPhone: "+973 3000 1000", discount: 0, paymentMethod: "benefitpay", paymentStatus: "paid", items: [{ serviceId: service.id, inventoryItemId: inventoryItem.id, name: "Navy cotton", quantity: 1, unitPrice: 45 }] });

    expect(result.total).toBe(45);
    const items = await instance.pb.collection("saleItems").getFullList({ filter: `saleId = "${result.id}"` });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ inventoryItemId: inventoryItem.id, lineTotal: 45 });
    const stock = await instance.pb.collection("inventoryItems").getOne(inventoryItem.id);
    expect(stock.quantity).toBe(2); // 4 on hand - (1 sold * 2 meters/unit)
    const movements = await instance.pb.collection("stockMovements").getFullList({ filter: `inventoryItemId = "${inventoryItem.id}"` });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movementType: "sale", quantityChange: -2, quantityAfter: 2 });
    const invoice = await instance.pb.collection("invoices").getFirstListItem(`saleId = "${result.id}"`);
    expect(invoice.status).toBe("paid");
  });

  it("attaches a replayed checkout without a client session to the resolved open POS session", async () => {
    const session = await openSession();
    const service = await instance.pb.collection("services").create({ sku: `SKU-${crypto.randomUUID()}`, name: "Navy cotton", category: "fabric", unitPrice: 45, isActive: true });
    const caller = posRouter.createCaller(makeContext());

    const result = await caller.checkout({ clientReference: `offline-${crypto.randomUUID()}`, customerName: "Offline client", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [{ serviceId: service.id, name: "Navy cotton", quantity: 1, unitPrice: 45 }] });

    const sale = await instance.pb.collection("sales").getOne(result.id);
    expect(sale.sessionId).toBe(session.id);
  });

  it("sells a live inventory material directly without a catalog service dependency", async () => {
    const session = await openSession();
    const inventoryItem = await instance.pb.collection("inventoryItems").create({ code: `FAB-${crypto.randomUUID()}`, name: "Navy Premium Cotton", category: "fabric", unit: "Meters", quantity: 16, minThreshold: 0, costPerUnit: 7.5, isActive: true });
    const caller = posRouter.createCaller(makeContext());

    const result = await caller.checkout({ sessionId: session.id, customerName: "Walk-in customer", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [{ inventoryItemId: inventoryItem.id, name: "Navy Premium Cotton", quantity: 2, unitPrice: 9 }] });

    expect(result.total).toBe(18);
    const stock = await instance.pb.collection("inventoryItems").getOne(inventoryItem.id);
    expect(stock.quantity).toBe(14);
  });

  it("creates a confirmed tailoring order, deposit sale, linked sale line, and invoice atomically from POS", async () => {
    const session = await openSession();
    const customer = await instance.pb.collection("customers").create({ name: "Ahmed", phone: "+973 3330 0011", preferredContact: "Phone" });
    const measurement = await instance.pb.collection("measurementProfiles").create({ customerId: customer.id, version: 1, measurementsJson: { neck: "15" }, effectiveDate: new Date().toISOString(), createdBy: actor.id });
    const tailor = await instance.pb.collection("staffProfiles").create({ name: "Khalid", jobTitle: "Tailor", baseSalary: 0, commissionRate: 0, isActive: true });
    const caller = posRouter.createCaller(makeContext());

    const result = await caller.tailoringCheckout({ sessionId: session.id, customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "2026-09-01", orderPrice: 45, paymentAmount: 20, paymentMethod: "benefitpay", notes: "Counter thoub order", productionNotes: "Begin after fabric selection." });

    expect(result).toMatchObject({ total: 20, paymentStatus: "partial" });
    const order = await instance.pb.collection("tailoringOrders").getOne(result.orderId);
    expect(order).toMatchObject({ customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, status: "confirmed" });
    const sale = await instance.pb.collection("sales").getOne(result.saleId);
    expect(sale).toMatchObject({ total: 20, paymentStatus: "partial" });
  });

  it("rejects a tailoring payment that exceeds the quoted order price before creating records", async () => {
    const caller = posRouter.createCaller(makeContext());
    await expect(caller.tailoringCheckout({ sessionId: "irrelevant", customerId: "irrelevant", measurementProfileId: "irrelevant", assignedTailorId: "irrelevant", garmentType: "Thoub", quantity: 1, orderPrice: 45, paymentAmount: 46, paymentMethod: "cash", notes: "", productionNotes: "" })).rejects.toThrow("The payment collected cannot exceed the quoted order price.");
  });
});
