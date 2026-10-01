#!/usr/bin/env bash
# EAS build post-success hook. Runs after a successful EAS Build. We use
# it to run a final typecheck and upload the build artifact metadata.
set -euo pipefail

echo "[eas-build-on-success] verifying build..."
cd "$EAS_PROJECT_ROOT/../.."
npx --workspaces=false tsc --noEmit
echo "[eas-build-on-success] OK"
