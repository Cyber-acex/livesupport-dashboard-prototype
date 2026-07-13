import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Float, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRobotAnimation } from '../hooks/useRobotAnimation';

function RobotModel({ hovered, clicked, pointer, voiceActive, activityPulse, danceActive, robotUrl, faceTextureUrl }) {
  const gltf = useGLTF(robotUrl);
  const faceTex = useTexture(faceTextureUrl);
  const scene = gltf.scene || gltf.scenes?.[0];
  const { rootRef, glowRef } = useRobotAnimation({
    hovered,
    clicked,
    pointer,
    modelObject: scene,
    enabled: true,
    voiceActive,
    activityPulse,
    danceActive
  });

  useMemo(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();

      if (name.includes('leg') || name.includes('foot') || name.includes('wheel') || name.includes('base') || name.includes('stand')) {
        child.visible = false;
      }

      if (name.includes('eye') || name.includes('screen') || name.includes('face') || name.includes('visor')) {
        child.material = child.material.clone();
        child.material.roughness = 0.02;
        child.material.metalness = 0.12;
        child.material.envMapIntensity = 1.35;
        if (faceTex) child.material.map = faceTex;
        child.material.needsUpdate = true;
      } else if (name.includes('antenna') || name.includes('joint') || name.includes('metal') || name.includes('rim')) {
        child.material = child.material.clone();
        child.material.roughness = 0.16;
        child.material.metalness = 1;
        child.material.needsUpdate = true;
      } else {
        child.material = child.material.clone();
        child.material.roughness = 0.08;
        child.material.metalness = 0.05;
        child.material.clearcoat = 1;
        child.material.clearcoatRoughness = 0.06;
        child.material.needsUpdate = true;
      }
    });

    scene.position.set(0, -0.24, 0);
  }, [scene, faceTex]);

  return (
    <group ref={rootRef} scale={0.30}>
      <primitive object={scene} />
      <mesh ref={glowRef} position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.78, 24, 24]} />
        <meshBasicMaterial color="#66e6ff" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HolographicPlatform({ pulse = 0, voiceActive = false }) {
  const ringRef = useRef(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = state.clock.elapsedTime * 0.35;
  });

  return (
    <group position={[0, -0.34, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[0.54, 0.72, 72]} />
        <meshBasicMaterial color={voiceActive ? '#3cdcff' : '#6feaff'} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.64, 0.021, 12, 80]} />
        <meshStandardMaterial color="#22cfff" emissive="#1a7dff" emissiveIntensity={1.35} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.50 + pulse * 0.02, 64]} />
        <meshBasicMaterial color="#89ecff" transparent opacity={0.22 + pulse * 0.04} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.46, 64]} />
        <meshStandardMaterial color="#c9f7ff" transparent opacity={0.16} roughness={0.2} metalness={0.15} />
      </mesh>
    </group>
  );
}

function RobotScene({ hovered, clicked, pointer, voiceActive, activityPulse, danceActive, robotUrl, faceTextureUrl }) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.84, 4.2], fov: 36 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={[0, 0, 0, 0]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#81e9ff', '#080d18', 0.75]} />
      <directionalLight position={[4, 6, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 0.9, 1.2]} intensity={2.1} color="#3dd9ff" />
      <spotLight position={[0, 2.2, 2.1]} angle={0.35} penumbra={0.35} intensity={1.1} color="#8ee8ff" />
      <Environment preset="city" />
      <Suspense fallback={null}>
        <Float speed={1.65} rotationIntensity={0.06} floatIntensity={0.7}>
          <RobotModel
            hovered={hovered}
            clicked={clicked}
            pointer={pointer}
            voiceActive={voiceActive}
            activityPulse={activityPulse}
            danceActive={danceActive}
            robotUrl={robotUrl}
            faceTextureUrl={faceTextureUrl}
          />
        </Float>
      </Suspense>
      <HolographicPlatform pulse={activityPulse} voiceActive={voiceActive} />
      <ContactShadows position={[0, -0.3, 0]} opacity={0.28} scale={3.1} blur={1.3} far={1.4} resolution={512} />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
    </Canvas>
  );
}

