import { motion, AnimatePresence } from 'framer-motion'
import { TargetingUI } from './ui/animated-hud-targeting-ui'

interface LoadingScreenProps {
  visible: boolean
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'linear-gradient(160deg, #1e2d26 0%, #2d4438 55%, #1a3328 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          {/* HUD targeting animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <TargetingUI color="#22c55e" className="w-64 h-56" />
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            TradeApp
            <motion.span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
              }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

          {/* Status text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: -16,
            }}
          >
            Connecting…
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
