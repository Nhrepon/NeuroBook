#!/usr/bin/env bash
# EAS build pre-start hook. Installs workspace deps and aligns peer-deps.
set -euo pipefail

echo "[eas-build-on-start] installing workspace deps..."
cd "$EAS_PROJECT_ROOT/../.."
npm ci
echo "[eas-build-on-start] aligning Expo peer-deps..."
npx --workspaces=false -y expo install --check
echo "[eas-build-on-start] OK"
