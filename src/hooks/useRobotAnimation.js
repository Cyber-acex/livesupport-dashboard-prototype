import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (start, end, alpha) => start + (end - start) * alpha;

/**
 * A lightweight animation hook for the sidebar robot mascot.
 * It provides idle motion, head tracking, breathing, hover glow, and click bounce.
 */
export function useRobotAnimation({
  pointer = { x: 0, y: 0 },
  hovered = false,
  clicked = false,
  enabled = true,
  modelObject = null,
  voiceActive = false,
  activityPulse = 0
} = {}) {
  const rootRef = useRef(null);
  const antennasRef = useRef([]);
  const eyesRef = useRef([]);
  const bodyRef = useRef(null);
  const headRef = useRef(null);
  const glowRef = useRef(null);
  const clickPulse = useRef(0);
  const isTabActive = useRef(true);

  useEffect(() => {
    if (!modelObject) return;

    const antennas = [];
    const eyes = [];
    let body = null;
    let head = null;

    modelObject.traverse((child) => {
      if (!child.isMesh) return;

      const name = (child.name || '').toLowerCase();
      if (name.includes('antenna')) {
        antennas.push(child);
      } else if (name.includes('eye')) {
        eyes.push(child);
      } else if (name.includes('head')) {
        head = child;
      } else if (name.includes('body') || name.includes('torso') || name.includes('chest')) {
        if (!body) body = child;
      }
    });

    antennasRef.current = antennas;
    eyesRef.current = eyes;
    bodyRef.current = body;
    headRef.current = head || body;
  }, [modelObject]);

  useEffect(() => {
    const handleVisibility = () => {
      isTabActive.current = document.visibilityState === 'visible';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();

    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useFrame((state, delta) => {
    if (!rootRef.current || !enabled || !isTabActive.current) return;

    const time = state.clock.elapsedTime;
    const floatAmplitude = hovered ? 0.052 : 0.035;
    const hoverLift = hovered ? 0.026 : 0.01;
    const bobOffset = Math.sin(time * (hovered ? 2.8 : 2.0)) * floatAmplitude + hoverLift;

    const targetRotationY = clamp(pointer.x * 0.72, -0.314, 0.314);
    const targetRotationX = clamp(pointer.y * 0.55, -0.174, 0.174);

    if (clicked) {
      clickPulse.current = Math.min(1, clickPulse.current + delta * 3.2);
    } else {
      clickPulse.current = Math.max(0, clickPulse.current - delta * 2.6);
    }

    const spinAmount = clicked ? clickPulse.current * Math.PI * 2 : 0;
    const bounceAmount = clicked ? Math.sin(clickPulse.current * Math.PI) * 0.08 : 0;
    const blinkActive = (time % 6.2) < 0.08 && Math.floor(time / 6.2) % 2 === 0;

    rootRef.current.position.y = lerp(rootRef.current.position.y ?? 0, 0.04 + bobOffset + bounceAmount, 0.09);
    rootRef.current.rotation.y = lerp(rootRef.current.rotation.y ?? 0, targetRotationY + spinAmount * 0.08, 0.1);
    rootRef.current.rotation.x = lerp(rootRef.current.rotation.x ?? 0, targetRotationX - (clicked ? 0.08 : 0), 0.1);
    rootRef.current.rotation.z = lerp(rootRef.current.rotation.z ?? 0, clicked ? 0.05 : 0, 0.1);

    if (bodyRef.current) {
      bodyRef.current.rotation.y = lerp(bodyRef.current.rotation.y ?? 0, targetRotationY * 0.28, 0.12);
      bodyRef.current.rotation.x = lerp(bodyRef.current.rotation.x ?? 0, targetRotationX * 0.18, 0.12);
      bodyRef.current.scale.setScalar(1 + Math.sin(time * 2.4) * 0.012 + (hovered ? 0.018 : 0));
    }

    if (headRef.current) {
      const micro = Math.sin(time * 1.35 + 0.8) * 0.01 + Math.sin(time * 0.9) * 0.006;
      headRef.current.rotation.y = lerp(headRef.current.rotation.y ?? 0, targetRotationY * 0.55 + micro, 0.1);
      headRef.current.rotation.x = lerp(headRef.current.rotation.x ?? 0, targetRotationX * 0.45 + Math.sin(time * 1.2) * 0.003, 0.1);
    }

    antennasRef.current.forEach((mesh, index) => {
      const sway = Math.sin(time * 3.2 + index) * 0.03;
      mesh.rotation.z = lerp(mesh.rotation.z ?? (index % 2 === 0 ? -0.2 : 0.2), (index % 2 === 0 ? -0.2 : 0.2) + sway, 0.12);
    });

    eyesRef.current.forEach((mesh) => {
      if (!mesh.material) return;
      const material = mesh.material;
      const blinkFactor = blinkActive ? 0.18 : 1;
      const emissiveBoost = hovered || voiceActive ? 2.2 : 1.35;
      const glowOpacity = hovered ? 1 : 0.82;

      if (material.emissive) {
        material.emissiveIntensity = emissiveBoost * blinkFactor;
      }
      if (material.color) {
        material.color.set(hovered ? '#87f2ff' : '#2fd7ff');
      }
      if (material.opacity !== undefined) {
        material.opacity = blinkFactor * (hovered ? 1 : 0.94);
      }
      if (material.transparent) {
        material.transparent = true;
      }
      if (glowRef.current && glowRef.current.material) {
        glowRef.current.material.opacity = hovered ? 0.3 : 0.16 + activityPulse * 0.03;
        glowRef.current.material.color.set(voiceActive ? '#4ad4ff' : '#66e6ff');
      }
    });

    if (glowRef.current) {
      glowRef.current.scale.setScalar(hovered ? 1.12 : 1 + activityPulse * 0.05);
    }
  });

  return { rootRef, antennasRef, eyesRef, bodyRef, headRef, glowRef };
}
