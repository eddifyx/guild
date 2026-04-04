# /guild Mobile App Runbook

This runbook covers the new `mobile/` workspace for iOS and Android packaging.
It is the right lane for TestFlight and Zapstore distribution.

## What Exists Now

- `client/` is still an Electron desktop app.
- `mobile/` is a new Expo-managed app scaffold with EAS build profiles for:
  - iOS TestFlight builds and submission
  - Android signed APK builds for Zapstore publication
  - Android preview APK builds for direct device testing
  - a first authenticated browser flow for nsec login, guilds, rooms, DMs, and message history

## Current Mobile MVP State

The mobile app can now:

- sign in with `nsec`
- persist the mobile session token
- connect a socket with `auth.token`
- browse guilds, rooms, DM conversations, and message history
- verify `/api/version` and `/api/auth/nostr/challenge`

The mobile app cannot yet:

- decrypt the current encrypted room or DM payloads
- send interoperable encrypted messages
- handle push notifications, voice, or screen share

## Why The Desktop Client Cannot Go Straight To The Stores

The current desktop app depends on Electron-native runtime surfaces:

- [`client/electron/preload.js`](/Users/eddifyx/Documents/Projects/guild-main/client/electron/preload.js) exposes `window.electronAPI` and `window.signalCrypto`.
- [`client/electron/main.js`](/Users/eddifyx/Documents/Projects/guild-main/client/electron/main.js) owns secure persistence, update delivery, screen capture, native notifications, and voice helper processes.
- [`client/src/crypto/signalClient.js`](/Users/eddifyx/Documents/Projects/guild-main/client/src/crypto/signalClient.js) routes the secure messaging lifecycle through Electron IPC instead of a mobile-native bridge.

Because of that, the Electron renderer cannot be submitted to TestFlight or
Zapstore as-is. The mobile app needs its own native secure runtime.

## Mobile Workspace Setup

From the repo root:

```bash
cp mobile/.env.example mobile/.env
npm --prefix mobile install
```

Then edit `mobile/.env` with your real identifiers:

- `GUILD_MOBILE_BUNDLE_ID`
- `GUILD_MOBILE_ANDROID_PACKAGE`
- `EXPO_OWNER`
- `EAS_PROJECT_ID` after `eas init`

## Local Mobile Commands

From the repo root:

```bash
npm run mobile:start
npm run mobile:ios
npm run mobile:android
```

Or from inside `mobile/`:

```bash
npx expo start
```

## TestFlight Build Flow

1. Log in to Expo and initialize EAS for the project.
2. Build the iOS TestFlight binary:

```bash
cd mobile
npx eas login
npx eas build --platform ios --profile testflight
```

3. Submit the build to App Store Connect / TestFlight:

```bash
npx eas submit --platform ios --profile testflight
```

If you prefer, you can also upload the generated archive manually in Apple's
tooling after the build finishes.

## Android Zapstore Flow

1. Build the signed Android APK:

```bash
cd mobile
npx eas build --platform android --profile zapstore
```

2. Publish it to Zapstore with the Zapstore CLI:

```bash
zsp publish --wizard
```

Zapstore's current developer docs describe APK-based publishing, not a Google
Play AAB submission flow.

For direct device testing before publishing, build a preview APK:

```bash
cd mobile
npx eas build --platform android --profile preview
```

## Remaining Engineering Work

The new `mobile/` app is a release scaffold, not a finished `/guild` mobile
client. The next implementation milestones are:

1. Replace the Electron `window.signalCrypto` bridge with a mobile-native crypto bridge backed by iOS Keychain, Android Keystore, and mobile-safe storage.
2. Port the key-service and sender-key sync paths so mobile can decrypt and send messages that interoperate with the current encrypted desktop client.
3. Add a server-backed unread model, APNs and FCM registration, and push delivery for mobile notifications.
4. Rebuild attachments, deep linking, offline cache, and reconnect behavior with mobile-native APIs.
5. Expand presence polish after the secure messaging base is stable.
6. Leave voice and screen share until the secure messaging and media layers are production-safe on mobile.

## Concrete MVP Surface

The server already exposes most of the mobile MVP surface:

- Auth: `/api/auth/nostr/challenge`, `/api/auth/nostr`, `/api/auth/logout`
- Guilds: `/api/guilds`, `/api/guilds/public`, `/api/guilds/:id`, `/api/guilds/:id/join`, `/api/guilds/join/:inviteCode`, `/api/guilds/:id/leave`
- Rooms: `/api/rooms`, `/api/rooms/mine`, `/api/rooms/:id/join`, `/api/rooms/:id/leave`
- Messages: `/api/messages/room/:roomId`, `/api/messages/dm/:otherUserId`, `/api/dm/conversations`
- Presence: websocket `presence:request`, `status:update`, emitted `presence:update`
- Encrypted interop: `/api/keys/*`, room sender-key routes, and related socket events

Current likely gaps for store-ready mobile behavior:

- No server-backed unread badge model for reliable mobile counts
- No APNs or FCM registration and push delivery path yet
- No mobile-native storage or crypto bridge replacing Electron

## References

- [Expo default template](https://raw.githubusercontent.com/expo/expo-template-default/main/package.json)
- [Expo EAS Android build formats](https://docs.expo.dev/build-reference/apk/)
- [Zapstore developers overview](https://zapstore.dev/developers)
- [Zapstore publishing guide](https://zapstore.dev/developers/publish)
- [Zapstore FAQ](https://zapstore.dev/docs/faq)
- [Expo submit to the Apple App Store](https://docs.expo.dev/submit/ios/)
