#!/usr/bin/env python3

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

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


def read_json(path_str: str) -> dict:
    path = Path(path_str)
    if not path.is_file():
        fail(f"file not found: {path}")
    try:
      data = json.loads(path.read_text())
    except Exception as exc:
      fail(f"unable to parse JSON at {path}: {exc}")
    if not isinstance(data, dict):
      fail(f"JSON file must contain an object: {path}")
    return data


def require_str(container: dict, key: str, context: str) -> str:
    value = container.get(key)
    if not isinstance(value, str) or not value.strip():
        fail(f"{context} must include a non-empty string for '{key}'")
    return value.strip()


def require_list(container: dict, key: str, context: str) -> list:
    value = container.get(key)
    if not isinstance(value, list):
        fail(f"{context} must include a list for '{key}'")
    return value


def sha256_for(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_manifest_version(manifest: dict, platform: str) -> str:
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


def validate_release_proof(proof: dict, manifest: dict, expected_release_version: Optional[str], required_artifacts: List[str]) -> None:
    release_version = require_str(proof, "releaseVersion", "release proof")
    release_type = require_str(proof, "releaseType", "release proof")
    if release_type not in {"normal", "recovery"}:
        fail("release proof 'releaseType' must be 'normal' or 'recovery'")
    if expected_release_version and release_version != expected_release_version:
        fail(
            f"release proof version {release_version} does not match expected release version {expected_release_version}"
        )

    require_str(proof, "baselineVersion", "release proof")
    require_str(proof, "workspacePath", "release proof")
    require_str(proof, "approvedBy", "release proof")

    ship_decision = require_str(proof, "shipDecision", "release proof")
    if ship_decision.lower() != "approved":
        fail("release proof 'shipDecision' must be 'approved'")

    if release_type == "recovery":
        require_str(proof, "recoveryReason", "recovery release proof")

    client_files_changed = require_list(proof, "clientFilesChanged", "release proof")
    server_files_changed = require_list(proof, "serverFilesChanged", "release proof")
    if not client_files_changed and not server_files_changed:
        fail("release proof must record at least one changed client or server file")

    artifacts = require_list(proof, "artifacts", "release proof")
    if not artifacts:
        fail("release proof must include at least one artifact entry")

    indexed_artifacts: dict[str, dict] = {}
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            fail("release proof artifact entries must be objects")
        artifact_path_str = require_str(artifact, "path", "artifact")
        artifact_path = Path(artifact_path_str).resolve()
        if not artifact_path.is_file():
            fail(f"artifact path in release proof does not exist: {artifact_path}")

        platform = require_str(artifact, "platform", "artifact")
        if platform not in VALID_PLATFORMS:
            fail(f"unsupported artifact platform in release proof: {platform}")

        artifact_version = require_str(artifact, "version", "artifact")
        manifest_version = resolve_manifest_version(manifest, platform)
        if artifact_version != manifest_version:
            fail(
                f"artifact version {artifact_version} for {platform} does not match manifest version {manifest_version}"
            )

        checksum = require_str(artifact, "sha256", "artifact").lower()
        actual_checksum = sha256_for(artifact_path)
        if checksum != actual_checksum:
            fail(
                f"artifact sha256 mismatch for {artifact_path}: expected {checksum}, got {actual_checksum}"
            )

        validators = artifact.get("validators")
        if not isinstance(validators, dict):
            fail(f"artifact validators must be an object for {artifact_path}")
        for validator_name in ("packagedRuntime", "laneMarkers", VALID_PLATFORMS[platform]):
            if validators.get(validator_name) != "passed":
                fail(
                    f"artifact {artifact_path} must mark validator '{validator_name}' as 'passed'"
                )

        startup_proof = artifact.get("startupProof")
        if not isinstance(startup_proof, dict):
            fail(f"artifact startupProof must be an object for {artifact_path}")
        if startup_proof.get("status") != "passed":
            fail(f"artifact startupProof must be marked passed for {artifact_path}")
        for key in ("tester", "environment", "method"):
            require_str(startup_proof, key, f"startupProof for {artifact_path}")

        smoke = artifact.get("smokeChecklist")
        if not isinstance(smoke, dict):
            fail(f"artifact smokeChecklist must be an object for {artifact_path}")
        for key in REQUIRED_SMOKE_CHECKS:
            if smoke.get(key) != "passed":
                fail(
                    f"artifact smokeChecklist must mark '{key}' as 'passed' for {artifact_path}"
                )

        indexed_artifacts[str(artifact_path)] = artifact

    for required_artifact in required_artifacts:
        required_path = str(Path(required_artifact).resolve())
        if required_path not in indexed_artifacts:
            fail(f"release proof is missing artifact entry for {required_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate /guild release proof metadata")
    parser.add_argument("--proof", required=True, help="Path to the release proof JSON file")
    parser.add_argument("--manifest", required=True, help="Path to server/client-version.json")
    parser.add_argument("--release-version", default="", help="Expected release version label")
    parser.add_argument(
        "--artifact",
        action="append",
        default=[],
        help="Artifact path that must be covered by the proof (repeatable)",
    )
    args = parser.parse_args()

    proof = read_json(args.proof)
    manifest = read_json(args.manifest)
    validate_release_proof(
        proof=proof,
        manifest=manifest,
        expected_release_version=args.release_version.strip() or None,
        required_artifacts=args.artifact,
    )

    print("release proof validation passed:")
    print(f"  {Path(args.proof).resolve()}")


if __name__ == "__main__":
    main()
