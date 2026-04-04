# Mac Staging Screen Capture Permissions

## Problem

On macOS, Screen Recording for the staging app can appear "enabled" in System Settings while the app still gets prompted again, or fails to start capture. This happened repeatedly during staging work because we were launching rebuilt ad-hoc app copies from `client/out/...`.

## Root Cause

macOS TCC ties Screen Recording trust to the exact app identity and code requirement. Rebuilt ad-hoc copies of `guild-staging.app` do not present a stable trust identity, so:

- System Settings may show an older `guild-staging` record as enabled
- the currently launched rebuilt app may still be treated as a new/untrusted binary
- Screen Recording prompts can reappear even though the toggle looks on

## Stable Fix

Use a single Developer ID signed staging app installed at:

`/Applications/guild-staging.app`

Build and install it with:

```bash
cd client
npm run install:mac-staging-app
```

That script:

- packages the staging flavor
- signs it with the local Developer ID identity
- installs it to `/Applications/guild-staging.app`

## One-Time Reset When TCC Gets Stale

If Screen Recording was previously granted to an ad-hoc staging build, reset the staging bundle id once:

```bash
tccutil reset ScreenCapture is.1984.guild.staging
```

Then:

1. Open `/Applications/guild-staging.app`
2. Grant Screen Recording access
3. Fully quit the app
4. Reopen `/Applications/guild-staging.app`

## Operational Rule Going Forward

For any permission-sensitive Mac staging testing:

- always use `/Applications/guild-staging.app`
- do **not** use ad-hoc app copies directly from `client/out/...`
- after staging code changes, refresh the installed app with:

```bash
cd client
npm run install:mac-staging-app
```

## Note On Duplicate macOS Prompts

If macOS shows more than one permission prompt during share setup, treat that as an OS-level prompt sequence, not a `/guild` in-app dialog bug. The important part is that the trusted installed staging app should stop the recurring stale-TCC loop where prompts keep coming back on every rebuild.
