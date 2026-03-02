import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { JobResponse } from '../services/jobService';
import { ratingService } from '../services/ratingService';
import type { RatingResponse } from '../services/ratingService';
import { UserRole } from '@tradeapp/shared';

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

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [existingRating, setExistingRating] = useState<RatingResponse | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  const fetchJob = async () => {
    if (!id) return;
    try {
      const data = await jobService.getJobById(id);
      setJob(data);
      if (data.status === 'completed') {
        const { rating } = await ratingService.getJobRating(id);
        setExistingRating(rating);
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchJob(); }, [id]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || ratingValue === 0) return;
    setRatingLoading(true);
    try {
      const created = await ratingService.createRating({ jobId: id, rating: ratingValue, comment: ratingComment || undefined });
      setExistingRating(created);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit rating');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await jobService.acceptJob(id);
      fetchJob();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!id) return;
    if (status === 'cancelled' && !confirm('Are you sure you want to cancel this job?')) return;
    setActionLoading(true);
    try {
      await jobService.updateJobStatus(id, status);
      fetchJob();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!id) return;
    if (!confirm('This will permanently remove the job. Are you sure?')) return;
    setActionLoading(true);
    try {
      await jobService.deleteJob(id);
      navigate('/my-jobs');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove job');
    } finally {
      setActionLoading(false);
    }
  };

  const isOwner = user?.id === job?.customerId;
  const isAssigned = user?.id === job?.professionalId;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            <Link to="/jobs" className="btn btn-outline">All Jobs</Link>
            <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
            <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page" style={{ maxWidth: '720px' }}>
        {isLoading ? (
          <p className="text-muted">Loading...</p>
        ) : !job ? (
          <p className="text-muted">Job not found.</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ marginBottom: '4px' }}>{job.title}</h1>
                <p className="text-muted" style={{ margin: 0 }}>
                  {job.category?.name} &middot; Posted {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1">
                <span className="badge">{STATUS_LABELS[job.status]}</span>
                <span className="badge">{URGENCY_LABELS[job.urgency]}</span>
              </div>
            </div>

            <hr className="divider" />

            {/* Description */}
            <div className="card">
              <h3>Description</h3>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{job.description}</p>
            </div>

            {/* Details grid */}
            <div className="card mt-2">
              <h3>Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '12px' }}>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Address</div>
                  <div className="text-sm">{job.address}</div>
                </div>
                {job.estimatedBudget && (
                  <div>
                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Budget</div>
                    <div className="text-sm">${job.estimatedBudget}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Posted by</div>
                  <div className="text-sm">{job.customer?.firstName} {job.customer?.lastName}</div>
                </div>
                {job.professional && (
                  <div>
                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Assigned to</div>
                    <div className="text-sm">{job.professional.firstName} {job.professional.lastName} ({job.professional.averageRating.toFixed(1)} rating)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="card mt-2">
              <h3>Timeline</h3>
              <div className="flex-col gap-1 mt-1">
                <div className="text-sm">
                  <span className="text-muted">Created:</span> {new Date(job.createdAt).toLocaleString()}
                </div>
                {job.acceptedAt && (
                  <div className="text-sm">
                    <span className="text-muted">Accepted:</span> {new Date(job.acceptedAt).toLocaleString()}
                  </div>
                )}
                {job.startedAt && (
                  <div className="text-sm">
                    <span className="text-muted">Started:</span> {new Date(job.startedAt).toLocaleString()}
                  </div>
                )}
                {job.completedAt && (
                  <div className="text-sm">
                    <span className="text-muted">Completed:</span> {new Date(job.completedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Rating section */}
            {job.status === 'completed' && (
              <div className="card mt-2">
                {isOwner && !existingRating && (
                  <>
                    <h3>Rate this Job</h3>
                    <p className="text-muted text-sm">How did {job.professional?.firstName} do?</p>
                    <form onSubmit={handleSubmitRating}>
                      <div className="flex gap-1" style={{ fontSize: '28px', marginBottom: '12px', cursor: 'pointer' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            onClick={() => setRatingValue(star)}
                            style={{ color: star <= ratingValue ? '#f59e0b' : '#d1d5db', userSelect: 'none' }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <textarea
                        className="form-input"
                        placeholder="Leave a comment (optional)"
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        rows={3}
                        style={{ marginBottom: '12px' }}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={ratingValue === 0 || ratingLoading}
                      >
                        {ratingLoading ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </form>
                  </>
                )}
                {existingRating && (
                  <>
                    <h3>{isOwner ? 'Your Rating' : 'Customer Rating'}</h3>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} style={{ color: star <= existingRating.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                      ))}
                      <span className="text-muted text-sm" style={{ marginLeft: '8px' }}>{existingRating.rating}/5</span>
                    </div>
                    {existingRating.comment && (
                      <p className="text-sm" style={{ margin: 0 }}>{existingRating.comment}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              {/* Professional can accept an open job */}
              {user?.role === UserRole.PROFESSIONAL && job.status === 'pending' && (
                <button className="btn btn-primary" onClick={handleAccept} disabled={actionLoading}>
                  {actionLoading ? 'Accepting...' : 'Accept this job'}
                </button>
              )}

              {/* Assigned professional can start or complete */}
              {isAssigned && job.status === 'accepted' && (
                <button className="btn btn-primary" onClick={() => handleStatusUpdate('in_progress')} disabled={actionLoading}>
                  Start job
                </button>
              )}
              {isAssigned && job.status === 'in_progress' && (
                <button className="btn btn-success" onClick={() => handleStatusUpdate('completed')} disabled={actionLoading}>
                  Mark complete
                </button>
              )}

              {/* Either party can cancel (if not completed/cancelled) */}
              {(isOwner || isAssigned) && !['completed', 'cancelled'].includes(job.status) && (
                <button className="btn btn-danger" onClick={() => handleStatusUpdate('cancelled')} disabled={actionLoading}>
                  Cancel
                </button>
              )}

              {/* Owner can permanently remove a cancelled job */}
              {isOwner && job.status === 'cancelled' && (
                <button className="btn btn-danger" onClick={handleRemove} disabled={actionLoading}>
                  Remove
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
