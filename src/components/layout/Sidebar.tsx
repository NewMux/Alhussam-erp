import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileText,
  Boxes,
  Users2,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavMenuItem {
  id: string;
  labelKey: keyof typeof import('../../services/i18n').translations['en'];
  shortLabel: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { hasPermission } = useAuth();
  const { t } = useLanguage();

  const menuItems: NavMenuItem[] = [
    {
      id: 'dashboard',
      labelKey: 'dashboard',
      shortLabel: 'Overview',
      icon: <LayoutDashboard size={18} />,
      roles: ['admin', 'sales', 'tailor', 'inventory', 'payroll'],
    },
    {
      id: 'pos',
      labelKey: 'pos',
      shortLabel: 'POS',
      icon: <ShoppingCart size={18} />,
      roles: ['admin', 'sales'],
    },
    {
      id: 'customers',
      labelKey: 'customers',
      shortLabel: 'Clients',
      icon: <Users size={18} />,
      roles: ['admin', 'sales', 'tailor'],
    },
    {
      id: 'invoices',
      labelKey: 'invoices',
      shortLabel: 'Invoices',
      icon: <FileText size={18} />,
      roles: ['admin', 'sales', 'payroll'],
    },
    {
      id: 'inventory',
      labelKey: 'inventory',
      shortLabel: 'Stock',
      icon: <Boxes size={18} />,
      roles: ['admin', 'inventory'],
    },
    {
      id: 'payroll',
      labelKey: 'payroll',
      shortLabel: 'Payroll',
      icon: <Users2 size={18} />,
      roles: ['admin', 'payroll'],
    },
    {
      id: 'admin',
      labelKey: 'admin',
      shortLabel: 'Admin',
      icon: <ShieldCheck size={18} />,
      roles: ['admin'],
    },
  ];

  return (
    <aside className="sidebar no-print">
      <div className="nav-group">
        {menuItems.map((item) => {
          const isAllowed = hasPermission(item.roles);
          if (!isAllowed) return null;

          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span className="desktop-label">{t[item.labelKey]}</span>
              <span className="mobile-label">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
