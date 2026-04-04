import { recordLaneDiagnostic } from './laneDiagnostics.js';

const MAX_NOTIFICATION_BODY_LENGTH = 140;

export function isAppWindowForegrounded() {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function summarizeNotificationBody(message, fallback = '') {
  const normalized = String(message || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return String(fallback || '').trim();
  if (normalized.length <= MAX_NOTIFICATION_BODY_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_NOTIFICATION_BODY_LENGTH - 3).trimEnd()}...`;
}

export async function showSystemNotification({ title, body = '', route = null } = {}) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) return false;

  const electronNotifier = window.electronAPI?.showSystemNotification;
  if (typeof electronNotifier !== 'function') {
    recordLaneDiagnostic('platform', 'system_notification_unavailable', {
      title: normalizedTitle,
      routeType: route?.type || null,
    });
    return false;
  }

  try {
    const shown = !!(await electronNotifier({
      title: normalizedTitle,
      body: summarizeNotificationBody(body),
      route: route && typeof route === 'object' ? route : null,
    }));
    recordLaneDiagnostic('platform', 'system_notification_attempt', {
      title: normalizedTitle,
      routeType: route?.type || null,
      shown,
    });
    return shown;
  } catch {
    recordLaneDiagnostic('platform', 'system_notification_error', {
      title: normalizedTitle,
      routeType: route?.type || null,
    });
    return false;
  }
}
