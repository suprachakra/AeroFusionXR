#!/usr/bin/env bash
# canary-test.sh: Smoke tests & metrics validation after canary deployment
set -euo pipefail

SERVICE_URL=${1:-"http://canary.aerofusion.local/health"}
RETRIES=5

for i in $(seq 1 $RETRIES); do
  STATUS=$(curl -o /dev/null -s -w "%{http_code}" $SERVICE_URL || true)
  if [[ "$STATUS" == "200" ]]; then
    echo "Canary healthy on attempt $i"
    exit 0
  fi
  echo "Attempt $i failed (HTTP $STATUS), retrying..."
  sleep 10
done

echo "Canary failed after $RETRIES attempts" >&2
exit 1
