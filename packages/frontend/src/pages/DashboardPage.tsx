import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '@tradeapp/shared';
import { NotificationBell } from '../components/NotificationBell';
import { useScrolled } from '../hooks/useScrolled';

export function DashboardPage() {
  const { user, professionalProfile, logout } = useAuth();
  const navigate = useNavigate();
  const scrolled = useScrolled();

  const handleLogout = () => { logout(); navigate('/login'); };

  const isPro = user?.role === UserRole.PROFESSIONAL;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            <Link to="/my-jobs" className="navbar-link">My Jobs</Link>
            {isPro
              ? <Link to="/jobs" className="btn btn-primary btn-sm">Browse Jobs</Link>
              : <Link to="/post-job" className="btn btn-accent btn-sm">+ Post a Job</Link>
            }
            <Link to="/edit-profile" className="navbar-link">Profile</Link>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </nav>

      <div className="page">
        {/* Welcome header */}
        <div className="animate-in" style={{ marginBottom: 36 }}>
          <p className="section-label">Dashboard</p>
          <h1 style={{ marginBottom: 6 }}>
            Good to see you, {user?.firstName}
            <span style={{ color: 'var(--color-amber)' }}>.</span>
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            {isPro ? 'Browse jobs, manage your profile and track your work.' : 'Post jobs, track progress and manage your account.'}
          </p>
        </div>

        {/* Professional stats strip */}
        {isPro && professionalProfile && (
          <div className="animate-in animate-in-delay-1" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 1, background: 'var(--color-border)', borderRadius: 'var(--radius-lg)',
            overflow: 'hidden', marginBottom: 28, boxShadow: 'var(--shadow-sm)',
          }}>
            {[
              { label: 'Status', value: professionalProfile.isAvailable ? '🟢 Available' : '🔴 Unavailable' },
              { label: 'Rating', value: `${professionalProfile.averageRating.toFixed(1)} ★` },
              { label: 'Jobs done', value: String(professionalProfile.totalJobsCompleted) },
              { label: 'Service radius', value: `${professionalProfile.availabilityRadiusKm ?? '—'} km` },
              { label: 'Hourly rate', value: professionalProfile.hourlyRate ? `£${professionalProfile.hourlyRate}/hr` : '—' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'var(--color-surface)', padding: '20px 24px',
              }}>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid-2 animate-in animate-in-delay-2" style={{ gap: 24 }}>
          {/* Account card */}
          <div className="card">
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: 0 }}>Account</h4>
              <span className={`badge ${isPro ? 'badge-navy' : 'badge-amber'}`}>
                {isPro ? 'Tradesperson' : 'Homeowner'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stat-row">
                <span className="stat-label">Email</span>
                <span className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 400 }}>{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="stat-row">
                  <span className="stat-label">Phone</span>
                  <span className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 400 }}>{user.phone}</span>
                </div>
              )}
              {isPro && professionalProfile?.location && (
                <div className="stat-row">
                  <span className="stat-label">Base location</span>
                  <span className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                    📍 {professionalProfile.location.display
                      ?? `${professionalProfile.location.latitude.toFixed(3)}, ${professionalProfile.location.longitude.toFixed(3)}`}
                  </span>
                </div>
              )}
              {isPro && !professionalProfile?.location && (
                <div style={{
                  padding: '10px 14px', background: 'var(--color-amber-light)',
                  border: '1px solid rgba(232,160,32,0.3)', borderRadius: 'var(--radius)',
                  fontSize: '0.85rem', color: '#7a4a00',
                }}>
                  📍 No location set — <Link to="/edit-profile" style={{ color: 'inherit', fontWeight: 600 }}>add one</Link> to appear in local searches
                </div>
              )}
            </div>
            <div style={{ marginTop: 24 }}>
              <Link to="/edit-profile" className="btn btn-ghost btn-sm btn-block">Edit profile</Link>
            </div>
          </div>

          {/* Quick actions card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 20px' }}>Quick actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {isPro ? (
                <>
                  <Link to="/jobs" className="btn btn-primary btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>🔍</span> Browse available jobs
                  </Link>
                  <Link to="/my-jobs" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>📋</span> View my accepted jobs
                  </Link>
                  <Link to="/edit-profile" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>⚙️</span> Update availability &amp; rates
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/post-job" className="btn btn-accent btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>+</span> Post a new job
                  </Link>
                  <Link to="/my-jobs" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>📋</span> View my posted jobs
                  </Link>
                  <Link to="/edit-profile" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <span>⚙️</span> Edit profile
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
