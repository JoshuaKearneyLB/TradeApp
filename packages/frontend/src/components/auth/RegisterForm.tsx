import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@tradeapp/shared';

function validatePhone(phone: string): string {
  if (!phone.trim()) return '';
  const stripped = phone.replace(/[\s\-().]/g, '');
  if (/^(0[1-9]\d{9}|\+44[1-9]\d{9})$/.test(stripped)) return '';
  return 'Please enter a valid UK phone number (e.g. 07911 123456)';
}

export function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: UserRole.CUSTOMER,
  });
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'phone') setPhoneError('');
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    const pErr = validatePhone(formData.phone);
    if (pErr) { setPhoneError(pErr); return; }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isCustomer = formData.role === UserRole.CUSTOMER;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            TradeApp<span className="navbar-brand-dot" />
          </Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }} className="animate-in">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ marginBottom: 6 }}>Join TradeApp</h2>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Free to join — get started in minutes</p>
          </div>

          {/* Role toggle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24,
          }}>
            {[
              { value: UserRole.CUSTOMER, label: 'Homeowner', icon: '🏡', desc: 'I need a tradesperson' },
              { value: UserRole.PROFESSIONAL, label: 'Tradesperson', icon: '🔧', desc: 'I offer services' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData({ ...formData, role: opt.value as UserRole })}
                style={{
                  background: formData.role === opt.value ? 'var(--color-navy)' : 'var(--color-surface)',
                  border: `2px solid ${formData.role === opt.value ? 'var(--color-navy)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '16px 12px',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: formData.role === opt.value ? '#fff' : 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: formData.role === opt.value ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', marginTop: 3 }}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: '32px 32px' }}>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName" className="form-label">First name</label>
                  <input id="firstName" name="firstName" type="text" className="form-input"
                    value={formData.firstName} onChange={handleChange} required placeholder="John" />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName" className="form-label">Last name</label>
                  <input id="lastName" name="lastName" type="text" className="form-input"
                    value={formData.lastName} onChange={handleChange} required placeholder="Smith" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email address</label>
                <input id="email" name="email" type="email" className="form-input"
                  value={formData.email} onChange={handleChange} required
                  autoComplete="email" placeholder="you@example.com" />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Phone <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="phone" name="phone" type="tel" className="form-input"
                  placeholder="e.g. 07911 123456"
                  value={formData.phone} onChange={handleChange}
                  onBlur={() => setPhoneError(validatePhone(formData.phone))}
                />
                {phoneError && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>{phoneError}</p>}
              </div>

              <div className="form-row" style={{ marginBottom: 8 }}>
                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input id="password" name="password" type="password" className="form-input"
                    value={formData.password} onChange={handleChange}
                    required minLength={6} autoComplete="new-password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
                  <input id="confirmPassword" name="confirmPassword" type="password" className="form-input"
                    value={formData.confirmPassword} onChange={handleChange}
                    required minLength={6} autoComplete="new-password" placeholder="••••••••" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading} style={{ marginTop: 8 }}>
                {isLoading ? (
                  <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Creating account…</>
                ) : `Create ${isCustomer ? 'homeowner' : 'tradesperson'} account`}
              </button>
            </form>
          </div>

          <p className="text-center text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
