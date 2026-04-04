export const mobileReadyNow = [
  'Expo workspace and environment-driven app config',
  'Dedicated TestFlight iOS build lane',
  'Dedicated Android APK build lane for Zapstore',
  'Server diagnostics for version and auth challenge checks',
  'Authenticated mobile browser for guilds, rooms, DMs, and message history',
];

export const mobileMvpTracks = [
  {
    title: 'Secure Messaging Interop',
    items: [
      'Replace the Electron signal bridge with a mobile-native crypto bridge backed by iOS Keychain and Android Keystore.',
      'Port the key-service routes and sender-key sync so mobile can decrypt the current desktop-encrypted payloads.',
      'Restore interoperable encrypted send and receive flows for rooms and direct messages.',
    ],
  },
  {
    title: 'Push And Read State',
    items: [
      'Add a server-backed unread badge model so mobile counts stay correct across reconnects and devices.',
      'Register APNs and FCM tokens, then deliver push notifications for mentions, rooms, and direct messages.',
      'Wire deep links from notifications into guild, room, and DM navigation.',
    ],
  },
  {
    title: 'Attachments And Presence',
    items: [
      'Rebuild attachment upload, download, and preview flows with mobile-safe file handling.',
      'Add presence polish, reconnect handling, and local caching for unstable mobile networks.',
      'Treat voice and screen share as follow-on work after secure messaging and attachments are stable.',
    ],
  },
];

export const mobileBlockers = [
  'The current desktop client still depends on window.electronAPI and window.signalCrypto.',
  'Encrypted send and decrypt still depend on a mobile-native crypto bridge and key-service interop.',
  'Unread badges and push delivery do not yet have a mobile-native server path.',
  'Voice and screen share rely on desktop-specific Electron runtime capabilities.',
];

export const mobileMvpPriority = [
  'Priority 1: mobile crypto bridge, secure storage hardening, and encrypted message decryption.',
  'Priority 2: sender-key sync plus key-service interop for encrypted room and DM sending.',
  'Priority 3: push notifications, unread counts, and deep-link navigation.',
  'Priority 4: attachment upload and download with mobile-safe media handling.',
  'Priority 5: reconnect polish, offline cache, and presence quality improvements.',
  'Priority 6: voice, calling, and any future screen-share work.',
];
