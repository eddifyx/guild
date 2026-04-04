import React from 'react';
export function UpdateOverlayLogo({ logoMetrics }) {
  return (
    <div style={{ position: 'relative', width: logoMetrics.logoSize, height: logoMetrics.logoSize, perspective: 960 }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `rotateX(${logoMetrics.logoTilt}deg) rotateY(${(logoMetrics.logoTilt * -1.15).toFixed(2)}deg)`,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          border: `${logoMetrics.outerStroke}px solid rgba(64, 255, 64, 0.4)`,
          borderRadius: 4,
          animation: 'byz-spin-cw 4s linear infinite',
          willChange: 'transform',
        }} />
        <div style={{
          position: 'absolute',
          inset: logoMetrics.middleInset,
          border: `${logoMetrics.middleStroke}px solid rgba(64, 255, 64, 0.58)`,
          borderRadius: 3,
          animation: 'byz-spin-ccw 3s linear infinite',
          willChange: 'transform',
        }} />
        <div style={{
          position: 'absolute',
          inset: logoMetrics.innerInset,
          background: 'rgba(64, 255, 64, 0.8)',
          borderRadius: 2,
          boxShadow: '0 0 16px rgba(64, 255, 64, 0.2)',
          animation: 'byz-pulse 2s ease-in-out infinite',
          willChange: 'transform',
        }} />
      </div>
    </div>
  );
}
