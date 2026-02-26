#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTION_NAME="toto-huat-api"

echo "==> Building Lambda..."
bash "$ROOT/scripts/build-lambda.sh"

echo "==> Deploying Lambda..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ROOT/.build/lambda.zip" \
  --no-cli-pager

echo "==> Waiting for update to complete..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME"

echo "==> Lambda deployed."
