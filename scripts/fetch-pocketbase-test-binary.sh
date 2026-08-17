#!/usr/bin/env bash
# Downloads the PocketBase binary used only by the test suite's integration
# tests (server/test/pocketbaseHarness.ts). Tests that need it skip
# themselves gracefully when this binary isn't present, so this is optional
# for local development but worth running before `pnpm test` for full coverage.
set -euo pipefail

VERSION="0.28.4"
DEST_DIR=".pocketbase-test"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

mkdir -p "$DEST_DIR"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${OS}_${ARCH}.zip"
echo "Downloading $URL..."
curl -sSL -o "$DEST_DIR/pocketbase.zip" "$URL"
unzip -o "$DEST_DIR/pocketbase.zip" -d "$DEST_DIR" pocketbase >/dev/null
rm "$DEST_DIR/pocketbase.zip"
chmod +x "$DEST_DIR/pocketbase"
echo "Installed $DEST_DIR/pocketbase"
