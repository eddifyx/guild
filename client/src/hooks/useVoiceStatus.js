import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';

const VOICE_STATUS_POLL_INTERVAL_MS = 15_000;

const DEFAULT_VOICE_STATUS = {
  status: 'unknown',
  workerCount: 0,
  targetWorkerCount: 0,
  workersAvailable: true,
  degraded: false,
  recoveryPending: false,
  checkedAt: null,
};

function normalizeVoiceStatus(payload = {}) {
  const workerCount = Number(payload.workerCount) || 0;
  const targetWorkerCount = Number(payload.targetWorkerCount) || workerCount || 0;
  const workersAvailable = payload.workersAvailable !== false && workerCount > 0;
  const degraded = !!payload.degraded || (targetWorkerCount > 0 && workerCount < targetWorkerCount);
  const recoveryPending = !!payload.recoveryPending;

  let status = payload.status || 'ok';
  if (!workersAvailable) {
    status = recoveryPending ? 'recovering' : 'unavailable';
  } else if (recoveryPending) {
    status = 'recovering';
  } else if (degraded) {
    status = 'degraded';
  } else {
    status = 'ok';
  }

  return {
    status,
    workerCount,
    targetWorkerCount,
    workersAvailable,
    degraded,
    recoveryPending,
    checkedAt: new Date().toISOString(),
  };
}

export function useVoiceStatus(enabled = true) {
  const { socket } = useSocket();
  const [voiceStatus, setVoiceStatus] = useState(DEFAULT_VOICE_STATUS);

  const refreshVoiceStatus = useCallback(async () => {
    if (!enabled) {
      setVoiceStatus(DEFAULT_VOICE_STATUS);
      return DEFAULT_VOICE_STATUS;
    }

    const nextStatus = normalizeVoiceStatus(await api('/api/voice/status'));
    setVoiceStatus(nextStatus);
    return nextStatus;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setVoiceStatus(DEFAULT_VOICE_STATUS);
      return undefined;
    }

    let cancelled = false;

    const load = () => {
      refreshVoiceStatus().catch(() => {
        if (cancelled) return;
      });
    };

    load();
    const intervalId = window.setInterval(load, VOICE_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, refreshVoiceStatus]);

  useEffect(() => {
    if (!enabled || !socket) return undefined;

    const handleConnect = () => {
      refreshVoiceStatus().catch(() => {});
    };

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [enabled, socket, refreshVoiceStatus]);

  return { voiceStatus, refreshVoiceStatus };
}
