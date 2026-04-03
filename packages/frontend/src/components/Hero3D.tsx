import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Trail } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ── Particle riding along the beam with a glowing trail ──────────
function BeamParticle({
  curve,
  speed,
  startT,
}: {
  curve: THREE.CatmullRomCurve3
  speed: number
  startT: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const t = useRef(startT)

  useFrame((_, delta) => {
    t.current = (t.current + delta * speed) % 1
    meshRef.current.position.copy(curve.getPoint(t.current))
  })

  return (
    <Trail
      width={0.12}
      length={10}
      color={new THREE.Color('#86efac')}
      attenuation={(f) => f * f * f}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </Trail>
  )
}

// ── Animated pulse ring at pin base ──────────────────────────────
function PulseRing({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const s = 1 + (Math.sin(clock.elapsedTime * 2.2) * 0.5 + 0.5) * 0.7
    ref.current.scale.setScalar(s)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.35 - (s - 1) * 0.3
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.32, 0]}>
      <ringGeometry args={[0.22, 0.36, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Map pin ───────────────────────────────────────────────────────
function MapPin({
  position,
  color,
  emissive,
  floatOffset = 0,
}: {
  position: [number, number, number]
  color: string
  emissive: string
  floatOffset?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  const baseY = position[1]

  useFrame(({ clock }) => {
    ref.current.position.y = baseY + Math.sin(clock.elapsedTime * 0.85 + floatOffset) * 0.14
  })

  const stdMat = {
    color,
    emissive,
    emissiveIntensity: 0.9,
    metalness: 0.65,
    roughness: 0.12,
  }

  return (
    <group ref={ref} position={position}>
      <PulseRing color={emissive} />

      {/* Head sphere */}
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.38, 48, 48]} />
        <meshStandardMaterial {...stdMat} />
      </mesh>

      {/* Outer glow shell */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.56, 32, 32]} />
        <meshBasicMaterial color={emissive} transparent opacity={0.07} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -0.58, 0]}>
        <cylinderGeometry args={[0.08, 0.17, 0.74, 24]} />
        <meshStandardMaterial {...stdMat} />
      </mesh>

      {/* Tip */}
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.17, 0.56, 24]} />
        <meshStandardMaterial {...stdMat} />
      </mesh>
    </group>
  )
}

// ── Glowing arc connecting the pins ──────────────────────────────
function ConnectionBeam() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.1, -0.15, 0),
        new THREE.Vector3(-0.9, 0.82, 0.38),
        new THREE.Vector3(0, 1.1, 0.5),
        new THREE.Vector3(0.9, 0.82, 0.38),
        new THREE.Vector3(2.1, -0.15, 0),
      ]),
    []
  )

  return (
    <group>
      {/* Core beam */}
      <mesh>
        <tubeGeometry args={[curve, 128, 0.018, 8, false]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.9} />
      </mesh>
      {/* Wide glow halo */}
      <mesh>
        <tubeGeometry args={[curve, 64, 0.065, 8, false]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.1} />
      </mesh>
      {/* Particles */}
      <BeamParticle curve={curve} speed={0.44} startT={0.05} />
      <BeamParticle curve={curve} speed={0.36} startT={0.45} />
      <BeamParticle curve={curve} speed={0.55} startT={0.75} />
    </group>
  )
}

// ── Floating green dust particles ─────────────────────────────────
function DustParticles() {
  const COUNT = 70
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4.5
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    return arr
  }, [])

  const ref = useRef<THREE.Points>(null!)
  useFrame(({ clock }) => {
    ref.current.rotation.y = clock.elapsedTime * 0.025
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#86efac" size={0.035} transparent opacity={0.45} sizeAttenuation />
    </points>
  )
}

// ── Reflective ground disc with subtle grid ───────────────────────
function Ground() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(9, 18, 0x22c55e, 0x22c55e)
    const mats = Array.isArray(g.material) ? g.material : [g.material]
    mats.forEach((m) => {
      m.transparent = true
      ;(m as THREE.LineBasicMaterial).opacity = 0.1
    })
    return g
  }, [])

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.43, 0]} receiveShadow>
        <circleGeometry args={[4.5, 64]} />
        <meshStandardMaterial
          color="#1a2d22"
          metalness={0.92}
          roughness={0.08}
          transparent
          opacity={0.6}
        />
      </mesh>
      <primitive object={grid} position={[0, -1.42, 0]} />
    </>
  )
}

// ── Scene root — handles mouse-parallax rotation ──────────────────
function Scene() {
  const groupRef = useRef<THREE.Group>(null!)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    groupRef.current.rotation.y +=
      (mouse.current.x * 0.32 - groupRef.current.rotation.y) * 0.04
    groupRef.current.rotation.x +=
      (mouse.current.y * 0.13 - groupRef.current.rotation.x) * 0.04
  })

  return (
    <group ref={groupRef}>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[-4, 4, 3]} intensity={4} color="#22c55e" />
      <pointLight position={[4, 3, 2]} intensity={2.5} color="#86efac" />
      <pointLight position={[0, 0, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[0, -2, 2]} intensity={0.6} color="#22c55e" />

      <Ground />
      <DustParticles />

      {/* Customer pin — green */}
      <MapPin position={[-2.1, 0, 0]} color="#22c55e" emissive="#22c55e" floatOffset={0} />
      {/* Tradesperson pin — dark slate with teal glow */}
      <MapPin
        position={[2.1, 0, 0]}
        color="#3d6b57"
        emissive="#4ade80"
        floatOffset={Math.PI * 0.65}
      />

      <ConnectionBeam />

      <Stars radius={30} depth={15} count={700} factor={1.4} saturation={0} fade speed={0.3} />
    </group>
  )
}

// ── Hero 3D canvas ────────────────────────────────────────────────
export function Hero3D() {
  return (
    <div
      style={{
        width: 430,
        height: 340,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* "Matched" overlay label */}
      <div
        style={{
          position: 'absolute',
          bottom: 62,
          left: '50%',
          fontSize: '0.62rem',
          fontWeight: 800,
          color: '#22c55e',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontFamily: 'var(--font-display, serif)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 18px rgba(34,197,94,0.75)',
          animation: 'matchLabel 2.8s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        ⚡ Matched instantly
      </div>

      <Canvas
        camera={{ position: [0, 1.3, 6.8], fov: 46 }}
        style={{ background: 'transparent' }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        shadows
      >
        <Scene />
        <EffectComposer>
          <Bloom
            intensity={2.2}
            luminanceThreshold={0.12}
            luminanceSmoothing={0.88}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
