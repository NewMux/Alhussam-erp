import React from 'react';
import { Sale, Invoice } from '../../types';
import { useERP } from '../../context/ERPContext';
import { useLanguage } from '../../context/LanguageContext';
import { QRCodeView } from '../common/QRCodeView';
import { Printer, MessageSquare } from 'lucide-react';

interface POSReceiptModalProps {
  sale: Sale;
  invoice?: Invoice;
  onClose: () => void;
}

export const POSReceiptModal: React.FC<POSReceiptModalProps> = ({ sale, onClose }) => {
  const { settings, updateInvoiceDelivery } = useERP();
  const { lang, t } = useLanguage();

  const handlePrint = () => {
    window.print();
    updateInvoiceDelivery(sale.id, 'Print');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      lang === 'ar'
        ? `مرحباً ${sale.customerName}،\nشكراً لاختياركم ${settings.arabicShopName || settings.shopName}.\nرقم الإيصال: ${sale.transactionNumber}\nالمبلغ الإجمالي: ${sale.total.toFixed(3)} د.ب\nطريقة الدفع: ${sale.paymentMethod}`
        : `Hello ${sale.customerName},\nThank you for choosing ${settings.shopName}.\nReceipt: ${sale.transactionNumber}\nTotal: BHD ${sale.total.toFixed(3)}\nPayment Method: ${sale.paymentMethod}\nStatus: ${sale.paymentStatus}`
    );
    window.open(`https://wa.me/${sale.customerPhone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
    updateInvoiceDelivery(sale.id, 'WhatsApp');
  };

  const qrData = `TN:${sale.transactionNumber}|DATE:${sale.timestamp}|TOTAL:${sale.total.toFixed(3)}BHD|CR:${settings.crNumber}`;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px', padding: '1.5rem', background: '#ffffff', color: '#000000' }}>
        {/* Actions header (hidden on print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-sm btn-primary" onClick={handleWhatsAppShare} title="Share receipt via WhatsApp">
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button className="btn btn-sm btn-success" onClick={handlePrint}>
              <Printer size={14} /> {t.printInvoice}
            </button>
          </div>
        </div>

        {/* Thermal Receipt Layout */}
        <div className="receipt-paper" style={{ fontFamily: 'Courier, monospace', fontSize: '0.85rem', color: '#000000' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px dashed #000', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{settings.shopName}</h2>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{settings.arabicShopName}</div>
            <div style={{ fontSize: '0.75rem' }}>CR: {settings.crNumber} | VAT: {settings.vatNumber}</div>
            <div style={{ fontSize: '0.75rem' }}>Tel: {settings.phone}</div>
          </div>

          <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', borderBottom: '1px dashed #000', paddingBottom: '0.5rem' }}>
            <div><strong>Receipt #:</strong> {sale.transactionNumber}</div>
            <div><strong>Date:</strong> {new Date(sale.timestamp).toLocaleString()}</div>
            <div><strong>Customer:</strong> {sale.customerName}</div>
            <div><strong>Phone:</strong> {sale.customerPhone}</div>
            <div><strong>Served By:</strong> {sale.staffUserName}</div>
          </div>

          {/* Line Items */}
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '0.2rem 0' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Total (BHD)</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dashed #ccc' }}>
                  <td style={{ padding: '0.3rem 0' }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.assignedTailorName && (
                      <div style={{ fontSize: '0.7rem', color: '#444' }}>Tailor: {item.assignedTailorName}</div>
                    )}
                    {item.fabricName && (
                      <div style={{ fontSize: '0.7rem', color: '#444' }}>Fabric: {item.fabricName}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.total.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: '1px dashed #000', paddingTop: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>BHD {sale.subtotal.toFixed(3)}</span>
            </div>
            {sale.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>- BHD {sale.discount.toFixed(3)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginTop: '0.25rem', borderTop: '1px solid #000', paddingTop: '0.25rem' }}>
              <span>TOTAL BHD:</span>
              <span>BHD {sale.total.toFixed(3)}</span>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', borderTop: '1px dashed #000', paddingTop: '0.5rem' }}>
              <div><strong>Payment Method:</strong> {sale.paymentMethod}</div>
              <div><strong>Status:</strong> {sale.paymentStatus}</div>
              {sale.offline && (
                <div style={{ color: '#d97706', fontWeight: 600 }}>* Processed Offline (Pending Sync)</div>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px dashed #000', paddingTop: '0.75rem' }}>
            <QRCodeView value={qrData} size={90} label={`VERIFIED QR: ${sale.transactionNumber}`} />
          </div>

          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            <p>{settings.receiptFooter}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
