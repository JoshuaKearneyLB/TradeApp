import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { jobService } from '../services/jobService';
import type { JobResponse } from '../services/jobService';
import { UserRole } from '@tradeapp/shared';
import { MapView } from '../components/MapView';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Open',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
};

export function MyJobsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const data = await jobService.getMyJobs();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      await jobService.updateJobStatus(jobId, 'cancelled');
      fetchJobs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel job');
    }
  };

  const handleRemove = async (jobId: string) => {
    if (!confirm('This will permanently remove the job. Are you sure?')) return;
    try {
      await jobService.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove job');
    }
  };

  const handleStatusUpdate = async (jobId: string, status: string) => {
    try {
      await jobService.updateJobStatus(jobId, status);
      fetchJobs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const isCustomer = user?.role === UserRole.CUSTOMER;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            {isCustomer ? (
              <Link to="/post-job" className="btn btn-primary">Post a Job</Link>
            ) : (
              <Link to="/jobs" className="btn btn-outline">Browse Jobs</Link>
            )}
            <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
            <NotificationBell />
            <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>{isCustomer ? 'My Posted Jobs' : 'My Accepted Jobs'}</h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {isCustomer
                ? 'Jobs you have posted. You can view details or cancel them.'
                : 'Jobs you have accepted or are working on.'}
            </p>
          </div>
          {jobs.length > 0 && (
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
          )}
        </div>

        <hr className="divider" />

        {isLoading ? (
          <p className="text-center text-muted mt-4">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center mt-4">
            <p className="text-muted">
              {isCustomer ? 'You haven\'t posted any jobs yet.' : 'You haven\'t accepted any jobs yet.'}
            </p>
            {isCustomer ? (
              <Link to="/post-job" className="btn btn-primary mt-2">Post your first job</Link>
            ) : (
              <Link to="/jobs" className="btn btn-primary mt-2">Browse available jobs</Link>
            )}
          </div>
        ) : viewMode === 'map' ? (
          <MapView jobs={jobs} />
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
                    <span className="badge">{STATUS_LABELS[job.status] || job.status}</span>
                    <span className="badge">{URGENCY_LABELS[job.urgency] || job.urgency}</span>
                    {job.estimatedBudget && <span className="badge">${job.estimatedBudget}</span>}
                  </div>
                </div>

                <p className="text-sm mt-2" style={{ marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {job.description}
                </p>

                <div className="flex-between">
                  <span className="text-xs text-light">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    <Link to={`/jobs/${job.id}`} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                      View
                    </Link>

                    {/* Professional actions */}
                    {!isCustomer && job.status === 'accepted' && (
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleStatusUpdate(job.id, 'in_progress')}>
                        Start
                      </button>
                    )}
                    {!isCustomer && job.status === 'in_progress' && (
                      <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleStatusUpdate(job.id, 'completed')}>
                        Complete
                      </button>
                    )}

                    {/* Customer can cancel any non-completed/non-cancelled job */}
                    {isCustomer && !['completed', 'cancelled'].includes(job.status) && (
                      <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleCancel(job.id)}>
                        Cancel
                      </button>
                    )}
                    {/* Customer can permanently remove a cancelled job */}
                    {isCustomer && job.status === 'cancelled' && (
                      <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRemove(job.id)}>
                        Remove
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
