import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "ar";

const STORAGE_KEY = "al-hussam-language";
const ORIGINAL_TEXT = new WeakMap<Text, string>();

const ARABIC_COPY: Record<string, string> = {
  "Overview": "نظرة عامة",
  "Customers": "العملاء",
  "Inventory": "المخزون",
  "Tailoring orders": "طلبات التفصيل",
  "Point of Sale": "نقطة البيع",
  "Sales history": "سجل المبيعات",
  "Invoices": "الفواتير",
  "Staff & Payroll": "الموظفون والرواتب",
  "Shop Settings": "إعدادات المتجر",
  "Audit Trail": "سجل التدقيق",
  "Tailor ERP": "نظام الخياطة",
  "Main navigation": "التنقل الرئيسي",
  "More navigation": "المزيد من التنقل",
  "Signed-in user": "المستخدم المسجل",
  "ERP workspace": "مساحة عمل النظام",
  "Secure business workspace": "مساحة عمل تجارية آمنة",
  "Sign out": "تسجيل الخروج",
  "More": "المزيد",
  "More workspace tools": "المزيد من أدوات العمل",
  "Open the rest of your tailor business workspace.": "افتح بقية مساحة عمل متجر الخياطة.",
  "Team": "الفريق",
  "POS": "نقطة البيع",
  "Orders": "الطلبات",
  "English": "الإنجليزية",
  "Arabic": "العربية",
  "العربية": "العربية",
  "Switch to Arabic": "التبديل إلى العربية",
  "Switch to English": "التبديل إلى الإنجليزية",
  "Customers & measurements": "العملاء والمقاسات",
  "Client relations": "علاقات العملاء",
  "Client directory": "دليل العملاء",
  "New customer": "عميل جديد",
  "Edit": "تعديل",
  "Measurements": "المقاسات",
  "Outstanding balance": "الرصيد المستحق",
  "Email balance": "إرسال الرصيد بالبريد",
  "WhatsApp (future)": "واتساب (مستقبلاً)",
  "Find a client by name or phone…": "ابحث عن عميل بالاسم أو الهاتف…",
  "Point of sale": "نقطة البيع",
  "Add items → review the order → take payment": "أضف الأصناف ← راجع الطلب ← استلم الدفعة",
  "Ready to sell": "جاهز للبيع",
  "Ready": "جاهز",
  "End sales day": "إنهاء يوم المبيعات",
  "New sale": "بيع جديد",
  "Tailoring order": "طلب تفصيل",
  "Return": "مرتجع",
  "Customer": "العميل",
  "Saved": "محفوظ",
  "Register": "سجل البيع",
  "Walk-in customer": "عميل حاضر",
  "Optional customer · click to attach": "عميل اختياري · اضغط للربط",
  "Walk-in amount sale": "بيع بمبلغ مباشر",
  "Enter amount": "أدخل المبلغ",
  "Checkout": "إتمام البيع",
  "All Products": "كل المنتجات",
  "Tailoring": "التفصيل",
  "View order": "عرض الطلب",
  "0 items in order": "0 أصناف في الطلب",
  "Tailoring mode": "وضع التفصيل",
  "Create a production order and collect the deposit.": "أنشئ طلب إنتاج واستلم العربون.",
  "New bespoke tailoring order": "طلب تفصيل جديد",
  "Choose customer": "اختر العميل",
  "Measurement version": "إصدار المقاسات",
  "Assigned tailor": "الخياط المسؤول",
  "Garment type": "نوع الملابس",
  "Pieces": "القطع",
  "Due date": "تاريخ التسليم",
  "Quoted order price (BHD, VAT-inclusive)": "السعر المتفق عليه (د.ب، شامل ضريبة القيمة المضافة)",
  "Fabric supplied by customer": "القماش مقدم من العميل",
  "No shop fabric is deducted for this order when selected.": "عند اختيار هذا الخيار لن يتم خصم قماش من مخزون المتجر.",
  "Counter & fitting notes": "ملاحظات الاستقبال والقياس",
  "Production notes": "ملاحظات الإنتاج",
  "Collect now": "المبلغ المحصل الآن",
  "Balance remaining": "الرصيد المتبقي",
  "Payment method": "طريقة الدفع",
  "Cash": "نقداً",
  "BenefitPay": "بنفت بي",
  "Bank transfer": "تحويل بنكي",
  "Card": "بطاقة",
  "Confirm order & invoice": "تأكيد الطلب والفاتورة",
  "Returns mode": "وضع المرتجعات",
  "Find a receipt, select items, and refund.": "ابحث عن الإيصال، اختر الأصناف، ثم نفّذ الاسترجاع.",
  "Return or refund an order": "إرجاع أو استرداد طلب",
  "Find receipt": "البحث عن الإيصال",
  "Refund method": "طريقة الاسترداد",
  "Confirm return & refund": "تأكيد المرتجع والاسترداد",
  "Item returns restore eligible stock. Amount refunds require a reason and record the chosen amount without inventing stock movements.": "تعيد مرتجعات الأصناف الكمية المؤهلة إلى المخزون. أما الاسترداد بمبلغ محدد فيتطلب سبباً ويسجل المبلغ دون إنشاء حركة مخزون غير حقيقية.",
  "Shop settings": "إعدادات المتجر",
  "Save settings": "حفظ الإعدادات",
  "Save and start using the ERP": "حفظ والبدء باستخدام النظام",
  "VAT enabled": "ضريبة القيمة المضافة مفعلة",
  "VAT rate": "نسبة ضريبة القيمة المضافة",
  "VAT registration number": "الرقم الضريبي",
  "Invoice": "فاتورة",
  "Receipt": "إيصال",
  "Issued": "تاريخ الإصدار",
  "Bill to": "الفاتورة إلى",
  "Payment": "الدفع",
  "Sale reference": "مرجع البيع",
  "Description": "الوصف",
  "Qty": "الكمية",
  "Unit price": "سعر الوحدة",
  "Line total": "إجمالي السطر",
  "Subtotal": "المجموع الفرعي",
  "Discount": "الخصم",
  "VAT": "ضريبة القيمة المضافة",
  "Total": "الإجمالي",
  "Thank you for your business.": "شكراً لتعاملكم معنا.",
  "Staff & payroll": "الموظفون والرواتب",
  "Staff access": "صلاحيات الموظفين",
  "Add staff": "إضافة موظف",
  "Payroll": "الرواتب",
  "Payslip history": "سجل قسائم الراتب",
  "Export payroll": "تصدير الرواتب",
  "Audit trail": "سجل التدقيق",
  "No business-changing events have been recorded yet.": "لم يتم تسجيل أي أحداث تغيّر بيانات العمل بعد.",
  "Loading…": "جارٍ التحميل…",
  "Loading": "جارٍ التحميل",
  "Save": "حفظ",
  "Cancel": "إلغاء",
  "Search": "بحث",
  "Close": "إغلاق",
  "Confirm": "تأكيد",
  "Delete": "حذف",
  "Update": "تحديث",
  "Status": "الحالة",
  "Date": "التاريخ",
  "Amount": "المبلغ",
  "Notes": "ملاحظات",
};

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function translateCopy(value: string, language: Language): string {
  if (language === "en") return value;
  const trimmed = value.trim();
  const leading = value.slice(0, value.indexOf(trimmed));
  const trailing = value.slice(value.indexOf(trimmed) + trimmed.length);
  if (ARABIC_COPY[trimmed]) return `${leading}${ARABIC_COPY[trimmed]}${trailing}`;
  if (/^BHD\b/.test(trimmed)) return `${leading}${trimmed.replace(/^BHD\b/, "د.ب")}${trailing}`;
  if (/^Started (.+) · (.+)$/.test(trimmed)) {
    const [, time, detail] = trimmed.match(/^Started (.+) · (.+)$/) || [];
    return `${leading}بدأ ${time} · ${detail}${trailing}`;
  }
  if (/^Saved (\d+)$/.test(trimmed)) return `${leading}محفوظ $1${trailing}`.replace("$1", trimmed.match(/\d+/)?.[0] || "0");
  return value;
}

