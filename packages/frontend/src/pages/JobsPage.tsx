import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { JobResponse, Category } from '../services/jobService';
import { MapView } from '../components/MapView';

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
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
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Available Jobs</h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {hasLocation
                ? `Jobs within ${professionalProfile!.availabilityRadiusKm} km of your location, sorted by distance.`
                : 'Open jobs looking for a professional. Accept one to get started.'}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              className={viewMode === 'list' ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ padding: '6px 16px' }}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              className={viewMode === 'map' ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ padding: '6px 16px' }}
              onClick={() => setViewMode('map')}
            >
              Map
            </button>
          </div>
        </div>

        {user?.role === 'professional' && !hasLocation && (
          <div className="card-muted mb-3" style={{ borderLeft: '3px solid #f59e0b' }}>
            <p className="text-sm" style={{ margin: 0 }}>
              Set your location in <Link to="/edit-profile">Edit Profile</Link> to see only jobs within your service radius.
            </p>
          </div>
        )}

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

        {isLoading ? (
          <p className="text-center text-muted mt-4">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center mt-4">
            <p className="text-muted">No open jobs{hasLocation ? ' in your area' : ''} right now. Check back soon.</p>
            {hasLocation && (
              <p className="text-sm text-muted">
                Your service radius is {professionalProfile!.availabilityRadiusKm} km —{' '}
                <Link to="/edit-profile">increase it in Edit Profile</Link>.
              </p>
            )}
          </div>
        ) : viewMode === 'map' ? (
          <MapView jobs={jobs} center={proCenter} />
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
                  <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge">{URGENCY_LABELS[job.urgency] || job.urgency}</span>
                    {job.estimatedBudget && <span className="badge">${job.estimatedBudget}</span>}
                    {(job as any).distanceKm != null && (
                      <span className="badge">{((job as any).distanceKm as number).toFixed(1)} km</span>
                    )}
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
