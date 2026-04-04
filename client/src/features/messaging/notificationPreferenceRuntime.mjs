export const GLOBAL_NOTIFICATION_MUTE_KEY = 'notify:muteAll';
export const ROOM_NOTIFICATION_MUTE_KEY = 'notify:muteRooms';
export const DM_NOTIFICATION_MUTE_KEY = 'notify:muteDMs';

export function resolveNotificationPreferenceStorage(storage = null, {
  windowObject = globalThis.window,
} = {}) {
  if (storage) return storage;
  if (typeof windowObject === 'undefined' || !windowObject) return null;
  return windowObject.localStorage || null;
}

export function readBooleanNotificationPreference(storage, key) {
  try {
    return storage?.getItem?.(key) === 'true';
  } catch {
    return false;
  }
}

export function readNotificationMutePreferences(storage = null, options = {}) {
  const resolvedStorage = resolveNotificationPreferenceStorage(storage, options);
  const muteRooms = readBooleanNotificationPreference(resolvedStorage, ROOM_NOTIFICATION_MUTE_KEY);
  const muteDMs = readBooleanNotificationPreference(resolvedStorage, DM_NOTIFICATION_MUTE_KEY);
  const muteAll = readBooleanNotificationPreference(resolvedStorage, GLOBAL_NOTIFICATION_MUTE_KEY)
    || (muteRooms && muteDMs);

  return {
    muteAll,
    muteRooms,
    muteDMs,
  };
}

export function setGlobalNotificationsMuted(muted, storage = null, options = {}) {
  const resolvedStorage = resolveNotificationPreferenceStorage(storage, options);
  const serialized = muted ? 'true' : 'false';

  try {
    resolvedStorage?.setItem?.(GLOBAL_NOTIFICATION_MUTE_KEY, serialized);
    resolvedStorage?.setItem?.(ROOM_NOTIFICATION_MUTE_KEY, serialized);
    resolvedStorage?.setItem?.(DM_NOTIFICATION_MUTE_KEY, serialized);
  } catch {}

  return readNotificationMutePreferences(resolvedStorage, options);
}
