import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { useERP } from '../../context/ERPContext';
import { Boxes, X, Save } from 'lucide-react';

interface FabricModalProps {
  existingItem?: InventoryItem;
  onClose: () => void;
}

export const FabricModal: React.FC<FabricModalProps> = ({ existingItem, onClose }) => {
  const { saveInventoryItem } = useERP();

  const [formData, setFormData] = useState({
    name: existingItem?.name || '',
    code: existingItem?.code || `FAB-${Math.floor(100 + Math.random() * 900)}`,
    category: existingItem?.category || 'Fabric',
    color: existingItem?.color || 'White',
    widthInches: existingItem?.widthInches || 58,
    quantity: existingItem?.quantity || 100.0,
    unit: existingItem?.unit || 'Meters',
    minThreshold: existingItem?.minThreshold || 25.0,
    costPerUnit: existingItem?.costPerUnit || 5.0,
    active: existingItem ? existingItem.active : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveInventoryItem({
      id: existingItem?.id || `inv-${Date.now()}`,
      ...formData,
    } as InventoryItem);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Boxes color="var(--accent-gold)" /> {existingItem ? 'Edit Fabric / Material' : 'Add New Fabric Roll'}
          </h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input
              type="text"
              className="input"
              required
              placeholder="e.g. Toyobo Royal Japanese Cotton"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Roll / Item Code *</label>
              <input
                type="text"
                className="input"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
              >
                <option value="Fabric">Fabric</option>
                <option value="Lining">Lining</option>
                <option value="Buttons">Buttons</option>
                <option value="Thread">Thread</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Color / Shade</label>
              <input
                type="text"
                className="input"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Width (Inches)</label>
              <input
                type="number"
                className="input"
                value={formData.widthInches}
                onChange={(e) => setFormData({ ...formData, widthInches: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <select
                className="select"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
              >
                <option value="Meters">Meters</option>
                <option value="Yards">Yards</option>
                <option value="Rolls">Rolls</option>
                <option value="Pieces">Pieces</option>
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Current Stock Quantity</label>
              <input
                type="number"
                step="0.5"
                className="input"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Low Stock Alert Threshold</label>
              <input
                type="number"
                step="0.5"
                className="input"
                required
                value={formData.minThreshold}
                onChange={(e) => setFormData({ ...formData, minThreshold: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cost per Unit (BHD)</label>
              <input
                type="number"
                step="0.100"
                className="input"
                required
                value={formData.costPerUnit}
                onChange={(e) => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save Material Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
