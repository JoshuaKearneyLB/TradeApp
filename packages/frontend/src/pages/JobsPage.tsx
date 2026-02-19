import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { JobResponse, Category } from '../services/jobService';

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
};

export function JobsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      // Only fetch open (pending) jobs — no status filter needed, backend defaults to pending
      const params: Record<string, unknown> = {};
      if (filterCategory) params.categoryId = Number(filterCategory);
      const data = await jobService.getJobs(params);
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    jobService.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => { fetchJobs(); }, [filterCategory]);

  const handleAccept = async (jobId: string) => {
    try {
      await jobService.acceptJob(jobId);
      // Remove from the open list since it's no longer pending
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept job');
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            <Link to="/my-jobs" className="btn btn-outline">My Jobs</Link>
            <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
            <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page">
        <h1>Available Jobs</h1>
        <p className="text-muted">Open jobs looking for a professional. Accept one to get started.</p>

        {/* Category filter */}
        <div className="card-muted mb-3">
          <div style={{ maxWidth: '300px' }}>
            <label htmlFor="filterCategory" className="form-label">Filter by category</label>
            <select id="filterCategory" className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Job list */}
        {isLoading ? (
          <p className="text-center text-muted mt-4">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center mt-4">
            <p className="text-muted">No open jobs right now. Check back soon.</p>
          </div>
        ) : (
          <div className="flex-col gap-2">
            {jobs.map((job) => (
              <div key={job.id} className="card">
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <Link to={`/jobs/${job.id}`} style={{ fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none' }}>
                      {job.title}
                    </Link>
                    <div className="text-sm text-muted mt-1">
                      {job.category?.name} &middot; {job.address}
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ alignItems: 'center' }}>
                    <span className="badge">{URGENCY_LABELS[job.urgency] || job.urgency}</span>
                    {job.estimatedBudget && <span className="badge">${job.estimatedBudget}</span>}
                  </div>
                </div>

                <p className="text-sm mt-2" style={{ marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {job.description}
                </p>

                <div className="flex-between">
                  <span className="text-xs text-light">
                    Posted by {job.customer?.firstName} {job.customer?.lastName} &middot; {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    <Link to={`/jobs/${job.id}`} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                      View
                    </Link>
                    {user?.role === 'professional' && (
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleAccept(job.id)}>
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
