import {
  ShopSettings,
  User,
  Customer,
  MeasurementProfile,
  ProductOrService,
  InventoryItem,
  StockMovement,
  StaffMember,
  AttendanceRecord,
  PerformanceRecord,
  SalaryPayout,
  Sale,
  Invoice,
  AuditEvent,
} from '../types';
import {
  INITIAL_SHOP_SETTINGS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_MEASUREMENTS,
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_STAFF,
  INITIAL_ATTENDANCE,
  INITIAL_PERFORMANCE,
  INITIAL_PAYOUTS,
  INITIAL_SALES,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
} from './initialData';

const STORAGE_KEYS = {
  SETTINGS: 'tailor_erp_settings_v1',
  USERS: 'tailor_erp_users_v1',
  CUSTOMERS: 'tailor_erp_customers_v1',
  MEASUREMENTS: 'tailor_erp_measurements_v1',
  PRODUCTS: 'tailor_erp_products_v1',
  INVENTORY: 'tailor_erp_inventory_v1',
  MOVEMENTS: 'tailor_erp_movements_v1',
  STAFF: 'tailor_erp_staff_v1',
  ATTENDANCE: 'tailor_erp_attendance_v1',
  PERFORMANCE: 'tailor_erp_performance_v1',
  PAYOUTS: 'tailor_erp_payouts_v1',
  SALES: 'tailor_erp_sales_v1',
  OFFLINE_QUEUE: 'tailor_erp_offline_queue_v1',
  INVOICES: 'tailor_erp_invoices_v1',
  AUDIT: 'tailor_erp_audit_v1',
};

// Helper for local storage reading
function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to load key ${key}`, e);
    return fallback;
  }
}

// Helper for local storage writing
function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save key ${key}`, e);
  }
}

