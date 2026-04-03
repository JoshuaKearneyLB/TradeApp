import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { JobResponse, Category } from '../services/jobService';
import { MapView } from '../components/MapView';
import { NotificationBell } from '../components/NotificationBell';

const URGENCY_CONFIG: Record<string, { label: string; badge: string }> = {
  low:       { label: 'Low priority',  badge: 'badge-muted' },
  medium:    { label: 'Medium',        badge: 'badge-amber' },
  high:      { label: 'High',          badge: 'badge-warning' },
  emergency: { label: 'Emergency',     badge: 'badge-danger' },
};

export function JobsPage() {
  const { user, professionalProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const proLocation = professionalProfile?.location;
  const hasLocation = user?.role === 'professional' && proLocation?.latitude && proLocation?.longitude;

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (filterCategory) params.categoryId = Number(filterCategory);
      if (hasLocation) {
        params.lat = proLocation!.latitude;
        params.lng = proLocation!.longitude;
        params.radiusKm = professionalProfile!.availabilityRadiusKm;
      }
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
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept job');
    }
  };

  const proCenter: [number, number] | undefined =
    hasLocation ? [proLocation!.latitude, proLocation!.longitude] : undefined;

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

      <div className="page">
        {/* Page header */}
        <div className="animate-in" style={{ marginBottom: 28 }}>
          <p className="section-label">Browse</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ marginBottom: 4 }}>
                Available jobs
                <span style={{ color: 'var(--color-amber)' }}>.</span>
              </h1>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                {hasLocation
                  ? `Showing jobs within ${professionalProfile!.availabilityRadiusKm} km of your location`
                  : 'Open jobs ready to be accepted — find your next project'}
              </p>
            </div>
            {/* List / Map toggle */}
            <div style={{
              display: 'flex', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
              padding: 4, gap: 4,
            }}>
              {(['list', 'map'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '6px 18px', border: 'none', borderRadius: 'var(--radius)',
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: viewMode === mode ? 'var(--color-navy)' : 'transparent',
                    color: viewMode === mode ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {mode === 'list' ? '≡ List' : '⊙ Map'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* No-location warning */}
        {user?.role === 'professional' && !hasLocation && (
          <div className="animate-in animate-in-delay-1" style={{
            padding: '14px 18px', marginBottom: 20,
            background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.3)',
            borderRadius: 'var(--radius)', fontSize: '0.875rem', color: '#7a4a00',
          }}>
            📍 <strong>No base location set</strong> — <Link to="/edit-profile" style={{ color: 'inherit', fontWeight: 700 }}>add one in your profile</Link> to see only jobs within your service radius
          </div>
        )}

        {/* Filters bar */}
        <div className="animate-in animate-in-delay-1" style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
          padding: '16px 20px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <label htmlFor="filterCategory" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            Filter by
          </label>
          <select
            id="filterCategory"
            className="form-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ maxWidth: 260, marginBottom: 0 }}
          >
            <option value="">All trades</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!isLoading && (
            <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} found
            </span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }} className="animate-in">
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
            <h3 style={{ marginBottom: 8, color: 'var(--color-text)' }}>No jobs found</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
              {hasLocation
                ? `No open jobs within ${professionalProfile!.availabilityRadiusKm} km right now — check back soon`
                : 'No open jobs matching your filters at the moment'}
            </p>
            {hasLocation && (
              <Link to="/edit-profile" className="btn btn-ghost btn-sm">
                Increase service radius
              </Link>
            )}
          </div>
        ) : viewMode === 'map' ? (
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <MapView jobs={jobs} center={proCenter} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map((job, i) => {
              const urgency = URGENCY_CONFIG[job.urgency] ?? { label: job.urgency, badge: 'badge-muted' };
              return (
                <div
                  key={job.id}
                  className="card card-job animate-in"
                  style={{ animationDelay: `${i * 0.04}s`, padding: '20px 24px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to={`/jobs/${job.id}`}
                        style={{
                          fontFamily: 'var(--font-display)', fontSize: '1.05rem',
                          fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none',
                        }}
                      >
                        {job.title}
                      </Link>
                      <div style={{ marginTop: 4, fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span>{job.category?.name}</span>
                        <span>·</span>
                        <span>📍 {job.address}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                      <span className={`badge ${urgency.badge}`}>{urgency.label}</span>
                      {job.estimatedBudget && (
                        <span className="badge badge-navy">£{job.estimatedBudget}</span>
                      )}
                      {(job as any).distanceKm != null && (
                        <span className="badge badge-muted">
                          {((job as any).distanceKm as number).toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{
                    margin: '12px 0', fontSize: '0.875rem', color: 'var(--color-text-muted)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {job.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                      Posted by {job.customer?.firstName} · {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                        View details
                      </Link>
                      {user?.role === 'professional' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAccept(job.id)}
                        >
                          Accept job
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
