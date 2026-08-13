import React, { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ERPProvider } from './context/ERPContext';
import { LanguageProvider } from './context/LanguageContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { POS } from './components/pos/POS';
import { CustomerList } from './components/customers/CustomerList';
import { InvoiceList } from './components/invoices/InvoiceList';
import { InventoryList } from './components/inventory/InventoryList';
import { StaffList } from './components/payroll/StaffList';
import { AdminTab } from './components/admin/AdminTab';
import { CommandPalette } from './components/common/CommandPalette';
import { Customer } from './types';

const APP_TABS = ['dashboard', 'pos', 'customers', 'invoices', 'inventory', 'payroll', 'admin'] as const;
type AppTab = (typeof APP_TABS)[number];

interface RouteState {
  tab: AppTab;
  customerId?: string;
}

const isAppTab = (value: string): value is AppTab =>
  (APP_TABS as readonly string[]).includes(value);

const getRouteFromLocation = (): RouteState => {
  const routeSegment = window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const tab = isAppTab(routeSegment) ? routeSegment : 'dashboard';
  const customerId = new URLSearchParams(window.location.search).get('customer') || undefined;

  return { tab, customerId: tab === 'pos' ? customerId : undefined };
};

const MainAppContent: React.FC = () => {
  const [route, setRoute] = useState<RouteState>(getRouteFromLocation);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (requestedTab: string, customerId?: string) => {
    const tab = isAppTab(requestedTab) ? requestedTab : 'dashboard';
    const path = tab === 'dashboard' ? '/' : `/${tab}`;
    const query = tab === 'pos' && customerId ? `?customer=${encodeURIComponent(customerId)}` : '';

    window.history.pushState({}, '', `${path}${query}`);
    setRoute({ tab, customerId: tab === 'pos' ? customerId : undefined });
  };

  const handleOpenPOSWithCustomer = (customer: Customer) => {
    navigateTo('pos', customer.id);
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={route.tab} setActiveTab={navigateTo} />
      <div className="main-layout">
        <Header onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
        <main className="content-area" id="main-content" tabIndex={-1}>
          {route.tab === 'dashboard' && (
            <Dashboard
              setActiveTab={navigateTo}
              onOpenPOS={() => navigateTo('pos')}
              onOpenNewCustomer={() => navigateTo('customers')}
            />
          )}
          {route.tab === 'pos' && <POS initialCustomerId={route.customerId} />}
          {route.tab === 'customers' && (
            <CustomerList onOpenPOSWithCustomer={handleOpenPOSWithCustomer} />
          )}
          {route.tab === 'invoices' && <InvoiceList />}
          {route.tab === 'inventory' && <InventoryList />}
          {route.tab === 'payroll' && <StaffList />}
          {route.tab === 'admin' && <AdminTab />}
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onOpen={() => setIsCommandPaletteOpen(true)}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={navigateTo}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ERPProvider>
          <MainAppContent />
        </ERPProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
