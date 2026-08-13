export type UserRole = 'admin' | 'sales' | 'tailor' | 'inventory' | 'payroll';

export interface User {
  id: string;
  name: string;
  login: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  preferredContact?: 'WhatsApp' | 'Phone' | 'Email';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementProfile {
  id: string;
  customerId: string;
  version: number;
  effectiveDate: string;
  createdBy: string;
  // All dimensions in inches unless specified
  neck: number;
  chest: number;
  waist: number;
  hips: number;
  shoulder: number;
  sleeveLength: number;
  thobeLength: number;
  armhole: number;
  cuff: number;
  inseam: number;
  fitPreference: 'Slim' | 'Regular' | 'Loose';
  collarStyle: 'Traditional Saudi' | 'Emirati Soft' | 'Kuwaiti Mandarin' | 'Modern Cutaway';
  pocketStyle: 'Single Chest' | 'Double Pocket' | 'Hidden Pocket';
  notes?: string;
}

export interface ProductOrService {
  id: string;
  name: string;
  category: 'Custom Tailoring' | 'Fabric Roll' | 'Ready Wear' | 'Alteration' | 'Accessories';
  unitPrice: number; // in BHD
  defaultFabricMeters?: number;
  active: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number; // BHD
  total: number; // BHD
  measurementProfileId?: string;
  assignedTailorId?: string;
  assignedTailorName?: string;
  fabricId?: string;
  fabricName?: string;
  fabricMetersUsed?: number;
}

export type PaymentMethod = 'Cash' | 'BenefitPay Card' | 'Bank Transfer' | 'Credit Card';
export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export interface Sale {
  id: string;
  localId: string;
  transactionNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  staffUserId: string;
  staffUserName: string;
  timestamp: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  offline: boolean;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  saleId: string;
  transactionNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  issuedDate: string;
  dueDate: string;
  deliveryMetadata?: {
    sentViaWhatsApp?: boolean;
    sentViaEmail?: boolean;
    printedCount?: number;
    lastActionDate?: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  category: 'Fabric' | 'Lining' | 'Buttons' | 'Thread' | 'Accessories';
  color: string;
  widthInches?: number;
  quantity: number;
  unit: 'Meters' | 'Yards' | 'Rolls' | 'Pieces';
  minThreshold: number;
  costPerUnit: number; // BHD
  active: boolean;
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: 'stock-in' | 'sale-deduction' | 'manual-adjustment' | 'return';
  quantity: number;
  reason: string;
  referenceId?: string;
  timestamp: string;
  createdBy: string;
}

export interface StaffMember {
  id: string;
  name: string;
  jobTitle: string;
  phone: string;
  baseSalary: number; // BHD
  commissionPerPiece: number; // BHD
  status: 'active' | 'inactive';
  joinedDate: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Paid Leave' | 'Unpaid Leave';

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  createdBy: string;
}

export interface PerformanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  metric: string;
  units: number;
  commissionEarned: number; // BHD
  notes?: string;
}

export interface SalaryPayout {
  id: string;
  staffId: string;
  staffName: string;
  payPeriod: string; // YYYY-MM
  baseSalary: number;
  performanceBonus: number;
  deductions: number;
  netSalary: number;
  status: 'Pending' | 'Approved' | 'Paid';
  payoutDate: string;
  notes?: string;
  approvedBy: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  metadata?: string;
}

export interface ShopSettings {
  shopName: string;
  arabicShopName: string;
  crNumber: string;
  vatNumber?: string;
  phone: string;
  address: string;
  receiptFooter: string;
  invoiceTerms: string;
  currency: string;
}
