import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminService';
import type { AdminStats, AdminUser, AdminJob, AdminPayment } from '../services/adminService';
import { NotificationBell } from '../components/NotificationBell';

type Tab = 'users' | 'jobs' | 'payments';

const STATUS_COLORS: Record<string, string> = {
  active: '#166534',
  suspended: '#b45309',
  deleted: '#991b1b',
  pending: '#1e40af',
  accepted: '#1e40af',
  in_progress: '#b45309',
  completed: '#166534',
  cancelled: '#6b7280',
  succeeded: '#166534',
  failed: '#991b1b',
};

const STATUS_BG: Record<string, string> = {
  active: 'rgba(34,197,94,0.12)',
  suspended: 'rgba(251,191,36,0.15)',
  deleted: 'rgba(239,68,68,0.12)',
  pending: 'rgba(59,130,246,0.12)',
  accepted: 'rgba(59,130,246,0.12)',
  in_progress: 'rgba(251,191,36,0.15)',
  completed: 'rgba(34,197,94,0.12)',
  cancelled: 'rgba(156,163,175,0.15)',
  succeeded: 'rgba(34,197,94,0.12)',
  failed: 'rgba(239,68,68,0.12)',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
      background: STATUS_BG[status] ?? 'rgba(156,163,175,0.15)',
      color: STATUS_COLORS[status] ?? '#6b7280',
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, [string, string]> = {
    admin: ['#1a3a6b', 'rgba(26,58,107,0.12)'],
    professional: ['#0f766e', 'rgba(13,148,136,0.12)'],
    customer: ['#6b21a8', 'rgba(107,33,168,0.12)'],
  };
  const [color, bg] = colors[role] ?? ['#6b7280', 'rgba(156,163,175,0.15)'];
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
      background: bg, color, textTransform: 'capitalize',
    }}>
      {role}
    </span>
  );
}

