import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AuthChallengePayload,
  fetchAuthChallenge,
  fetchServerVersion,
  ServerVersionPayload,
} from './serverApi';
import { getConfiguredApiBaseUrl } from '../../config/mobileConfig';

export function useServerDiagnostics(initialServerUrl = '') {
  const [serverUrl, setServerUrl] = useState(initialServerUrl || getConfiguredApiBaseUrl());
  const [iosVersion, setIosVersion] = useState<ServerVersionPayload | null>(null);
  const [androidVersion, setAndroidVersion] = useState<ServerVersionPayload | null>(null);
  const [challenge, setChallenge] = useState<AuthChallengePayload | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setServerUrl(initialServerUrl || getConfiguredApiBaseUrl());
  }, [initialServerUrl]);

  const run = useCallback(async <T,>(key: string, action: () => Promise<T>) => {
    setLoadingKey(key);
    setError('');
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoadingKey(null);
    }
  }, []);

  const checkIos = useCallback(async () => {
    const payload = await run('ios', () => fetchServerVersion(serverUrl, 'ios'));
    if (payload) {
      setIosVersion(payload);
    }
  }, [run, serverUrl]);

  const checkAndroid = useCallback(async () => {
    const payload = await run('android', () => fetchServerVersion(serverUrl, 'android'));
    if (payload) {
      setAndroidVersion(payload);
    }
  }, [run, serverUrl]);

  const checkChallenge = useCallback(async () => {
    const payload = await run('challenge', () => fetchAuthChallenge(serverUrl));
    if (payload) {
      setChallenge(payload);
    }
  }, [run, serverUrl]);

  const readiness = useMemo(() => ([
    {
      label: 'iOS version endpoint',
      ok: Boolean(iosVersion?.version),
      detail: iosVersion?.version || 'Not checked yet',
    },
    {
      label: 'Android version endpoint',
      ok: Boolean(androidVersion?.version),
      detail: androidVersion?.version || 'Not checked yet',
    },
    {
      label: 'Nostr auth challenge',
      ok: Boolean(challenge?.challenge),
      detail: challenge?.challenge ? 'Challenge issued successfully' : 'Not checked yet',
    },
  ]), [androidVersion?.version, challenge?.challenge, iosVersion?.version]);

  return {
    serverUrl,
    setServerUrl,
    iosVersion,
    androidVersion,
    challenge,
    loadingKey,
    error,
    readiness,
    checkIos,
    checkAndroid,
    checkChallenge,
  };
}
