import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import type { JobResponse } from '../services/jobService';
import { ratingService } from '../services/ratingService';
import type { RatingResponse } from '../services/ratingService';
import { getJobPayment, createPaymentIntent } from '../services/paymentService';
import type { Payment } from '../services/paymentService';
import { PaymentModal } from '../components/PaymentModal';
import { UserRole } from '@tradeapp/shared';
import { NotificationBell } from '../components/NotificationBell';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  pending:     { label: 'Open',        badge: 'badge-amber',   icon: '🟡' },
  accepted:    { label: 'Accepted',    badge: 'badge-navy',    icon: '🔵' },
  in_progress: { label: 'In Progress', badge: 'badge-warning', icon: '🟠' },
  completed:   { label: 'Completed',   badge: 'badge-success', icon: '🟢' },
  cancelled:   { label: 'Cancelled',   badge: 'badge-danger',  icon: '🔴' },
};

const URGENCY_CONFIG: Record<string, { label: string; badge: string }> = {
  low:       { label: 'Low priority', badge: 'badge-muted' },
  medium:    { label: 'Medium',       badge: 'badge-amber' },
  high:      { label: 'High',         badge: 'badge-warning' },
  emergency: { label: 'Emergency',    badge: 'badge-danger' },
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{
            fontSize: '1.75rem', lineHeight: 1,
            color: star <= (hover || value) ? 'var(--color-amber)' : 'var(--color-border)',
            cursor: onChange ? 'pointer' : 'default',
            transition: 'color 0.1s',
            userSelect: 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

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
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ clientSecret: string; amountPence: number } | null>(null);

  const fetchJob = async () => {
    if (!id) return;
    try {
      const data = await jobService.getJobById(id);
      setJob(data);
      if (data.status === 'completed') {
        const [{ rating }, existingPayment] = await Promise.all([
          ratingService.getJobRating(id),
          getJobPayment(id),
        ]);
        setExistingRating(rating);
        setPayment(existingPayment);
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

  const handlePayNow = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const { clientSecret, amount } = await createPaymentIntent(id);
      setPaymentModal({ clientSecret, amountPence: amount });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setActionLoading(false);
    }
  };

  const isOwner = user?.id === job?.customerId;
  const isAssigned = user?.id === job?.professionalId;
  const statusCfg = job ? (STATUS_CONFIG[job.status] ?? { label: job.status, badge: 'badge-muted', icon: '⚪' }) : null;
  const urgencyCfg = job ? (URGENCY_CONFIG[job.urgency] ?? { label: job.urgency, badge: 'badge-muted' }) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            <Link to="/jobs" className="navbar-link">Browse Jobs</Link>
            <Link to="/my-jobs" className="navbar-link">My Jobs</Link>
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </div>
      </nav>

      <div className="page" style={{ maxWidth: 760 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : !job ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
            <h3>Job not found</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>This job may have been removed.</p>
            <Link to="/jobs" className="btn btn-primary btn-sm">Back to jobs</Link>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            <div className="animate-in" style={{ marginBottom: 24, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <Link to="/jobs" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Browse jobs</Link>
              <span style={{ margin: '0 8px' }}>›</span>
              <span style={{ color: 'var(--color-text)' }}>{job.title}</span>
            </div>

            {/* Header */}
            <div className="animate-in" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {statusCfg && <span className={`badge ${statusCfg.badge}`}>{statusCfg.icon} {statusCfg.label}</span>}
                    {urgencyCfg && <span className={`badge ${urgencyCfg.badge}`}>{urgencyCfg.label}</span>}
                    {job.category && <span className="badge badge-muted">{job.category.name}</span>}
                  </div>
                  <h1 style={{ marginBottom: 6, fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>{job.title}</h1>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    📍 {job.address} · Posted {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {job.estimatedBudget && (
                  <div style={{
                    padding: '12px 20px', background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                    textAlign: 'center', flexShrink: 0,
                  }}>
                    <div className="stat-label">Budget</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                      £{job.estimatedBudget}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="card animate-in animate-in-delay-1" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Description</h4>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7, color: 'var(--color-text)' }}>{job.description}</p>
            </div>

            {/* Details grid */}
            <div className="card animate-in animate-in-delay-1" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Job details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div>
                  <div className="stat-label">Posted by</div>
                  <div className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {job.customer?.firstName} {job.customer?.lastName}
                  </div>
                </div>
                {job.professional && (
                  <div>
                    <div className="stat-label">Assigned to</div>
                    <div className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {job.professional.firstName} {job.professional.lastName}
                      <span style={{ color: 'var(--color-amber)', marginLeft: 6, fontSize: '0.85rem' }}>
                        {job.professional.averageRating.toFixed(1)} ★
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="stat-label">Location</div>
                  <div className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{job.address}</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card animate-in animate-in-delay-2" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Timeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Posted', date: job.createdAt },
                  { label: 'Accepted', date: job.acceptedAt },
                  { label: 'Started', date: job.startedAt },
                  { label: 'Completed', date: job.completedAt },
                ].filter((t) => t.date).map((t) => (
                  <div key={t.label} className="stat-row">
                    <span className="stat-label">{t.label}</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {new Date(t.date!).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating */}
            {job.status === 'completed' && (
              <div className="card animate-in animate-in-delay-2" style={{ marginBottom: 16 }}>
                {isOwner && !existingRating ? (
                  <>
                    <h4 style={{ margin: '0 0 6px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Leave a rating</h4>
                    <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      How did {job.professional?.firstName} do?
                    </p>
                    <form onSubmit={handleSubmitRating}>
                      <div style={{ marginBottom: 14 }}>
                        <StarRating value={ratingValue} onChange={setRatingValue} />
                      </div>
                      <textarea
                        className="form-input"
                        placeholder="Leave a comment (optional)"
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        rows={3}
                        style={{ marginBottom: 14, resize: 'vertical' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={ratingValue === 0 || ratingLoading}>
                        {ratingLoading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Submitting…</> : 'Submit rating'}
                      </button>
                    </form>
                  </>
                ) : existingRating ? (
                  <>
                    <h4 style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                      {isOwner ? 'Your rating' : 'Customer rating'}
                    </h4>
                    <div style={{ marginBottom: 8 }}>
                      <StarRating value={existingRating.rating} />
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {existingRating.rating}/5 stars
                    </p>
                    {existingRating.comment && (
                      <p style={{ margin: '10px 0 0', fontSize: '0.9rem', color: 'var(--color-text)', fontStyle: 'italic' }}>
                        "{existingRating.comment}"
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Payment — owner sees this when job is completed */}
            {isOwner && job.status === 'completed' && (
              <div className="animate-in animate-in-delay-3" style={{ marginBottom: 16 }}>
                {payment?.status === 'succeeded' ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 'var(--radius)',
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                    color: '#166534', fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    ✓ Paid — £{Number(job.estimatedBudget).toFixed(2)}
                  </div>
                ) : (
                  <button
                    onClick={handlePayNow}
                    disabled={actionLoading}
                    style={{
                      padding: '12px 24px', border: 'none', borderRadius: 'var(--radius)',
                      background: 'var(--color-success)', color: '#fff',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem',
                      cursor: actionLoading ? 'default' : 'pointer',
                      opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? 'Loading…' : `Pay now — £${Number(job.estimatedBudget).toFixed(2)}`}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            {(user?.role === UserRole.PROFESSIONAL || isOwner || isAssigned) && !['completed', 'cancelled'].includes(job.status) || (isOwner && job.status === 'cancelled') ? (
              <div className="animate-in animate-in-delay-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {user?.role === UserRole.PROFESSIONAL && job.status === 'pending' && !isOwner && (
                  <button className="btn btn-primary" onClick={handleAccept} disabled={actionLoading}>
                    {actionLoading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Accepting…</> : '✓ Accept this job'}
                  </button>
                )}
                {isAssigned && job.status === 'accepted' && (
                  <button className="btn btn-primary" onClick={() => handleStatusUpdate('in_progress')} disabled={actionLoading}>
                    ▶ Start job
                  </button>
                )}
                {isAssigned && job.status === 'in_progress' && (
                  <button
                    onClick={() => handleStatusUpdate('completed')}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: 'var(--color-success)', color: '#fff',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Mark as complete
                  </button>
                )}
                {(isOwner || isAssigned) && !['completed', 'cancelled'].includes(job.status) && (
                  <button
                    onClick={() => handleStatusUpdate('cancelled')}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 20px', border: '1.5px solid var(--color-danger)',
                      borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--color-danger)',
                      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel job
                  </button>
                )}
                {isOwner && job.status === 'cancelled' && (
                  <button
                    onClick={handleRemove}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: 'var(--color-danger)', color: '#fff',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove job
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      {paymentModal && job && (
        <PaymentModal
          jobId={job.id}
          jobTitle={job.title}
          clientSecret={paymentModal.clientSecret}
          amountPence={paymentModal.amountPence}
          onSuccess={() => {
            setPaymentModal(null);
            setPayment({ id: '', jobId: job.id, amount: Number(job.estimatedBudget), platformFee: 0, professionalPayout: 0, status: 'succeeded', createdAt: new Date().toISOString() });
          }}
          onClose={() => setPaymentModal(null)}
        />
      )}
    </div>
  );
}
