import React from 'react';
import { useERP } from '../../context/ERPContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Banknote,
  TrendingUp,
  AlertTriangle,
  Users,
  ShoppingCart,
  UserPlus,
  Boxes,
  FileCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenPOS: () => void;
  onOpenNewCustomer: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, onOpenPOS, onOpenNewCustomer }) => {
  const { sales, inventory, customers, invoices, payouts } = useERP();
  const { t, lang } = useLanguage();

  // Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter((s) => s.timestamp.startsWith(todayStr));
  const todayRevenue = todaySales.reduce((acc, curr) => acc + curr.total, 0);

  const monthlySales = sales.filter((s) => s.timestamp.startsWith('2026-08'));
  const monthlyRevenue = monthlySales.reduce((acc, curr) => acc + curr.total, 0);

  const lowStockItems = inventory.filter((i) => i.quantity <= i.minThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border-color)' }}>
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem', letterSpacing: '-0.015em' }}>
              {t.operationalOverview}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {t.overviewSubtitle}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button className="btn btn-primary" onClick={onOpenPOS}>
              <ShoppingCart size={16} /> {t.fastPOSCheckout}
            </button>
            <button className="btn btn-secondary" onClick={onOpenNewCustomer}>
              <UserPlus size={16} /> {t.newCustomerMeasurement}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-4">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--apple-blue-subtle)', color: 'var(--apple-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Banknote size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.todaysRevenue}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              BHD {todayRevenue.toFixed(3)}
            </h3>
            <span style={{ fontSize: '0.725rem', color: 'var(--apple-green)' }}>
              {todaySales.length} sale(s) today
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--apple-green-subtle)', color: 'var(--apple-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.augustRevenue}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              BHD {monthlyRevenue.toFixed(3)}
            </h3>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              {monthlySales.length} total orders
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: lowStockItems.length > 0 ? 'var(--apple-red-subtle)' : 'var(--apple-gray-subtle)', color: lowStockItems.length > 0 ? 'var(--apple-red)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.lowStockFabrics}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: lowStockItems.length > 0 ? 'var(--apple-red)' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {lowStockItems.length} Roll(s)
            </h3>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              {inventory.length} total fabric items
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(0,0,0,0.04)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.totalCustomers}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {customers.length} Profiles
            </h3>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              Stored with measurements
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Recent Transactions Table */}
        <div className="card">
          <div className="card-header">
            <h3>{t.recentPOSTransactions}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setActiveTab('invoices')}>
              {t.viewAllInvoices}
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction #</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 5).map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 600, color: 'var(--apple-blue)' }}>{sale.transactionNumber}</td>
                    <td>
                      <div>{sale.customerName}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sale.customerPhone}</span>
                    </td>
                    <td>{sale.paymentMethod}</td>
                    <td style={{ fontWeight: 600 }}>BHD {sale.total.toFixed(3)}</td>
                    <td>
                      {sale.syncStatus === 'pending' ? (
                        <span className="badge badge-gold">
                          <Clock size={10} /> Offline Pending
                        </span>
                      ) : (
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={10} /> {sale.paymentStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Widgets Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Low Stock Widget */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Boxes size={16} color="var(--apple-blue)" /> {t.lowStockAlerts}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setActiveTab('inventory')}>
                {t.manageStock}
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>All fabric rolls & materials are above thresholds.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'var(--apple-red-subtle)',
                      border: '1px solid rgba(255, 59, 48, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Code: {item.code} | Threshold: {item.minThreshold} {item.unit}</div>
                    </div>
                    <span className="badge badge-danger">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Module Shortcut Card */}
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.85rem' }}>{t.quickLinks}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setActiveTab('customers')}>
                <Users size={15} /> Customer Measurements Database
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setActiveTab('inventory')}>
                <Boxes size={15} /> Receive Fabric Stock Movement
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setActiveTab('payroll')}>
                <FileCheck size={15} /> Review Monthly Staff Payroll ({payouts.length} records)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
