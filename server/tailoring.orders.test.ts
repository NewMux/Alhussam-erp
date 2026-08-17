import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@shared/pb-types";
import { isPocketbaseTestBinaryAvailable, startTestPocketBase, useTestPocketBaseEnv, type TestPocketBase } from "./test/pocketbaseHarness";

// Real PocketBase integration test (not a Drizzle mock) — see server/test/pocketbaseHarness.ts.
// Run scripts/fetch-pocketbase-test-binary.sh first for this to run instead of skip.
describe.skipIf(!isPocketbaseTestBinaryAvailable())("tailoring order procedures", () => {
  let instance: TestPocketBase;
  let erpRouter: typeof import("./erp").erpRouter;
  let actor: User;

  beforeAll(async () => {
    instance = await startTestPocketBase();
    useTestPocketBaseEnv(instance);
    ({ erpRouter } = await import("./erp"));
    actor = await instance.pb.collection("users").create<User>({ email: "owner@example.com", password: "OwnerPass123!", passwordConfirm: "OwnerPass123!", name: "Owner", role: "admin", loginMethod: "test", lastSignedIn: new Date().toISOString() });
    await instance.pb.collection("userBusinessRoles").create({ userId: actor.id, role: "admin", isActive: true });
  }, 60000);

  afterAll(async () => { await instance?.stop(); });

  function makeContext() {
    return { user: actor, req: { headers: {} }, res: {} } as never;
  }
  const seedCustomer = () => instance.pb.collection("customers").create({ name: "Customer", phone: "33300011", preferredContact: "Phone" });
  const seedMeasurement = (customerId: string) => instance.pb.collection("measurementProfiles").create({ customerId, version: 1, measurementsJson: { neck: "15" }, effectiveDate: new Date().toISOString(), createdBy: actor.id });
  const seedTailor = (isActive = true) => instance.pb.collection("staffProfiles").create({ name: "Tailor", jobTitle: "Tailor", baseSalary: 0, commissionRate: 0, isActive });

  it("creates a confirmed thoub order only when the measurement belongs to the chosen customer and the tailor is active", async () => {
    const customer = await seedCustomer();
    const measurement = await seedMeasurement(customer.id);
    const tailor = await seedTailor();
    const caller = erpRouter.createCaller(makeContext());

    const result = await caller.tailoring.create({ customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "2026-08-28", price: 45, notes: "Classic fit", productionNotes: "" });
    expect(result.id).toBeTruthy();
    expect(result.orderNumber).toMatch(/^TO-/);

    // Each create() is a genuinely new order in PocketBase — unlike the old
    // insert-mock this isn't a repeated fixed id.
    const second = await caller.tailoring.create({ customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "2026-08-28", price: 45, notes: "Classic fit", productionNotes: "" });
    expect(second.id).not.toBe(result.id);
  });

  it("rejects a measurement from a different customer and an inactive assigned tailor", async () => {
    const customer = await seedCustomer();
    const otherCustomer = await seedCustomer();
    const mismatchedMeasurement = await seedMeasurement(otherCustomer.id);
    const tailor = await seedTailor();
    const caller = erpRouter.createCaller(makeContext());

    await expect(caller.tailoring.create({ customerId: customer.id, measurementProfileId: mismatchedMeasurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "", price: 0, notes: "", productionNotes: "" })).rejects.toThrow("measurement version");

    const ownMeasurement = await seedMeasurement(customer.id);
    const inactiveTailor = await seedTailor(false);
    await expect(caller.tailoring.create({ customerId: customer.id, measurementProfileId: ownMeasurement.id, assignedTailorId: inactiveTailor.id, garmentType: "Thoub", quantity: 1, dueDate: "", price: 0, notes: "", productionNotes: "" })).rejects.toThrow("active tailor");
  });

  it("persists a valid ready-to-handed-over update and blocks an invalid shortcut", async () => {
    const customer = await seedCustomer();
    const measurement = await seedMeasurement(customer.id);
    const tailor = await seedTailor();
    const caller = erpRouter.createCaller(makeContext());

    const created = await caller.tailoring.create({ customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "2026-08-28", price: 45, notes: "", productionNotes: "" });
    await instance.pb.collection("tailoringOrders").update(created.id, { status: "ready" });

    await expect(caller.tailoring.update({ id: created.id, assignedTailorId: tailor.id, status: "handed_over", dueDate: "2026-08-28", productionNotes: "Collected by customer" })).resolves.toEqual({ success: true });
    const updated = await instance.pb.collection("tailoringOrders").getOne(created.id);
    expect(updated.status).toBe("handed_over");

    // A fresh order defaults to "confirmed" — jumping straight to handed_over must be rejected.
    const another = await caller.tailoring.create({ customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: "Thoub", quantity: 1, dueDate: "", price: 0, notes: "", productionNotes: "" });
    await expect(caller.tailoring.update({ id: another.id, assignedTailorId: tailor.id, status: "handed_over", dueDate: "", productionNotes: "" })).rejects.toThrow("stages in sequence");
  });
});
