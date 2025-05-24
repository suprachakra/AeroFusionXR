#!/usr/bin/env bash
# migrate-db.sh: Run DB migrations via Flyway or Liquibase
set -euo pipefail

MIGRATION_TOOL=${1:-flyway}
CONFIG_FILE="./db/conf/${MIGRATION_TOOL}.conf"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Configuration file $CONFIG_FILE not found." >&2
  exit 1
fi

echo "==> Running migrations with $MIGRATION_TOOL..."
if [[ "$MIGRATION_TOOL" == "flyway" ]]; then
  flyway -configFiles="$CONFIG_FILE" migrate
else
  liquibase --defaultsFile="$CONFIG_FILE" update
fi

echo "Migrations applied successfully."
