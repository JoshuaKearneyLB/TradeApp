import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@tradeapp/shared';

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
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
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

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
        </div>
      </nav>

      <div className="page-narrow">
        <h2 style={{ marginBottom: '6px' }}>Create an account</h2>
        <p className="text-muted">Join TradeApp today</p>

        <div className="card mt-3">
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="role" className="form-label">I am a</label>
              <select id="role" name="role" className="form-select" value={formData.role} onChange={handleChange} required>
                <option value={UserRole.CUSTOMER}>Customer — looking for services</option>
                <option value={UserRole.PROFESSIONAL}>Professional — offering services</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">First name</label>
                <input id="firstName" name="firstName" type="text" className="form-input" value={formData.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="form-label">Last name</label>
                <input id="lastName" name="lastName" type="text" className="form-input" value={formData.lastName} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input id="email" name="email" type="email" className="form-input" value={formData.email} onChange={handleChange} required autoComplete="email" />
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="form-label">Phone <span className="text-light">(optional)</span></label>
              <input id="phone" name="phone" type="tel" className="form-input" value={formData.phone} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input id="password" name="password" type="password" className="form-input" value={formData.password} onChange={handleChange} required minLength={6} autoComplete="new-password" />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" className="form-input" value={formData.confirmPassword} onChange={handleChange} required minLength={6} autoComplete="new-password" />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-3">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </>
  );
}
