import React from 'react';
import { Invoice } from '../../types';
import { useERP } from '../../context/ERPContext';
import { useLanguage } from '../../context/LanguageContext';
import { QRCodeView } from '../common/QRCodeView';
import { Printer, Mail, MessageSquare } from 'lucide-react';

interface InvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose }) => {
  const { settings, updateInvoiceDelivery } = useERP();
  const { lang, t } = useLanguage();

  const handlePrint = () => {
    window.print();
    updateInvoiceDelivery(invoice.id, 'Print');
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      lang === 'ar'
        ? `فاتورة ERP رسمية رقم ${invoice.invoiceNumber} من ${settings.arabicShopName || settings.shopName}.\nالإجمالي: ${invoice.total.toFixed(3)} د.ب\nحالة الدفع: ${invoice.paymentStatus}\nشكراً لكم!`
        : `Official ERP Invoice ${invoice.invoiceNumber} from ${settings.shopName}.\nTotal: BHD ${invoice.total.toFixed(3)}\nPayment Status: ${invoice.paymentStatus}\nThank you!`
    );
    window.open(`https://wa.me/${invoice.customerPhone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
    updateInvoiceDelivery(invoice.id, 'WhatsApp');
  };

  const handleEmail = () => {
    alert(lang === 'ar' ? `تم إرسال الفاتورة ${invoice.invoiceNumber} إلى ${invoice.customerName}` : `Simulated Email Dispatch: Invoice ${invoice.invoiceNumber} sent to ${invoice.customerName}!`);
    updateInvoiceDelivery(invoice.id, 'Email');
  };

  const qrString = `INV:${invoice.invoiceNumber}|DATE:${invoice.issuedDate}|TOTAL:${invoice.total.toFixed(3)}BHD|CR:${settings.crNumber}|VAT:${settings.vatNumber}`;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px', background: '#ffffff', color: '#111827', padding: '2rem' }}>
        {/* Header Bar (hidden when printing) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
          <div>
            <span className="badge badge-emerald">Official ERP Document</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem', marginRight: '0.5rem' }}>Status: {invoice.paymentStatus}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-sm btn-secondary" onClick={onClose}>
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleWhatsApp}>
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleEmail}>
              <Mail size={14} /> Email
            </button>
            <button className="btn btn-sm btn-success" onClick={handlePrint}>
              <Printer size={14} /> {t.printInvoice}
            </button>
          </div>
        </div>

        {/* Invoice PDF Document Layout */}
        <div className="invoice-paper" style={{ fontFamily: 'Inter, sans-serif' }}>
          {/* Shop Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{settings.shopName}</h1>
              <div style={{ fontSize: '1rem', color: '#475569', fontWeight: 700 }}>{settings.arabicShopName}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                CR: {settings.crNumber} | VAT ID: {settings.vatNumber}<br />
                {settings.address}<br />
                Tel: {settings.phone}
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706', margin: 0 }}>TAX INVOICE / فاتورة ضريبية</h2>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {invoice.invoiceNumber}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                Issued Date: {invoice.issuedDate}<br />
                Transaction Ref: {invoice.transactionNumber}
              </div>

              {/* QR Code */}
              <QRCodeView value={qrString} size={85} label={invoice.invoiceNumber} />
            </div>
          </div>

          {/* Customer & Payment Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Billed To / فاتورة إلى:</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>{invoice.customerName}</div>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>Phone: {invoice.customerPhone}</div>
              {invoice.customerAddress && <div style={{ fontSize: '0.85rem', color: '#475569' }}>{invoice.customerAddress}</div>}
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Payment Details:</div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                Payment Method: <strong>{invoice.paymentMethod}</strong><br />
                Payment Status: <strong style={{ color: invoice.paymentStatus === 'Paid' ? '#059669' : '#d97706' }}>{invoice.paymentStatus}</strong><br />
                Currency: <strong>BHD (Bahraini Dinar / دينار بحريني)</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '0.65rem', textAlign: 'left' }}>Item Description</th>
                <th style={{ padding: '0.65rem', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Unit Price (BHD)</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Total (BHD)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0.65rem' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                    {item.assignedTailorName && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Assigned Tailor: {item.assignedTailorName}</div>
                    )}
                    {item.fabricName && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Fabric: {item.fabricName}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>{item.unitPrice.toFixed(3)}</td>
                  <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right', fontWeight: 600 }}>{item.total.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <div style={{ width: '280px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>BHD {invoice.subtotal.toFixed(3)}</span>
              </div>
              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#dc2626' }}>
                  <span>Discount:</span>
                  <span>- BHD {invoice.discount.toFixed(3)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0', borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                <span>Amount Due:</span>
                <span style={{ color: '#d97706' }}>BHD {invoice.total.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Signatures */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Terms & Conditions / الشروط والأحكام:</div>
            <p>{settings.invoiceTerms}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
