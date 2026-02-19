import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { Category } from '../services/jobService';

export function PostJobPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId || !form.title || !form.description || !form.address) {
      setError('Please fill in all required fields');
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
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
      });
      navigate('/jobs');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            <Link to="/jobs" className="btn btn-outline">Browse Jobs</Link>
            <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
            <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page-narrow">
        <h2 style={{ marginBottom: '6px' }}>Post a job</h2>
        <p className="text-muted">Describe what you need done and we'll connect you with professionals.</p>

        <div className="card mt-3">
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="categoryId" className="form-label">Service category</label>
              <select id="categoryId" name="categoryId" className="form-select" value={form.categoryId} onChange={handleChange} required>
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="title" className="form-label">Job title</label>
              <input id="title" name="title" type="text" className="form-input" placeholder="e.g. Fix leaking kitchen tap" value={form.title} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea id="description" name="description" className="form-input" rows={4} placeholder="Describe the job in detail — what's the problem, what do you need, any specifics..." value={form.description} onChange={handleChange} required style={{ resize: 'vertical' }} />
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">Address</label>
              <input id="address" name="address" type="text" className="form-input" placeholder="123 Main St, City, Postcode" value={form.address} onChange={handleChange} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="urgency" className="form-label">Urgency</label>
                <select id="urgency" name="urgency" className="form-select" value={form.urgency} onChange={handleChange}>
                  <option value="low">Low — no rush</option>
                  <option value="medium">Medium — within a few days</option>
                  <option value="high">High — as soon as possible</option>
                  <option value="emergency">Emergency — right now</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="estimatedBudget" className="form-label">Budget <span className="text-light">(optional)</span></label>
                <input id="estimatedBudget" name="estimatedBudget" type="number" className="form-input" placeholder="$" min="0" step="0.01" value={form.estimatedBudget} onChange={handleChange} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
              {isLoading ? 'Posting...' : 'Post job'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
