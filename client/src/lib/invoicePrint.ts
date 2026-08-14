export type InvoicePrintPayload = {
  shop: { shopName: string; arabicShopName?: string | null; crNumber?: string | null; phone?: string | null; email?: string | null; address?: string | null } | null;
  invoice: { invoiceNumber: string; status: string; issuedAt: Date | string; notes?: string | null };
  sale: { saleNumber: string; customerName: string; customerPhone?: string | null; paymentMethod: string; subtotal: number | string; discount: number | string; total: number | string };
  items: Array<{ name: string; quantity: number | string; unitPrice: number | string; lineTotal: number | string }>;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
const money = (value: number | string) => `BHD ${Number(value || 0).toFixed(3)}`;
const issuedDate = (value: Date | string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function buildInvoicePrintDocument(payload: InvoicePrintPayload) {
  const shop = payload.shop;
  const itemRows = payload.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td class="numeric">${escapeHtml(item.quantity)}</td><td class="numeric">${money(item.unitPrice)}</td><td class="numeric strong">${money(item.lineTotal)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(payload.invoice.invoiceNumber)}</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17253a; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
    .invoice { width: 100%; max-width: 180mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 26px; padding-bottom: 20px; border-bottom: 2px solid #1f496d; }
    .brand { min-width: 0; } .mark { display: inline-block; padding: 7px 9px; margin-right: 8px; border-radius: 8px; background: #1f496d; color: #fff; font-size: 11px; font-weight: 700; vertical-align: middle; }
    h1 { display: inline-block; margin: 0; font-size: 21px; vertical-align: middle; } h2 { margin: 0; color: #1f496d; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; }
    .arabic, .muted { color: #64748b; } .contact { margin-top: 12px; color: #475569; } .contact div { margin: 2px 0; }
    .invoice-meta { min-width: 180px; text-align: right; } .invoice-meta p { margin: 4px 0; } .badge { display: inline-block; margin-top: 8px; padding: 4px 8px; border-radius: 999px; background: #e9f4ec; color: #17603a; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 22px 0; } .party:last-child { text-align: right; } .label { margin-bottom: 6px; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; } .party strong { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; } th { padding: 10px 8px; background: #eef2f6; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; color: #475569; font-size: 10px; letter-spacing: .08em; text-align: left; text-transform: uppercase; } td { padding: 11px 8px; border-bottom: 1px solid #e2e8f0; } .numeric { text-align: right; white-space: nowrap; } .strong { font-weight: 700; }
    .totals { width: 230px; margin: 20px 0 0 auto; } .total-row { display: flex; justify-content: space-between; gap: 24px; padding: 5px 0; } .grand-total { margin-top: 7px; padding-top: 9px; border-top: 2px solid #1f496d; color: #1f496d; font-size: 16px; font-weight: 700; }
    .note { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; } .thanks { margin-top: 20px; color: #64748b; font-size: 11px; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body><main class="invoice"><header class="header"><section class="brand"><div><span class="mark">AM</span><h1>${escapeHtml(shop?.shopName || "Tailor shop")}</h1></div>${shop?.arabicShopName ? `<div class="arabic">${escapeHtml(shop.arabicShopName)}</div>` : ""}<div class="contact">${shop?.address ? `<div>${escapeHtml(shop.address)}</div>` : ""}${shop?.phone ? `<div>${escapeHtml(shop.phone)}</div>` : ""}${shop?.email ? `<div>${escapeHtml(shop.email)}</div>` : ""}${shop?.crNumber ? `<div>CR: ${escapeHtml(shop.crNumber)}</div>` : ""}</div></section><section class="invoice-meta"><h2>Invoice</h2><p><strong>${escapeHtml(payload.invoice.invoiceNumber)}</strong></p><p class="muted">Issued ${escapeHtml(issuedDate(payload.invoice.issuedAt))}</p><span class="badge">${escapeHtml(payload.invoice.status)}</span></section></header><section class="parties"><div class="party"><div class="label">Bill to</div><strong>${escapeHtml(payload.sale.customerName)}</strong><div class="muted">${escapeHtml(payload.sale.customerPhone || "No phone recorded")}</div></div><div class="party"><div class="label">Payment</div><strong>${escapeHtml(payload.sale.paymentMethod.replace("_", " "))}</strong><div class="muted">Sale reference: ${escapeHtml(payload.sale.saleNumber)}</div></div></section><table><thead><tr><th>Description</th><th class="numeric">Qty</th><th class="numeric">Unit price</th><th class="numeric">Line total</th></tr></thead><tbody>${itemRows}</tbody></table><section class="totals"><div class="total-row"><span>Subtotal</span><span>${money(payload.sale.subtotal)}</span></div><div class="total-row"><span>Discount</span><span>${money(payload.sale.discount)}</span></div><div class="total-row grand-total"><span>Total</span><span>${money(payload.sale.total)}</span></div></section>${payload.invoice.notes ? `<p class="note">${escapeHtml(payload.invoice.notes)}</p>` : ""}<p class="thanks">Thank you for choosing ${escapeHtml(shop?.shopName || "our tailoring shop")}.</p></main></body></html>`;
}

export function writeInvoiceToPrintWindow(payload: InvoicePrintPayload, printWindow: Window | null) {
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(buildInvoicePrintDocument(payload));
  printWindow.document.close();
  window.setTimeout(() => { if (!printWindow.closed) { printWindow.focus(); printWindow.print(); } }, 250);
  return true;
}

export function openInvoicePrintWindow(payload: InvoicePrintPayload) {
  return writeInvoiceToPrintWindow(payload, window.open("", "_blank", "popup,width=900,height=720"));
}