export default function SidebarRobot({ compact = false }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [danceActive, setDanceActive] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [activityPulse, setActivityPulse] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const robotUrl = useMemo(() => new URL('../../uploads/logo.glb', import.meta.url).href, []);
  useGLTF.preload(robotUrl);
  const faceTextureUrl = useMemo(() => new URL('../../uploads/logo robo.jpg', import.meta.url).href, []);

  const hoverScale = useMotionValue(1);
  const springScale = useSpring(hoverScale, { stiffness: 220, damping: 18 });
  const hoverGlow = useMotionValue(0);
  const springGlow = useSpring(hoverGlow, { stiffness: 220, damping: 16 });

  useEffect(() => {
    const handleTicket = () => {
      setPointer({ x: 0.6, y: 0.12 });
      setActivityPulse(1);
    };
    const handleCustomer = () => {
      setClicked(true);
      setActivityPulse(1);
    };
    const handleAI = () => {
      setActivityPulse(1);
    };
    const handleVoice = () => {
      setVoiceActive(true);
      setActivityPulse(1);
    };
    const handleIdle = () => {
      setVoiceActive(false);
      setActivityPulse(0);
    };

    window.addEventListener('livesupport:ticket', handleTicket);
    window.addEventListener('livesupport:customer', handleCustomer);
    window.addEventListener('livesupport:ai', handleAI);
    window.addEventListener('livesupport:voice', handleVoice);
    window.addEventListener('livesupport:idle', handleIdle);

    return () => {
      window.removeEventListener('livesupport:ticket', handleTicket);
      window.removeEventListener('livesupport:customer', handleCustomer);
      window.removeEventListener('livesupport:ai', handleAI);
      window.removeEventListener('livesupport:voice', handleVoice);
      window.removeEventListener('livesupport:idle', handleIdle);
    };
  }, []);

  useEffect(() => {
    if (!activityPulse) return;
    const timeout = window.setTimeout(() => setActivityPulse(0), 900);
    return () => window.clearTimeout(timeout);
  }, [activityPulse]);

  useEffect(() => {
    if (!clicked) return;
    const timeout = window.setTimeout(() => setClicked(false), 700);
    return () => window.clearTimeout(timeout);
  }, [clicked]);

  useEffect(() => {
    if (!danceActive) return;
    const timeout = window.setTimeout(() => setDanceActive(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [danceActive]);

  const handleTap = () => {
    setClicked(true);
    setDanceActive(true);
    setActivityPulse(1);
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    setPointer({ x: -x * 0.6, y: -y * 0.4 });
  };

  const resetPointer = () => setPointer({ x: 0, y: 0 });

  return (
    <motion.div
      className={`relative flex items-center justify-center rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl ${compact ? 'h-16 w-16' : 'h-24 w-24'} ${hovered ? 'scale-[1.02]' : 'scale-100'}`}
      style={{ scale: springScale, cursor: hovered ? 'pointer' : 'default' }}
      onMouseMove={handlePointerMove}
      onMouseEnter={() => {
        setHovered(true);
        hoverScale.set(1.05);
        hoverGlow.set(1);
      }}
      onMouseLeave={() => {
        setHovered(false);
        resetPointer();
        hoverScale.set(1);
        hoverGlow.set(0);
      }}
      onPointerDown={handleTap}
      onMouseUp={() => setClicked(false)}
      onTouchStart={handleTap}
      onClick={handleTap}
      onPointerLeave={() => setClicked(false)}
    >
      <motion.div
        className="absolute inset-0 rounded-[1.35rem]"
        style={{
          background: 'radial-gradient(circle at top, rgba(103,228,255,0.22), transparent 70%)',
          opacity: springGlow,
        }}
      />
      <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] bg-transparent">
        <RobotScene
          hovered={hovered}
          clicked={clicked}
          pointer={pointer}
          voiceActive={voiceActive}
          activityPulse={activityPulse}
          danceActive={danceActive}
          robotUrl={robotUrl}
          faceTextureUrl={faceTextureUrl}
        />
      </div>
    </motion.div>
  );
}
