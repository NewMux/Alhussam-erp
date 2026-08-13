import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Invoice } from '../../types';
import { InvoiceModal } from './InvoiceModal';
import {
  FileText,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  MessageSquare,
  Eye,
} from 'lucide-react';

export const InvoiceList: React.FC = () => {
  const { invoices } = useERP();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerPhone.includes(searchQuery);

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && inv.paymentStatus === statusFilter;
  });

  const totalBhd = filteredInvoices.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText color="var(--accent-gold)" /> Customer Invoice Management
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Generate, print, and track professional ERP invoices linked directly to counter sales.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filtered Invoices Total:</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
              BHD {totalBhd.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['All', 'Paid', 'Pending'] as const).map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st} Invoices
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '2.5rem', padding: '0.45rem 0.75rem 0.45rem 2.5rem' }}
              placeholder="Search invoice #, customer name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issued Date</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Total (BHD)</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No customer invoices found matching the selected search query.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{inv.invoiceNumber}</td>
                    <td>{inv.issuedDate}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.customerPhone}</div>
                    </td>
                    <td>{inv.items.length} Item(s)</td>
                    <td style={{ fontWeight: 700 }}>BHD {inv.total.toFixed(3)}</td>
                    <td>{inv.paymentMethod}</td>
                    <td>
                      {inv.paymentStatus === 'Paid' ? (
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} /> Paid
                        </span>
                      ) : (
                        <span className="badge badge-gold">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => setSelectedInvoice(inv)}>
                        <Eye size={14} /> View & Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
};
