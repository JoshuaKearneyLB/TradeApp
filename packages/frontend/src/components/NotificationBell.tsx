import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = async (id: string, relatedJobId?: string) => {
    await markRead(id);
    setOpen(false);
    if (relatedJobId) {
      navigate(`/my-jobs`);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-outline"
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            backgroundColor: '#111',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            borderRadius: '999px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '320px',
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted, #64748b)', fontSize: '0.875rem', margin: 0 }}>
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id, n.relatedJobId)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border, #f1f5f9)',
                    cursor: n.relatedJobId ? 'pointer' : 'default',
                    backgroundColor: n.isRead ? 'transparent' : '#f5f5f5',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontWeight: n.isRead ? 400 : 600, fontSize: '0.875rem', flex: 1 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted, #64748b)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                    {n.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
