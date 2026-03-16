# macOS Release Signing

The macOS direct-download build should be signed with a `Developer ID Application`
certificate and notarized before release.

## What the build expects

Set `GUILD_MAC_SIGN=1` for a release build. When that flag is enabled,
Electron Forge will:

- sign the app with `packagerConfig.osxSign`
- notarize the build with `packagerConfig.osxNotarize`

The bundle identifiers used by default are:

- app bundle id: `is.1984.guild`
- helper bundle id: `is.1984.guild.helper`

Override the app bundle id if needed:

```bash
export GUILD_MAC_BUNDLE_ID="your.bundle.id"
```

## Required Apple setup

1. Import a `Developer ID Application` certificate into the login keychain.
2. Configure notarization credentials with one of the supported methods below.

## Recommended notarization setup

Store a notarytool keychain profile once:

```bash
xcrun notarytool store-credentials "guild-notary" \
  --apple-id "YOUR_APPLE_ID" \
  --team-id "YOUR_TEAM_ID" \
  --password "YOUR_APP_SPECIFIC_PASSWORD"
```

Then build with:

```bash
cd client
GUILD_MAC_SIGN=1 \
APPLE_KEYCHAIN_PROFILE="guild-notary" \
npm run make:mac-release
```

Validate the environment first:

```bash
cd client
APPLE_KEYCHAIN_PROFILE="guild-notary" \
npm run verify:mac-release
```

## Supported notarization env vars

Preferred:

- `APPLE_KEYCHAIN_PROFILE`
- optional `APPLE_KEYCHAIN`

Alternative App Store Connect API key flow:

- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Alternative Apple ID flow:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## Verify locally

Check for a usable signing identity:

```bash
security find-identity -v -p codesigning
```

Check the finished app:

```bash
codesign -dv --verbose=4 out/guild-darwin-arm64/guild.app
spctl -a -vv out/guild-darwin-arm64/guild.app
```
