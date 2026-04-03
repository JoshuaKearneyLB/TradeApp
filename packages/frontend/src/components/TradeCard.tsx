import { useRef, useCallback } from 'react';

interface TradeCardProps {
  icon: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  animDelay?: string;
}

export function TradeCard({ icon, name, desc, color, bg, animDelay = '0s' }: TradeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width;
      const y = (e.clientY - top) / height;

      const rotY =  (x - 0.5) * 26;
      const rotX = -(y - 0.5) * 26;

      el.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.06,1.06,1.06)`;

      if (glareRef.current) {
        const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 90;
        const dist  = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2);
        glareRef.current.style.opacity = String(dist * 0.65);
        glareRef.current.style.background = `linear-gradient(${angle}deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 65%)`;
      }
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1)';
    el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    if (glareRef.current) glareRef.current.style.opacity = '0';
    setTimeout(() => { if (el) el.style.transition = ''; }, 620);
  }, []);

  return (
    <div className="animate-in" style={{ animationDelay: animDelay, height: '100%' }}>
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        height: '100%',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: '28px 24px 24px',
        cursor: 'default',
        overflow: 'hidden',
        boxShadow: 'var(--shadow)',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Coloured top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: color,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />

      {/* Glare overlay */}
      <div
        ref={glareRef}
        style={{
          position: 'absolute', inset: 0,
          borderRadius: 'inherit',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.08s',
          zIndex: 10,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Icon pill — floats slightly in Z */}
      <div style={{
        width: 54, height: 54,
        borderRadius: 'var(--radius)',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.7rem', marginBottom: 18,
        boxShadow: `0 4px 14px ${color}30`,
        transform: 'translateZ(20px)',
      }}>
        {icon}
      </div>

      {/* Text — also lifted in Z for depth layering */}
      <div style={{ transform: 'translateZ(12px)' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700, fontSize: '1rem',
          color: 'var(--color-text)', marginBottom: 6,
        }}>
          {name}
        </div>
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {desc}
        </div>
      </div>

      {/* Corner glow */}
      <div style={{
        position: 'absolute', bottom: -24, right: -24,
        width: 90, height: 90, borderRadius: '50%',
        background: color, opacity: 0.08,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
    </div>
    </div>
  );
}
