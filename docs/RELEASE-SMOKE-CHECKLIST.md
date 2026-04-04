# /guild Release Smoke Checklist

Use this on the exact packaged artifacts before production metadata is flipped.

## 1. Preflight

- clean release workspace confirmed
- exact client file list confirmed
- exact server file list confirmed
- artifact path to be published is final
- target platform build host is known

## 2. Artifact Gates

- `npm run verify:client-version -- /absolute/path/to/server/client-version.json`
- `npm run verify:packaged-runtime -- /absolute/path/to/guild-<platform>-<version>.zip`
- `npm run verify:lane-markers -- /absolute/path/to/guild-<platform>-<version>.zip`
- `npm run verify:mac-update-zip -- /absolute/path/to/guild-darwin-arm64-<version>.zip` when shipping Mac
- `npm run verify:windows-update-zip -- /absolute/path/to/guild-win32-x64-<version>.zip` when shipping Windows

## 3. Target-OS Startup Proof

### Mac

- packaged app launches
- no main-process crash
- signed/notarized app is accepted

### Windows

- exact published zip extracted into a fresh folder
- `guild.exe` launches
- no `ERR_MODULE_NOT_FOUND`
- no `Unable to locate ...`
- no missing native module crash
- secure startup reaches login/home

## 4. Core Lane Smoke

- fresh login works
- restored session relaunch works
- lowest-rank member can read `/guildchat`
- lowest-rank member can post in `/guildchat`
- `/guildchat` mention reaches the target user
- DM send/receive works
- DM notification path works
- hidden/minimized OS notification path works

## 5. Voice Lane Smoke

- Mac to Mac voice works when Mac ships
- Windows to Windows voice works when Windows ships
- Mac to Windows voice works when voice/media/runtime packaging changed
- mute, unmute, deafen, and undeafen behave correctly

## 6. Update Path

- previous production Mac updates to the new Mac build
- previous production Windows updates to the new Windows build

## 7. Publish Gate

- uploaded live URL returns `200`
- version API returns the intended version for every affected platform
- build tested is the build published

## 8. Sign-Off

Record before ship:

- tested artifact paths
- release proof path
- who ran the smoke
- which two clients were used
- what was explicitly not tested
- why any waived item is acceptable

If any required item fails or is missing, the release is stop-ship.
