import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { StaffMember, AttendanceStatus } from '../../types';
import { SalaryPayoutModal } from './SalaryPayoutModal';
import {
  Users2,
  Calendar,
  Award,
  Banknote,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

export const StaffList: React.FC = () => {
  const { staff, attendance, performance, payouts, recordAttendance } = useERP();
  const { currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'attendance' | 'performance' | 'payouts'>('roster');
  const [selectedStaffForPayout, setSelectedStaffForPayout] = useState<StaffMember | null>(null);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('2026-08');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleAttendanceChange = (staffMember: StaffMember, status: AttendanceStatus) => {
    recordAttendance({
      staffId: staffMember.id,
      staffName: staffMember.name,
      date: attendanceDate,
      status,
      createdBy: currentUser.name,
    });
  };

  const getAttendanceForStaffDate = (staffId: string, date: string) => {
    return attendance.find((a) => a.staffId === staffId && a.date === date);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users2 color="var(--apple-blue)" /> Staff Roster, Attendance & Payroll Management
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Record daily attendance, track tailor production output, calculate commissions, and execute monthly salary payouts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${activeSubTab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('roster')}
            >
              <UserCheck size={14} /> Staff Roster
            </button>
            <button
              className={`btn btn-sm ${activeSubTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('attendance')}
            >
              <Calendar size={14} /> Daily Attendance
            </button>
            <button
              className={`btn btn-sm ${activeSubTab === 'performance' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('performance')}
            >
              <Award size={14} /> Tailor Performance
            </button>
            <button
              className={`btn btn-sm ${activeSubTab === 'payouts' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('payouts')}
            >
              <Banknote size={14} /> Monthly Payroll
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: Staff Roster */}
      {activeSubTab === 'roster' && (
        <div className="card">
          <div className="card-header">
            <h3>Active Shop Staff ({staff.length})</h3>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Job Title / Role</th>
                  <th>Contact Phone</th>
                  <th>Base Salary (BHD)</th>
                  <th>Tailor Commission Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{s.name}</td>
                    <td>
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>{s.jobTitle}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{s.phone}</td>
                    <td style={{ fontWeight: 600 }}>BHD {s.baseSalary.toFixed(3)}</td>
                    <td>BHD {s.commissionPerPiece.toFixed(3)} / piece</td>
                    <td>
                      <span className="badge badge-emerald">Active</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => { setSelectedStaffForPayout(s); }}
                      >
                        <Banknote size={14} /> Issue Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Daily Attendance Grid */}
      {activeSubTab === 'attendance' && (
        <div className="card">
          <div className="card-header">
            <h3>Daily Attendance Matrix</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select Date:</span>
              <input
                type="date"
                className="input"
                style={{ width: '160px', padding: '0.35rem 0.5rem' }}
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Attendance Status for {attendanceDate}</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const rec = getAttendanceForStaffDate(s.id, attendanceDate);
                  const currentStatus = rec?.status || 'Present';

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.jobTitle}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {(['Present', 'Absent', 'Half Day', 'Paid Leave'] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              className={`btn btn-sm ${currentStatus === st ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => handleAttendanceChange(s, st)}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {rec ? rec.createdBy : 'Pending input'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Tailor Performance */}
      {activeSubTab === 'performance' && (
        <div className="card">
          <div className="card-header">
            <h3>Tailor Production & Piece-Rate Performance</h3>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tailor Name</th>
                  <th>Production Metric</th>
                  <th>Units Produced</th>
                  <th>Commission Earned (BHD)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td style={{ fontWeight: 600, color: 'var(--apple-blue)' }}>{p.staffName}</td>
                    <td>{p.metric}</td>
                    <td style={{ fontWeight: 600 }}>{p.units} Unit(s)</td>
                    <td style={{ fontWeight: 700, color: 'var(--apple-green)' }}>
                      BHD {p.commissionEarned.toFixed(3)}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Monthly Payroll Summary & Payout History */}
      {activeSubTab === 'payouts' && (
        <div className="card">
          <div className="card-header">
            <h3>Monthly Salary Payout Records</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pay Period:</span>
              <input
                type="month"
                className="input"
                style={{ width: '160px', padding: '0.35rem 0.5rem' }}
                value={selectedPayPeriod}
                onChange={(e) => setSelectedPayPeriod(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Payout ID</th>
                  <th>Pay Period</th>
                  <th>Staff Member</th>
                  <th>Base Salary</th>
                  <th>Bonus / Commission</th>
                  <th>Deductions</th>
                  <th>Net Payout (BHD)</th>
                  <th>Status</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No salary payout records issued for period {selectedPayPeriod}.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, color: 'var(--apple-blue)' }}>{p.id}</td>
                      <td>{p.payPeriod}</td>
                      <td style={{ fontWeight: 600 }}>{p.staffName}</td>
                      <td>BHD {p.baseSalary.toFixed(3)}</td>
                      <td style={{ color: 'var(--apple-green)' }}>+ BHD {p.performanceBonus.toFixed(3)}</td>
                      <td style={{ color: 'var(--apple-red)' }}>- BHD {p.deductions.toFixed(3)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>
                        BHD {p.netSalary.toFixed(3)}
                      </td>
                      <td>
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} /> {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.approvedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {selectedStaffForPayout && (
        <SalaryPayoutModal
          staffMember={selectedStaffForPayout}
          payPeriod={selectedPayPeriod}
          onClose={() => setSelectedStaffForPayout(null)}
        />
      )}
    </div>
  );
};
