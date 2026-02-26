#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=============================="
echo "  Deploying Toto Huat"
echo "=============================="

bash "$ROOT/scripts/deploy-lambda.sh"
bash "$ROOT/scripts/deploy-frontend.sh"

echo "=============================="
echo "  All deployments complete!"
echo "=============================="
