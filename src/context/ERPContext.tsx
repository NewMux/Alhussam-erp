import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ShopSettings,
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
  CartItem,
  PaymentMethod,
  PaymentStatus,
} from '../types';
import { StorageDB } from '../services/db';
import { useAuth } from './AuthContext';

interface ERPContextType {
  settings: ShopSettings;
  customers: Customer[];
  measurements: MeasurementProfile[];
  products: ProductOrService[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  performance: PerformanceRecord[];
  payouts: SalaryPayout[];
  sales: Sale[];
  offlineQueue: Sale[];
  invoices: Invoice[];
  auditLogs: AuditEvent[];
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  refreshData: () => void;

  // Actions
  saveCustomer: (customer: Customer) => Customer;
  saveMeasurementProfile: (profile: MeasurementProfile) => MeasurementProfile;
  createPOSSale: (
    customerInfo: { id?: string; name: string; phone: string },
    items: CartItem[],
    subtotal: number,
    discount: number,
    total: number,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus,
    notes?: string
  ) => { sale: Sale; invoice: Invoice };
  syncOfflineSales: () => { syncedCount: number; errors: string[] };
  saveInventoryItem: (item: InventoryItem) => InventoryItem;
  recordStockMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>) => StockMovement;
  recordAttendance: (record: Omit<AttendanceRecord, 'id'>) => AttendanceRecord;
  recordPerformance: (record: Omit<PerformanceRecord, 'id'>) => PerformanceRecord;
  createPayout: (payout: Omit<SalaryPayout, 'id'>) => SalaryPayout;
  updatePayoutStatus: (id: string, status: 'Approved' | 'Paid') => SalaryPayout;
  updateInvoiceDelivery: (invoiceId: string, channel: 'WhatsApp' | 'Email' | 'Print') => void;
  updateSettings: (newSettings: ShopSettings) => void;
  resetDemoData: () => void;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<ShopSettings>(StorageDB.getSettings());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementProfile[]>([]);
  const [products, setProducts] = useState<ProductOrService[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [payouts, setPayouts] = useState<SalaryPayout[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);

  const refreshData = () => {
    StorageDB.init();
    setSettings(StorageDB.getSettings());
    setCustomers(StorageDB.getCustomers());
    setMeasurements(StorageDB.getMeasurements());
    setProducts(StorageDB.getProducts());
    setInventory(StorageDB.getInventory());
    setMovements(StorageDB.getMovements());
    setStaff(StorageDB.getStaff());
    setAttendance(StorageDB.getAttendance());
    setPerformance(StorageDB.getPerformance());
    setPayouts(StorageDB.getPayouts());
    setSales(StorageDB.getSales());
    setOfflineQueue(StorageDB.getOfflineQueue());
    setInvoices(StorageDB.getInvoices());
    setAuditLogs(StorageDB.getAuditLogs());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const toggleSimulatedOffline = () => {
    setIsSimulatedOffline((prev) => !prev);
  };

  const saveCustomer = (cust: Customer) => {
    const saved = StorageDB.saveCustomer(cust);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'CUSTOMER_SAVED',
      entity: 'Customer',
      entityId: saved.id,
      metadata: `Saved customer profile: ${saved.name} (${saved.phone})`,
    });
    refreshData();
    return saved;
  };

