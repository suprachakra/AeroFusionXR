#!/usr/bin/env bash
# rotate-secrets.sh: Rotate AWS Secrets Manager entries and sync with Vault
set -euo pipefail

SECRETS_LIST=("db/credentials" "api/keys" "hsm/credentials")
for secret in "${SECRETS_LIST[@]}"; do
  echo "Rotating secret: $secret"
  aws secretsmanager rotate-secret --secret-id "$secret"
  NEW_ARN=$(aws secretsmanager describe-secret --secret-id "$secret" --query 'ARN' --output text)
  echo "New ARN: $NEW_ARN"
  vault write secret/data/$secret \
    data=@@(aws secretsmanager get-secret-value --secret-id "$secret" --query 'SecretString' --output text)
done

echo "Secrets rotation complete."
