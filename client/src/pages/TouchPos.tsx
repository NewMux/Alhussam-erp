import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronDown, CreditCard, Minus, Plus, Scissors, Search, ShoppingCart, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { writeInvoiceToPrintWindow } from "@/lib/invoicePrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CartLine = { inventoryItemId: number; name: string; code: string; price: number; unit: string; available: number; quantity: number };
type CustomerOption = { id: number; name: string; phone: string; address: string | null };
type PosMode = "inventory" | "tailoring";
type PaymentMethod = "cash" | "benefitpay" | "bank_transfer" | "credit_card";

const formatMoney = (value: number) => `BHD ${Number(value || 0).toFixed(3)}`;
const urlMoney = (key: string) => {
  const value = Number(new URLSearchParams(window.location.search).get(key) || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};
const paymentMethods: Array<{ key: PaymentMethod; label: string }> = [
  { key: "benefitpay", label: "BenefitPay" },
  { key: "cash", label: "Cash" },
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "credit_card", label: "Credit card" },
];

export default function TouchPos() {
  const [mode, setMode] = useState<PosMode>(() => new URLSearchParams(window.location.search).get("mode") === "tailoring" ? "tailoring" : "inventory");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("benefitpay");
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [measurementProfileId, setMeasurementProfileId] = useState("");
  const [assignedTailorId, setAssignedTailorId] = useState("");
  const [garmentType, setGarmentType] = useState("Thoub");
  const [garmentQuantity, setGarmentQuantity] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [orderPrice, setOrderPrice] = useState(() => urlMoney("quote"));
  const [paymentAmount, setPaymentAmount] = useState(() => urlMoney("deposit"));
  const [orderNotes, setOrderNotes] = useState("");
  const [productionNotes, setProductionNotes] = useState("");
  const pendingPrintWindow = useRef<Window | null>(null);

  const inventory = trpc.erp.inventory.list.useQuery();
  const customerSearchInput = useMemo(() => ({ search: customerSearch }), [customerSearch]);
  const customers = trpc.erp.customers.list.useQuery(customerSearchInput);
  const profileInput = useMemo(() => ({ customerId: Number(customerId) }), [customerId]);
  const measurements = trpc.erp.customers.measurements.useQuery(profileInput, { enabled: mode === "tailoring" && Boolean(customerId) });
  const staff = trpc.erp.staff.list.useQuery(undefined, { enabled: mode === "tailoring" });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (mode === "tailoring" && !measurementProfileId && measurements.data?.length === 1) setMeasurementProfileId(String(measurements.data[0].id));
  }, [measurementProfileId, measurements.data, mode]);
  useEffect(() => {
    if (mode !== "tailoring" || assignedTailorId || !staff.data?.length) return;
    const uniqueTailors = Array.from(new Map(staff.data.map(member => [`${member.name}::${member.jobTitle}`, member])).values());
    if (uniqueTailors.length === 1) setAssignedTailorId(String(uniqueTailors[0].id));
  }, [assignedTailorId, mode, staff.data]);

  const printIssuedInvoice = async ({ invoiceId, saleNumber, total, orderNumber }: { invoiceId: number; saleNumber: string; total: number; orderNumber?: string }) => {
    const printWindow = pendingPrintWindow.current;
    pendingPrintWindow.current = null;
    utils.erp.dashboard.invalidate();
    utils.erp.invoices.list.invalidate();
    utils.erp.sales.list.invalidate();
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

  const checkout = trpc.pos.checkout.useMutation({
    onSuccess: async ({ invoiceId, saleNumber, total }) => {
      setCart([]);
      setDiscount(0);
      utils.erp.inventory.list.invalidate();
      await printIssuedInvoice({ invoiceId, saleNumber, total });
    },
    onError: error => {
      if (pendingPrintWindow.current && !pendingPrintWindow.current.closed) pendingPrintWindow.current.close();
      pendingPrintWindow.current = null;
      toast.error(error.message);
    },
  });
  const resetTailoringForm = () => {
    setMeasurementProfileId("");
    setAssignedTailorId("");
    setGarmentType("Thoub");
    setGarmentQuantity(1);
    setDueDate("");
    setOrderPrice(0);
    setPaymentAmount(0);
    setOrderNotes("");
    setProductionNotes("");
  };
  const tailoringCheckout = trpc.pos.tailoringCheckout.useMutation({
    onSuccess: async ({ invoiceId, saleNumber, total, orderNumber }) => {
      resetTailoringForm();
      await printIssuedInvoice({ invoiceId, saleNumber, total, orderNumber });
    },
    onError: error => {
      if (pendingPrintWindow.current && !pendingPrintWindow.current.closed) pendingPrintWindow.current.close();
      pendingPrintWindow.current = null;
      toast.error(error.message);
    },
  });

  const categories = useMemo(() => ["all", ...Array.from(new Set(inventory.data?.map(item => item.category) || []))], [inventory.data]);
  const visibleItems = useMemo(() => (inventory.data || []).filter(item => (category === "all" || item.category === category) && [item.code, item.name, item.color || ""].some(value => value.toLowerCase().includes(search.toLowerCase()))), [inventory.data, category, search]);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const outstanding = Math.max(0, orderPrice - paymentAmount);
  const tailoringReady = Boolean(customerId && selectedCustomer && measurementProfileId && assignedTailorId && garmentType.trim().length >= 2 && garmentQuantity > 0 && orderPrice > 0 && paymentAmount > 0 && paymentAmount <= orderPrice);

  const add = (item: NonNullable<typeof inventory.data>[number]) => setCart(current => {
    const existing = current.find(line => line.inventoryItemId === item.id);
    const available = Number(item.quantity);
    const nextQuantity = (existing?.quantity || 0) + 1;
    if (nextQuantity > available) {
      toast.error(`${item.name} only has ${item.quantity} ${item.unit} available.`);
      return current;
    }
    return existing
      ? current.map(line => line.inventoryItemId === item.id ? { ...line, quantity: nextQuantity, available } : line)
      : [...current, { inventoryItemId: item.id, name: item.name, code: item.code, price: Number(item.costPerUnit), unit: item.unit, available, quantity: 1 }];
  });
  const changeQuantity = (inventoryItemId: number, delta: number) => setCart(current => current.flatMap(line => {
    if (line.inventoryItemId !== inventoryItemId) return [line];
    if (line.quantity + delta <= 0) return [];
    if (line.quantity + delta > line.available) {
      toast.error(`${line.name} only has ${line.available.toFixed(3)} ${line.unit} available.`);
      return [line];
    }
    return [{ ...line, quantity: line.quantity + delta }];
  }));
  const changePrice = (inventoryItemId: number, price: number) => setCart(current => current.map(line => line.inventoryItemId === inventoryItemId ? { ...line, price: Math.max(0, price) } : line));
  const chooseCustomer = (customer: CustomerOption | null) => {
    setCustomerId(customer ? String(customer.id) : "");
    setSelectedCustomer(customer);
    setMeasurementProfileId("");
    setCustomerSearch("");
    setCustomerPickerOpen(false);
  };
  const completeCheckout = () => {
    pendingPrintWindow.current = window.open("", "_blank", "popup,width=900,height=720");
    checkout.mutate({ customerId: customerId ? Number(customerId) : undefined, customerName: selectedCustomer?.name || "Walk-in customer", customerPhone: selectedCustomer?.phone, discount, paymentMethod, paymentStatus: "paid", items: cart.map(line => ({ inventoryItemId: line.inventoryItemId, name: line.name, quantity: line.quantity, unitPrice: line.price })) });
  };
  const completeTailoringCheckout = () => {
    if (!tailoringReady || !selectedCustomer) {
      toast.error("Choose the customer, saved measurement, tailor, garment, quote, and payment before issuing the order.");
      return;
    }
    pendingPrintWindow.current = window.open("", "_blank", "popup,width=900,height=720");
    tailoringCheckout.mutate({ customerId: selectedCustomer.id, measurementProfileId: Number(measurementProfileId), assignedTailorId: Number(assignedTailorId), garmentType: garmentType.trim(), quantity: garmentQuantity, dueDate: dueDate || undefined, orderPrice, paymentAmount, paymentMethod, notes: orderNotes, productionNotes });
  };

  if (inventory.isLoading) return <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">Loading inventory counter…</div>;
  if (inventory.error || customers.error || (mode === "tailoring" && (measurements.error || staff.error))) return <p className="text-destructive">{inventory.error?.message || customers.error?.message || measurements.error?.message || staff.error?.message}</p>;

  return <div className="mx-auto max-w-[1580px] space-y-5 pb-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Inventory counter</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Point of sale</h1><p className="mt-1 text-sm text-muted-foreground">Sell live materials or open a bespoke production order without leaving the counter.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Badge variant="secondary" className="w-fit px-3 py-1.5 text-sm"><CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" />{inventory.data?.length || 0} live items</Badge><div className="flex rounded-xl border bg-white p-1 shadow-sm"><button type="button" onClick={() => setMode("inventory")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${mode === "inventory" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><ShoppingCart className="mr-1.5 inline h-4 w-4" />Inventory sale</button><button type="button" onClick={() => setMode("tailoring")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${mode === "tailoring" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><Scissors className="mr-1.5 inline h-4 w-4" />Tailoring order</button></div></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><p className="font-semibold">{selectedCustomer?.name || (mode === "tailoring" ? "Customer required" : "Walk-in customer")}</p><p className="truncate text-sm text-muted-foreground">{selectedCustomer ? `${selectedCustomer.phone}${selectedCustomer.address ? ` · ${selectedCustomer.address}` : ""}` : mode === "tailoring" ? "A saved client and measurement are required for a bespoke order" : "No customer linked to this counter sale"}</p></div></div><Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}><PopoverTrigger asChild><Button variant="outline" className="h-11 justify-between rounded-xl bg-white sm:w-[320px]"><span className="flex min-w-0 items-center gap-2"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{selectedCustomer ? selectedCustomer.name : "Find customer by name or phone"}</span></span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /></Button></PopoverTrigger><PopoverContent align="end" className="w-[min(92vw,380px)] p-0"><Command shouldFilter={false}><CommandInput value={customerSearch} onValueChange={setCustomerSearch} placeholder="Type a name or phone number…" /><CommandList><CommandGroup heading="Counter customer">{mode === "inventory" && <CommandItem value="walk-in" onSelect={() => chooseCustomer(null)}><span className="flex flex-1 items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" />Walk-in customer</span>{!customerId && <Check className="h-4 w-4 text-primary" />}</CommandItem>}</CommandGroup><CommandGroup heading={customerSearch.trim() ? "Matches" : "Recent customers"}>{customers.isLoading ? <div className="px-3 py-6 text-center text-sm text-muted-foreground">Searching customers…</div> : customers.data?.map(customer => <CommandItem key={customer.id} value={String(customer.id)} onSelect={() => chooseCustomer(customer)}><span className="min-w-0 flex-1"><span className="block truncate font-medium">{customer.name}</span><span className="block truncate text-xs text-muted-foreground">{customer.phone}</span></span>{customerId === String(customer.id) && <Check className="h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup><CommandEmpty>{customerSearch.trim() ? "No customers match that search." : "No customers have been added yet."}</CommandEmpty></CommandList></Command></PopoverContent></Popover></div></div>

        {mode === "inventory" ? <>
          <div className="flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory("all")} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${category === "all" ? "bg-primary text-primary-foreground shadow-sm" : "border bg-white text-foreground"}`}>All inventory</button>{categories.filter(item => item !== "all").map(item => <button type="button" key={item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold capitalize ${category === item ? "bg-primary text-primary-foreground shadow-sm" : "border bg-white text-foreground"}`}>{item}</button>)}</div>
          <label className="relative block"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search inventory code, material, or color" className="h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm shadow-sm outline-none ring-primary/20 transition focus:ring-4" /></label>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{visibleItems.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No inventory records match that search.</div> : visibleItems.map(item => { const available = Number(item.quantity); const unavailable = available <= 0; return <button type="button" key={item.id} disabled={unavailable} onClick={() => add(item)} className={`group flex min-h-52 flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition ${unavailable ? "cursor-not-allowed border-destructive/30 bg-rose-50/30 opacity-60" : "hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98]"}`}><div className="flex items-start justify-between gap-2"><Badge variant="secondary" className="w-fit capitalize">{item.category}</Badge><Badge variant={unavailable ? "destructive" : "outline"}>{available.toFixed(3)} {item.unit}</Badge></div><div className="mt-4 flex-1"><p className="text-lg font-semibold leading-snug">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.code}{item.color ? ` · ${item.color}` : ""}{item.widthInches ? ` · ${item.widthInches} in` : ""}</p><p className="mt-3 text-xs text-muted-foreground">Default unit price: {formatMoney(Number(item.costPerUnit))}</p></div><div className="mt-4 flex items-center justify-between"><span className="text-lg font-bold text-primary">{formatMoney(Number(item.costPerUnit))}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Plus className="h-5 w-5" /></span></div></button>; })}</div>
        </> : <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Scissors className="h-5 w-5" /></div><p className="font-semibold">New bespoke tailoring order</p></div><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Confirm the client’s saved measurement and tailor at the counter. The production job and payment invoice are created together.</p></div><Badge className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">Production starts confirmed</Badge></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Measurement version<select value={measurementProfileId} onChange={event => setMeasurementProfileId(event.target.value)} disabled={!customerId || measurements.isLoading} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15"><option value="">{customerId ? (measurements.isLoading ? "Loading saved measurements…" : "Choose saved measurement") : "Choose customer first"}</option>{measurements.data?.map(profile => <option key={profile.id} value={profile.id}>Version {profile.version} · {new Date(profile.effectiveDate).toLocaleDateString()}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium">Assigned tailor<select value={assignedTailorId} onChange={event => setAssignedTailorId(event.target.value)} disabled={staff.isLoading} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15"><option value="">{staff.isLoading ? "Loading tailor team…" : "Choose active tailor"}</option>{staff.data?.map(member => <option key={member.id} value={member.id}>{member.name} · {member.jobTitle}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium">Garment type<input value={garmentType} onChange={event => setGarmentType(event.target.value)} placeholder="Thoub, Kandura, Abaya…" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label><label className="space-y-1.5 text-sm font-medium">Pieces<input value={garmentQuantity} onChange={event => setGarmentQuantity(Math.max(1, Number(event.target.value) || 1))} type="number" min={1} max={20} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label><label className="space-y-1.5 text-sm font-medium">Due date <span className="font-normal text-muted-foreground">(optional)</span><input value={dueDate} onChange={event => setDueDate(event.target.value)} type="date" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label><label className="space-y-1.5 text-sm font-medium">Quoted order price (BHD)<input value={orderPrice || ""} onChange={event => setOrderPrice(Math.max(0, Number(event.target.value) || 0))} type="number" min={0} step="0.001" placeholder="0.000" className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Counter & fitting notes<textarea value={orderNotes} onChange={event => setOrderNotes(event.target.value)} rows={4} placeholder="Fabric preference, fitting request, customer instructions…" className="w-full rounded-xl border bg-white p-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label><label className="space-y-1.5 text-sm font-medium">Initial production notes<textarea value={productionNotes} onChange={event => setProductionNotes(event.target.value)} rows={4} placeholder="Cutting or workshop instructions for the assigned tailor…" className="w-full rounded-xl border bg-white p-3 text-sm font-normal outline-none focus:ring-4 focus:ring-primary/15" /></label></div></div>}
      </section>

      <aside className="h-fit xl:sticky xl:top-6">
        {mode === "inventory" ? <div className="overflow-hidden rounded-2xl border bg-white shadow-lg"><div className="flex items-center gap-3 border-b bg-slate-50 px-5 py-4"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShoppingCart className="h-5 w-5" /></div><div><p className="font-semibold">Cart ({cart.reduce((count, line) => count + line.quantity, 0)})</p><p className="text-xs text-muted-foreground">Direct inventory sale</p></div></div><div className="min-h-[260px] max-h-[43vh] space-y-2 overflow-y-auto p-4">{cart.length === 0 ? <div className="flex min-h-[230px] flex-col items-center justify-center text-center text-muted-foreground"><ShoppingCart className="mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No items in cart</p><p className="mt-1 text-sm">Choose one of the live inventory tiles to add it.</p></div> : cart.map(line => <div key={line.inventoryItemId} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold leading-snug">{line.name}</p><p className="mt-1 text-xs text-muted-foreground">{line.code} · {line.available.toFixed(3)} {line.unit} available</p></div><button type="button" onClick={() => setCart(current => current.filter(item => item.inventoryItemId !== line.inventoryItemId))} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3"><label className="text-xs font-medium text-muted-foreground">Unit price (BHD)<input aria-label={`Unit price for ${line.name}`} type="number" min={0} step="0.001" value={line.price} onChange={event => changePrice(line.inventoryItemId, Number(event.target.value) || 0)} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground outline-none" /></label><div className="flex items-center rounded-xl border"><button type="button" onClick={() => changeQuantity(line.inventoryItemId, -1)} className="flex h-10 w-9 items-center justify-center rounded-l-xl hover:bg-muted"><Minus className="h-4 w-4" /></button><span className="w-9 text-center font-semibold">{line.quantity}</span><button type="button" onClick={() => changeQuantity(line.inventoryItemId, 1)} className="flex h-10 w-9 items-center justify-center rounded-r-xl hover:bg-muted"><Plus className="h-4 w-4" /></button></div></div><p className="mt-3 text-right font-semibold">{formatMoney(line.price * line.quantity)}</p></div>)}</div><div className="space-y-4 border-t bg-slate-50/70 p-5"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(subtotal)}</span></div><div className="flex items-center justify-between gap-3 text-sm"><label className="text-muted-foreground" htmlFor="discount">Discount</label><div className="flex h-10 items-center rounded-lg border bg-white"><span className="px-2 text-xs text-muted-foreground">BHD</span><input id="discount" value={discount} min={0} max={subtotal} step="0.001" onChange={event => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value) || 0)))} type="number" className="w-20 border-0 bg-transparent pr-2 text-right outline-none" /></div></div><div className="flex items-baseline justify-between border-t pt-4"><span className="text-lg font-bold">Total</span><span className="text-2xl font-bold text-primary">{formatMoney(total)}</span></div><PaymentButtons paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} /><Button className="min-h-14 w-full rounded-xl text-base shadow-md" disabled={cart.length === 0 || checkout.isPending} onClick={completeCheckout}><CreditCard className="mr-2 h-5 w-5" />{checkout.isPending ? "Completing sale…" : "Checkout, issue & print invoice"}</Button></div></div> : <div className="overflow-hidden rounded-2xl border bg-white shadow-lg"><div className="flex items-center gap-3 border-b bg-slate-50 px-5 py-4"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Scissors className="h-5 w-5" /></div><div><p className="font-semibold">Tailoring checkout</p><p className="text-xs text-muted-foreground">Confirm production & collect payment</p></div></div><div className="space-y-5 p-5"><div className="rounded-xl border bg-primary/[0.03] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Production brief</p><p className="mt-2 font-semibold">{garmentType.trim() || "Bespoke garment"} · {garmentQuantity} {garmentQuantity === 1 ? "piece" : "pieces"}</p><p className="mt-1 text-sm text-muted-foreground">{selectedCustomer?.name || "Choose a customer"}</p><p className="mt-3 text-xs text-muted-foreground">The job will enter the production board as <span className="font-semibold text-foreground">Confirmed</span>.</p></div><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Quoted order price</span><span className="font-semibold">{formatMoney(orderPrice)}</span></div><label className="block text-sm font-medium">Collect now (deposit or full payment)<div className="mt-1 flex h-12 items-center rounded-xl border bg-white"><span className="px-3 text-sm text-muted-foreground">BHD</span><input value={paymentAmount || ""} onChange={event => setPaymentAmount(Math.max(0, Number(event.target.value) || 0))} type="number" min={0} max={orderPrice || undefined} step="0.001" placeholder="0.000" className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-right text-base font-semibold outline-none" /></div></label><div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Balance remaining</span><span className={outstanding > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{formatMoney(outstanding)}</span></div></div><PaymentButtons paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} /><p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">The invoice records the amount collected today. A partial payment is shown as a deposit and the remaining balance stays visible on the production order.</p><Button className="min-h-14 w-full rounded-xl text-base shadow-md" disabled={!tailoringReady || tailoringCheckout.isPending} onClick={completeTailoringCheckout}><CreditCard className="mr-2 h-5 w-5" />{tailoringCheckout.isPending ? "Creating tailoring order…" : "Confirm order, issue & print invoice"}</Button></div></div>}
      </aside>
    </div>
  </div>;
}

function PaymentButtons({ paymentMethod, setPaymentMethod }: { paymentMethod: PaymentMethod; setPaymentMethod: (value: PaymentMethod) => void }) {
  return <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment method</p><div className="grid grid-cols-2 gap-2">{paymentMethods.map(method => <button type="button" key={method.key} onClick={() => setPaymentMethod(method.key)} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${paymentMethod === method.key ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted"}`}>{method.label}</button>)}</div></div>;
}