  const saveMeasurementProfile = (prof: MeasurementProfile) => {
    const saved = StorageDB.saveMeasurement(prof);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'MEASUREMENT_SAVED',
      entity: 'MeasurementProfile',
      entityId: saved.id,
      metadata: `Saved version ${saved.version} for customer ${saved.customerId}`,
    });
    refreshData();
    return saved;
  };

  const createPOSSale = (
    customerInfo: { id?: string; name: string; phone: string },
    items: CartItem[],
    subtotal: number,
    discount: number,
    total: number,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus,
    notes?: string
  ) => {
    const { sale, invoice } = StorageDB.createSale(
      {
        localId: `loc-${Date.now()}`,
        customerId: customerInfo.id,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        items,
        subtotal,
        discount,
        total,
        paymentMethod,
        paymentStatus,
        staffUserId: currentUser.id,
        staffUserName: currentUser.name,
        offline: isSimulatedOffline,
        notes,
      },
      isSimulatedOffline
    );

    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: isSimulatedOffline ? 'POS_SALE_OFFLINE_QUEUED' : 'POS_SALE_COMPLETED',
      entity: 'Sale',
      entityId: sale.transactionNumber,
      metadata: `Created sale ${sale.transactionNumber} for ${sale.customerName} (Total BHD ${sale.total.toFixed(3)})`,
    });

    refreshData();
    return { sale, invoice };
  };

  const syncOfflineSales = () => {
    const result = StorageDB.syncOfflineQueue();
    refreshData();
    return result;
  };

  const saveInventoryItem = (item: InventoryItem) => {
    const saved = StorageDB.saveInventoryItem(item);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'INVENTORY_ITEM_SAVED',
      entity: 'InventoryItem',
      entityId: saved.code,
      metadata: `Saved fabric/material item: ${saved.name}`,
    });
    refreshData();
    return saved;
  };

  const recordStockMovement = (movement: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const saved = StorageDB.recordMovement(movement);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'STOCK_MOVEMENT',
      entity: 'StockMovement',
      entityId: saved.id,
      metadata: `${movement.type.toUpperCase()}: ${movement.quantity} units for ${movement.inventoryItemName}`,
    });
    refreshData();
    return saved;
  };

  const recordAttendance = (record: Omit<AttendanceRecord, 'id'>) => {
    const saved = StorageDB.saveAttendanceRecord(record);
    refreshData();
    return saved;
  };

  const recordPerformance = (record: Omit<PerformanceRecord, 'id'>) => {
    const saved = StorageDB.recordPerformance(record);
    refreshData();
    return saved;
  };

  const createPayout = (payout: Omit<SalaryPayout, 'id'>) => {
    const saved = StorageDB.createPayout(payout);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'SALARY_PAYOUT_CREATED',
      entity: 'SalaryPayout',
      entityId: saved.id,
      metadata: `Created salary payout BHD ${saved.netSalary.toFixed(3)} for ${saved.staffName} (${saved.payPeriod})`,
    });
    refreshData();
    return saved;
  };

  const updatePayoutStatus = (id: string, status: 'Approved' | 'Paid') => {
    const updated = StorageDB.updatePayoutStatus(id, status);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `SALARY_PAYOUT_${status.toUpperCase()}`,
      entity: 'SalaryPayout',
      entityId: id,
      metadata: `Updated payout status to ${status} for ${updated.staffName}`,
    });
    refreshData();
    return updated;
  };

  const updateInvoiceDelivery = (invoiceId: string, channel: 'WhatsApp' | 'Email' | 'Print') => {
    StorageDB.updateInvoiceDelivery(invoiceId, channel);
    refreshData();
  };

  const updateSettings = (newSettings: ShopSettings) => {
    StorageDB.saveSettings(newSettings);
    StorageDB.addAuditLog({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: 'SETTINGS_UPDATED',
      entity: 'ShopSettings',
      entityId: newSettings.crNumber,
      metadata: 'Updated shop identity and printing configurations.',
    });
    refreshData();
  };

  const resetDemoData = () => {
    StorageDB.resetData();
  };

  return (
    <ERPContext.Provider
      value={{
        settings,
        customers,
        measurements,
        products,
        inventory,
        movements,
        staff,
        attendance,
        performance,
        payouts,
        sales,
        offlineQueue,
        invoices,
        auditLogs,
        isSimulatedOffline,
        toggleSimulatedOffline,
        refreshData,
        saveCustomer,
        saveMeasurementProfile,
        createPOSSale,
        syncOfflineSales,
        saveInventoryItem,
        recordStockMovement,
        recordAttendance,
        recordPerformance,
        createPayout,
        updatePayoutStatus,
        updateInvoiceDelivery,
        updateSettings,
        resetDemoData,
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
};
