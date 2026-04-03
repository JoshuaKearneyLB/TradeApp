import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { jobService } from '../services/jobService';
import type { JobResponse } from '../services/jobService';
import { UserRole } from '@tradeapp/shared';
import { MapView } from '../components/MapView';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  pending:     { label: 'Open',        badge: 'badge-amber',   icon: '🟡' },
  accepted:    { label: 'Accepted',    badge: 'badge-navy',    icon: '🔵' },
  in_progress: { label: 'In Progress', badge: 'badge-warning', icon: '🟠' },
  completed:   { label: 'Completed',   badge: 'badge-success', icon: '🟢' },
  cancelled:   { label: 'Cancelled',   badge: 'badge-danger',  icon: '🔴' },
};

const URGENCY_CONFIG: Record<string, { label: string; badge: string }> = {
  low:       { label: 'Low',       badge: 'badge-muted' },
  medium:    { label: 'Medium',    badge: 'badge-amber' },
  high:      { label: 'High',      badge: 'badge-warning' },
  emergency: { label: 'Emergency', badge: 'badge-danger' },
};

export function MyJobsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterStatus, setFilterStatus] = useState('');

  const isCustomer = user?.role === UserRole.CUSTOMER;

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

  const filteredJobs = filterStatus ? jobs.filter((j) => j.status === filterStatus) : jobs;

  // Status summary counts
  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            {isCustomer
              ? <Link to="/post-job" className="btn btn-accent btn-sm">+ Post a Job</Link>
              : <Link to="/jobs" className="btn btn-primary btn-sm">Browse Jobs</Link>
            }
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </div>
      </nav>

      <div className="page">
        {/* Header */}
        <div className="animate-in" style={{ marginBottom: 28 }}>
          <p className="section-label">{isCustomer ? 'My posted jobs' : 'My accepted jobs'}</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ marginBottom: 4 }}>
                {isCustomer ? 'Your jobs' : 'Your work'}
                <span style={{ color: 'var(--color-amber)' }}>.</span>
              </h1>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                {isCustomer
                  ? "Track and manage the jobs you've posted"
                  : "Jobs you've accepted and are working on"}
              </p>
            </div>
            {jobs.length > 0 && (
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
            )}
          </div>
        </div>

        {/* Status summary chips */}
        {jobs.length > 0 && (
          <div className="animate-in animate-in-delay-1" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={() => setFilterStatus('')}
              style={{
                padding: '5px 14px', borderRadius: 'var(--radius-full)',
                border: `1.5px solid ${!filterStatus ? 'var(--color-navy)' : 'var(--color-border)'}`,
                background: !filterStatus ? 'var(--color-navy)' : 'var(--color-surface)',
                color: !filterStatus ? '#fff' : 'var(--color-text-muted)',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              All ({jobs.length})
            </button>
            {Object.entries(counts).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status];
              if (!cfg) return null;
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status === filterStatus ? '' : status)}
                  style={{
                    padding: '5px 14px', borderRadius: 'var(--radius-full)',
                    border: `1.5px solid ${filterStatus === status ? 'var(--color-navy)' : 'var(--color-border)'}`,
                    background: filterStatus === status ? 'var(--color-navy)' : 'var(--color-surface)',
                    color: filterStatus === status ? '#fff' : 'var(--color-text-muted)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  {cfg.icon} {cfg.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }} className="animate-in">
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>{isCustomer ? '📋' : '🔧'}</div>
            <h3 style={{ marginBottom: 8 }}>{isCustomer ? 'No jobs yet' : 'No jobs accepted yet'}</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
              {isCustomer
                ? 'Post your first job and get matched with local tradespeople.'
                : 'Browse available jobs and accept one to get started.'}
            </p>
            {isCustomer ? (
              <Link to="/post-job" className="btn btn-accent">+ Post your first job</Link>
            ) : (
              <Link to="/jobs" className="btn btn-primary">Browse available jobs</Link>
            )}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }} className="animate-in">
            <p style={{ color: 'var(--color-text-muted)' }}>No jobs with this status.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setFilterStatus('')} style={{ marginTop: 12 }}>
              Clear filter
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <MapView jobs={filteredJobs} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredJobs.map((job, i) => {
              const statusCfg = STATUS_CONFIG[job.status] ?? { label: job.status, badge: 'badge-muted', icon: '⚪' };
              const urgencyCfg = URGENCY_CONFIG[job.urgency] ?? { label: job.urgency, badge: 'badge-muted' };
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
                        {!isCustomer && job.customer && (
                          <>
                            <span>·</span>
                            <span>Posted by {job.customer.firstName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                      <span className={`badge ${statusCfg.badge}`}>{statusCfg.icon} {statusCfg.label}</span>
                      <span className={`badge ${urgencyCfg.badge}`}>{urgencyCfg.label}</span>
                      {job.estimatedBudget && <span className="badge badge-muted">£{job.estimatedBudget}</span>}
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
                      {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link to={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                        View
                      </Link>

                      {/* Professional: start / complete */}
                      {!isCustomer && job.status === 'accepted' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(job.id, 'in_progress')}>
                          ▶ Start
                        </button>
                      )}
                      {!isCustomer && job.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusUpdate(job.id, 'completed')}
                          style={{
                            padding: '6px 14px', border: 'none', borderRadius: 'var(--radius)',
                            background: 'var(--color-success)', color: '#fff',
                            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                          }}
                        >
                          ✓ Complete
                        </button>
                      )}

                      {/* Customer: cancel */}
                      {isCustomer && !['completed', 'cancelled'].includes(job.status) && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          style={{
                            padding: '6px 14px', border: '1.5px solid var(--color-danger)',
                            borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--color-danger)',
                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {/* Customer: remove cancelled */}
                      {isCustomer && job.status === 'cancelled' && (
                        <button
                          onClick={() => handleRemove(job.id)}
                          style={{
                            padding: '6px 14px', border: 'none',
                            borderRadius: 'var(--radius)', background: 'var(--color-danger)', color: '#fff',
                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                          }}
                        >
                          Remove
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