export const StorageDB = {
  // Initialize Database with Defaults if empty
  init: () => {
    getStorage(STORAGE_KEYS.SETTINGS, INITIAL_SHOP_SETTINGS);
    getStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
    getStorage(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    getStorage(STORAGE_KEYS.MEASUREMENTS, INITIAL_MEASUREMENTS);
    getStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    getStorage(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY);
    getStorage(STORAGE_KEYS.STAFF, INITIAL_STAFF);
    getStorage(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    getStorage(STORAGE_KEYS.PERFORMANCE, INITIAL_PERFORMANCE);
    getStorage(STORAGE_KEYS.PAYOUTS, INITIAL_PAYOUTS);
    getStorage(STORAGE_KEYS.SALES, INITIAL_SALES);
    getStorage(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
    getStorage(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS);
    getStorage<Sale[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  },

  // Reset to default seed
  resetData: () => {
    localStorage.clear();
    StorageDB.init();
    window.location.reload();
  },

  // Shop Settings
  getSettings: (): ShopSettings => getStorage(STORAGE_KEYS.SETTINGS, INITIAL_SHOP_SETTINGS),
  saveSettings: (settings: ShopSettings) => setStorage(STORAGE_KEYS.SETTINGS, settings),

  // Users
  getUsers: (): User[] => getStorage(STORAGE_KEYS.USERS, INITIAL_USERS),
  saveUsers: (users: User[]) => setStorage(STORAGE_KEYS.USERS, users),

  // Customers
  getCustomers: (): Customer[] => getStorage(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
  saveCustomer: (customer: Customer): Customer => {
    const customers = StorageDB.getCustomers();
    const existingIdx = customers.findIndex((c) => c.id === customer.id);
    let updated: Customer[];
    if (existingIdx >= 0) {
      customer.updatedAt = new Date().toISOString();
      customers[existingIdx] = customer;
      updated = [...customers];
    } else {
      customer.createdAt = new Date().toISOString();
      customer.updatedAt = new Date().toISOString();
      updated = [customer, ...customers];
    }
    setStorage(STORAGE_KEYS.CUSTOMERS, updated);
    return customer;
  },

  // Measurements
  getMeasurements: (): MeasurementProfile[] => getStorage(STORAGE_KEYS.MEASUREMENTS, INITIAL_MEASUREMENTS),
  getCustomerMeasurements: (customerId: string): MeasurementProfile[] => {
    return StorageDB.getMeasurements()
      .filter((m) => m.customerId === customerId)
      .sort((a, b) => b.version - a.version);
  },
  saveMeasurement: (profile: MeasurementProfile): MeasurementProfile => {
    const list = StorageDB.getMeasurements();
    const existing = list.filter((m) => m.customerId === profile.customerId);
    const maxVersion = existing.reduce((acc, curr) => Math.max(acc, curr.version), 0);

    profile.version = maxVersion + 1;
    profile.effectiveDate = new Date().toISOString().split('T')[0];
    profile.id = `meas-${profile.customerId}-v${profile.version}`;

    const updated = [profile, ...list];
    setStorage(STORAGE_KEYS.MEASUREMENTS, updated);
    return profile;
  },

  // Products
  getProducts: (): ProductOrService[] => getStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
  saveProducts: (prods: ProductOrService[]) => setStorage(STORAGE_KEYS.PRODUCTS, prods),

  // Inventory
  getInventory: (): InventoryItem[] => getStorage(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY),
  saveInventoryItem: (item: InventoryItem): InventoryItem => {
    const list = StorageDB.getInventory();
    const idx = list.findIndex((i) => i.id === item.id);
    let updated: InventoryItem[];
    if (idx >= 0) {
      list[idx] = item;
      updated = [...list];
    } else {
      item.id = item.id || `inv-${Date.now()}`;
      updated = [item, ...list];
    }
    setStorage(STORAGE_KEYS.INVENTORY, updated);
    return item;
  },

  getMovements: (): StockMovement[] => getStorage(STORAGE_KEYS.MOVEMENTS, []),
  recordMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>): StockMovement => {
    const movements = StorageDB.getMovements();
    const newMov: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    setStorage(STORAGE_KEYS.MOVEMENTS, [newMov, ...movements]);

    // Update main inventory stock balance
    const inventory = StorageDB.getInventory();
    const item = inventory.find((i) => i.id === movement.inventoryItemId);
    if (item) {
      if (movement.type === 'stock-in' || movement.type === 'return') {
        item.quantity += movement.quantity;
      } else {
        item.quantity = Math.max(0, item.quantity - movement.quantity);
      }
      StorageDB.saveInventoryItem(item);
    }
    return newMov;
  },

  // Staff
  getStaff: (): StaffMember[] => getStorage(STORAGE_KEYS.STAFF, INITIAL_STAFF),
  saveStaff: (staff: StaffMember[]) => setStorage(STORAGE_KEYS.STAFF, staff),

  // Attendance
  getAttendance: (): AttendanceRecord[] => getStorage(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE),
  saveAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>): AttendanceRecord => {
    const list = StorageDB.getAttendance();
    const existingIdx = list.findIndex((a) => a.staffId === record.staffId && a.date === record.date);
    let updated: AttendanceRecord[];
    let saved: AttendanceRecord;
    if (existingIdx >= 0) {
      saved = { ...list[existingIdx], ...record };
      list[existingIdx] = saved;
      updated = [...list];
    } else {
      saved = { ...record, id: `att-${Date.now()}` };
      updated = [saved, ...list];
    }
    setStorage(STORAGE_KEYS.ATTENDANCE, updated);
    return saved;
  },

  // Performance
  getPerformance: (): PerformanceRecord[] => getStorage(STORAGE_KEYS.PERFORMANCE, INITIAL_PERFORMANCE),
  recordPerformance: (record: Omit<PerformanceRecord, 'id'>): PerformanceRecord => {
    const list = StorageDB.getPerformance();
    const newRec: PerformanceRecord = { ...record, id: `perf-${Date.now()}` };
    setStorage(STORAGE_KEYS.PERFORMANCE, [newRec, ...list]);
    return newRec;
  },

  // Salary Payouts
  getPayouts: (): SalaryPayout[] => getStorage(STORAGE_KEYS.PAYOUTS, INITIAL_PAYOUTS),
  createPayout: (payout: Omit<SalaryPayout, 'id'>): SalaryPayout => {
    const payouts = StorageDB.getPayouts();
    // Check duplicate
    const exists = payouts.some((p) => p.staffId === payout.staffId && p.payPeriod === payout.payPeriod);
    if (exists) {
      throw new Error(`A salary payout for ${payout.staffName} for pay period ${payout.payPeriod} already exists!`);
    }

    const newPayout: SalaryPayout = {
      ...payout,
      id: `pay-${payout.payPeriod}-${payout.staffId}`,
    };
    setStorage(STORAGE_KEYS.PAYOUTS, [newPayout, ...payouts]);
    return newPayout;
  },

  updatePayoutStatus: (id: string, status: 'Approved' | 'Paid'): SalaryPayout => {
    const payouts = StorageDB.getPayouts();
    const idx = payouts.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Payout record not found');
    payouts[idx].status = status;
    payouts[idx].payoutDate = new Date().toISOString().split('T')[0];
    setStorage(STORAGE_KEYS.PAYOUTS, payouts);
    return payouts[idx];
  },

  // Sales & Offline Queue
  getSales: (): Sale[] => getStorage(STORAGE_KEYS.SALES, INITIAL_SALES),
  getOfflineQueue: (): Sale[] => getStorage<Sale[]>(STORAGE_KEYS.OFFLINE_QUEUE, []),

  createSale: (saleData: Omit<Sale, 'id' | 'transactionNumber' | 'timestamp' | 'syncStatus'>, isOffline: boolean): { sale: Sale; invoice: Invoice } => {
    const sales = StorageDB.getSales();
    const offlineQueue = StorageDB.getOfflineQueue();
    const timestamp = new Date().toISOString();
    const txNum = `TXN-2026-${(sales.length + offlineQueue.length + 43).toString().padStart(4, '0')}`;
    const invNum = `INV-2026-${(sales.length + offlineQueue.length + 43).toString().padStart(4, '0')}`;

    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}`,
      transactionNumber: txNum,
      timestamp,
      syncStatus: isOffline ? 'pending' : 'synced',
      offline: isOffline,
    };

    const newInvoice: Invoice = {
      id: `inv-doc-${Date.now()}`,
      invoiceNumber: invNum,
      saleId: newSale.id,
      transactionNumber: txNum,
      customerId: newSale.customerId,
      customerName: newSale.customerName,
      customerPhone: newSale.customerPhone,
      items: newSale.items,
      subtotal: newSale.subtotal,
      discount: newSale.discount,
      total: newSale.total,
      paymentStatus: newSale.paymentStatus,
      paymentMethod: newSale.paymentMethod,
      issuedDate: timestamp.split('T')[0],
      dueDate: timestamp.split('T')[0],
      deliveryMetadata: { printedCount: 1 },
    };

    if (isOffline) {
      setStorage(STORAGE_KEYS.OFFLINE_QUEUE, [newSale, ...offlineQueue]);
    } else {
      setStorage(STORAGE_KEYS.SALES, [newSale, ...sales]);
      const invoices = StorageDB.getInvoices();
      setStorage(STORAGE_KEYS.INVOICES, [newInvoice, ...invoices]);
    }

    // Auto-deduct inventory if fabric used
    newSale.items.forEach((item) => {
      if (item.fabricId && item.fabricMetersUsed) {
        StorageDB.recordMovement({
          inventoryItemId: item.fabricId,
          inventoryItemName: item.fabricName || 'Fabric Roll',
          type: 'sale-deduction',
          quantity: item.fabricMetersUsed * item.quantity,
          reason: `Auto deduction for POS Sale ${txNum}`,
          referenceId: newSale.id,
          createdBy: newSale.staffUserName,
        });
      }
    });

    // Record tailor performance if assigned
    newSale.items.forEach((item) => {
      if (item.assignedTailorId && item.assignedTailorName) {
        const staff = StorageDB.getStaff().find((s) => s.id === item.assignedTailorId);
        const commission = staff ? staff.commissionPerPiece * item.quantity : 0;
        StorageDB.recordPerformance({
          staffId: item.assignedTailorId,
          staffName: item.assignedTailorName,
          date: timestamp.split('T')[0],
          metric: item.name,
          units: item.quantity,
          commissionEarned: commission,
          notes: `POS Sale ${txNum}`,
        });
      }
    });

    return { sale: newSale, invoice: newInvoice };
  },

  syncOfflineQueue: (): { syncedCount: number; errors: string[] } => {
    const queue = StorageDB.getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: [] };

    const sales = StorageDB.getSales();
    const invoices = StorageDB.getInvoices();

    const synced: Sale[] = [];
    const errors: string[] = [];

    queue.forEach((offlineSale) => {
      // Idempotency check by localId
      const exists = sales.some((s) => s.localId === offlineSale.localId);
      if (!exists) {
        const syncedSale: Sale = {
          ...offlineSale,
          syncStatus: 'synced',
          offline: false,
        };
        const syncedInvoice: Invoice = {
          id: `inv-doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          invoiceNumber: offlineSale.transactionNumber.replace('TXN', 'INV'),
          saleId: syncedSale.id,
          transactionNumber: syncedSale.transactionNumber,
          customerId: syncedSale.customerId,
          customerName: syncedSale.customerName,
          customerPhone: syncedSale.customerPhone,
          items: syncedSale.items,
          subtotal: syncedSale.subtotal,
          discount: syncedSale.discount,
          total: syncedSale.total,
          paymentStatus: syncedSale.paymentStatus,
          paymentMethod: syncedSale.paymentMethod,
          issuedDate: syncedSale.timestamp.split('T')[0],
          dueDate: syncedSale.timestamp.split('T')[0],
        };
        sales.unshift(syncedSale);
        invoices.unshift(syncedInvoice);
        synced.push(syncedSale);
      }
    });

    setStorage(STORAGE_KEYS.SALES, sales);
    setStorage(STORAGE_KEYS.INVOICES, invoices);
    setStorage(STORAGE_KEYS.OFFLINE_QUEUE, []);

    // Log audit event
    StorageDB.addAuditLog({
      actor: 'System Sync Engine',
      actorRole: 'admin',
      action: 'OFFLINE_POS_SYNC',
      entity: 'Sale',
      entityId: `BATCH-${synced.length}`,
      metadata: `Synchronized ${synced.length} offline transactions successfully.`,
    });

    return { syncedCount: synced.length, errors };
  },

  // Invoices
  getInvoices: (): Invoice[] => getStorage(STORAGE_KEYS.INVOICES, INITIAL_INVOICES),
  updateInvoiceDelivery: (invoiceId: string, channel: 'WhatsApp' | 'Email' | 'Print') => {
    const invoices = StorageDB.getInvoices();
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx >= 0) {
      const metadata = invoices[idx].deliveryMetadata || {};
      if (channel === 'WhatsApp') metadata.sentViaWhatsApp = true;
      if (channel === 'Email') metadata.sentViaEmail = true;
      if (channel === 'Print') metadata.printedCount = (metadata.printedCount || 0) + 1;
      metadata.lastActionDate = new Date().toISOString();
      invoices[idx].deliveryMetadata = metadata;
      setStorage(STORAGE_KEYS.INVOICES, invoices);
    }
  },

  // Audit Logs
  getAuditLogs: (): AuditEvent[] => getStorage(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS),
  addAuditLog: (log: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const logs = StorageDB.getAuditLogs();
    const newLog: AuditEvent = {
      ...log,
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    setStorage(STORAGE_KEYS.AUDIT, [newLog, ...logs]);
  },
};
