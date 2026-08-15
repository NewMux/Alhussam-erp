import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, BadgePercent, Banknote, Check, CheckCircle2, ChevronDown, CircleDollarSign, CreditCard, Gift, HandCoins, History, Minus, Plus, Receipt, RotateCcw, Scissors, Search, ShoppingCart, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { writeInvoiceToPrintWindow } from "@/lib/invoicePrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

type CartLine = { inventoryItemId: number; name: string; code: string; price: number; unit: string; available: number; quantity: number; lineDiscount: number };
type CustomerOption = { id: number; name: string; phone: string; address: string | null };
type PosMode = "sale" | "tailoring" | "returns";
type PaymentMethod = "cash" | "benefitpay" | "bank_transfer" | "credit_card";
type PaymentLine = { method: PaymentMethod; amount: number; reference: string };

const formatMoney = (value: number) => `BHD ${Number(value || 0).toFixed(3)}`;
const urlMoney = (key: string) => {
  const value = Number(new URLSearchParams(window.location.search).get(key) || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};
const paymentMethods: Array<{ key: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { key: "cash", label: "Cash", icon: Banknote },
  { key: "benefitpay", label: "BenefitPay", icon: CircleDollarSign },
  { key: "bank_transfer", label: "Bank transfer", icon: HandCoins },
  { key: "credit_card", label: "Card", icon: CreditCard },
];

export default function TouchPos() {
  const [mode, setMode] = useState<PosMode>(() => new URLSearchParams(window.location.search).get("mode") === "tailoring" ? "tailoring" : "sale");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState("");
  const [search, setSearch] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [measurementProfileId, setMeasurementProfileId] = useState("");
  const [assignedTailorId, setAssignedTailorId] = useState("");
  const [garmentType, setGarmentType] = useState("Thoub");
  const [garmentQuantity, setGarmentQuantity] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [orderPrice, setOrderPrice] = useState(() => urlMoney("quote"));
  const [paymentAmount, setPaymentAmount] = useState(() => urlMoney("deposit"));
  const [orderNotes, setOrderNotes] = useState("");
  const [productionNotes, setProductionNotes] = useState("");
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [returnSearch, setReturnSearch] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [heldOrderId, setHeldOrderId] = useState<number | undefined>();
  const pendingPrintWindow = useRef<Window | null>(null);

  const inventory = trpc.erp.inventory.list.useQuery();
  const customerSearchInput = useMemo(() => ({ search: customerSearch }), [customerSearch]);
  const customers = trpc.erp.customers.list.useQuery(customerSearchInput);
  const profileInput = useMemo(() => ({ customerId: Number(customerId) }), [customerId]);
  const measurements = trpc.erp.customers.measurements.useQuery(profileInput, { enabled: mode === "tailoring" && Boolean(customerId) });
  const staff = trpc.erp.staff.list.useQuery(undefined, { enabled: mode === "tailoring" });
  const session = trpc.pos.session.current.useQuery();
  const shopSettings = trpc.erp.shop.get.useQuery();
  const heldOrders = trpc.pos.orders.held.useQuery();
  const loyalty = trpc.pos.loyalty.account.useQuery({ customerId: Number(customerId) }, { enabled: Boolean(customerId) && mode === "sale" });
  const discountValidation = trpc.pos.discounts.validate.useQuery({ code: discountCode || "NONE", subtotal: Math.max(0, cart.reduce((sum, line) => sum + line.price * line.quantity - line.lineDiscount, 0)) }, { enabled: false });
  const returnLookup = trpc.pos.returns.lookup.useQuery({ saleNumber: returnSearch || "NONE" }, { enabled: returnSearch.trim().length >= 3 });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (mode === "tailoring" && !measurementProfileId && measurements.data?.length === 1) setMeasurementProfileId(String(measurements.data[0].id));
  }, [measurementProfileId, measurements.data, mode]);
  useEffect(() => {
    if (mode !== "tailoring" || assignedTailorId || !staff.data?.length) return;
    const uniqueTailors = Array.from(new Map(staff.data.map(member => [`${member.name}::${member.jobTitle}`, member])).values());
    if (uniqueTailors.length === 1) setAssignedTailorId(String(uniqueTailors[0].id));
  }, [assignedTailorId, mode, staff.data]);
  useEffect(() => {
    if (!returnLookup.data) return;
    setReturnQuantities(Object.fromEntries(returnLookup.data.items.map(item => [item.id, 0])));
  }, [returnLookup.data]);

  const printIssuedInvoice = async ({ invoiceId, saleNumber, total, orderNumber }: { invoiceId: number; saleNumber: string; total: number; orderNumber?: string }) => {
    const printWindow = pendingPrintWindow.current;
    pendingPrintWindow.current = null;
    utils.erp.dashboard.invalidate();
    utils.erp.invoices.list.invalidate();
    utils.erp.sales.list.invalidate();
    utils.erp.salesHistory.list.invalidate();
    utils.erp.salesHistory.monthlyReport.invalidate();
    utils.erp.inventory.list.invalidate();
    utils.pos.loyalty.account.invalidate();
    if (orderNumber) utils.erp.tailoring.list.invalidate();
    try {
      const detail = await utils.erp.invoices.detail.fetch({ invoiceId });
      const opened = writeInvoiceToPrintWindow({
        shop: detail.shop,
        invoice: { invoiceNumber: detail.invoice.invoiceNumber, status: detail.invoice.status, issuedAt: detail.invoice.issuedAt, notes: detail.invoice.notes },
        sale: { saleNumber: detail.sale.saleNumber, customerName: detail.sale.customerNameSnapshot, customerPhone: detail.sale.customerPhoneSnapshot, paymentMethod: detail.sale.paymentMethod, subtotal: detail.sale.subtotal, discount: detail.sale.discount, total: detail.sale.total },
        items: detail.items.map(item => ({ name: item.nameSnapshot, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })),
      }, printWindow);
      toast.success(orderNumber ? `${orderNumber} confirmed · ${formatMoney(total)} collected` : `${saleNumber} completed · ${formatMoney(total)}`);
      if (!opened) toast.message("Invoice issued. Allow pop-ups to open its print window automatically.");
    } catch {
      if (printWindow && !printWindow.closed) printWindow.close();
      toast.success(orderNumber ? `${orderNumber} confirmed` : `${saleNumber} completed`);
      toast.error("Invoice was issued, but the print window could not be opened. Use Invoices to print it.");
    }
  };

  const openSession = trpc.pos.session.open.useMutation({ onSuccess: () => { session.refetch(); toast.success("POS session opened"); }, onError: error => toast.error(error.message) });
  const closeSession = trpc.pos.session.close.useMutation({ onSuccess: () => { session.refetch(); toast.success("POS session closed"); }, onError: error => toast.error(error.message) });
  const holdOrder = trpc.pos.orders.hold.useMutation({ onSuccess: result => { setCart([]); setHeldOrderId(undefined); heldOrders.refetch(); toast.success(`${result.orderNumber} held for later`); }, onError: error => toast.error(error.message) });
  const cancelHeldOrder = trpc.pos.orders.cancel.useMutation({ onSuccess: () => { heldOrders.refetch(); toast.success("Held order cancelled"); }, onError: error => toast.error(error.message) });
  const checkout = trpc.pos.checkout.useMutation({
    onSuccess: async ({ invoiceId, saleNumber, total }) => { setCart([]); setPaymentLines([]); setPaymentOpen(false); setManualDiscount(0); setAppliedDiscountCode(""); setDiscountCode(""); setLoyaltyPointsToRedeem(0); setHeldOrderId(undefined); await printIssuedInvoice({ invoiceId, saleNumber, total }); },
    onError: error => { if (pendingPrintWindow.current && !pendingPrintWindow.current.closed) pendingPrintWindow.current.close(); pendingPrintWindow.current = null; toast.error(error.message); },
  });
  const returnSale = trpc.pos.returns.create.useMutation({
    onSuccess: async result => { setReturnSearch(""); setReturnQuantities({}); await printIssuedInvoice({ invoiceId: result.invoiceId, saleNumber: result.saleNumber, total: result.total }); },
    onError: error => { if (pendingPrintWindow.current && !pendingPrintWindow.current.closed) pendingPrintWindow.current.close(); pendingPrintWindow.current = null; toast.error(error.message); },
  });
  const resetTailoringForm = () => { setMeasurementProfileId(""); setAssignedTailorId(""); setGarmentType("Thoub"); setGarmentQuantity(1); setDueDate(""); setOrderPrice(0); setPaymentAmount(0); setOrderNotes(""); setProductionNotes(""); };
  const tailoringCheckout = trpc.pos.tailoringCheckout.useMutation({ onSuccess: async ({ invoiceId, saleNumber, total, orderNumber }) => { resetTailoringForm(); await printIssuedInvoice({ invoiceId, saleNumber, total, orderNumber }); }, onError: error => { if (pendingPrintWindow.current && !pendingPrintWindow.current.closed) pendingPrintWindow.current.close(); pendingPrintWindow.current = null; toast.error(error.message); } });

  const categories = useMemo(() => ["all", ...Array.from(new Set(inventory.data?.map(item => item.category) || []))], [inventory.data]);
  const visibleItems = useMemo(() => (inventory.data || []).filter(item => (category === "all" || item.category === category) && [item.code, item.name, item.color || ""].some(value => value.toLowerCase().includes(search.toLowerCase()))), [inventory.data, category, search]);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const lineDiscount = cart.reduce((sum, line) => sum + line.lineDiscount, 0);
  const discountAmount = Math.min(Math.max(0, subtotal - lineDiscount), manualDiscount);
  const appliedCodeAmount = appliedDiscountCode && discountValidation.data?.snapshot === appliedDiscountCode ? Number(discountValidation.data.amount) : 0;
  const loyaltyValue = Number(shopSettings.data?.loyaltyPointValue ?? 0.1);
  const loyaltyDiscount = Math.min(Math.max(0, subtotal - lineDiscount - discountAmount - appliedCodeAmount), loyaltyPointsToRedeem * loyaltyValue);
  const total = Math.max(0, subtotal - lineDiscount - discountAmount - appliedCodeAmount - loyaltyDiscount);
  const paidTotal = paymentLines.reduce((sum, line) => sum + line.amount, 0);
  const outstanding = Math.max(0, total - paidTotal);
  const tailoringOutstanding = Math.max(0, orderPrice - paymentAmount);
  const tailoringReady = Boolean(customerId && selectedCustomer && measurementProfileId && assignedTailorId && garmentType.trim().length >= 2 && garmentQuantity > 0 && orderPrice > 0 && paymentAmount > 0 && paymentAmount <= orderPrice);

  const add = (item: NonNullable<typeof inventory.data>[number]) => setCart(current => {
    const existing = current.find(line => line.inventoryItemId === item.id);
    const available = Number(item.quantity);
    const nextQuantity = (existing?.quantity || 0) + 1;
    if (nextQuantity > available) { toast.error(`${item.name} only has ${item.quantity} ${item.unit} available.`); return current; }
    return existing ? current.map(line => line.inventoryItemId === item.id ? { ...line, quantity: nextQuantity, available } : line) : [...current, { inventoryItemId: item.id, name: item.name, code: item.code, price: Number(item.costPerUnit), unit: item.unit, available, quantity: 1, lineDiscount: 0 }];
  });
  const changeQuantity = (inventoryItemId: number, delta: number) => setCart(current => current.flatMap(line => { if (line.inventoryItemId !== inventoryItemId) return [line]; if (line.quantity + delta <= 0) return []; if (line.quantity + delta > line.available) { toast.error(`${line.name} only has ${line.available.toFixed(3)} ${line.unit} available.`); return [line]; } return [{ ...line, quantity: line.quantity + delta }]; }));
  const changePrice = (inventoryItemId: number, price: number) => setCart(current => current.map(line => line.inventoryItemId === inventoryItemId ? { ...line, price: Math.max(0, price) } : line));
  const changeLineDiscount = (inventoryItemId: number, value: number) => setCart(current => current.map(line => line.inventoryItemId === inventoryItemId ? { ...line, lineDiscount: Math.min(line.price * line.quantity, Math.max(0, value)) } : line));
  const chooseCustomer = (customer: CustomerOption | null) => { setCustomerId(customer ? String(customer.id) : ""); setSelectedCustomer(customer); setMeasurementProfileId(""); setLoyaltyPointsToRedeem(0); setCustomerSearch(""); setCustomerPickerOpen(false); };
  const loadHeldOrder = (order: NonNullable<typeof heldOrders.data>[number]) => { setCart((order.cartJson || []) as unknown as CartLine[]); setHeldOrderId(order.id); setCustomerId(order.customerId ? String(order.customerId) : ""); setMode("sale"); toast.success(`${order.orderNumber} loaded`); };
  const addPaymentLine = () => setPaymentLines(current => [...current, { method: "cash", amount: Math.max(0, total - current.reduce((sum, line) => sum + line.amount, 0)), reference: "" }]);
  const completeCheckout = () => {
    if (!session.data) { toast.error("Open a POS session before checking out."); return; }
    const lines = paymentLines.filter(line => line.amount > 0);
    if (lines.reduce((sum, line) => sum + line.amount, 0) > total + 0.001) { toast.error("Payment lines cannot exceed the order total."); return; }
    pendingPrintWindow.current = window.open("", "_blank", "popup,width=900,height=720");
    checkout.mutate({ sessionId: session.data.id, heldOrderId, customerId: customerId ? Number(customerId) : undefined, customerName: selectedCustomer?.name || "Walk-in customer", customerPhone: selectedCustomer?.phone, note: orderNote || undefined, discount: discountAmount, discountCode: appliedDiscountCode || undefined, loyaltyPointsToRedeem, paymentMethod: lines[0]?.method || paymentMethod, paymentStatus: lines.length && lines.reduce((sum, line) => sum + line.amount, 0) >= total - 0.001 ? "paid" : lines.length ? "partial" : "unpaid", payments: lines.map(line => ({ method: line.method, amount: line.amount, reference: line.reference || undefined })), items: cart.map(line => ({ inventoryItemId: line.inventoryItemId, name: line.name, quantity: line.quantity, unitPrice: line.price, lineDiscount: line.lineDiscount })) });
  };
  const completeTailoringCheckout = () => { if (!session.data) { toast.error("Open a POS session before creating a tailoring order."); return; } if (!tailoringReady || !selectedCustomer) { toast.error("Choose the customer, saved measurement, tailor, garment, quote, and payment before issuing the order."); return; } pendingPrintWindow.current = window.open("", "_blank", "popup,width=900,height=720"); tailoringCheckout.mutate({ sessionId: session.data.id, customerId: selectedCustomer.id, measurementProfileId: Number(measurementProfileId), assignedTailorId: Number(assignedTailorId), garmentType: garmentType.trim(), quantity: garmentQuantity, dueDate: dueDate || undefined, orderPrice, paymentAmount, paymentMethod, notes: orderNotes, productionNotes }); };
  const completeReturn = () => { if (!session.data) { toast.error("Open a POS session before processing a return."); return; } if (!returnLookup.data) return; const items = returnLookup.data.items.filter(item => (returnQuantities[item.id] || 0) > 0).map(item => ({ saleItemId: item.id, quantity: returnQuantities[item.id] || 0 })); if (!items.length) { toast.error("Choose at least one item to return."); return; } pendingPrintWindow.current = window.open("", "_blank", "popup,width=900,height=720"); returnSale.mutate({ sessionId: session.data.id, originalSaleId: returnLookup.data.sale.id, paymentMethod, items }); };

  if (inventory.isLoading) return <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">Loading register…</div>;
  if (inventory.error || customers.error || shopSettings.error || (mode === "tailoring" && (measurements.error || staff.error))) return <p className="text-destructive">{inventory.error?.message || customers.error?.message || shopSettings.error?.message || measurements.error?.message || staff.error?.message}</p>;

  const productCatalog = (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><UserRound className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="font-semibold">{selectedCustomer?.name || "Walk-in customer"}</p>
              <p className="truncate text-sm text-muted-foreground">
                {selectedCustomer ? `${selectedCustomer.phone}${selectedCustomer.address ? ` · ${selectedCustomer.address}` : ""}` : "Link a customer to earn and redeem loyalty points"}
              </p>
            </div>
          </div>
          <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 justify-between rounded-xl bg-white sm:w-[320px]">
                <span className="flex min-w-0 items-center gap-2"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{selectedCustomer?.name || "Find customer"}</span></span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
              <Command shouldFilter={false}>
                <CommandInput value={customerSearch} onValueChange={setCustomerSearch} placeholder="Type a name or phone number…" />
                <CommandList>
                  <CommandGroup heading="Counter customer">
                    <CommandItem value="walk-in" onSelect={() => chooseCustomer(null)}>
                      <span className="flex flex-1 items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" />Walk-in customer</span>
                      {!customerId && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  </CommandGroup>
                  <CommandGroup heading={customerSearch.trim() ? "Matches" : "Recent customers"}>
                    {customers.isLoading ? <div className="px-3 py-6 text-center text-sm text-muted-foreground">Searching customers…</div> : customers.data?.map(customer => (
                      <CommandItem key={customer.id} value={String(customer.id)} onSelect={() => chooseCustomer(customer)}>
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{customer.name}</span><span className="block truncate text-xs text-muted-foreground">{customer.phone}</span></span>
                        {customerId === String(customer.id) && <Check className="h-4 w-4 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandEmpty>{customerSearch.trim() ? "No customers match that search." : "No customers have been added yet."}</CommandEmpty>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {selectedCustomer && <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><Gift className="h-4 w-4" />{loyalty.isLoading ? "Loading loyalty balance…" : `Loyalty balance: ${Number(loyalty.data?.pointsBalance || 0).toFixed(3)} points`}</div>}
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(item => <button type="button" key={item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold capitalize ${category === item ? "bg-primary text-primary-foreground shadow-sm" : "border bg-white text-foreground"}`}>{item === "all" ? "All products" : item}</button>)}
        </div>
        <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, code, material, or color" className="h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm shadow-sm outline-none ring-primary/20 transition focus:ring-4" /></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No products match that search.</div> : visibleItems.map(item => {
            const available = Number(item.quantity);
            const unavailable = available <= 0;
            return <button type="button" key={item.id} disabled={unavailable} onClick={() => add(item)} className={`group flex min-h-48 flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition ${unavailable ? "cursor-not-allowed border-destructive/30 bg-rose-50/30 opacity-60" : "hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98]"}`}>
              <div className="flex items-start justify-between gap-2"><Badge variant="secondary" className="w-fit capitalize">{item.category}</Badge><Badge variant={unavailable ? "destructive" : "outline"}>{available.toFixed(3)} {item.unit}</Badge></div>
              <div className="mt-4 flex-1"><p className="text-lg font-semibold leading-snug">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.code}{item.color ? ` · ${item.color}` : ""}{item.widthInches ? ` · ${item.widthInches} in` : ""}</p></div>
              <div className="mt-4 flex items-center justify-between"><span className="text-lg font-bold text-primary">{formatMoney(Number(item.costPerUnit))}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Plus className="h-5 w-5" /></span></div>
            </button>;
          })}
        </div>
      </div>
    </section>
  );

  const orderPanel = (
    <aside className="h-fit xl:sticky xl:top-6">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShoppingCart className="h-5 w-5" /></div><div><p className="font-semibold">Current order ({cart.reduce((count, line) => count + line.quantity, 0)})</p><p className="text-xs text-muted-foreground">{heldOrderId ? "Held order loaded" : "Tap products to add them"}</p></div></div>
          {cart.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCart([])}>Clear</Button>}
        </div>
        <div className="max-h-[38vh] min-h-[200px] space-y-2 overflow-y-auto p-4">
          {cart.length === 0 ? <div className="flex min-h-[180px] flex-col items-center justify-center text-center text-muted-foreground"><ShoppingCart className="mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No items in order</p><p className="mt-1 text-sm">Choose products from the catalog.</p></div> : cart.map(line => (
            <div key={line.inventoryItemId} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold leading-snug">{line.name}</p><p className="mt-1 text-xs text-muted-foreground">{line.code} · {line.available.toFixed(3)} {line.unit} available</p></div><button type="button" onClick={() => setCart(current => current.filter(item => item.inventoryItemId !== line.inventoryItemId))} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3"><label className="text-xs font-medium text-muted-foreground">Price<input aria-label={`Unit price for ${line.name}`} type="number" min={0} step="0.001" value={line.price} onChange={event => changePrice(line.inventoryItemId, Number(event.target.value) || 0)} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground outline-none" /></label><div className="flex items-center rounded-xl border"><button type="button" onClick={() => changeQuantity(line.inventoryItemId, -1)} className="flex h-10 w-9 items-center justify-center rounded-l-xl hover:bg-muted"><Minus className="h-4 w-4" /></button><span className="w-9 text-center font-semibold">{line.quantity}</span><button type="button" onClick={() => changeQuantity(line.inventoryItemId, 1)} className="flex h-10 w-9 items-center justify-center rounded-r-xl hover:bg-muted"><Plus className="h-4 w-4" /></button></div></div>
              <div className="mt-2 flex items-center justify-between gap-3"><label className="text-xs font-medium text-muted-foreground">Line discount<input type="number" min={0} max={line.price * line.quantity} step="0.001" value={line.lineDiscount} onChange={event => changeLineDiscount(line.inventoryItemId, Number(event.target.value) || 0)} className="mt-1 h-8 w-28 rounded-lg border bg-white px-2 text-right text-sm outline-none" /></label><p className="font-semibold">{formatMoney(Math.max(0, line.price * line.quantity - line.lineDiscount))}</p></div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t bg-slate-50/70 p-5">
          <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
          <SummaryRow label="Line discounts" value={`− ${formatMoney(lineDiscount)}`} />
          <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><BadgePercent className="h-4 w-4" />Order discount</span><input value={manualDiscount || ""} min={0} max={Math.max(0, subtotal - lineDiscount)} step="0.001" onChange={event => setManualDiscount(Math.min(Math.max(0, subtotal - lineDiscount), Number(event.target.value) || 0))} type="number" className="h-9 w-28 rounded-lg border bg-white px-2 text-right outline-none" /></div>
          <div className="flex gap-2"><input value={discountCode} onChange={event => setDiscountCode(event.target.value.toUpperCase())} placeholder="Discount code" className="h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm outline-none" /><Button variant="outline" className="h-10" disabled={!discountCode.trim() || discountValidation.isFetching} onClick={async () => { try { const result = await discountValidation.refetch(); if (result.data) { setAppliedDiscountCode(result.data.snapshot || discountCode); toast.success(`Discount applied · ${formatMoney(Number(result.data.amount))}`); } } catch { toast.error("Discount code could not be applied."); } }}>Apply</Button></div>
          {appliedDiscountCode && <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><span>Code {appliedDiscountCode} · {formatMoney(appliedCodeAmount)}</span><button type="button" onClick={() => setAppliedDiscountCode("")}><X className="h-4 w-4" /></button></div>}
          {selectedCustomer && <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-1.5 text-muted-foreground"><Gift className="h-4 w-4" />Redeem points</span><input value={loyaltyPointsToRedeem || ""} min={0} max={Number(loyalty.data?.pointsBalance || 0)} step="0.001" onChange={event => setLoyaltyPointsToRedeem(Math.min(Number(loyalty.data?.pointsBalance || 0), Math.max(0, Number(event.target.value) || 0)))} type="number" className="h-9 w-28 rounded-lg border bg-white px-2 text-right outline-none" /></div>}
          {loyaltyPointsToRedeem > 0 && <SummaryRow label="Loyalty redemption" value={`− ${formatMoney(loyaltyDiscount)}`} />}
          <div className="border-t pt-3"><SummaryRow label="Total" value={formatMoney(total)} /></div>
          <Textarea value={orderNote} onChange={event => setOrderNote(event.target.value)} placeholder="Order note or cashier comment (optional)" rows={2} className="resize-none bg-white" />
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={!cart.length || !session.data || holdOrder.isPending} onClick={() => holdOrder.mutate({ sessionId: session.data!.id, customerId: customerId ? Number(customerId) : undefined, note: orderNote || undefined, items: cart.map(line => ({ inventoryItemId: line.inventoryItemId, name: line.name, quantity: line.quantity, unitPrice: line.price, lineDiscount: line.lineDiscount })) })}><Archive className="mr-2 h-4 w-4" />Hold order</Button><Button className="min-h-11" disabled={!cart.length || !session.data} onClick={() => { setPaymentLines([{ method: paymentMethod, amount: total, reference: "" }]); setPaymentOpen(true); }}><CreditCard className="mr-2 h-4 w-4" />Pay</Button></div>
          {heldOrders.data && heldOrders.data.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Held orders</p><div className="space-y-2">{heldOrders.data.map(order => <div key={order.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white p-2"><button type="button" onClick={() => loadHeldOrder(order)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{order.orderNumber}</span><span className="block truncate text-xs text-muted-foreground">{order.note || "No note"}</span></button><button type="button" onClick={() => cancelHeldOrder.mutate({ orderId: order.id })} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}
        </div>
      </div>
    </aside>
  );

  const tailoringPanel = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3 border-b pb-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Scissors className="h-5 w-5" /></div><div><p className="font-semibold">New bespoke tailoring order</p><p className="mt-1 text-sm leading-6 text-muted-foreground">The job and first payment are created together and enter the production board as confirmed.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">Customer<select value={customerId} onChange={event => { const customer = customers.data?.find(item => String(item.id) === event.target.value); chooseCustomer(customer || null); }} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal"><option value="">Choose customer</option>{customers.data?.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-medium">Measurement version<select value={measurementProfileId} onChange={event => setMeasurementProfileId(event.target.value)} disabled={!customerId || measurements.isLoading} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal"><option value="">{customerId ? (measurements.isLoading ? "Loading…" : "Choose saved measurement") : "Choose customer first"}</option>{measurements.data?.map(profile => <option key={profile.id} value={profile.id}>Version {profile.version}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-medium">Assigned tailor<select value={assignedTailorId} onChange={event => setAssignedTailorId(event.target.value)} disabled={staff.isLoading} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal"><option value="">{staff.isLoading ? "Loading…" : "Choose active tailor"}</option>{staff.data?.map(member => <option key={member.id} value={member.id}>{member.name} · {member.jobTitle}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-medium">Garment type<input value={garmentType} onChange={event => setGarmentType(event.target.value)} placeholder="Thoub, Kandura, Abaya…" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>
          <label className="space-y-1.5 text-sm font-medium">Pieces<input value={garmentQuantity} onChange={event => setGarmentQuantity(Math.max(1, Number(event.target.value) || 1))} type="number" min={1} max={20} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>
          <label className="space-y-1.5 text-sm font-medium">Due date<input value={dueDate} onChange={event => setDueDate(event.target.value)} type="date" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>
          <label className="space-y-1.5 text-sm font-medium">Quoted order price (BHD)<input value={orderPrice || ""} onChange={event => setOrderPrice(Math.max(0, Number(event.target.value) || 0))} type="number" min={0} step="0.001" placeholder="0.000" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Counter & fitting notes<Textarea value={orderNotes} onChange={event => setOrderNotes(event.target.value)} rows={5} className="font-normal" /></label><label className="space-y-1.5 text-sm font-medium">Production notes<Textarea value={productionNotes} onChange={event => setProductionNotes(event.target.value)} rows={5} className="font-normal" /></label></div>
      </section>
      <aside className="h-fit xl:sticky xl:top-6"><div className="space-y-5 rounded-2xl border bg-white p-5 shadow-lg"><div className="rounded-xl bg-primary/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Production brief</p><p className="mt-2 font-semibold">{garmentType.trim() || "Bespoke garment"} · {garmentQuantity} {garmentQuantity === 1 ? "piece" : "pieces"}</p><p className="mt-1 text-sm text-muted-foreground">{selectedCustomer?.name || "Choose a customer"}</p></div><SummaryRow label="Quoted order price" value={formatMoney(orderPrice)} /><label className="block text-sm font-medium">Collect now<div className="mt-1 flex h-12 items-center rounded-xl border bg-white"><span className="px-3 text-sm text-muted-foreground">BHD</span><input value={paymentAmount || ""} onChange={event => setPaymentAmount(Math.max(0, Number(event.target.value) || 0))} type="number" min={0} max={orderPrice || undefined} step="0.001" placeholder="0.000" className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-right text-base font-semibold outline-none" /></div></label><SummaryRow label="Balance remaining" value={formatMoney(tailoringOutstanding)} /><PaymentButtons paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} /><Button className="min-h-14 w-full rounded-xl text-base" disabled={!tailoringReady || tailoringCheckout.isPending || !session.data} onClick={completeTailoringCheckout}><CreditCard className="mr-2 h-5 w-5" />{tailoringCheckout.isPending ? "Creating order…" : "Confirm order & invoice"}</Button><p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">A partial payment is recorded as a deposit and the remaining balance stays visible on the production order.</p></div></aside>
    </div>
  );

  const returnsPanel = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start gap-3 border-b pb-4"><div className="rounded-xl bg-amber-100 p-3 text-amber-700"><RotateCcw className="h-5 w-5" /></div><div><p className="font-semibold">Return or refund an order</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Search an original POS or tailoring receipt, choose the lines and quantity, and restock inventory automatically.</p></div></div><div className="mt-5 flex gap-2"><input value={returnSearch} onChange={event => setReturnSearch(event.target.value.toUpperCase())} placeholder="Enter sale number, e.g. POS-…" className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm" /><Button className="h-11" onClick={() => returnLookup.refetch()} disabled={returnSearch.trim().length < 3 || returnLookup.isFetching}><Search className="mr-2 h-4 w-4" />Find receipt</Button></div>{returnLookup.isFetching && <p className="mt-5 text-sm text-muted-foreground">Searching receipt…</p>}{returnLookup.data && <div className="mt-5 space-y-3"><div className="rounded-xl bg-muted/40 p-4"><p className="font-semibold">{returnLookup.data.sale.saleNumber}</p><p className="text-sm text-muted-foreground">{returnLookup.data.sale.customerNameSnapshot} · {formatMoney(Number(returnLookup.data.sale.total))}</p></div>{returnLookup.data.items.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="font-medium">{item.nameSnapshot}</p><p className="text-xs text-muted-foreground">Sold {Number(item.quantity).toFixed(3)} · {formatMoney(Number(item.unitPrice))}</p></div><input aria-label={`Return quantity for ${item.nameSnapshot}`} type="number" min={0} max={Number(item.quantity)} step="0.001" value={returnQuantities[item.id] || ""} onChange={event => setReturnQuantities(current => ({ ...current, [item.id]: Math.min(Number(item.quantity), Math.max(0, Number(event.target.value) || 0)) }))} className="h-10 w-28 rounded-lg border bg-white px-2 text-right" /></div>)}</div>}{returnSearch && !returnLookup.isFetching && returnLookup.data === null && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No returnable receipt found. Check the sale number and try again.</p>}</section>
      <aside className="h-fit xl:sticky xl:top-6"><div className="space-y-5 rounded-2xl border bg-white p-5 shadow-lg"><p className="font-semibold">Refund method</p><PaymentButtons paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} /><Button className="min-h-14 w-full rounded-xl" disabled={!returnLookup.data || returnSale.isPending || !session.data} onClick={completeReturn}><RotateCcw className="mr-2 h-5 w-5" />{returnSale.isPending ? "Processing return…" : "Confirm return & refund"}</Button><p className="text-xs leading-5 text-muted-foreground">The refund is recorded as a linked negative sale, and any inventory-backed line is returned to stock.</p></div></aside>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1580px] space-y-4 pb-4">
      <div className="rounded-2xl border bg-slate-950 p-4 text-white shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-white/10 p-2.5"><Receipt className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Odoo-style register</p><h1 className="mt-0.5 text-xl font-semibold">Point of sale</h1><p className="text-xs text-slate-300">{session.data ? `${session.data.sessionNumber} · Open since ${new Date(session.data.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No active session"}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge className={session.data ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-400" : "bg-amber-300 text-amber-950 hover:bg-amber-300"}>{session.data ? "Session open" : "Session required"}</Badge>{session.data ? <Button variant="secondary" className="h-10" onClick={() => { const value = window.prompt("Closing cash (BHD)", "0.000"); if (value !== null) closeSession.mutate({ sessionId: session.data!.id, closingCash: Number(value) || 0 }); }}><X className="mr-2 h-4 w-4" />Close session</Button> : <Button variant="secondary" className="h-10" onClick={() => openSession.mutate({ openingCash: Number(window.prompt("Opening cash (BHD)", "0.000") || 0) })}><CheckCircle2 className="mr-2 h-4 w-4" />Open session</Button>}</div></div></div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Retail workspace</p><p className="mt-1 text-sm text-muted-foreground">Build the order on the left, complete payment on the right, and keep all operational sales inside POS.</p></div><div className="flex flex-wrap gap-2"><Button variant={mode === "sale" ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setMode("sale")}><ShoppingCart className="mr-2 h-4 w-4" />New order</Button><Button variant={mode === "tailoring" ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setMode("tailoring")}><Scissors className="mr-2 h-4 w-4" />Tailoring</Button><Button variant={mode === "returns" ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setMode("returns")}><RotateCcw className="mr-2 h-4 w-4" />Returns</Button></div></div>
      {mode === "sale" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">{productCatalog}{orderPanel}</div>}
      {mode === "tailoring" && tailoringPanel}
      {mode === "returns" && returnsPanel}
      {paymentOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Payment screen</p><h2 className="mt-1 text-xl font-semibold">Complete order</h2><p className="mt-1 text-sm text-muted-foreground">Use one method or split payment across multiple methods.</p></div><button type="button" onClick={() => setPaymentOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-3">{paymentLines.map((line, index) => <div className="grid gap-2 sm:grid-cols-[1fr_140px_1fr_auto]" key={`${index}-${line.method}`}><select value={line.method} onChange={event => setPaymentLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: event.target.value as PaymentMethod } : item))} className="h-11 rounded-xl border bg-white px-3 text-sm">{paymentMethods.map(method => <option key={method.key} value={method.key}>{method.label}</option>)}</select><input type="number" min={0} step="0.001" value={line.amount} onChange={event => setPaymentLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))} className="h-11 rounded-xl border bg-white px-3 text-right" /><input value={line.reference} onChange={event => setPaymentLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Reference optional" className="h-11 rounded-xl border bg-white px-3 text-sm" /><Button variant="ghost" size="icon" disabled={paymentLines.length === 1} onClick={() => setPaymentLines(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div><Button variant="outline" className="mt-3" onClick={addPaymentLine}><Plus className="mr-2 h-4 w-4" />Add payment method</Button><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><SummaryRow label="Order total" value={formatMoney(total)} /><SummaryRow label="Paid now" value={formatMoney(paidTotal)} /><div className="mt-3 flex items-baseline justify-between border-t border-white/20 pt-3"><span className="font-semibold">Remaining</span><span className={`text-xl font-bold ${outstanding ? "text-amber-300" : "text-emerald-300"}`}>{formatMoney(outstanding)}</span></div></div><Button className="mt-5 min-h-14 w-full rounded-xl text-base" disabled={paymentLines.length === 0 || paidTotal > total + 0.001 || checkout.isPending} onClick={completeCheckout}><CreditCard className="mr-2 h-5 w-5" />{checkout.isPending ? "Processing payment…" : "Confirm payment & issue invoice"}</Button></div></div>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>; }
function PaymentButtons({ paymentMethod, setPaymentMethod }: { paymentMethod: PaymentMethod; setPaymentMethod: (value: PaymentMethod) => void }) { return <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment method</p><div className="grid grid-cols-2 gap-2">{paymentMethods.map(method => { const Icon = method.icon; return <button type="button" key={method.key} onClick={() => setPaymentMethod(method.key)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold ${paymentMethod === method.key ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted"}`}><Icon className="h-4 w-4" />{method.label}</button>; })}</div></div>; }

export { formatMoney };
