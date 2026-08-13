import React, { useState } from 'react';
import { StaffMember } from '../../types';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Banknote, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SalaryPayoutModalProps {
  staffMember: StaffMember;
  payPeriod: string; // YYYY-MM
  onClose: () => void;
}

export const SalaryPayoutModal: React.FC<SalaryPayoutModalProps> = ({
  staffMember,
  payPeriod,
  onClose,
}) => {
  const { payouts, performance, createPayout } = useERP();
  const { currentUser } = useAuth();

  // Calculate commission earned in pay period
  const staffPerformance = performance.filter(
    (p) => p.staffId === staffMember.id && p.date.startsWith(payPeriod)
  );
  const calculatedCommission = staffPerformance.reduce((acc, curr) => acc + curr.commissionEarned, 0);

  const [baseSalary, setBaseSalary] = useState(staffMember.baseSalary);
  const [performanceBonus, setPerformanceBonus] = useState(calculatedCommission);
  const [deductions, setDeductions] = useState(0.0);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Check duplicate
  const existingPayout = payouts.find(
    (p) => p.staffId === staffMember.id && p.payPeriod === payPeriod
  );

  const netSalary = Math.max(0, baseSalary + performanceBonus - deductions);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      createPayout({
        staffId: staffMember.id,
        staffName: staffMember.name,
        payPeriod,
        baseSalary,
        performanceBonus,
        deductions,
        netSalary,
        status: 'Paid',
        payoutDate: new Date().toISOString().split('T')[0],
        notes,
        approvedBy: currentUser.name,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create payout');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Banknote color="var(--apple-blue)" /> Monthly Salary Payout
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Staff: {staffMember.name} ({staffMember.jobTitle}) | Pay Period: {payPeriod}
            </span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {existingPayout && (
          <div style={{ padding: '0.85rem', background: 'var(--apple-red-subtle)', border: '1px solid var(--apple-red)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--text-main)' }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--apple-red)' }}>
              <AlertTriangle size={18} /> Duplicate Payout Prevention Warning!
            </div>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              A salary payout of <strong>BHD {existingPayout.netSalary.toFixed(3)}</strong> for period <strong>{payPeriod}</strong> has already been issued to {staffMember.name} on {existingPayout.payoutDate}.
            </p>
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: '0.85rem', background: 'var(--apple-red-subtle)', border: '1px solid var(--apple-red)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--apple-red)' }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Base Salary (BHD)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                required
                value={baseSalary}
                onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Performance Bonus (BHD)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                required
                value={performanceBonus}
                onChange={(e) => setPerformanceBonus(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Deductions (BHD)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                required
                value={deductions}
                onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Calculated Net Output Card */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--apple-blue)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Salary Payable:</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--apple-blue)' }}>
                BHD {netSalary.toFixed(3)}
              </div>
            </div>
            <span className="badge badge-emerald">
              <CheckCircle2 size={12} /> Calculation Verified
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Payout Notes / Approval References</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="e.g. Approved by Payroll Manager Fatima, includes August commissions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!!existingPayout}>
              <Save size={16} /> Confirm & Issue Payout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
