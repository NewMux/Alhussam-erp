import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Customer, MeasurementProfile } from '../../types';
import { MeasurementModal } from './MeasurementModal';
import {
  Users,
  Search,
  Plus,
  Ruler,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  History,
  ShoppingCart,
} from 'lucide-react';

interface CustomerListProps {
  onOpenPOSWithCustomer?: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onOpenPOSWithCustomer }) => {
  const { customers, measurements, saveCustomer } = useERP();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);

  // New Customer Form Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  // Measurement Modal State
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const customerMeasurements = selectedCustomer
    ? measurements
        .filter((m) => m.customerId === selectedCustomer.id)
        .sort((a, b) => b.version - a.version)
    : [];

  const latestMeasurement = customerMeasurements[0];

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    // Duplicate check
    const existing = customers.find(
      (c) => c.phone.trim() === newCustPhone.trim() || c.name.toLowerCase() === newCustName.toLowerCase()
    );
    if (existing && !duplicateWarning) {
      setDuplicateWarning(existing);
      return;
    }

    const created = saveCustomer({
      id: `cust-${Date.now()}`,
      name: newCustName,
      phone: newCustPhone,
      email: newCustEmail,
      address: newCustAddress,
      notes: newCustNotes,
      preferredContact: 'WhatsApp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setSelectedCustomer(created);
    setIsAddModalOpen(false);
    setDuplicateWarning(null);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustNotes('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>
      {/* LEFT COLUMN: Customer Table & Search */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="var(--accent-gold)" /> Customer Database ({customers.length})
          </h3>
          <button className="btn btn-sm btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} /> New Customer
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name or phone (+973)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Customer List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredCustomers.map((c) => {
            const hasMeas = measurements.some((m) => m.customerId === c.id);
            const isSelected = selectedCustomer?.id === c.id;

            return (
              <div
                key={c.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: isSelected ? 'var(--accent-gold-subtle)' : 'var(--bg-primary)',
                  border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setSelectedCustomer(c)}
              >
                <div className="flex-between">
                  <div style={{ fontWeight: 600, color: isSelected ? 'var(--accent-gold)' : '#ffffff' }}>
                    {c.name}
                  </div>
                  {hasMeas ? (
                    <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                      Measured
                    </span>
                  ) : (
                    <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>
                      Pending Measurement
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  <Phone size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {c.phone}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Customer Detail & Measurement History */}
      {selectedCustomer ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', overflowY: 'auto' }}>
          {/* Header Action Bar */}
          <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>{selectedCustomer.name}</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <span><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />{selectedCustomer.phone}</span>
                {selectedCustomer.email && <span><Mail size={13} style={{ display: 'inline', marginRight: 4 }} />{selectedCustomer.email}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm btn-primary" onClick={() => setIsMeasurementModalOpen(true)}>
                <Ruler size={14} /> Record Measurements
              </button>
              {onOpenPOSWithCustomer && (
                <button className="btn btn-sm btn-success" onClick={() => onOpenPOSWithCustomer(selectedCustomer)}>
                  <ShoppingCart size={14} /> Start POS Sale
                </button>
              )}
            </div>
          </div>

          {/* Profile Metadata */}
          {selectedCustomer.address && (
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} /> Address: {selectedCustomer.address}
            </div>
          )}

          {/* Measurements Version Timeline */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--accent-gold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} /> Measurement Profiles & Versions ({customerMeasurements.length})
            </h3>

            {customerMeasurements.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-primary)', borderRadius: '10px', color: 'var(--text-muted)' }}>
                <Ruler size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No tailor measurements recorded for this customer yet.</p>
                <button className="btn btn-sm btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => setIsMeasurementModalOpen(true)}>
                  Record First Profile
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {customerMeasurements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: 'var(--bg-primary)',
                      border: m.version === latestMeasurement.version ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1rem',
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span className="badge badge-gold">
                        Version {m.version} {m.version === latestMeasurement.version ? '(Current Approved Profile)' : ''}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Date: {m.effectiveDate} | Recorded by: {m.createdBy}
                      </span>
                    </div>

                    {/* Dimensions Specs Grid */}
                    <div className="grid-4" style={{ gap: '0.5rem', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Neck:</span> <strong>{m.neck}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Chest:</span> <strong>{m.chest}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Waist:</span> <strong>{m.waist}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Hips:</span> <strong>{m.hips}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Shoulder:</span> <strong>{m.shoulder}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Sleeve:</span> <strong>{m.sleeveLength}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Thobe Length:</span> <strong>{m.thobeLength}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Armhole:</span> <strong>{m.armhole}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Cuff:</span> <strong>{m.cuff}"</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Inseam:</span> <strong>{m.inseam}"</strong></div>
                    </div>

                    <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--text-muted)' }}>
                      <div><strong>Styles:</strong> Fit: {m.fitPreference} | Collar: {m.collarStyle} | Pocket: {m.pocketStyle}</div>
                      {m.notes && <div><strong>Notes:</strong> {m.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select a customer from the list to view profile & measurement history.
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3>Create Customer Profile</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => { setIsAddModalOpen(false); setDuplicateWarning(null); }}>
                Cancel
              </button>
            </div>

            {duplicateWarning && (
              <div style={{ padding: '0.85rem', background: 'var(--accent-danger-subtle)', border: '1px solid var(--accent-danger)', borderRadius: '8px', marginBottom: '1rem', color: '#ffffff' }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-danger)' }}>
                  <AlertTriangle size={18} /> Possible Duplicate Customer Found!
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  A customer named <strong>{duplicateWarning.name}</strong> with phone number <strong>{duplicateWarning.phone}</strong> already exists in the system.
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedCustomer(duplicateWarning); setIsAddModalOpen(false); setDuplicateWarning(null); }}>
                    Open Existing Profile
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={(e) => { setDuplicateWarning(null); handleCreateCustomer(e); }}>
                    Proceed Anyway
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Full Customer Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Sheikh Jasim Al-Bahri"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (+973) *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="+973 3900 1234"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="customer@example.bh"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Road 204, Riffa, Bahrain"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Special Notes</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="VIP preferences, language preference..."
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">
                  Save Customer Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Measurement Modal */}
      {isMeasurementModalOpen && selectedCustomer && (
        <MeasurementModal
          customer={selectedCustomer}
          existingProfile={latestMeasurement}
          onClose={() => setIsMeasurementModalOpen(false)}
        />
      )}
    </div>
  );
};
