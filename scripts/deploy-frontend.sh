#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/apps/frontend"
BUCKET="toto-huat-frontend-759650489076"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:?Set CLOUDFRONT_DISTRIBUTION_ID env var}"

echo "==> Building frontend..."
cd "$FRONTEND"
VITE_API_URL="" pnpm build

echo "==> Syncing to S3..."
# Immutable cache for hashed assets
aws s3 sync dist/assets/ "s3://$BUCKET/assets/" \
  --cache-control "public, max-age=31536000, immutable"

# No-cache for index.html and other root files
aws s3 sync dist/ "s3://$BUCKET/" \
  --exclude "assets/*" \
  --cache-control "no-cache"

echo "==> Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" \
  --no-cli-pager

echo "==> Frontend deployed."
