import React, { useState } from 'react';
import { ShopSettingsView } from './ShopSettings';
import { AuditLogsView } from './AuditLogs';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Building2, Users } from 'lucide-react';

export const AdminTab: React.FC = () => {
  const { users } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'audit' | 'users'>('settings');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck color="var(--accent-gold)" /> ERP Administration & Audit Control
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Configure shop identity, review security audit logs, and inspect active staff user permissions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${activeSubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('settings')}
            >
              <Building2 size={14} /> Shop Identity
            </button>
            <button
              className={`btn btn-sm ${activeSubTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('audit')}
            >
              <ShieldCheck size={14} /> Audit Trail
            </button>
            <button
              className={`btn btn-sm ${activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('users')}
            >
              <Users size={14} /> User Accounts
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'settings' && <ShopSettingsView />}
      {activeSubTab === 'audit' && <AuditLogsView />}

      {activeSubTab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h3>Registered ERP User Accounts</h3>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Login Username</th>
                  <th>Assigned System Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.login}</td>
                    <td>
                      <span className="badge badge-gold">{u.role}</span>
                    </td>
                    <td>
                      <span className="badge badge-emerald">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