type LanguageContextValue = {
  language: Language;
  isArabic: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateDocument(language: Language) {
  const root = document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);
  textNodes.forEach(textNode => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("[data-no-translate]") || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) return;
    const original = ORIGINAL_TEXT.get(textNode) || textNode.nodeValue || "";
    ORIGINAL_TEXT.set(textNode, original);
    textNode.nodeValue = translateCopy(original, language);
  });
  document.querySelectorAll<HTMLElement>("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach(element => {
    ["placeholder", "aria-label", "title"].forEach(attribute => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const originalKey = `data-original-${attribute}`;
      const original = element.getAttribute(originalKey) || current;
      element.setAttribute(originalKey, original);
      element.setAttribute(attribute, translateCopy(original, language));
    });
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    isArabic: language === "ar",
    setLanguage: next => setLanguageState(next),
    toggleLanguage: () => setLanguageState(current => current === "ar" ? "en" : "ar"),
    t: value => value,
  }), [language]);

  useEffect(() => {
    try { window.localStorage?.setItem(STORAGE_KEY, language); } catch { /* Storage may be unavailable in restricted browsers. */ }
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("arabic-ui", language === "ar");
    let translating = false;
    let observer: MutationObserver;
    const apply = () => {
      if (translating) return;
      translating = true;
      observer?.disconnect();
      try {
        translateDocument(language);
      } finally {
        translating = false;
        observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
      }
    };
    observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    apply();
    return () => observer.disconnect();
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export type { Language };
