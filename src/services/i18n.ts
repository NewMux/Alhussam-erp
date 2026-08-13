export type Language = 'en' | 'ar';

export interface TranslationDictionary {
  // Navigation
  dashboard: string;
  pos: string;
  customers: string;
  invoices: string;
  inventory: string;
  payroll: string;
  admin: string;

  // Header & Controls
  online: string;
  offlineMode: string;
  syncQueue: string;
  role: string;
  commandPaletteHint: string;
  resetSeed: string;

  // Dashboard
  operationalOverview: string;
  overviewSubtitle: string;
  fastPOSCheckout: string;
  newCustomerMeasurement: string;
  todaysRevenue: string;
  augustRevenue: string;
  lowStockFabrics: string;
  totalCustomers: string;
  recentPOSTransactions: string;
  viewAllInvoices: string;
  lowStockAlerts: string;
  manageStock: string;
  quickLinks: string;

  // POS
  selectCustomer: string;
  walkInCustomer: string;
  profileLinked: string;
  noCustomerLinked: string;
  cartLineItems: string;
  offlineQueueActive: string;
  noItemsInCart: string;
  selectCatalogItems: string;
  subtotal: string;
  discount: string;
  totalPayable: string;
  paymentMethod: string;
  completeSalePrint: string;
  assignedTailor: string;
  fabricRoll: string;

  // Customers & Measurements
  customerDatabase: string;
  newCustomer: string;
  searchCustomerPlaceholder: string;
  measured: string;
  pendingMeasurement: string;
  recordMeasurements: string;
  startPOSSale: string;
  measurementProfiles: string;
  neck: string;
  chest: string;
  waist: string;
  hips: string;
  shoulder: string;
  sleeve: string;
  thobeLength: string;
  armhole: string;
  cuff: string;
  inseam: string;
  fitCut: string;
  collarStyle: string;
  pocketStyle: string;

  // Invoices
  invoiceManagement: string;
  taxInvoice: string;
  billedTo: string;
  issuedDate: string;
  amountDue: string;
  printInvoice: string;
  whatsAppShare: string;

  // Inventory
  inventoryManagement: string;
  addFabricRoll: string;
  rollCode: string;
  materialName: string;
  availableBalance: string;
  minThreshold: string;
  adjustStock: string;

  // Payroll
  staffPayroll: string;
  staffRoster: string;
  dailyAttendance: string;
  tailorPerformance: string;
  monthlyPayroll: string;
  baseSalary: string;
  commissionEarned: string;
  netSalary: string;
  issuePayout: string;
  duplicatePayoutWarning: string;

  // QR & Tech
  scanQRCode: string;
  techNativeMode: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    dashboard: 'Dashboard',
    pos: 'Point of Sale (POS)',
    customers: 'Customers & Measurements',
    invoices: 'Invoices',
    inventory: 'Inventory & Fabrics',
    payroll: 'Staff & Payroll',
    admin: 'Admin & Audit',

    online: 'Online',
    offlineMode: 'Offline Mode Active',
    syncQueue: 'Sync Queue',
    role: 'Role',
    commandPaletteHint: 'Search or Cmd + K...',
    resetSeed: 'Reset Seed',

    operationalOverview: 'Operational Overview',
    overviewSubtitle: 'Central workspace for sales, tailor measurements, stock levels, and monthly payroll.',
    fastPOSCheckout: 'Fast POS Checkout',
    newCustomerMeasurement: 'New Customer & Measurements',
    todaysRevenue: "Today's Revenue",
    augustRevenue: 'August Revenue',
    lowStockFabrics: 'Low Stock Fabrics',
    totalCustomers: 'Total Customers',
    recentPOSTransactions: 'Recent POS Transactions',
    viewAllInvoices: 'View All Invoices',
    lowStockAlerts: 'Low Stock Alerts',
    manageStock: 'Manage Stock',
    quickLinks: 'Quick Operational Links',

