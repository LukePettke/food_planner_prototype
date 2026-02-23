#!/usr/bin/env bash
# Usage: ./scripts/check-railway.sh https://your-app.up.railway.app
# Or:   RAILWAY_URL=https://your-app.up.railway.app ./scripts/check-railway.sh

BASE="${1:-${RAILWAY_URL}}"
if [ -z "$BASE" ]; then
  echo "Usage: $0 <your-railway-url>"
  echo "Example: $0 https://food-planner-production.up.railway.app"
  exit 1
fi
BASE="${BASE%/}"

echo "Checking: $BASE"
echo ""

echo "1. Health (should be 200):"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "$BASE/api/health"

echo ""
echo "2. Auth me when logged out (should be 200, user: null):"
curl -s "$BASE/api/auth/me" | head -c 200
echo ""

echo ""
echo "3. Protected route without auth (should be 401):"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "$BASE/api/preferences"

echo ""
echo "Done. If you see 200 for health and auth/me, and 401 for /api/preferences, the app and JWT are working."
