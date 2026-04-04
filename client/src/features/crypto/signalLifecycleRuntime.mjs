export async function initializeSignalLifecycle({
  authData,
  allowDeferredBundleAttestation = false,
  signalCrypto,
  currentDeviceId = 1,
  reconcileLocalDeviceRegistrationFn,
  confirmPublishedLocalDeviceRegistrationFn,
  uploadSignedBundleFn,
  resetEncryptionKeysFn,
  isDeferredBundleAttestationErrorFn,
  runKeyMaintenanceNowFn,
  scheduleKeyMaintenanceFn,
  clearRemoteIdentityCacheFn,
  clearSessionBootstrapRecipientsFn,
  logWarnFn = console.warn,
} = {}) {
  if (!signalCrypto) {
    throw new Error('Signal crypto not available (requires Electron)');
  }

  let outboundSignalBlockedReason = null;
  let attemptedLocalSignalReset = false;
  const result = await signalCrypto.initialize(authData.userId);
  let deviceId = Number(result?.deviceId)
    || Number(await signalCrypto.getDeviceId?.())
    || Number(currentDeviceId)
    || 1;

  const localRegistration = await reconcileLocalDeviceRegistrationFn?.(authData, deviceId);
  deviceId = Number(localRegistration?.deviceId) || deviceId;
  outboundSignalBlockedReason = localRegistration?.canUploadBundle === false
    ? (localRegistration?.uploadBlockReason || 'Secure messaging is waiting for device verification.')
    : null;

  if (outboundSignalBlockedReason) {
    logWarnFn(
      '[Signal] Continuing startup with outbound secure send paused until device verification succeeds:',
      outboundSignalBlockedReason,
    );
  }

  const deferBundleAttestation = (error) => {
    const nextBlockedReason = 'Secure messaging is waiting for your Nostr signer to publish this device bundle.';
    outboundSignalBlockedReason = outboundSignalBlockedReason || nextBlockedReason;
    logWarnFn(
      '[Signal] Deferring signer-backed bundle publication until a signer is available again:',
      error?.message || error,
    );
  };

  const ensurePublishedLocalBundle = async () => {
    if (!confirmPublishedLocalDeviceRegistrationFn) {
      return;
    }

    const shouldAttemptLocalLegacyReset = (confirmation) => {
      if (Number(deviceId) !== 1) {
        return false;
      }
      const identities = Array.isArray(confirmation?.identities) ? confirmation.identities : [];
      return identities.length === 0 || identities.every((identity) => Number(identity?.deviceId) === 1);
    };

    const resetLocalBundleStateAndRetry = async () => {
      if (attemptedLocalSignalReset || typeof signalCrypto?.resetLocalState !== 'function') {
        return { recovered: false, deferred: false };
      }

      attemptedLocalSignalReset = true;
      logWarnFn(
        '[Signal] Device 1 bundle still mismatched after re-publish; resetting local Signal state and retrying once for user:',
        authData?.userId,
      );

      await signalCrypto.resetLocalState(authData?.userId);
      const resetResult = await signalCrypto.initialize(authData.userId);
      let nextDeviceId = Number(resetResult?.deviceId)
        || Number(await signalCrypto.getDeviceId?.())
        || 1;

      const localRegistration = await reconcileLocalDeviceRegistrationFn?.(authData, nextDeviceId);
      nextDeviceId = Number(localRegistration?.deviceId) || nextDeviceId;
      deviceId = nextDeviceId;
      outboundSignalBlockedReason = localRegistration?.canUploadBundle === false
        ? (localRegistration?.uploadBlockReason || 'Secure messaging is waiting for device verification.')
        : null;

      if (outboundSignalBlockedReason) {
        return { recovered: false, deferred: false };
      }

      try {
        await uploadSignedBundleFn?.(authData, {
          deviceId,
          forceFreshAttestation: true,
        });
      } catch (err) {
        if (allowDeferredBundleAttestation && isDeferredBundleAttestationErrorFn?.(err)) {
          deferBundleAttestation(err);
          return { recovered: true, deferred: true };
        }
        throw err;
      }

      return { recovered: true, deferred: false };
    };

    let confirmation = await confirmPublishedLocalDeviceRegistrationFn(authData, deviceId);
    if (confirmation?.published) {
      return;
    }

    logWarnFn(
      '[Signal] Remote device bundle missing after upload; forcing a fresh re-publish for device:',
      deviceId,
    );
    try {
      await uploadSignedBundleFn?.(authData, {
        deviceId,
        forceFreshAttestation: true,
      });
    } catch (err) {
      if (allowDeferredBundleAttestation && isDeferredBundleAttestationErrorFn?.(err)) {
        deferBundleAttestation(err);
        return;
      }
      throw err;
    }
    confirmation = await confirmPublishedLocalDeviceRegistrationFn(authData, deviceId);
    if (confirmation?.published) {
      return;
    }

    if (shouldAttemptLocalLegacyReset(confirmation)) {
      const recovery = await resetLocalBundleStateAndRetry();
      if (recovery.deferred) {
        return;
      }
      if (recovery.recovered) {
        confirmation = await confirmPublishedLocalDeviceRegistrationFn(authData, deviceId);
        if (confirmation?.published) {
          return;
        }
      }
    }

    const error = new Error(`Secure messaging could not publish this device bundle (device ${Number(deviceId) || 1}).`);
    error.retryable = true;
    throw error;
  };

  try {
    await uploadSignedBundleFn?.(authData, { deviceId });
  } catch (err) {
    if (result?.isNew && err?.message?.includes('rotation')) {
      logWarnFn('[Signal] Key mismatch - resetting server keys');
      await resetEncryptionKeysFn?.();
      await uploadSignedBundleFn?.(authData, { deviceId });
    } else if (allowDeferredBundleAttestation && isDeferredBundleAttestationErrorFn?.(err)) {
      deferBundleAttestation(err);
    } else {
      throw err;
    }
  }

  await ensurePublishedLocalBundle();

  clearRemoteIdentityCacheFn?.();
  clearSessionBootstrapRecipientsFn?.();
  if (!outboundSignalBlockedReason) {
    await runKeyMaintenanceNowFn?.();
    scheduleKeyMaintenanceFn?.();
  }

  return {
    initialized: true,
    userId: authData.userId,
    userNpub: authData.npub || null,
    deviceId,
    outboundSignalBlockedReason,
  };
}

