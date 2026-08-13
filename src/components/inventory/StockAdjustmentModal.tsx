import React, { useState } from 'react';
import { InventoryItem, StockMovement } from '../../types';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, X, Save } from 'lucide-react';

interface StockAdjustmentModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ item, onClose }) => {
  const { recordStockMovement } = useERP();
  const { currentUser } = useAuth();

  const [type, setType] = useState<StockMovement['type']>('stock-in');
  const [quantity, setQuantity] = useState<number>(10.0);
  const [reason, setReason] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('A reason is mandatory for stock movements and audit history.');
      return;
    }

    recordStockMovement({
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      type,
      quantity,
      reason,
      createdBy: currentUser.name,
    });

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Stock Movement: {item.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Code: {item.code} | Current Stock: {item.quantity} {item.unit}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Movement Action</label>
            <div className="grid-3">
              <button
                type="button"
                className={`btn btn-sm ${type === 'stock-in' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => setType('stock-in')}
              >
                <ArrowDownLeft size={16} /> Stock-In (Receive)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${type === 'manual-adjustment' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setType('manual-adjustment')}
              >
                <RefreshCw size={16} /> Manual Deduction
              </button>
              <button
                type="button"
                className={`btn btn-sm ${type === 'return' ? 'btn-secondary' : 'btn-secondary'}`}
                onClick={() => setType('return')}
              >
                <ArrowUpRight size={16} /> Customer Return
              </button>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Quantity ({item.unit}) *</label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                className="input"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Responsible Staff Actor</label>
              <input type="text" className="input" disabled value={`${currentUser.name} (${currentUser.role})`} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Mandatory Reason / Note *</label>
            <textarea
              className="textarea"
              rows={3}
              required
              placeholder="e.g. Shipment receipt from Toyobo supplier, damaged roll scrap, physical audit recount..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Record Stock Movement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
