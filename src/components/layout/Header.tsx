import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useERP } from '../../context/ERPContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import {
  Scissors,
  Wifi,
  WifiOff,
  RefreshCw,
  UserCheck,
  RotateCcw,
  Building2,
  Globe,
  Command,
} from 'lucide-react';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const { currentUser, switchRole } = useAuth();
  const {
    settings,
    isSimulatedOffline,
    toggleSimulatedOffline,
    offlineQueue,
    syncOfflineSales,
    resetDemoData,
  } = useERP();
  const { lang, toggleLanguage, t } = useLanguage();

  const handleSync = () => {
    const res = syncOfflineSales();
    if (res.syncedCount > 0) {
      alert(lang === 'ar' ? `تمت مزامنة ${res.syncedCount} معاملة أوفلاين بنجاح!` : `Successfully synchronized ${res.syncedCount} offline transaction(s)!`);
    } else {
      alert(lang === 'ar' ? 'لا توجد معاملات أوفلاين قيد الانتظار.' : 'No offline transactions pending synchronization.');
    }
  };

  const handleReset = () => {
    if (window.confirm(lang === 'ar' ? 'هل تريد إعادة ضبط قاعدة البيانات للبيانات الأولية؟' : 'Reset database to clean initial seed data?')) {
      resetDemoData();
    }
  };

  return (
    <header className="top-header no-print">
      <div className="shop-branding">
        <div className="shop-logo-badge">
          <Scissors size={18} />
        </div>
        <div className="shop-title">
          <h1>{lang === 'ar' && settings.arabicShopName ? settings.arabicShopName : settings.shopName}</h1>
          <span>
            <Building2 size={12} style={{ display: 'inline', marginRight: 4, marginLeft: 4 }} />
            {settings.crNumber} • {settings.currency}
          </span>
        </div>
      </div>

      <div className="header-actions">
        {/* Command Palette Trigger */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={onOpenCommandPalette}
          title="Open Apple Command Line (Cmd + K)"
        >
          <Command size={14} color="var(--apple-blue)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cmd + K</span>
        </button>

        {/* Bilingual Language Switcher */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={toggleLanguage}
          style={{ background: 'var(--apple-blue-subtle)', color: 'var(--apple-blue)', border: '1px solid rgba(0,113,227,0.2)', fontWeight: 600 }}
        >
          <Globe size={14} />
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

        {/* Offline Simulation Toggle */}
        <button
          className={`btn btn-sm ${isSimulatedOffline ? 'btn-danger' : 'btn-secondary'}`}
          onClick={toggleSimulatedOffline}
          title="Click to toggle network connection state"
        >
          {isSimulatedOffline ? (
            <>
              <WifiOff size={14} /> {t.offlineMode}
            </>
          ) : (
            <>
              <Wifi size={14} color="var(--apple-green)" /> {t.online}
            </>
          )}
        </button>

        {/* Sync Offline Queue Button */}
        {offlineQueue.length > 0 && (
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSync}
            disabled={isSimulatedOffline}
          >
            <RefreshCw size={14} className={offlineQueue.length > 0 ? 'spin' : ''} />
            {t.syncQueue} ({offlineQueue.length})
          </button>
        )}

        {/* Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f2f2f7', padding: '0.25rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <UserCheck size={14} color="var(--apple-blue)" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1 }}>{t.role}: {currentUser.name}</span>
            <select
              style={{
                background: 'transparent',
                color: 'var(--text-main)',
                border: 'none',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
              value={currentUser.role}
              onChange={(e) => switchRole(e.target.value as UserRole)}
            >
              <option value="admin" style={{ background: '#ffffff', color: '#000000' }}>Owner / Admin</option>
              <option value="sales" style={{ background: '#ffffff', color: '#000000' }}>Sales Counter Staff</option>
              <option value="tailor" style={{ background: '#ffffff', color: '#000000' }}>Tailor Staff</option>
              <option value="inventory" style={{ background: '#ffffff', color: '#000000' }}>Inventory Manager</option>
              <option value="payroll" style={{ background: '#ffffff', color: '#000000' }}>Payroll Manager</option>
            </select>
          </div>
        </div>

        {/* Seed Reset */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleReset}
          title="Reset sample database"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </header>
  );
};