export function AdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Jobs state
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobPage, setJobPage] = useState(1);
  const [jobStatus, setJobStatus] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [payTotal, setPayTotal] = useState(0);
  const [payPage, setPayPage] = useState(1);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    adminService.getStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    if (tab !== 'users') return;
    setUsersLoading(true);
    adminService.getUsers(userPage, userRole || undefined, userSearch || undefined)
      .then((data) => { setUsers(data.users); setUserTotal(data.total); })
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, [tab, userPage, userRole, userSearch]);

  useEffect(() => {
    if (tab !== 'jobs') return;
    setJobsLoading(true);
    adminService.getJobs(jobPage, jobStatus || undefined)
      .then((data) => { setJobs(data.jobs); setJobTotal(data.total); })
      .catch(console.error)
      .finally(() => setJobsLoading(false));
  }, [tab, jobPage, jobStatus]);

  useEffect(() => {
    if (tab !== 'payments') return;
    setPaymentsLoading(true);
    adminService.getPayments(payPage)
      .then((data) => { setPayments(data.payments); setPayTotal(data.total); })
      .catch(console.error)
      .finally(() => setPaymentsLoading(false));
  }, [tab, payPage]);

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await adminService.updateUserStatus(userId, status);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, accountStatus: status } : u));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const statCards = stats ? [
    { label: 'Total users', value: stats.users.total, sub: `${stats.users.byRole?.customer ?? 0} customers · ${stats.users.byRole?.professional ?? 0} pros` },
    { label: 'Total jobs', value: stats.jobs.total, sub: `${stats.jobs.byStatus?.pending ?? 0} pending · ${stats.jobs.byStatus?.completed ?? 0} completed` },
    { label: 'Total revenue', value: `£${stats.revenue.total.toFixed(2)}`, sub: `£${stats.revenue.platformFees.toFixed(2)} platform fees` },
    { label: 'Active pros', value: stats.professionalsWithPayments, sub: 'With Stripe connected' },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">TradeApp<span className="navbar-brand-dot" /></Link>
          <div className="navbar-actions">
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', background: 'rgba(26,58,107,0.08)', borderRadius: 6 }}>
              Admin
            </span>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </div>
      </nav>

      <div className="page" style={{ maxWidth: 1100 }}>
        <div className="animate-in" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', marginBottom: 4 }}>Admin dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>Platform overview and user management</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="animate-in animate-in-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            {statCards.map((card) => (
              <div key={card.label} className="card" style={{ padding: '18px 22px' }}>
                <div className="stat-label" style={{ marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: 4 }}>{card.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="animate-in animate-in-delay-1" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {(['users', 'jobs', 'payments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px', border: 'none', background: 'none',
                borderBottom: tab === t ? '2.5px solid var(--color-amber)' : '2.5px solid transparent',
                color: tab === t ? 'var(--color-amber)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', textTransform: 'capitalize', marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <div className="animate-in">
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="Search name or email…"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                style={{ flex: 1, minWidth: 200, padding: '8px 14px', fontSize: '0.875rem' }}
              />
              <select
                className="form-input"
                value={userRole}
                onChange={(e) => { setUserRole(e.target.value); setUserPage(1); }}
                style={{ padding: '8px 14px', fontSize: '0.875rem', minWidth: 140 }}
              >
                <option value="">All roles</option>
                <option value="customer">Customer</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {usersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(26,58,107,0.04)', borderBottom: '1px solid var(--color-border)' }}>
                        {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{u.firstName} {u.lastName}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</td>
                          <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                          <td style={{ padding: '12px 16px' }}><StatusBadge status={u.accountStatus} /></td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {u.role !== 'admin' && (
                              u.accountStatus === 'active' ? (
                                <button
                                  onClick={() => handleStatusChange(u.id, 'suspended')}
                                  style={{ padding: '4px 12px', border: '1.5px solid #b45309', borderRadius: 6, background: 'none', color: '#b45309', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Suspend
                                </button>
                              ) : u.accountStatus === 'suspended' ? (
                                <button
                                  onClick={() => handleStatusChange(u.id, 'active')}
                                  style={{ padding: '4px 12px', border: '1.5px solid #166534', borderRadius: 6, background: 'none', color: '#166534', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Activate
                                </button>
                              ) : null
                            )}
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Pagination total={userTotal} page={userPage} limit={20} onPage={setUserPage} />
          </div>
        )}

        {/* Jobs tab */}
        {tab === 'jobs' && (
          <div className="animate-in">
            <div style={{ marginBottom: 16 }}>
              <select
                className="form-input"
                value={jobStatus}
                onChange={(e) => { setJobStatus(e.target.value); setJobPage(1); }}
                style={{ padding: '8px 14px', fontSize: '0.875rem', minWidth: 160 }}
              >
                <option value="">All statuses</option>
                {['pending', 'accepted', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {jobsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(26,58,107,0.04)', borderBottom: '1px solid var(--color-border)' }}>
                        {['Title', 'Category', 'Status', 'Budget', 'Customer', 'Professional', 'Date'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            <Link to={`/jobs/${j.id}`} style={{ color: 'var(--color-navy)', textDecoration: 'none' }}>{j.title}</Link>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{j.category}</td>
                          <td style={{ padding: '12px 16px' }}><StatusBadge status={j.status} /></td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{j.estimatedBudget ? `£${j.estimatedBudget.toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{j.customer}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: j.professional ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{j.professional ?? '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(j.createdAt).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No jobs found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Pagination total={jobTotal} page={jobPage} limit={20} onPage={setJobPage} />
          </div>
        )}

        {/* Payments tab */}
        {tab === 'payments' && (
          <div className="animate-in">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {paymentsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(26,58,107,0.04)', borderBottom: '1px solid var(--color-border)' }}>
                        {['Job', 'Amount', 'Platform fee', 'Pro payout', 'Status', 'Customer', 'Professional', 'Date'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.jobTitle}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-navy)' }}>£{p.amount.toFixed(2)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>£{p.platformFee.toFixed(2)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-amber-dark)' }}>£{p.professionalPayout.toFixed(2)}</td>
                          <td style={{ padding: '12px 16px' }}><StatusBadge status={p.status} /></td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{p.customer}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{p.professional}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No payments found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Pagination total={payTotal} page={payPage} limit={20} onPage={setPayPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function Pagination({ total, page, limit, onPage }: { total: number; page: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
      <span>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button disabled={page === 1} onClick={() => onPage(page - 1)} className="btn btn-sm" style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn btn-sm" style={{ opacity: page >= pages ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}
