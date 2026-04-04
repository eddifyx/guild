import { useEffect } from 'react';

export function useGuildSettingsShellEffects({
  openTraceId = null,
  onClose = () => {},
  refs = {},
  endPerfTraceAfterNextPaintFn = () => {},
} = {}) {
  const {
    completedOpenTraceIdsRef = { current: new Set() },
  } = refs;

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!openTraceId || completedOpenTraceIdsRef.current.has(openTraceId)) {
      return;
    }

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaintFn(openTraceId, {
      status: 'ready',
      surface: 'guild-settings',
    });
  }, [completedOpenTraceIdsRef, endPerfTraceAfterNextPaintFn, openTraceId]);
}
