import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Building2, Save, CheckCircle2 } from 'lucide-react';

export const ShopSettingsView: React.FC = () => {
  const { settings, updateSettings } = useERP();
  const [formData, setFormData] = useState({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="card" style={{ maxWidth: '800px' }}>
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 color="var(--accent-gold)" /> Tailor Shop Business Identity Settings
        </h3>
      </div>

      {savedSuccess && (
        <div style={{ padding: '0.85rem', background: 'var(--accent-emerald-subtle)', border: '1px solid var(--accent-emerald)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} /> Shop identity configurations updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Shop Commercial Name (English) *</label>
            <input
              type="text"
              className="input"
              required
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Shop Name (Arabic)</label>
            <input
              type="text"
              className="input"
              value={formData.arabicShopName}
              onChange={(e) => setFormData({ ...formData, arabicShopName: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Commercial Registration (CR) *</label>
            <input
              type="text"
              className="input"
              required
              value={formData.crNumber}
              onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">VAT Registration Number</label>
            <input
              type="text"
              className="input"
              value={formData.vatNumber || ''}
              onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input
              type="text"
              className="input"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Physical Address</label>
          <input
            type="text"
            className="input"
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">POS Thermal Receipt Footer Note</label>
          <input
            type="text"
            className="input"
            value={formData.receiptFooter}
            onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">ERP Invoice Terms & Payment Policy</label>
          <textarea
            className="textarea"
            rows={3}
            value={formData.invoiceTerms}
            onChange={(e) => setFormData({ ...formData, invoiceTerms: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Shop Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
