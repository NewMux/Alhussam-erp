import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Search,
  ShoppingCart,
  Users,
  FileText,
  Boxes,
  Users2,
  ShieldCheck,
  Command,
  X,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectTab: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onOpen,
  onClose,
  onSelectTab,
}) => {
  const { customers, inventory } = useERP();
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
          onOpen();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  if (!isOpen) return null;

  // Build items list based on search query
  const moduleShortcuts = [
    { type: 'nav', label: t.dashboard, tab: 'dashboard', icon: <Command size={16} /> },
    { type: 'nav', label: t.pos, tab: 'pos', icon: <ShoppingCart size={16} /> },
    { type: 'nav', label: t.customers, tab: 'customers', icon: <Users size={16} /> },
    { type: 'nav', label: t.invoices, tab: 'invoices', icon: <FileText size={16} /> },
    { type: 'nav', label: t.inventory, tab: 'inventory', icon: <Boxes size={16} /> },
    { type: 'nav', label: t.payroll, tab: 'payroll', icon: <Users2 size={16} /> },
    { type: 'nav', label: t.admin, tab: 'admin', icon: <ShieldCheck size={16} /> },
  ];

  const matchedCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
  );

  const matchedFabrics = inventory.filter(
    (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.code.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectModule = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '600px',
          padding: 0,
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '18px',
          overflow: 'hidden',
          color: 'var(--text-main)',
        }}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f9f9fb' }}>
          <Search size={20} color="var(--apple-blue)" style={{ marginRight: lang === 'ar' ? 0 : 12, marginLeft: lang === 'ar' ? 12 : 0 }} />
          <input
            type="text"
            className="input"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.05rem',
              fontWeight: 500,
              boxShadow: 'none',
              padding: 0,
              color: 'var(--text-main)',
            }}
            placeholder={lang === 'ar' ? 'ابحث في النظام عن عميل، قماش، أو أمر... (Cmd + K)' : 'Search ERP for customers, fabrics, invoices... (Cmd + K)'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="btn btn-sm btn-secondary" onClick={onClose} style={{ padding: '0.2rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Search Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.75rem' }}>
          {query.trim() === '' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--apple-blue)', textTransform: 'uppercase', padding: '0.35rem 0.75rem' }}>
                {lang === 'ar' ? 'الوحدات الرئيسية' : 'System Modules'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {moduleShortcuts.map((mod) => (
                  <div
                    key={mod.tab}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'rgba(0,0,0,0.02)',
                    }}
                    onClick={() => handleSelectModule(mod.tab)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500, color: 'var(--text-main)' }}>
                      {mod.icon} {mod.label}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jump to module</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Results */}
          {matchedCustomers.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--apple-blue)', textTransform: 'uppercase', padding: '0.35rem 0.75rem' }}>
                {lang === 'ar' ? 'العملاء المطابقين' : 'Matching Customers'}
              </div>
              {matchedCustomers.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.02)',
                    marginBottom: '0.25rem',
                  }}
                  onClick={() => {
                    onSelectTab('customers');
                    onClose();
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                  </div>
                  <span className="badge badge-blue">View Customer Profile</span>
                </div>
              ))}
            </div>
          )}

          {/* Fabric Results */}
          {matchedFabrics.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--apple-blue)', textTransform: 'uppercase', padding: '0.35rem 0.75rem' }}>
                {lang === 'ar' ? 'أقمشة وخامات المطابقة' : 'Matching Fabric Rolls'}
              </div>
              {matchedFabrics.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.02)',
                    marginBottom: '0.25rem',
                  }}
                  onClick={() => {
                    onSelectTab('inventory');
                    onClose();
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{f.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {f.code} | Stock: {f.quantity} {f.unit}</div>
                  </div>
                  <span className="badge badge-emerald">Inventory</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Command Palette Footer */}
        <div style={{ background: '#f2f2f7', padding: '0.65rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Press <strong>ESC</strong> to exit</span>
          <span>Apple Light Mode ERP Command Line v2.0</span>
        </div>
      </div>
    </div>
  );
};
