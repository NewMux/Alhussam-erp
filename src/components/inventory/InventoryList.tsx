import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { InventoryItem } from '../../types';
import { FabricModal } from './FabricModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  RefreshCw,
  Edit2,
  History,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const InventoryList: React.FC = () => {
  const { inventory, movements } = useERP();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFabricModalOpen, setIsFabricModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [showMovementsDrawer, setShowMovementsDrawer] = useState(false);

  const categories = ['All', 'Fabric', 'Lining', 'Buttons', 'Thread', 'Accessories'];

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.color.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === 'All') return matchesSearch;
    return matchesSearch && item.category === selectedCategory;
  });

  const lowStockItems = inventory.filter((i) => i.quantity <= i.minThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Boxes color="var(--apple-blue)" /> Inventory & Fabric Roll Management
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Track fabric rolls, meterage balances, low-stock thresholds, and auditable material movements.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowMovementsDrawer(!showMovementsDrawer)}>
              <History size={16} /> Movement Log ({movements.length})
            </button>
            <button className="btn btn-primary" onClick={() => { setEditingItem(null); setIsFabricModalOpen(true); }}>
              <Plus size={16} /> Add Fabric Roll
            </button>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Header Banner */}
      {lowStockItems.length > 0 && (
        <div style={{ padding: '1rem', background: 'var(--apple-red-subtle)', border: '1px solid rgba(255, 59, 48, 0.25)', borderRadius: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={24} color="var(--apple-red)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--apple-red)' }}>
                Attention Required: {lowStockItems.length} Fabric/Material item(s) are below minimum threshold!
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Items: {lowStockItems.map((i) => `${i.name} (${i.quantity} ${i.unit} left)`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '2.5rem', padding: '0.45rem 0.75rem 0.45rem 2.5rem' }}
              placeholder="Search fabric name, code, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Inventory Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Material / Fabric Name</th>
                <th>Category</th>
                <th>Color & Width</th>
                <th>Available Balance</th>
                <th>Min Threshold</th>
                <th>Cost / Unit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No fabric items found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const isLow = item.quantity <= item.minThreshold;

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: 'var(--apple-blue)' }}>{item.code}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                      </td>
                      <td>
                        <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>{item.category}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {item.color} {item.widthInches ? `(${item.widthInches}")` : ''}
                      </td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-emerald'}`} style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {item.minThreshold} {item.unit}
                      </td>
                      <td style={{ fontWeight: 600 }}>BHD {item.costPerUnit.toFixed(3)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setAdjustingItem(item)}
                            title="Record Stock Movement"
                          >
                            <RefreshCw size={14} /> Adjust Stock
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setEditingItem(item); setIsFabricModalOpen(true); }}
                            title="Edit Material Specs"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movements Audit History Drawer */}
      {showMovementsDrawer && (
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <div className="card-header">
            <h3>Stock Movements Audit History</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowMovementsDrawer(false)}>
              Close History Log
            </button>
          </div>

          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reason / Ref</th>
                  <th>Responsible Actor</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(mov.timestamp).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{mov.inventoryItemName}</td>
                      <td>
                        {mov.type === 'stock-in' || mov.type === 'return' ? (
                          <span className="badge badge-emerald"><TrendingUp size={10} /> {mov.type}</span>
                        ) : (
                          <span className="badge badge-gold"><TrendingDown size={10} /> {mov.type}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{mov.quantity}</td>
                      <td style={{ fontSize: '0.85rem' }}>{mov.reason}</td>
                      <td>{mov.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fabric Add/Edit Modal */}
      {isFabricModalOpen && (
        <FabricModal
          existingItem={editingItem || undefined}
          onClose={() => setIsFabricModalOpen(false)}
        />
      )}

      {/* Stock Movement Modal */}
      {adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
        />
      )}
    </div>
  );
};
