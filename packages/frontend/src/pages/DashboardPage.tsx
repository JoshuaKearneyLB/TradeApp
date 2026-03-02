import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '@tradeapp/shared';
import { NotificationBell } from '../components/NotificationBell';

export function DashboardPage() {
  const { user, professionalProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp</Link>
          <div className="navbar-actions">
            <Link to="/my-jobs" className="btn btn-outline">My Jobs</Link>
            {user?.role === UserRole.CUSTOMER && (
              <Link to="/post-job" className="btn btn-primary">Post a Job</Link>
            )}
            {user?.role === UserRole.PROFESSIONAL && (
              <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
            )}
            <Link to="/edit-profile" className="btn btn-outline">Edit Profile</Link>
            <NotificationBell />
            <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.firstName}.</p>

        <hr className="divider" />

        {/* Account summary */}
        <div className="card">
          <h3>Your account</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Email</div>
              <div className="text-sm">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Role</div>
              <div className="text-sm">{user?.role === UserRole.CUSTOMER ? 'Customer' : 'Professional'}</div>
            </div>
            {user?.phone && (
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Phone</div>
                <div className="text-sm">{user.phone}</div>
              </div>
            )}
          </div>
        </div>

        {/* Professional profile */}
        {user?.role === UserRole.PROFESSIONAL && professionalProfile && (
          <div className="card mt-3">
            <h3>Professional profile</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Status</div>
                <div className="text-sm">{professionalProfile.isAvailable ? 'Available' : 'Unavailable'}</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Rating</div>
                <div className="text-sm">{professionalProfile.averageRating.toFixed(1)} / 5.0</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Jobs completed</div>
                <div className="text-sm">{professionalProfile.totalJobsCompleted}</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Service radius</div>
                <div className="text-sm">{professionalProfile.availabilityRadiusKm} km</div>
              </div>
              {professionalProfile.hourlyRate && (
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Hourly rate</div>
                  <div className="text-sm">${professionalProfile.hourlyRate}/hr</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Base location</div>
                <div className="text-sm">
                  {professionalProfile.location?.display
                    ? `📍 ${professionalProfile.location.display}`
                    : professionalProfile.location
                      ? `📍 ${professionalProfile.location.latitude.toFixed(4)}, ${professionalProfile.location.longitude.toFixed(4)}`
                      : <span className="text-light">Not set — <a href="/edit-profile" style={{ color: 'inherit' }}>add in Edit Profile</a></span>
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="card mt-3">
          <h3>Quick actions</h3>
          <div className="flex gap-2 mt-2">
            <Link to="/my-jobs" className="btn btn-outline">My Jobs</Link>
            <Link to="/edit-profile" className="btn btn-outline">Edit Profile</Link>
            {user?.role === UserRole.CUSTOMER && (
              <Link to="/post-job" className="btn btn-primary">Post a Job</Link>
            )}
            {user?.role === UserRole.PROFESSIONAL && (
              <Link to="/jobs" className="btn btn-primary">Browse Available Jobs</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
