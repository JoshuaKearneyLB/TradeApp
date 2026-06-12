import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ACCENT: Record<ToastType, string> = {
  success: '#0d9488',
  error: '#dc2626',
  info: '#1a3a6b',
};

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

/**
 * UX-02: replaces blocking native alert() calls with non-blocking, accessible
 * toast notifications. Mounted once near the app root; surfaces errors and
 * confirmations without freezing the UI thread.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    // auto-dismiss; errors linger a little longer so they can be read
    window.setTimeout(() => remove(id), type === 'error' ? 6000 : 4000);
  }, [remove]);

  const toast = useRef({
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  }).current;

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 2000,
          display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'min(92vw, 380px)',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            onClick={() => remove(t.id)}
            className="toast-item"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              background: '#fff', color: '#0f1e35',
              borderLeft: `4px solid ${ACCENT[t.type]}`,
              boxShadow: '0 8px 30px rgba(15,35,70,0.18)',
              fontSize: '0.875rem', lineHeight: 1.4,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                background: ACCENT[t.type], color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800,
              }}
            >
              {ICON[t.type]}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}
