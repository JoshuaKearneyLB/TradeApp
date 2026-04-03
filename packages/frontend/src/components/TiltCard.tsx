import { useRef, useCallback, ReactNode } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  strength?: number;   // tilt intensity (degrees), default 12
  glare?: boolean;     // show glare overlay, default true
  scale?: number;      // scale on hover, default 1.03
}

/**
 * 3D perspective tilt card — mouse position drives CSS transforms.
 * No external dependencies. GPU-accelerated via transform3d.
 */
export function TiltCard({
  children,
  className = '',
  style,
  strength = 12,
  glare = true,
  scale = 1.03,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;

      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width;   // 0–1
      const y = (e.clientY - top) / height;   // 0–1

      const rotateX = (0.5 - y) * strength * 2;   // positive = tilt up
      const rotateY = (x - 0.5) * strength * 2;   // positive = tilt right

      el.style.transform = `
        perspective(800px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        scale(${scale})
      `;

      if (glareRef.current) {
        // Glare angle follows mouse
        const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 90;
        const intensity = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2) * 0.6;
        glareRef.current.style.opacity = String(intensity);
        glareRef.current.style.background = `
          linear-gradient(
            ${angle}deg,
            rgba(255,255,255,0.28) 0%,
            rgba(255,255,255,0) 60%
          )
        `;
      }
    });
  }, [strength, scale]);

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s cubic-bezier(0.22,1,0.36,1)';
    el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    if (glareRef.current) glareRef.current.style.opacity = '0';
    // Clear transition override after it completes so mousemove is snappy again
    setTimeout(() => { if (el) el.style.transition = ''; }, 560);
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        ...style,
      }}
    >
      {children}

      {/* Glare overlay */}
      {glare && (
        <div
          ref={glareRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.1s',
            zIndex: 10,
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </div>
  );
}