export async function destroySignalLifecycle({
  maintenanceInterval = null,
  clearIntervalFn = clearInterval,
  signalCrypto,
  clearRemoteIdentityCacheFn,
  clearSessionBootstrapRecipientsFn,
} = {}) {
  if (maintenanceInterval) {
    clearIntervalFn(maintenanceInterval);
  }
  if (signalCrypto) {
    await signalCrypto.destroy();
  }
  clearRemoteIdentityCacheFn?.();
  clearSessionBootstrapRecipientsFn?.();
  return {
    maintenanceInterval: null,
    initialized: false,
    userId: null,
    deviceId: 1,
    userNpub: null,
    initPromise: null,
    outboundSignalBlockedReason: null,
  };
}

export async function ensureOutboundSignalLifecycleReady({
  outboundSignalBlockedReason = null,
  userId = null,
  userNpub = null,
  deviceId = 1,
  reconcileLocalDeviceRegistrationFn,
  confirmPublishedLocalDeviceRegistrationFn,
  uploadSignedBundleFn,
  runKeyMaintenanceNowFn,
  scheduleKeyMaintenanceFn,
} = {}) {
  const normalizedDeviceId = Number(deviceId) || 1;
  const authData = userId ? {
    userId,
    npub: userNpub,
  } : null;

  const republishLocalDeviceBundle = async (targetDeviceId) => {
    if (!confirmPublishedLocalDeviceRegistrationFn || !authData) {
      return false;
    }

    let confirmation = await confirmPublishedLocalDeviceRegistrationFn(authData, targetDeviceId);
    if (confirmation?.published) {
      return false;
    }

    await uploadSignedBundleFn?.(authData, {
      deviceId: targetDeviceId,
      forceFreshAttestation: true,
    });
    confirmation = await confirmPublishedLocalDeviceRegistrationFn(authData, targetDeviceId);
    if (!confirmation?.published) {
      const err = new Error(`Secure messaging could not publish this device bundle (device ${Number(targetDeviceId) || 1}).`);
      err.retryable = true;
      throw err;
    }

    await runKeyMaintenanceNowFn?.();
    scheduleKeyMaintenanceFn?.();
    return true;
  };

  if (!outboundSignalBlockedReason) {
    const performedUpload = await republishLocalDeviceBundle(normalizedDeviceId);
    return {
      deviceId: normalizedDeviceId,
      outboundSignalBlockedReason: null,
      performedUpload,
    };
  }

  if (!userId) {
    const err = new Error(outboundSignalBlockedReason);
    err.retryable = true;
    throw err;
  }

  const localRegistration = await reconcileLocalDeviceRegistrationFn?.(authData, deviceId);
  const nextDeviceId = Number(localRegistration?.deviceId) || Number(deviceId) || 1;
  const nextBlockedReason = localRegistration?.canUploadBundle === false
    ? (localRegistration?.uploadBlockReason || outboundSignalBlockedReason)
    : null;

  if (nextBlockedReason) {
    const err = new Error(nextBlockedReason);
    err.retryable = true;
    throw err;
  }

  await uploadSignedBundleFn?.(authData, { deviceId: nextDeviceId });
  await republishLocalDeviceBundle(nextDeviceId);
  await runKeyMaintenanceNowFn?.();
  scheduleKeyMaintenanceFn?.();

  return {
    deviceId: nextDeviceId,
    outboundSignalBlockedReason: null,
    performedUpload: true,
  };
}
