#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR/frontend"

echo "Building frontend..."
npm run build

echo "Extracting Cloudflare authentication credentials..."
TOKEN=$(python3 -c "
import json
try:
    cfg = json.load(open('/root/.config/cloudflare/config/default.json'))
    print(cfg.get('api_token') or cfg.get('oauth_token') or cfg.get('access_token') or '')
except Exception:
    print('')
")

DEPLOY_TOKEN="${CLOUDFLARE_API_TOKEN:-$TOKEN}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-eb86852651db0a28c6a4d4c34427545b}"

if [ -z "$DEPLOY_TOKEN" ]; then
  echo "Error: No Cloudflare API token found in environment or default.json."
  exit 1
fi

echo "Deploying to Cloudflare Pages (gurukul-sports-academy)..."
WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$DEPLOY_TOKEN" CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
  wrangler pages deploy dist --project-name gurukul-sports-academy --branch main --commit-dirty=true

echo "Deployment complete!"
