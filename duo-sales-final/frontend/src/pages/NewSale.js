import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const INPUT = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const LABEL = { display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.3px' };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  );
}

export default function NewSale() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    date: today,
    agent_name: user?.role === 'agent' ? user.name : '',
    carrier_name: '',
    email: '',
    lane_details: '',
    amount: '',
    purpose: '',
    lane_start_date: '',
    truck: '',
    phone_number: '',
    company_name: '',
    address: '',
    acc_type: '',
    status: 'Pending',
    closed_by: '',
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await axios.post('/api/sales', form);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); navigate('/sales'); }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>New Sale Submission</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Fill in the details below. A backup email will be sent automatically.</p>
      </div>

      {success && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--green)', fontSize: 13, marginBottom: 20 }}>
          ✓ Sale saved successfully! Email backup sent. Redirecting...
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Basic Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="Date *">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required style={INPUT} />
            </Field>
            <Field label="Agent Name *">
              <input type="text" value={form.agent_name} onChange={e => set('agent_name', e.target.value)}
                readOnly={user?.role === 'agent'} required style={{ ...INPUT, opacity: user?.role === 'agent' ? 0.7 : 1 }} placeholder="Agent name" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...INPUT, opacity: user?.role === 'agent' ? 0.6 : 1 }} disabled={user?.role === 'agent'}>
                <option>Pending</option>
                <option>Active</option>
                <option>Cancelled</option>
                <option>Chargeback</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Carrier & Client Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Carrier Name *">
              <input type="text" value={form.carrier_name} onChange={e => set('carrier_name', e.target.value)} required style={INPUT} placeholder="e.g. ABC Trucking LLC" />
            </Field>
            <Field label="Company Name">
              <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} style={INPUT} placeholder="Client company name" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={INPUT} placeholder="carrier@email.com" />
            </Field>
            <Field label="Phone Number">
              <input type="tel" value={form.phone_number} onChange={e => set('phone_number', e.target.value)} style={INPUT} placeholder="+1 (555) 000-0000" />
            </Field>
            <Field label="Address">
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)} style={INPUT} placeholder="Full address" />
            </Field>
            <Field label="Account Type">
              <input type="text" value={form.acc_type} onChange={e => set('acc_type', e.target.value)} style={INPUT} placeholder="e.g. Spot, Contract, Broker" />
            </Field>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Lane & Deal Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="Lane Details">
              <input type="text" value={form.lane_details} onChange={e => set('lane_details', e.target.value)} style={INPUT} placeholder="e.g. Chicago → Dallas" />
            </Field>
            <Field label="Lane Start Date">
              <input type="date" value={form.lane_start_date} onChange={e => set('lane_start_date', e.target.value)} style={INPUT} />
            </Field>
            <Field label="Truck">
              <input type="text" value={form.truck} onChange={e => set('truck', e.target.value)} style={INPUT} placeholder="e.g. 53ft Dry Van" />
            </Field>
            <Field label="Amount ($)">
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} style={INPUT} placeholder="0.00" step="0.01" min="0" />
            </Field>
            <Field label="Purpose">
              <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)} style={INPUT} placeholder="e.g. Freight, Logistics" />
            </Field>
            <Field label="Closed By">
              <input type="text" value={form.closed_by} onChange={e => set('closed_by', e.target.value)} style={INPUT} placeholder="Name of closer" />
            </Field>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Notes</div>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} placeholder="Any additional notes or comments about this sale..." />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={saving}
            style={{ padding: '12px 32px', background: 'linear-gradient(135deg,#4f8ef7,#6c63ff)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : '+ Submit Sale'}
          </button>
          <button type="button" onClick={() => navigate('/sales')}
            style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
