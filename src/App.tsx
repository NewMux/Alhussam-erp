import React, { useState } from 'react';
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

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const handleOpenPOSWithCustomer = (customer: Customer) => {
    setActiveTab('pos');
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-layout">
        <Header onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
        <main className="content-area">
          {activeTab === 'dashboard' && (
            <Dashboard
              setActiveTab={setActiveTab}
              onOpenPOS={() => setActiveTab('pos')}
              onOpenNewCustomer={() => setActiveTab('customers')}
            />
          )}
          {activeTab === 'pos' && <POS />}
          {activeTab === 'customers' && (
            <CustomerList onOpenPOSWithCustomer={handleOpenPOSWithCustomer} />
          )}
          {activeTab === 'invoices' && <InvoiceList />}
          {activeTab === 'inventory' && <InventoryList />}
          {activeTab === 'payroll' && <StaffList />}
          {activeTab === 'admin' && <AdminTab />}
        </main>
      </div>

      {/* Tech-Native Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => setActiveTab(tab)}
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
