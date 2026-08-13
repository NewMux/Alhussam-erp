import React, { useState } from 'react';
import { Customer, MeasurementProfile } from '../../types';
import { useERP } from '../../context/ERPContext';
import { Ruler, Save, X } from 'lucide-react';

interface MeasurementModalProps {
  customer: Customer;
  existingProfile?: MeasurementProfile;
  onClose: () => void;
}

export const MeasurementModal: React.FC<MeasurementModalProps> = ({
  customer,
  existingProfile,
  onClose,
}) => {
  const { saveMeasurementProfile } = useERP();

  const [formData, setFormData] = useState({
    neck: existingProfile?.neck || 16.0,
    chest: existingProfile?.chest || 42.0,
    waist: existingProfile?.waist || 36.0,
    hips: existingProfile?.hips || 43.0,
    shoulder: existingProfile?.shoulder || 18.0,
    sleeveLength: existingProfile?.sleeveLength || 33.5,
    thobeLength: existingProfile?.thobeLength || 57.0,
    armhole: existingProfile?.armhole || 20.0,
    cuff: existingProfile?.cuff || 9.0,
    inseam: existingProfile?.inseam || 30.0,
    fitPreference: existingProfile?.fitPreference || 'Regular',
    collarStyle: existingProfile?.collarStyle || 'Traditional Saudi',
    pocketStyle: existingProfile?.pocketStyle || 'Double Pocket',
    notes: existingProfile?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMeasurementProfile({
      id: '',
      customerId: customer.id,
      version: 1, // Will be computed automatically by DB
      effectiveDate: new Date().toISOString().split('T')[0],
      createdBy: 'Counter Staff',
      ...formData,
    } as MeasurementProfile);

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '750px' }}>
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Ruler color="var(--accent-gold)" /> Record Measurements: {customer.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone: {customer.phone}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Dimensions Grid */}
          <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '0.75rem' }}>Body Dimensions (Inches)</h4>
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Neck Circumference</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.neck}
                onChange={(e) => setFormData({ ...formData, neck: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Chest / Bust</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.chest}
                onChange={(e) => setFormData({ ...formData, chest: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Waist</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.waist}
                onChange={(e) => setFormData({ ...formData, waist: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hips</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.hips}
                onChange={(e) => setFormData({ ...formData, hips: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shoulder Width</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.shoulder}
                onChange={(e) => setFormData({ ...formData, shoulder: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sleeve Length</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.sleeveLength}
                onChange={(e) => setFormData({ ...formData, sleeveLength: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Thobe / Overall Length</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.thobeLength}
                onChange={(e) => setFormData({ ...formData, thobeLength: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Armhole</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.armhole}
                onChange={(e) => setFormData({ ...formData, armhole: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cuff Circumference</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={formData.cuff}
                onChange={(e) => setFormData({ ...formData, cuff: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          {/* Tailoring Styling Options */}
          <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '0.75rem' }}>Tailoring & Fit Preferences</h4>
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Fit Cut Preference</label>
              <select
                className="select"
                value={formData.fitPreference}
                onChange={(e) => setFormData({ ...formData, fitPreference: e.target.value as any })}
              >
                <option value="Slim">Slim Fit</option>
                <option value="Regular">Regular Fit</option>
                <option value="Loose">Loose Comfort Fit</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Collar Cut Style</label>
              <select
                className="select"
                value={formData.collarStyle}
                onChange={(e) => setFormData({ ...formData, collarStyle: e.target.value as any })}
              >
                <option value="Traditional Saudi">Traditional Saudi Collar</option>
                <option value="Emirati Soft">Emirati Soft Collar</option>
                <option value="Kuwaiti Mandarin">Kuwaiti Mandarin Collar</option>
                <option value="Modern Cutaway">Modern Cutaway Collar</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Pocket Style</label>
              <select
                className="select"
                value={formData.pocketStyle}
                onChange={(e) => setFormData({ ...formData, pocketStyle: e.target.value as any })}
              >
                <option value="Single Chest">Single Chest Pocket</option>
                <option value="Double Pocket">Double Side & Chest</option>
                <option value="Hidden Pocket">Hidden Inside Pocket</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Tailor Fitting Notes</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="e.g. Extra ease around shoulders, double stitching on cuffs..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save New Measurement Version
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
