import React from 'react';
import { useERP } from '../../context/ERPContext';
import { ShieldCheck } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs } = useERP();

  return (
    <div className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck color="var(--accent-gold)" /> System Audit Trail ({auditLogs.length} events)
        </h3>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor User</th>
              <th>Role</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>Metadata Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td style={{ fontWeight: 600, color: '#ffffff' }}>{log.actor}</td>
                <td>
                  <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>{log.actorRole}</span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{log.action}</td>
                <td style={{ fontSize: '0.85rem' }}>{log.entity} ({log.entityId})</td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.metadata || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
