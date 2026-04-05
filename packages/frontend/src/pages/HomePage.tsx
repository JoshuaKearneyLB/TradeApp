import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { useScrolled } from '../hooks/useScrolled';
import { TiltCard } from '../components/TiltCard';
import { TradeCard } from '../components/TradeCard';

const services = [
  { name: 'Plumbing',     icon: '🔧', desc: 'Leaks, pipes & installations',  color: '#0ea5e9', bg: '#f0f9ff' },
  { name: 'Electrical',   icon: '⚡', desc: 'Wiring, fuse boards & lighting', color: '#f59e0b', bg: '#fffbeb' },
  { name: 'HVAC',         icon: '❄️', desc: 'Heating, cooling & ventilation', color: '#06b6d4', bg: '#ecfeff' },
  { name: 'Carpentry',    icon: '🪵', desc: 'Joinery, doors & furniture',     color: '#a16207', bg: '#fefce8' },
  { name: 'Painting',     icon: '🖌️', desc: 'Interior & exterior decoration', color: '#ec4899', bg: '#fdf2f8' },
  { name: 'Landscaping',  icon: '🌿', desc: 'Gardens, lawns & groundworks',   color: '#22c55e', bg: '#f0fdf4' },
  { name: 'Roofing',      icon: '🏠', desc: 'Repairs, felt & new roofs',      color: '#8b5cf6', bg: '#f5f3ff' },
  { name: 'Cleaning',     icon: '✨', desc: 'Domestic & commercial cleans',   color: '#14b8a6', bg: '#f0fdfa' },
];

const STATS = [
  { end: 2400, suffix: '+', label: 'Verified tradespeople' },
  { end: 18000, suffix: '+', label: 'Jobs completed' },
  { end: 4.9, suffix: '★', label: 'Average rating', decimals: 1 },
];

function useCountUp(end: number, duration = 1800, decimals = 0, triggered = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!triggered) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [triggered, end, duration, decimals]);
  return value;
}

function AnimatedStat({ end, suffix, label, decimals = 0 }: { end: number; suffix: string; label: string; decimals?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);
  const value = useCountUp(end, 1800, decimals, triggered);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTriggered(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="stat-strip-item" style={{ flex: 1, padding: '20px 24px', textAlign: 'center', borderRight: 'inherit' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-amber)' }}>
        <span className="count-up">{decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString()}</span>{suffix}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const scrolled = useScrolled();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            TradeApp<span className="navbar-brand-dot" />
          </Link>
          <div className="navbar-actions">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="navbar-link">Log in</Link>
                <Link to="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        backgroundImage: `
          linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px),
          linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px),
          linear-gradient(160deg, #0d1f40 0%, #1a3a6b 55%, #0a1830 100%)
        `,
        backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px, cover',
        padding: '120px 24px 100px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        <div style={{
          maxWidth: 780, margin: '0 auto', position: 'relative',
          textAlign: 'center',
        }}>
          <div className="animate-in" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(13,148,136,0.18)', border: '1px solid rgba(13,148,136,0.4)',
            borderRadius: 'var(--radius-full)', padding: '5px 14px',
            marginBottom: 28,
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5eead4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              🇬🇧 UK's trade marketplace
            </span>
          </div>

          <h1 className="animate-in animate-in-delay-1" style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 5.5vw, 3.8rem)',
            fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em',
            marginBottom: 22, lineHeight: 1.1,
          }}>
            Find trusted tradespeople<br />
            <span style={{ color: 'var(--color-amber)' }}>near you, instantly</span>
          </h1>

          <p className="animate-in animate-in-delay-2" style={{
            fontSize: '1.1rem', color: 'rgba(255,255,255,0.72)',
            maxWidth: 480, marginBottom: 40, lineHeight: 1.7,
            margin: '0 auto 40px',
          }}>
            Connect with skilled plumbers, electricians, carpenters and more.
            Post a job today and get matched within minutes.
          </p>

          {!user && (
            <div className="animate-in animate-in-delay-3" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/register" className="btn btn-accent btn-lg">
                Post a job — it's free
              </Link>
              <Link to="/login" style={{
                color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem',
                fontWeight: 500, textDecoration: 'none', padding: '14px 16px',
              }}>
                I'm a tradesperson →
              </Link>
            </div>
          )}
        </div>

        {/* Stats bar — animated counters */}
        <div className="animate-in animate-in-delay-4" style={{
          maxWidth: 600, margin: '60px auto 0',
          display: 'flex', justifyContent: 'center', gap: 0,
          background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none', flex: 1 }}>
              <AnimatedStat {...s} />
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section style={{ padding: '72px 24px', background: 'var(--color-surface)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p className="section-label">What we cover</p>
            <h2 style={{ marginBottom: 12 }}>Trades available on the platform</h2>
            <p style={{ maxWidth: 480, margin: '0 auto', color: 'var(--color-text-muted)' }}>
              From emergency callouts to planned projects — whatever trade you need, we've got you covered.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, alignItems: 'stretch' }}>
            {services.map((s, i) => (
              <TradeCard
                key={s.name}
                icon={s.icon}
                name={s.name}
                desc={s.desc}
                color={s.color}
                bg={s.bg}
                animDelay={`${i * 0.06}s`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* For Customers / Professionals */}
      <section style={{ padding: '72px 24px', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div className="grid-2" style={{ gap: 32 }}>

            {/* Customers */}
            <TiltCard strength={6} scale={1.02} className="animate-in" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="card card-static" style={{ borderTop: '4px solid var(--color-amber)', padding: '36px 32px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius)',
                background: 'var(--color-amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', marginBottom: 20,
              }}>🏡</div>
              <h3 style={{ marginBottom: 10 }}>For Homeowners</h3>
              <p style={{ marginBottom: 20 }}>Find qualified, vetted tradespeople for any project — big or small.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Post a job in under 2 minutes', 'Get matched with local professionals', 'Track progress in real-time', 'Pay only when satisfied'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.85rem' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 28 }}>
                <Link to="/register" className="btn btn-primary btn-sm">Post a job</Link>
              </div>
            </div>
            </TiltCard>

            {/* Professionals */}
            <TiltCard strength={6} scale={1.02} className="animate-in animate-in-delay-1" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="card card-static" style={{ borderTop: '4px solid var(--color-navy)', padding: '36px 32px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius)',
                background: '#eef3fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', marginBottom: 20,
              }}>🔧</div>
              <h3 style={{ marginBottom: 10 }}>For Tradespeople</h3>
              <p style={{ marginBottom: 20 }}>Grow your business by connecting with customers who need your skills.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Browse local jobs instantly', 'Set your rates and availability', 'Build a trusted reputation', 'Manage all jobs in one place'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.85rem' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 28 }}>
                <Link to="/register" className="btn btn-outline btn-sm">Join as a tradesperson</Link>
              </div>
            </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: 'var(--color-navy)', color: 'rgba(255,255,255,0.5)',
        padding: '32px 24px', textAlign: 'center', fontSize: '0.875rem',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', color: '#fff', fontWeight: 800, marginRight: 12 }}>TradeApp</span>
        © {new Date().getFullYear()} · Built for Britain's tradespeople
      </footer>
    </div>
  );
}
