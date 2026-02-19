import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const services = ['Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting', 'Landscaping', 'Roofing', 'Cleaning'];

export function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-brand">TradeApp</span>
          <div className="navbar-actions">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">Login</Link>
                <Link to="/register" className="btn btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="page">
        {/* Hero */}
        <div className="text-center" style={{ padding: '60px 0 48px' }}>
          <h1 style={{ fontSize: '2.8rem', marginBottom: '16px' }}>
            Find trusted tradespeople<br />near you, instantly
          </h1>
          <p style={{ fontSize: '1.1rem', maxWidth: '520px', margin: '0 auto 32px' }}>
            Connect with skilled plumbers, electricians, HVAC technicians and more — on demand.
          </p>
          {!user && (
            <div className="flex-center gap-2">
              <Link to="/register" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-outline">Login</Link>
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Two-column pitch */}
        <div className="grid-2 mt-3">
          <div className="card">
            <h3>For Customers</h3>
            <p>Find and hire skilled professionals for your projects quickly and easily.</p>
            <ul style={{ paddingLeft: '20px', margin: '12px 0 0', color: 'var(--color-text-muted)', lineHeight: '2' }}>
              <li>Post a job in minutes</li>
              <li>Get matched with qualified professionals</li>
              <li>Track progress in real-time</li>
              <li>Rate and review after completion</li>
            </ul>
          </div>

          <div className="card">
            <h3>For Professionals</h3>
            <p>Grow your business by connecting with customers who need your expertise.</p>
            <ul style={{ paddingLeft: '20px', margin: '12px 0 0', color: 'var(--color-text-muted)', lineHeight: '2' }}>
              <li>Receive instant job notifications</li>
              <li>Set your area, rates and availability</li>
              <li>Build your reputation with reviews</li>
              <li>Manage all your jobs from one place</li>
            </ul>
          </div>
        </div>

        {/* Services */}
        <div className="text-center mt-4">
          <h3>Services available</h3>
          <div className="flex-center gap-1 mt-2" style={{ flexWrap: 'wrap' }}>
            {services.map((s) => (
              <span key={s} className="badge">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
