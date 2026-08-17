/**
 * Hand-written record shapes for the PocketBase collections defined in
 * scripts/pocketbase-schema.ts. PocketBase record IDs are 15-char strings
 * (not the auto-incrementing integers the old Drizzle/Postgres schema used).
 */

export type Id = string;

interface Base {
  id: Id;
  createdAt: string;
  updatedAt: string;
}

export const businessRoleValues = ["admin", "sales", "tailor", "inventory", "payroll"] as const;
export type BusinessRole = (typeof businessRoleValues)[number];

export interface User extends Base {
  email: string;
  name: string | null;
  role: "user" | "admin";
  loginMethod: string | null;
  lastSignedIn: string;
  verified: boolean;
}

export interface UserBusinessRole extends Base {
  userId: Id;
  role: BusinessRole;
  isActive: boolean;
}

export interface CustomRole extends Base {
  name: string;
  description: string | null;
  permissionsJson: string[];
  isActive: boolean;
  createdBy: Id;
}

export interface UserCustomRole extends Base {
  userId: Id;
  customRoleId: Id;
  isActive: boolean;
  updatedBy: Id;
}

export interface PendingAccessRequest extends Base {
  userId: Id;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: Id | null;
  note: string | null;
}

export interface StaffAccessInvite extends Base {
  name: string;
  email: string;
  customRoleId: Id;
  isActive: boolean;
  invitedBy: Id;
  invitedAt: string;
  acceptedByUserId: Id | null;
  acceptedAt: string | null;
}

export interface ShopSettings extends Base {
  shopName: string;
  arabicShopName: string | null;
  crNumber: string | null;
  currency: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoicePrefix: string;
  vatEnabled: boolean;
  vatRate: number;
  vatNumber: string | null;
  updatedBy: Id | null;
}

export interface Customer extends Base {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  preferredContact: string | null;
}

export interface MeasurementProfile extends Base {
  customerId: Id;
  version: number;
  measurementsJson: Record<string, string>;
  fitPreference: string | null;
  collarStyle: string | null;
  pocketStyle: string | null;
  notes: string | null;
  effectiveDate: string;
  createdBy: Id;
}

export interface StaffProfile extends Base {
  userId: Id | null;
  name: string;
  phone: string | null;
  jobTitle: string;
  baseSalary: number;
  commissionRate: number;
  isActive: boolean;
}

export const tailoringOrderStatusValues = ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"] as const;
export type TailoringOrderStatus = (typeof tailoringOrderStatusValues)[number];

export interface TailoringOrder extends Base {
  orderNumber: string;
  customerId: Id;
  measurementProfileId: Id | null;
  assignedTailorId: Id | null;
  garmentType: string;
  quantity: number;
  status: TailoringOrderStatus;
  dueDate: string | null;
  price: number;
  customerSuppliedFabric: boolean;
  fabricNotes: string | null;
  notes: string | null;
  productionNotes: string | null;
  createdBy: Id;
}

export type InventoryCategory = "fabric" | "lining" | "buttons" | "thread" | "accessory" | "other";

export interface InventoryItem extends Base {
  code: string;
  name: string;
  category: InventoryCategory;
  color: string | null;
  widthInches: number | null;
  unit: string;
  quantity: number;
  minThreshold: number;
  costPerUnit: number;
  isActive: boolean;
}

export type StockMovementType = "opening" | "adjustment" | "sale" | "return" | "purchase";

export interface StockMovement extends Base {
  inventoryItemId: Id;
  movementType: StockMovementType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdBy: Id | null;
}

export type ServiceCategory = "tailoring" | "fabric" | "alteration" | "accessory" | "other";

export interface Service extends Base {
  sku: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  unitPrice: number;
  inventoryItemId: Id | null;
  defaultFabricMeters: number | null;
  isActive: boolean;
}

export interface PosSession extends Base {
  sessionNumber: string;
  status: "open" | "closed";
  openedBy: Id;
  openingCash: number;
  closingCash: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

export interface DiscountCode extends Base {
  code: string;
  type: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: Id;
}

export type PaymentMethod = "cash" | "benefitpay" | "bank_transfer" | "credit_card";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type SaleSource = "counter" | "manual" | "tailoring";

export interface Sale extends Base {
  saleNumber: string;
  clientReference: string | null;
  customerId: Id | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  source: SaleSource;
  sessionId: Id | null;
  discountCodeId: Id | null;
  discountCodeSnapshot: string | null;
  returnOfSaleId: Id | null;
  returnMode: string | null;
  returnReason: string | null;
  createdBy: Id;
}

export interface SaleItem extends Base {
  saleId: Id;
  serviceId: Id | null;
  inventoryItemId: Id | null;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  assignedTailorId: Id | null;
  measurementProfileId: Id | null;
}

export interface PosOrder extends Base {
  orderNumber: string;
  sessionId: Id | null;
  customerId: Id | null;
  status: "held" | "open" | "paid" | "cancelled" | "refunded";
  cartJson: unknown;
  note: string | null;
  createdBy: Id;
  heldAt: string;
}

export interface PosPayment extends Base {
  saleId: Id;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  createdBy: Id;
}

export interface Invoice extends Base {
  saleId: Id;
  invoiceNumber: string;
  status: "paid" | "partial" | "unpaid" | "void";
  issuedAt: string;
  dueDate: string | null;
  notes: string | null;
}

export type DeliveryChannel = "email" | "whatsapp" | "share";
export type DeliveryStatus = "prepared" | "sent" | "failed";

export interface InvoiceDelivery extends Base {
  invoiceId: Id;
  channel: DeliveryChannel;
  recipient: string | null;
  status: DeliveryStatus;
  message: string | null;
  error: string | null;
  createdBy: Id;
}

export interface CustomerBalanceDelivery extends Base {
  customerId: Id;
  channel: DeliveryChannel;
  recipient: string | null;
  status: DeliveryStatus;
  message: string | null;
  error: string | null;
  createdBy: Id;
}

export interface Attendance extends Base {
  staffProfileId: Id;
  workDate: string;
  status: "present" | "absent" | "leave" | "half_day";
  notes: string | null;
  recordedBy: Id;
}

export interface PerformanceRecord extends Base {
  staffProfileId: Id;
  workDate: string;
  metric: string;
  units: number;
  commissionEarned: number;
  notes: string | null;
  recordedBy: Id;
}

export interface SalaryPayout extends Base {
  staffProfileId: Id;
  payPeriod: string;
  payslipNumber: string | null;
  baseSalary: number;
  allowances: number;
  overtime: number;
  performanceBonus: number;
  deductions: number;
  deductionDetails: string | null;
  netSalary: number;
  notes: string | null;
  approvedBy: Id;
  paidAt: string;
}

export interface AuditLog extends Base {
  actorId: Id;
  action: string;
  entityType: string;
  entityId: string | null;
  detailsJson: string | null;
}
