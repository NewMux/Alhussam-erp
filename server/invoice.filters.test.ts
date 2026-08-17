import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@shared/pb-types";
import { isPocketbaseTestBinaryAvailable, startTestPocketBase, useTestPocketBaseEnv, type TestPocketBase } from "./test/pocketbaseHarness";

// Real PocketBase integration test (not a Drizzle mock) — see server/test/pocketbaseHarness.ts.
describe.skipIf(!isPocketbaseTestBinaryAvailable())("erp.invoices.list", () => {
  let instance: TestPocketBase;
  let appRouter: typeof import("./routers").appRouter;
  let actor: User;

  beforeAll(async () => {
    instance = await startTestPocketBase();
    useTestPocketBaseEnv(instance);
    ({ appRouter } = await import("./routers"));
    actor = await instance.pb.collection("users").create<User>({ email: "owner@example.com", password: "OwnerPass123!", passwordConfirm: "OwnerPass123!", name: "Owner", role: "admin", loginMethod: "test", lastSignedIn: new Date().toISOString() });
    await instance.pb.collection("userBusinessRoles").create({ userId: actor.id, role: "admin", isActive: true });
  }, 60000);

  afterAll(async () => { await instance?.stop(); });

  it("filters populated invoice rows by invoice, sale, payment, status, and date fields", async () => {
    const matchingSale = await instance.pb.collection("sales").create({ saleNumber: "SALE-101", customerNameSnapshot: "Ahmed Hassan", customerPhoneSnapshot: "+973 3000 0001", subtotal: 45, discount: 0, vatRate: 0, vatAmount: 0, total: 45, paidAmount: 45, paymentMethod: "cash", paymentStatus: "paid", source: "counter", createdBy: actor.id });
    const matchingInvoice = await instance.pb.collection("invoices").create({ saleId: matchingSale.id, invoiceNumber: "POS-000101", status: "paid", issuedAt: "2026-08-14T10:00:00.000Z" });

    const otherSale = await instance.pb.collection("sales").create({ saleNumber: "SALE-102", customerNameSnapshot: "Other Customer", customerPhoneSnapshot: "+973 3000 0002", subtotal: 45, discount: 0, vatRate: 0, vatAmount: 0, total: 45, paidAmount: 45, paymentMethod: "cash", paymentStatus: "paid", source: "manual", createdBy: actor.id });
    await instance.pb.collection("invoices").create({ saleId: otherSale.id, invoiceNumber: "POS-000102", status: "paid", issuedAt: "2026-09-01T10:00:00.000Z" });

    const caller = appRouter.createCaller({ user: actor, req: { headers: {} }, res: {} } as never);
    const result = await caller.erp.invoices.list({ search: "ahmed", status: "paid", source: "counter", paymentMethod: "cash", startDate: "2026-08-01", endDate: "2026-08-31" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: matchingInvoice.id, invoiceNumber: "POS-000101", sale: { id: matchingSale.id, saleNumber: "SALE-101", customerNameSnapshot: "Ahmed Hassan" } });
  });
});
