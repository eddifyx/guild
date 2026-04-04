import { playMessageChime } from '../../utils/chime.js';
import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import { isAppWindowForegrounded, showSystemNotification, summarizeNotificationBody } from '../../utils/systemNotifications.js';
import {
  readNotificationMutePreferences,
} from './notificationPreferenceRuntime.mjs';

export * from './notificationPolicyCore.mjs';
export * from './notificationPreferenceRuntime.mjs';

export function getMessagingNotificationContext({
  activeConversation = null,
  currentGuild = null,
  guildChatVisible = false,
  storage = null,
} = {}) {
  return {
    activeConversation,
    currentGuild,
    guildChatVisible,
    appForegrounded: isAppWindowForegrounded(),
    ...readNotificationMutePreferences(storage),
  };
}

export async function presentMessagingNotification({
  descriptor,
  diagnosticLane = 'messaging',
  diagnosticEvent = 'notification_requested',
  diagnosticContext = {},
} = {}) {
  if (!descriptor?.title) return false;

  recordLaneDiagnostic(diagnosticLane, diagnosticEvent, {
    routeType: descriptor.route?.type || null,
    ...diagnosticContext,
  });

  void playMessageChime();

  return showSystemNotification({
    title: descriptor.title,
    body: summarizeNotificationBody(descriptor.body, descriptor.fallbackBody),
    route: descriptor.route,
  });
}
