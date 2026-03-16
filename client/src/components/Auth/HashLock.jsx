import { useEffect, useRef, useState } from 'react';
import introSound from '../../assets/intro-sound.wav';
import logoGeometry from '../../branding/logoGeometry.json';

// Final diamond sizes (130px container)
const SIZE = logoGeometry.baseSize;
const OUTER_STROKE = logoGeometry.outerStroke;
const MIDDLE_STROKE = logoGeometry.middleStroke;
const MIDDLE_INSET = logoGeometry.middleInset; // -> 88x88
const INNER_INSET = logoGeometry.innerInset;   // -> 52x52
const TARGET = 45;
const BASE_TILT = logoGeometry.tilt;
const OUTER_PEAK = 152;
const MIDDLE_PEAK = -28;
const INNER_GAP = INNER_INSET - MIDDLE_INSET;
const INNER_TUCK_SCALE = clamp(1 - Math.max(0, 22 - INNER_GAP) * 0.01, 0.84, 0.97);

// Scale: start matching LoginScreen's 80px logo, grow to 130px
const INITIAL_SCALE = 80 / SIZE; // ≈ 0.615

// Phase timing
const HOLD_MS = 80;       // Brief anchor — logo appears at login size
const EXPAND_MS = 500;    // Scale up + diamonds drift apart
const CONVERGE_MS = 1300; // Both diamonds converge together