    selectCustomer: 'Select Customer Profile',
    walkInCustomer: 'Walk-in Customer',
    profileLinked: 'Profile Linked',
    noCustomerLinked: 'No customer profile linked',
    cartLineItems: 'Cart Line Items',
    offlineQueueActive: 'Offline Queue Active',
    noItemsInCart: 'No items in cart. Select products from the catalog to begin.',
    selectCatalogItems: 'Select items from catalog',
    subtotal: 'Subtotal',
    discount: 'Discount (BHD)',
    totalPayable: 'Total Payable',
    paymentMethod: 'Payment Method',
    completeSalePrint: 'Complete Sale & Print Receipt',
    assignedTailor: 'Assigned Tailor Specialist',
    fabricRoll: 'Fabric Roll Material',

    customerDatabase: 'Customer Database',
    newCustomer: 'New Customer',
    searchCustomerPlaceholder: 'Search by name or phone (+973)...',
    measured: 'Measured',
    pendingMeasurement: 'Pending Measurement',
    recordMeasurements: 'Record Measurements',
    startPOSSale: 'Start POS Sale',
    measurementProfiles: 'Measurement Profiles & Versions',
    neck: 'Neck Circumference',
    chest: 'Chest / Bust',
    waist: 'Waist',
    hips: 'Hips',
    shoulder: 'Shoulder Width',
    sleeve: 'Sleeve Length',
    thobeLength: 'Thobe Length',
    armhole: 'Armhole',
    cuff: 'Cuff Circumference',
    inseam: 'Inseam',
    fitCut: 'Fit Cut Preference',
    collarStyle: 'Collar Cut Style',
    pocketStyle: 'Pocket Style',

    invoiceManagement: 'Customer Invoice Management',
    taxInvoice: 'TAX INVOICE',
    billedTo: 'Billed To',
    issuedDate: 'Issued Date',
    amountDue: 'Amount Due',
    printInvoice: 'Print Invoice',
    whatsAppShare: 'WhatsApp',

    inventoryManagement: 'Inventory & Fabric Roll Management',
    addFabricRoll: 'Add Fabric Roll',
    rollCode: 'Roll / Item Code',
    materialName: 'Material Name',
    availableBalance: 'Available Balance',
    minThreshold: 'Low Stock Threshold',
    adjustStock: 'Adjust Stock',

    staffPayroll: 'Staff Roster, Attendance & Payroll',
    staffRoster: 'Staff Roster',
    dailyAttendance: 'Daily Attendance',
    tailorPerformance: 'Tailor Performance',
    monthlyPayroll: 'Monthly Payroll',
    baseSalary: 'Base Salary (BHD)',
    commissionEarned: 'Commission Earned (BHD)',
    netSalary: 'Net Salary Payable',
    issuePayout: 'Issue Payout',
    duplicatePayoutWarning: 'Duplicate Payout Warning',

    scanQRCode: 'Scan / Generate QR',
    techNativeMode: 'Tech-Native Mode',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    pos: 'نقطة البيع (POS)',
    customers: 'العملاء والقياسات',
    invoices: 'الفواتير والتحصيل',
    inventory: 'المخزون والأقمشة',
    payroll: 'الموظفون والرواتب',
    admin: 'الإدارة والتدقيق',

    online: 'متصل بالشبكة',
    offlineMode: 'وضع غير متصل نشط',
    syncQueue: 'مزامنة القائمة',
    role: 'الصلاحية',
    commandPaletteHint: 'ابحث أو Cmd + K...',
    resetSeed: 'إعادة ضبط البيانات',

    operationalOverview: 'النظرة العامة للعمليات',
    overviewSubtitle: 'مساحة العمل المركزية للمبيعات، قياسات الخياط، مستويات المخزون، والرواتب الشهرية.',
    fastPOSCheckout: 'نقطة بيع سريعة',
    newCustomerMeasurement: 'عميل وقياسات جديدة',
    todaysRevenue: 'إيراد اليوم',
    augustRevenue: 'إيرادات أغسطس',
    lowStockFabrics: 'أقمشة منخفضة المخزون',
    totalCustomers: 'إجمالي العملاء',
    recentPOSTransactions: 'أحدث معاملات الكاشير',
    viewAllInvoices: 'عرض جميع الفواتير',
    lowStockAlerts: 'تنبهات نقص المخزون',
    manageStock: 'إدارة المخزون',
    quickLinks: 'روابط تشغيلية سريعة',

