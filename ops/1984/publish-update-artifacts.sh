#!/usr/bin/env bash
set -euo pipefail

SSH_TARGET="${GUILD_1984_SSH_TARGET:-}"
HOST="${GUILD_1984_HOST:-}"
USER="${GUILD_1984_USER:-}"
SSH_KEY="${GUILD_1984_SSH_KEY:-}"
TARGET="${GUILD_1984_TARGET:-production}"
VERSION=""
MANIFEST=""
PROOF=""
APPLY=0
ARTIFACTS=()

usage() {
  cat <<'EOF'
Usage: ops/1984/publish-update-artifacts.sh [--apply] --manifest /absolute/path/to/client-version.json --proof /absolute/path/to/release-proof.json [--version X.Y.Z] [--target staging|production] <zip> [<zip>...]

Dry-run by default. This stages update ZIPs plus the full client-version.json
manifest and validated release proof, backs up the live manifest on the server,
and installs everything to the existing FlokiNET host with sudo.
EOF
}

while (($#)); do
  case "$1" in
    --apply)
      APPLY=1
      ;;
    --version)
      VERSION="${2:-}"
      shift
      ;;
    --manifest)
      MANIFEST="${2:-}"
      shift
      ;;
    --proof)
      PROOF="${2:-}"
      shift
      ;;
    --target)
      TARGET="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ARTIFACTS+=("$1")
      ;;
  esac
  shift
done

if [[ -z "$MANIFEST" ]]; then
  echo "--manifest is required" >&2
  exit 1
fi

if [[ "$APPLY" -eq 1 && -z "$PROOF" ]]; then
  echo "--proof is required when using --apply" >&2
  exit 1
fi

if [[ "${#ARTIFACTS[@]}" -eq 0 ]]; then
  echo "At least one artifact path is required" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if [[ -n "$PROOF" && ! -f "$PROOF" ]]; then
  echo "Release proof not found: $PROOF" >&2
  exit 1
fi

for artifact in "${ARTIFACTS[@]}"; do
  if [[ ! -f "$artifact" ]]; then
    echo "Artifact not found: $artifact" >&2
    exit 1
  fi
done

case "$TARGET" in
  staging)
    REMOTE_DIR="/opt/guild-staging/server"
    ;;
  production)
    REMOTE_DIR="/opt/guild/server"
    ;;
  *)
    echo "Invalid target: $TARGET" >&2
    exit 1
    ;;
esac

if [[ -n "$SSH_TARGET" ]]; then
  REMOTE="$SSH_TARGET"
elif [[ -n "$HOST" && -n "$USER" ]]; then
  REMOTE="$USER@$HOST"
elif [[ -n "$HOST" ]]; then
  REMOTE="$HOST"
else
  REMOTE="flokinet-guild"
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to validate the manifest" >&2
  exit 1
fi

python3 - "$MANIFEST" <<'PY'
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
data = json.loads(manifest_path.read_text())

if not isinstance(data, dict):
    raise SystemExit("Manifest must be a JSON object")

if not data.get("version"):
    raise SystemExit("Manifest must include a top-level version")
PY

if [[ -z "$VERSION" ]]; then
  VERSION="$(python3 - "$MANIFEST" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text())
print(data.get("version", "unknown"))
PY
)"
fi

if [[ -n "$PROOF" ]]; then
  PROOF_VALIDATE_CMD=(
    python3
    "$PWD/scripts/validate-release-proof.py"
    --proof "$PROOF"
    --manifest "$MANIFEST"
    --release-version "$VERSION"
  )
  for artifact in "${ARTIFACTS[@]}"; do
    PROOF_VALIDATE_CMD+=(--artifact "$artifact")
  done
  "${PROOF_VALIDATE_CMD[@]}"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_NAMES=()
for artifact in "${ARTIFACTS[@]}"; do
  ARTIFACT_NAMES+=("$(basename "$artifact")")
done

if [[ "$APPLY" -eq 0 ]]; then
  echo "[dry-run] Target: $REMOTE"
  echo "[dry-run] Remote app dir: $REMOTE_DIR"
  echo "[dry-run] Manifest: $MANIFEST"
  if [[ -n "$PROOF" ]]; then
    echo "[dry-run] Release proof: $PROOF"
  else
    echo "[dry-run] Release proof: not provided"
  fi
  echo "[dry-run] Release label: $VERSION"
  for artifact in "${ARTIFACTS[@]}"; do
    echo "[dry-run] Would upload artifact: $artifact -> $REMOTE_DIR/updates/$(basename "$artifact")"
  done
  echo "[dry-run] Would back up remote manifest to: $REMOTE_DIR/client-version.json.backup-$STAMP"
  echo "[dry-run] Would install manifest to: $REMOTE_DIR/client-version.json"
  if [[ -n "$PROOF" ]]; then
    echo "[dry-run] Would archive release proof to: $REMOTE_DIR/release-proofs/${VERSION}-${STAMP}.json"
  fi
  exit 0
fi

echo "[apply] Publishing release label $VERSION to $REMOTE:$REMOTE_DIR"

REMOTE_STAGE_DIR="$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "mktemp -d /tmp/guild-release.XXXXXX"
)"

cleanup_remote_stage() {
  ssh "${SSH_OPTS[@]}" "$REMOTE" "rm -rf '$REMOTE_STAGE_DIR'" >/dev/null 2>&1 || true
}
trap cleanup_remote_stage EXIT

scp "${SSH_OPTS[@]}" "$MANIFEST" "$REMOTE:$REMOTE_STAGE_DIR/client-version.json"
if [[ -n "$PROOF" ]]; then
  scp "${SSH_OPTS[@]}" "$PROOF" "$REMOTE:$REMOTE_STAGE_DIR/release-proof.json"
fi
for artifact in "${ARTIFACTS[@]}"; do
  scp "${SSH_OPTS[@]}" "$artifact" "$REMOTE:$REMOTE_STAGE_DIR/"
done

ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s -- "$REMOTE_DIR" "$REMOTE_STAGE_DIR" "$STAMP" "$VERSION" "${ARTIFACT_NAMES[@]}" <<'EOF'
set -euo pipefail

remote_dir="$1"
stage_dir="$2"
stamp="$3"
release_version="$4"
shift 4

sudo cp "$remote_dir/client-version.json" "$remote_dir/client-version.json.backup-$stamp"
sudo mkdir -p "$remote_dir/release-proofs"
for artifact_name in "$@"; do
  sudo install -m 644 "$stage_dir/$artifact_name" "$remote_dir/updates/$artifact_name"
done
sudo install -m 644 "$stage_dir/client-version.json" "$remote_dir/client-version.json"
if [[ -f "$stage_dir/release-proof.json" ]]; then
  sudo install -m 644 "$stage_dir/release-proof.json" "$remote_dir/release-proofs/${release_version}-${stamp}.json"
fi

echo "Installed manifest:"
sudo ls -l "$remote_dir/client-version.json"
echo "Installed artifacts:"
for artifact_name in "$@"; do
  sudo ls -l "$remote_dir/updates/$artifact_name"
done
if [[ -f "$stage_dir/release-proof.json" ]]; then
  echo "Installed release proof:"
  sudo ls -l "$remote_dir/release-proofs/${release_version}-${stamp}.json"
fi
EOF

echo "[apply] Backed up manifest to $REMOTE_DIR/client-version.json.backup-$STAMP"
if [[ -n "$PROOF" ]]; then
  echo "[apply] Archived release proof to $REMOTE_DIR/release-proofs/${VERSION}-${STAMP}.json"
fi
echo "[apply] Release publish completed for $VERSION"
