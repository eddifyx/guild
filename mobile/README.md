# /guild Mobile

`mobile/` is the new Expo-managed workspace for `/guild` on iOS and Android.
It gives us a real TestFlight and Zapstore build lane without trying to ship
the Electron desktop runtime inside a mobile store package.

## What This Is

- A managed Expo app scaffold
- EAS build profiles for TestFlight, preview APKs, and Zapstore APK releases
- Environment-driven iOS and Android identifiers
- A first authenticated mobile browser for nsec login, guilds, rooms, DMs, and message history

## What This Is Not Yet

- A complete port of the Electron secure messaging runtime
- A drop-in replacement for the desktop client

The current secure crypto bridge, secure persistence, voice helpers, and
desktop capture flows still live in `client/electron/`.

The current mobile browser does not decrypt the existing encrypted message
payloads yet. It is a foundation for the mobile port, not the finished secure
messaging client.

## Setup

```bash
cp .env.example .env
npm install
```

Set the identifiers in `.env` before your first TestFlight or Zapstore build:

- `GUILD_MOBILE_BUNDLE_ID`
- `GUILD_MOBILE_ANDROID_PACKAGE`
- `EXPO_OWNER`
- `EAS_PROJECT_ID`

## Development

```bash
npx expo start
npx expo start --ios
npx expo start --android
```

## Release

```bash
npx eas build --platform ios --profile testflight
npx eas build --platform android --profile zapstore
```

Publish the Android build to Zapstore:

```bash
npx eas submit --platform ios --profile testflight
zsp publish --wizard
```

For Android device testing outside the store flow:

```bash
npx eas build --platform android --profile preview
```