    selectCustomer: 'اختيار ملف العميل',
    walkInCustomer: 'عميل متجر (بدون تسجيل)',
    profileLinked: 'تم ربط الملف',
    noCustomerLinked: 'لم يتم ربط ملف عميل',
    cartLineItems: 'عناصر سلة الشراء',
    offlineQueueActive: 'قائمة انتظار الأوفلاين نشطة',
    noItemsInCart: 'السلة فارغة. اختر المنتجات أو الخدمات للبدء.',
    selectCatalogItems: 'اختر العناصر من الكتالوج',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم (د.ب)',
    totalPayable: 'المبلغ الإجمالي المستحق',
    paymentMethod: 'طريقة الدفع',
    completeSalePrint: 'إتمام البيع وطباعة الإيصال',
    assignedTailor: 'الخياط المختص المكلَف',
    fabricRoll: 'طاقة / قماش الثوب',

    customerDatabase: 'قاعدة بيانات العملاء',
    newCustomer: 'عميل جديد',
    searchCustomerPlaceholder: 'ابحث بالاسم أو رقم الهاتف (+973)...',
    measured: 'تم أخذ القياس',
    pendingMeasurement: 'في انتظار القياس',
    recordMeasurements: 'تسجيل مقاسات الخياطة',
    startPOSSale: 'بدء فاتورة بيع',
    measurementProfiles: 'سجل مقاسات الخياطة والإصدارات',
    neck: 'محيط الرقبة (الرقبة)',
    chest: 'محيط الصدر',
    waist: 'محيط الخصر',
    hips: 'محيط الورك',
    shoulder: 'عرض الكتف',
    sleeve: 'طول الكم',
    thobeLength: 'طول الثوب الكامل',
    armhole: 'حفرة اليد (الإبط)',
    cuff: 'محيط الكبك (الأسورة)',
    inseam: 'طول السروال الداخلي',
    fitCut: 'تفصيل وتفصيل القصة',
    collarStyle: 'نوع الياقة (القلبة)',
    pocketStyle: 'نوع الجيب',

    invoiceManagement: 'إدارة فواتير العملاء',
    taxInvoice: 'فاتورة ضريبية',
    billedTo: 'فاتورة إلى',
    issuedDate: 'تاريخ الإصدار',
    amountDue: 'المبلغ المطلوب',
    printInvoice: 'طباعة الفاتورة',
    whatsAppShare: 'إرسال واتساب',

    inventoryManagement: 'إدارة المخزون وطاقات الأقمشة',
    addFabricRoll: 'إضافة طاقة قماش',
    rollCode: 'رمز طاقة القماش',
    materialName: 'اسم القماش / الخامة',
    availableBalance: 'الرصيد المتاح',
    minThreshold: 'حد الإنذار الأدنى',
    adjustStock: 'تعديل / توريد مخزون',

    staffPayroll: 'سجل الموظفين، الحضور والرواتب',
    staffRoster: 'كادر العمل',
    dailyAttendance: 'سجل الحضور اليومي',
    tailorPerformance: 'إنتاجية الخياطين',
    monthlyPayroll: 'مسرد الرواتب الشهرية',
    baseSalary: 'الراتب الأساسي (د.ب)',
    commissionEarned: 'عمولة الإنتاجية (د.ب)',
    netSalary: 'صافي الراتب المستحق',
    issuePayout: 'صرف الراتب',
    duplicatePayoutWarning: 'تحذير تكرار صرف الراتب',

    scanQRCode: 'مسح / إنشاء رمز QR',
    techNativeMode: 'الوضع التقني المتقدم',
  },
};
