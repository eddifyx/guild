# /guild Release Proof

Every production publish now requires a machine-validated release proof JSON.

This file exists so we cannot publish a desktop build based on memory or
assumptions. It records:

- what version is being shipped
- what files changed
- what artifacts were validated
- what startup proof exists on the real target OS
- what smoke checks passed
- who approved ship

## Why This Exists

We already proved that all of these can be true at once:

- source code looks correct
- artifact validators partially pass
- packaged app still fails on startup on the target OS

The release proof file closes that gap by making startup proof and lane smoke a
required input to the publish step.

## Required Fields

- `releaseVersion`
- `releaseType`
- `baselineVersion`
- `workspacePath`
- `clientFilesChanged`
- `serverFilesChanged`
- `approvedBy`
- `shipDecision`
- `artifacts`

Each artifact entry must include:

- `platform`
- `version`
- `path`
- `sha256`
- `validators`
- `startupProof`
- `smokeChecklist`

## Required Validator Status

Every artifact must record:

- `packagedRuntime: "passed"`
- `laneMarkers: "passed"`
- `macUpdateZip: "passed"` for Mac artifacts
- `windowsUpdateZip: "passed"` for Windows artifacts

## Required Startup Proof

Every artifact must record:

- `status: "passed"`
- `tester`
- `environment`
- `method`

This is where we capture the real target-OS launch proof.

## Required Smoke Checklist

Every artifact must mark these as `"passed"`:

- `freshLogin`
- `restoredSession`
- `guildchatPost`
- `guildchatMention`
- `dmNotifications`
- `osNotifications`
- `voice`
- `updatePath`

## Example

```json
{
  "releaseVersion": "1.0.71",
  "releaseType": "recovery",
  "baselineVersion": "1.0.69",
  "workspacePath": "/Users/eddifyx/Documents/Projects/guild-main",
  "clientFilesChanged": [
    "client/.vite/build/main.js",
    "client/config/appFlavor.js"
  ],
  "serverFilesChanged": [
    "server/client-version.json"
  ],
  "approvedBy": "eddifyx",
  "shipDecision": "approved",
  "recoveryReason": "Windows 1.0.70 missed runtime-managed config files in app.asar.",
  "artifacts": [
    {
      "platform": "win32-x64",
      "version": "1.0.71",
      "path": "/Users/eddifyx/Documents/Projects/guild-main/client/out/manual-release-1.0.71/guild-win32-x64-1.0.71.zip",
      "sha256": "replace-with-real-sha256",
      "validators": {
        "packagedRuntime": "passed",
        "laneMarkers": "passed",
        "windowsUpdateZip": "passed"
      },
      "startupProof": {
        "status": "passed",
        "tester": "eddifyx",
        "environment": "Windows 11",
        "method": "Fresh extract and launch guild.exe",
        "notes": "Reached login without main-process crash."
      },
      "smokeChecklist": {
        "freshLogin": "passed",
        "restoredSession": "passed",
        "guildchatPost": "passed",
        "guildchatMention": "passed",
        "dmNotifications": "passed",
        "osNotifications": "passed",
        "voice": "passed",
        "updatePath": "passed"
      }
    }
  ]
}
```

## Draft Generator

Start from a real artifact and manifest snapshot:

```bash
npm run create:release-proof -- \
  --manifest /absolute/path/to/server/client-version.json \
  --output /absolute/path/to/release-proofs/1.0.71.json \
  --release-version 1.0.71 \
  --baseline-version 1.0.69 \
  --release-type recovery \
  --recovery-reason "Windows 1.0.70 missed runtime-managed config files in app.asar." \
  --artifact /absolute/path/to/guild-win32-x64-1.0.71.zip \
  --client-file /absolute/path/to/client/.vite/build/main.js \
  --client-file /absolute/path/to/client/config/appFlavor.js \
  --server-file /absolute/path/to/server/client-version.json
```

The generator will:

- compute artifact SHA256 hashes
- infer artifact platforms
- map artifact versions from the manifest
- prefill the required proof structure

It intentionally leaves validator results, startup proof, smoke proof, and
`shipDecision` as `pending` so we still have to complete the real qualification.

## Validation

Run:

```bash
npm run verify:release-proof -- --proof /absolute/path/to/release-proof.json --manifest /absolute/path/to/server/client-version.json --release-version X.Y.Z --artifact /absolute/path/to/artifact.zip
```

## Publish

The production helper now requires the proof file on `--apply`:

```bash
bash ops/1984/publish-update-artifacts.sh \
  --apply \
  --manifest /absolute/path/to/server/client-version.json \
  --proof /absolute/path/to/release-proof.json \
  --version X.Y.Z \
  --target production \
  /absolute/path/to/artifact.zip
```

The proof file is archived on the server under `release-proofs/` along with the
release manifest backup.
