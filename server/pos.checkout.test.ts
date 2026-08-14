import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocked.getDb }));

import { posRouter } from "./pos";

const query = (rows: unknown[]) => ({
  from: () => ({
    where: () => ({ limit: () => rows }),
    limit: () => rows,
  }),
});

describe("pos.checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the live-mapped line, linked stock update, and invoice within the sale transaction", async () => {
    const writes: unknown[] = [];
    const stockUpdates: unknown[] = [];
    const transactionSelectRows = [[{ id: 4, name: "Navy cotton", inventoryItemId: 81, defaultFabricMeters: "2.000", unitPrice: "45.000", isActive: true }], [{ id: 81, name: "Navy cotton", quantity: "4.000", unit: "Meters", isActive: true }]];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); return { insertId: writes.length === 1 ? 701 : 1 }; }) })),
      select: vi.fn(() => query(transactionSelectRows.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn((value: unknown) => { stockUpdates.push(value); return { where: vi.fn() }; }) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.checkout({
      customerName: "Counter client",
      customerPhone: "+973 3000 1000",
      discount: 0,
      paymentMethod: "benefitpay",
      paymentStatus: "paid",
      items: [{ serviceId: 4, inventoryItemId: 81, name: "Navy cotton", quantity: 1, unitPrice: 45 }],
    });

    expect(result).toMatchObject({ id: 701, invoiceId: 1, total: 45 });
    expect(writes).toHaveLength(4);
    expect(writes[1]).toMatchObject({ saleId: 701, serviceId: 4, inventoryItemId: 81, lineTotal: "45.000", assignedTailorId: null, measurementProfileId: null });
    expect(stockUpdates).toEqual([{ quantity: "2.000" }]);
    expect(writes[2]).toMatchObject({ inventoryItemId: 81, movementType: "sale", referenceId: 701, quantityChange: "-2.000", quantityAfter: "2.000" });
    expect(writes[3]).toMatchObject({ saleId: 701, invoiceNumber: "POS-000701", status: "paid" });
  });

  it("sells a live inventory material directly without a catalog service dependency", async () => {
    const writes: unknown[] = [];
    const stockUpdates: unknown[] = [];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); return { insertId: writes.length === 1 ? 702 : 2 }; }) })),
      select: vi.fn(() => query([{ id: 30001, name: "Navy Premium Cotton", quantity: "16.000", unit: "Meters", costPerUnit: "7.500", isActive: true }])),
      update: vi.fn(() => ({ set: vi.fn((value: unknown) => { stockUpdates.push(value); return { where: vi.fn() }; }) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = { select: vi.fn(() => query(rootResponses.shift() || [])), insert: vi.fn(() => ({ values: vi.fn() })), transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)) };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.checkout({ customerName: "Walk-in customer", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [{ inventoryItemId: 30001, name: "Navy Premium Cotton", quantity: 2, unitPrice: 9 }] });

    expect(result).toMatchObject({ id: 702, invoiceId: 2, total: 18 });
    expect(writes[1]).toMatchObject({ saleId: 702, serviceId: null, inventoryItemId: 30001, nameSnapshot: "Navy Premium Cotton", unitPrice: "9.000", lineTotal: "18.000" });
    expect(stockUpdates).toEqual([{ quantity: "14.000" }]);
    expect(writes[2]).toMatchObject({ inventoryItemId: 30001, movementType: "sale", quantityChange: "-2.000", quantityAfter: "14.000" });
  });

  it("creates a confirmed tailoring order, deposit sale, linked sale line, and invoice atomically from POS", async () => {
    const writes: unknown[] = [];
    const transactionResponses = [
      [{ id: 44, name: "[DEMO] Ahmed Al-Hassan", phone: "+973 3330 0011" }],
      [{ id: 9, customerId: 44, version: 1 }],
      [{ id: 7, name: "[DEMO] Khalid Tailor", isActive: true }],
    ];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); const insertIds = [811, 712, 1, 43]; return { insertId: insertIds[writes.length - 1] }; }) })),
      select: vi.fn(() => query(transactionResponses.shift() || [])),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.tailoringCheckout({
      customerId: 44,
      measurementProfileId: 9,
      assignedTailorId: 7,
      garmentType: "Thoub",
      quantity: 1,
      dueDate: "2026-09-01",
      orderPrice: 45,
      paymentAmount: 20,
      paymentMethod: "benefitpay",
      notes: "[DEMO] Counter thoub order",
      productionNotes: "[DEMO] Begin after fabric selection.",
    });

    expect(result).toMatchObject({ orderId: 811, saleId: 712, invoiceId: 43, total: 20, paymentStatus: "partial" });
    expect(writes).toHaveLength(4);
    expect(writes[0]).toMatchObject({ customerId: 44, measurementProfileId: 9, assignedTailorId: 7, garmentType: "Thoub", status: "confirmed", price: "45.000" });
    expect(writes[1]).toMatchObject({ customerId: 44, subtotal: "20.000", total: "20.000", paymentStatus: "partial" });
    expect(writes[2]).toMatchObject({ saleId: 712, serviceId: null, inventoryItemId: null, assignedTailorId: 7, measurementProfileId: 9, lineTotal: "20.000" });
    expect(writes[3]).toMatchObject({ saleId: 712, invoiceNumber: "POS-000712", status: "partial" });
  });

  it("rejects a tailoring payment that exceeds the quoted order price before creating records", async () => {
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);
    await expect(caller.tailoringCheckout({ customerId: 1, measurementProfileId: 1, assignedTailorId: 1, garmentType: "Thoub", quantity: 1, orderPrice: 45, paymentAmount: 46, paymentMethod: "cash", notes: "", productionNotes: "" })).rejects.toThrow("The payment collected cannot exceed the quoted order price.");
  });
});
