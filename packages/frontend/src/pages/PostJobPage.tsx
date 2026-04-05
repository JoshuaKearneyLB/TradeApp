import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { jobService } from '../services/jobService';
import type { Category } from '../services/jobService';
import type { GeocodeSuggestion } from '../services/geocodeService';
import { AddressAutocomplete } from '../components/AddressAutocomplete';

const URGENCY_OPTIONS = [
  { value: 'low',       label: 'Low',       desc: 'No rush — within a few weeks',  icon: '🟡' },
  { value: 'medium',    label: 'Medium',     desc: 'Within a few days',             icon: '🟠' },
  { value: 'high',      label: 'High',       desc: 'As soon as possible',           icon: '🔴' },
  { value: 'emergency', label: 'Emergency',  desc: 'Right now — urgent callout',    icon: '🚨' },
];

export function PostJobPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [form, setForm] = useState({
    categoryId: '',
    title: '',
    description: '',
    address: '',
    urgency: 'medium',
    estimatedBudget: '',
  });

  useEffect(() => {
    jobService.getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (value: string) => {
    setForm((prev) => ({ ...prev, address: value }));
    setGeocodedLocation(null);
  };

  const handleAddressSelect = (suggestion: GeocodeSuggestion) => {
    setForm((prev) => ({ ...prev, address: suggestion.shortName }));
    setGeocodedLocation({ latitude: suggestion.latitude, longitude: suggestion.longitude });
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId || !form.title || !form.description || !form.address) {
      setError('Please fill in all required fields');
      return;
    }
    if (!form.estimatedBudget || Number(form.estimatedBudget) <= 0) {
      setError('A budget is required so the tradesperson knows what to expect');
      return;
    }
    setIsLoading(true);
    try {
      await jobService.createJob({
        categoryId: Number(form.categoryId),
        title: form.title,
        description: form.description,
        address: form.address,
        urgency: form.urgency,
        estimatedBudget: Number(form.estimatedBudget),
        location: geocodedLocation ?? undefined,
      });
      navigate('/my-jobs');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            <Link to="/my-jobs" className="navbar-link">My Jobs</Link>
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Header */}
        <div className="animate-in" style={{ marginBottom: 32 }}>
          <p className="section-label">Post a job</p>
          <h1 style={{ marginBottom: 6 }}>
            What do you need done
            <span style={{ color: 'var(--color-amber)' }}>?</span>
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Describe your job and get matched with qualified local tradespeople.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="animate-in animate-in-delay-1">
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* Trade category */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Trade type</h4>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="categoryId" className="form-label">Service category <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <select
                id="categoryId"
                name="categoryId"
                className="form-select"
                value={form.categoryId}
                onChange={handleChange}
                required
              >
                <option value="">Select a trade…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Job details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Job details</h4>

            <div className="form-group">
              <label htmlFor="title" className="form-label">Job title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                id="title" name="title" type="text" className="form-input"
                placeholder="e.g. Fix leaking kitchen tap, Replace boiler, Paint living room"
                value={form.title} onChange={handleChange} required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="description" className="form-label">Description <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                id="description" name="description" className="form-input" rows={5}
                placeholder="Describe the job in detail — what's the problem, what materials you have, access instructions, any other specifics that will help a tradesperson quote accurately…"
                value={form.description} onChange={handleChange} required
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Location */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Location</h4>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Address <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <AddressAutocomplete
                id="address"
                name="address"
                value={form.address}
                onChange={handleAddressChange}
                onSelect={handleAddressSelect}
                placeholder="Start typing a street, area or postcode…"
                required
              />
              {geocodedLocation ? (
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--color-success)' }}>
                  ✓ Location pinned on map
                </p>
              ) : form.address && (
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                  Select a suggestion from the dropdown to pin the location
                </p>
              )}
            </div>
          </div>

          {/* Urgency */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Urgency</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, urgency: opt.value })}
                  style={{
                    padding: '12px 10px', border: `2px solid ${form.urgency === opt.value ? 'var(--color-navy)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius)', background: form.urgency === opt.value ? 'rgba(27,58,92,0.06)' : 'var(--color-surface)',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: form.urgency === opt.value ? 'var(--color-navy)' : 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="card" style={{ marginBottom: 28 }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Budget</h4>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="estimatedBudget" className="form-label">
                Budget <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '1rem',
                }}>£</span>
                <input
                  id="estimatedBudget" name="estimatedBudget" type="number" className="form-input"
                  placeholder="0.00" min="0" step="0.01"
                  value={form.estimatedBudget} onChange={handleChange}
                  style={{ paddingLeft: 30 }}
                />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                The fixed price you'll pay on completion. A 10% platform fee is included.
              </p>
            </div>
          </div>

          <button type="submit" className="btn btn-accent btn-block" disabled={isLoading} style={{ fontSize: '1rem', padding: '14px' }}>
            {isLoading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Posting job…</>
              : "+ Post job — it's free"}
          </button>
        </form>
      </div>
    </div>
  );
}