// Snap-lock easing: smooth approach, then hard mechanical snap at 96%
function easeSnapLock(t) {
  if (t >= 0.96) return 1; // instant snap — the "click"
  const mapped = t / 0.96;
  return 0.96 * (1 - Math.pow(1 - mapped, 3));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function HashLock({ onComplete }) {
  const logoRef = useRef(null);
  const rigRef = useRef(null);
  const outerRef = useRef(null);
  const middleRef = useRef(null);
  const innerRef = useRef(null);
  const flashRef = useRef(null);
  const [fading, setFading] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Fade out after animation completes
  useEffect(() => {
    const FADE_DELAY = 3180; // lock + settle — hardcoded to match audio
    const FADE_DURATION = 800;

    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => onCompleteRef.current(), FADE_DURATION);
    }, FADE_DELAY);

    return () => clearTimeout(timer);
  }, []);

  // Play intro sound
  useEffect(() => {
    const audio = new Audio(introSound);
    audio.volume = 0.6;
    const delay = setTimeout(() => audio.play().catch(() => {}), 67);
    return () => { clearTimeout(delay); audio.pause(); audio.currentTime = 0; };
  }, []);

  // Lock-dial animation
  useEffect(() => {
    let animId;
    const startTime = performance.now();
    let lockTime = -1;
    let flashTriggered = false;

    function frame(now) {
      const elapsed = now - startTime;

      let scale = INITIAL_SCALE;
      let outerAngle = TARGET;
      let middleAngle = TARGET;
      let rigTiltX = BASE_TILT;
      let rigTiltY = BASE_TILT * -1.15;
      let rigRoll = 0;
      let rigFloatY = 0;
      let innerScale = 1;

      if (elapsed < HOLD_MS) {
        // Phase 0: Hold — logo at login-screen size, all aligned
        scale = INITIAL_SCALE;
        outerAngle = TARGET;
        middleAngle = TARGET;
      } else if (elapsed < HOLD_MS + EXPAND_MS) {
        // Phase 1: Expand + Drift — logo grows, diamonds wander apart
        const t = (elapsed - HOLD_MS) / EXPAND_MS;
        const eased = easeOutCubic(t);

        scale = INITIAL_SCALE + (1 - INITIAL_SCALE) * eased;
        outerAngle = TARGET + (OUTER_PEAK - TARGET) * eased;
        middleAngle = TARGET + (MIDDLE_PEAK - TARGET) * eased;
        rigTiltX = BASE_TILT + eased * 2;
        rigTiltY = BASE_TILT * -1.15 - eased * 1.4;
        rigRoll = eased * -1.4;
        rigFloatY = eased * -8;
        innerScale = 1 + (INNER_TUCK_SCALE - 1) * eased;
      } else {
        // Phase 2: Converge — diamonds ease back to 45°
        scale = 1;
        const convergeElapsed = elapsed - HOLD_MS - EXPAND_MS;
        const convergeT = Math.min(1, convergeElapsed / CONVERGE_MS);
        const eased = easeSnapLock(convergeT);

        outerAngle = OUTER_PEAK + (TARGET - OUTER_PEAK) * eased;
        middleAngle = MIDDLE_PEAK + (TARGET - MIDDLE_PEAK) * eased;
        rigTiltX = BASE_TILT + (1 - eased) * 2;
        rigTiltY = BASE_TILT * -1.15 - (1 - eased) * 1.4;
        rigRoll = (1 - eased) * -1.4;
        rigFloatY = (1 - eased) * -8;
        innerScale = INNER_TUCK_SCALE + (1 - INNER_TUCK_SCALE) * eased;

        // Detect lock moment — both arrive
        if (convergeT >= 1 && lockTime < 0) {
          lockTime = now;
        }
      }

      // Apply scale to logo container
      if (logoRef.current) {
        logoRef.current.style.transform = `scale(${scale})`;
      }
      if (rigRef.current) {
        rigRef.current.style.transform = `translateY(${rigFloatY}px) rotateX(${rigTiltX}deg) rotateY(${rigTiltY}deg) rotateZ(${rigRoll}deg)`;
      }

      // Apply rotation to diamonds
      if (outerRef.current) {
        outerRef.current.style.transform = `rotate(${outerAngle}deg)`;
      }
      if (middleRef.current) {
        middleRef.current.style.transform = `rotate(${middleAngle}deg)`;
      }

      // Inner: gentle breathing until lock
      if (innerRef.current) {
        const breathe = lockTime < 0 ? Math.sin(elapsed / 500) * 0.01 : 0;
        innerRef.current.style.transform = `rotate(${TARGET}deg) scale(${innerScale * (1 + breathe)})`;
      }

      // Post-lock effects
      if (lockTime > 0) {
        const lockElapsed = now - lockTime;

        // Subtle flash
        if (!flashTriggered && flashRef.current) {
          flashTriggered = true;
          const flash = flashRef.current;
          flash.style.transition = 'opacity 0.2s ease-out';
          flash.style.opacity = '0.06';
          setTimeout(() => {
            flash.style.transition = 'opacity 0.5s ease-out';
            flash.style.opacity = '0';
          }, 200);
        }

        // Gentle scale pulse
        if (lockElapsed < 500) {
          const pulseT = lockElapsed / 500;
          const pulse = 1 + 0.03 * Math.sin(pulseT * Math.PI);
          if (logoRef.current) logoRef.current.style.transform = `scale(${pulse})`;
        } else {
          if (logoRef.current) logoRef.current.style.transform = 'scale(1)';
        }

        // Inner glow builds
        if (innerRef.current) {
          const glow = Math.min(1, lockElapsed / 800);
          innerRef.current.style.background = `rgba(64, 255, 64, ${0.25 + glow * 0.25})`;
          innerRef.current.style.boxShadow = `0 0 ${20 + glow * 28}px rgba(64, 255, 64, ${0.2 + glow * 0.4})`;
        }

        // Borders brighten
        if (outerRef.current) {
          const b = Math.min(1, lockElapsed / 1000);
          outerRef.current.style.borderColor = `rgba(64, 255, 64, ${0.4 + b * 0.3})`;
        }
        if (middleRef.current) {
          const b = Math.min(1, lockElapsed / 1000);
          middleRef.current.style.borderColor = `rgba(64, 255, 64, ${0.5 + b * 0.3})`;
        }
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#050705',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.8s ease-out',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Flash overlay */}
      <div
        ref={flashRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(64, 255, 64, 0.5)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Logo container — starts at login-screen scale */}
      <div
        ref={logoRef}
        style={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
          zIndex: 1,
          perspective: '1200px',
          transform: `scale(${INITIAL_SCALE})`,
          willChange: 'transform',
        }}
      >
        <div
          ref={rigRef}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotateX(${BASE_TILT}deg) rotateY(${BASE_TILT * -1.15}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {/* Outer diamond */}
          <div
            ref={outerRef}
            style={{
              position: 'absolute',
              inset: 0,
              border: `${OUTER_STROKE}px solid rgba(64, 255, 64, 0.4)`,
              borderRadius: 5,
              transform: `rotate(${TARGET}deg)`,
              willChange: 'transform, border-color',
            }}
          />
          {/* Middle diamond */}
          <div
            ref={middleRef}
            style={{
              position: 'absolute',
              inset: MIDDLE_INSET,
              border: `${MIDDLE_STROKE}px solid rgba(64, 255, 64, 0.5)`,
              borderRadius: 4,
              transform: `rotate(${TARGET}deg)`,
              willChange: 'transform, border-color',
            }}
          />
          {/* Inner diamond */}
          <div
            ref={innerRef}
            style={{
              position: 'absolute',
              inset: INNER_INSET,
              background: 'rgba(64, 255, 64, 0.25)',
              borderRadius: 3,
              boxShadow: '0 0 20px rgba(64, 255, 64, 0.2)',
              transform: `rotate(${TARGET}deg)`,
              willChange: 'transform, box-shadow, background',
            }}
          />
        </div>
      </div>

    </div>
  );
}
