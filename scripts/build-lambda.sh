#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/.build"
BACKEND="$ROOT/apps/backend"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/lambda"

echo "==> Bundling lambda.ts with esbuild..."
cd "$ROOT"
pnpm exec esbuild "$BACKEND/src/lambda.ts" \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile="$BUILD_DIR/lambda/index.mjs" \
  --external:better-sqlite3 \
  --external:@aws-sdk/* \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

echo "==> Installing better-sqlite3 native binary for Linux x86_64..."
docker run --rm \
  -v "$BUILD_DIR/lambda:/out" \
  --platform linux/amd64 \
  --entrypoint /bin/bash \
  public.ecr.aws/lambda/nodejs:20 \
  -c "
    npm init -y > /dev/null 2>&1 &&
    npm install better-sqlite3@12.6.2 --no-optional > /dev/null 2>&1 &&
    cp -r node_modules /out/node_modules
  "

echo "==> Creating lambda.zip..."
cd "$BUILD_DIR/lambda"
zip -rq "$BUILD_DIR/lambda.zip" index.mjs node_modules/

echo "==> Built $BUILD_DIR/lambda.zip ($(du -h "$BUILD_DIR/lambda.zip" | cut -f1))"
