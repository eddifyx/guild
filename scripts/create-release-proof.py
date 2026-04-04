#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


VALID_PLATFORMS = {
    "darwin-arm64": "macUpdateZip",
    "win32-x64": "windowsUpdateZip",
}

REQUIRED_SMOKE_CHECKS = (
    "freshLogin",
    "restoredSession",
    "guildchatPost",
    "guildchatMention",
    "dmNotifications",
    "osNotifications",
    "voice",
    "updatePath",
)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_json(path: Path) -> Dict:
    if not path.is_file():
        fail(f"file not found: {path}")
    try:
        data = json.loads(path.read_text())
    except Exception as exc:
        fail(f"unable to parse JSON at {path}: {exc}")
    if not isinstance(data, dict):
        fail(f"JSON file must contain an object: {path}")
    return data


def sha256_for(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_paths(paths: List[str]) -> List[str]:
    return sorted(dict.fromkeys(str(Path(path).resolve()) for path in paths if path))


def infer_platform(artifact_path: Path) -> str:
    normalized = artifact_path.name.lower()
    if "darwin-arm64" in normalized:
        return "darwin-arm64"
    if "win32-x64" in normalized:
        return "win32-x64"
    fail(
        f"unable to infer artifact platform from filename: {artifact_path.name} "
        "(expected darwin-arm64 or win32-x64 in the filename)"
    )


def resolve_manifest_version(manifest: Dict, platform: str) -> str:
    base_version = manifest.get("version")
    if not isinstance(base_version, str) or not base_version.strip():
        fail("manifest must include a top-level version")
    platform_overrides = manifest.get("platformOverrides")
    if isinstance(platform_overrides, dict):
        override = platform_overrides.get(platform)
        if isinstance(override, dict):
            override_version = override.get("version")
            if isinstance(override_version, str) and override_version.strip():
                return override_version.strip()
    return base_version.strip()


def build_artifact_entry(artifact_path: Path, manifest: Dict) -> Dict:
    platform = infer_platform(artifact_path)
    platform_validator = VALID_PLATFORMS[platform]
    validators = {
        "packagedRuntime": "pending",
        "laneMarkers": "pending",
        platform_validator: "pending",
    }
    smoke_checklist = {key: "pending" for key in REQUIRED_SMOKE_CHECKS}
    return {
        "platform": platform,
        "version": resolve_manifest_version(manifest, platform),
        "path": str(artifact_path.resolve()),
        "sha256": sha256_for(artifact_path),
        "validators": validators,
        "startupProof": {
            "status": "pending",
            "tester": "",
            "environment": "",
            "method": "",
            "notes": "",
        },
        "smokeChecklist": smoke_checklist,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a draft /guild release proof JSON")
    parser.add_argument("--manifest", required=True, help="Path to server/client-version.json")
    parser.add_argument("--output", required=True, help="Where to write the draft proof JSON")
    parser.add_argument("--release-version", required=True, help="Release label for this publish step")
    parser.add_argument("--baseline-version", required=True, help="Last known-good production baseline")
    parser.add_argument("--release-type", choices=("normal", "recovery"), default="normal")
    parser.add_argument("--recovery-reason", default="", help="Why this is a recovery release")
    parser.add_argument("--workspace", default=os.getcwd(), help="Release workspace path")
    parser.add_argument("--approved-by", default=os.environ.get("USER", ""), help="Approver name")
    parser.add_argument("--client-file", action="append", default=[], help="Changed client file (repeatable)")
    parser.add_argument("--server-file", action="append", default=[], help="Changed server file (repeatable)")
    parser.add_argument("--artifact", action="append", default=[], help="Artifact path (repeatable)")
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = read_json(manifest_path)

    artifact_paths = [Path(path).resolve() for path in args.artifact]
    if not artifact_paths:
        fail("at least one --artifact is required")
    for artifact_path in artifact_paths:
        if not artifact_path.is_file():
            fail(f"artifact not found: {artifact_path}")

    if args.release_type == "recovery" and not args.recovery_reason.strip():
        fail("--recovery-reason is required when --release-type recovery is used")

    proof = {
        "releaseVersion": args.release_version.strip(),
        "releaseType": args.release_type,
        "baselineVersion": args.baseline_version.strip(),
        "workspacePath": str(Path(args.workspace).resolve()),
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "clientFilesChanged": normalize_paths(args.client_file),
        "serverFilesChanged": normalize_paths(args.server_file),
        "approvedBy": args.approved_by.strip(),
        "shipDecision": "pending",
        "notes": "",
        "artifacts": [build_artifact_entry(path, manifest) for path in artifact_paths],
    }

    if args.release_type == "recovery":
        proof["recoveryReason"] = args.recovery_reason.strip()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(proof, indent=2) + "\n")

    print("release proof draft created:")
    print(f"  {output_path}")


if __name__ == "__main__":
    main()
