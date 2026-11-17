#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <key-vault-name> [env-file]" >&2
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

readonly key_vault_name="$1"
readonly env_file="${2:-.env}"
readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "${env_file}" ]]; then
  echo "Environment file not found: ${env_file}" >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is required" >&2
  exit 1
fi

az account show --output none

runtime_secret_count=""
for attempt in {1..12}; do
  if runtime_secret_count="$(az keyvault secret list \
    --vault-name "${key_vault_name}" \
    --query "length([?name == 'runtime-env'])" \
    --output tsv \
    --only-show-errors)"; then
    break
  fi

  if [[ ${attempt} -eq 12 ]]; then
    echo "Unable to access secrets in Key Vault ${key_vault_name}" >&2
    exit 1
  fi
  echo "Key Vault access is not ready; retrying in 10 seconds..." >&2
  sleep 10
done

existing_env="$(mktemp)"
runtime_env="$(mktemp)"
trap 'rm -f "${existing_env}" "${runtime_env}"' EXIT
chmod 0600 "${existing_env}" "${runtime_env}"

if [[ "${runtime_secret_count}" == "1" ]]; then
  az keyvault secret show \
    --vault-name "${key_vault_name}" \
    --name runtime-env \
    --query value \
    --output tsv \
    --only-show-errors > "${existing_env}"
fi

python3 "${script_dir}/build-runtime-env.py" "${env_file}" "${existing_env}" "${runtime_env}"

for attempt in {1..6}; do
  if az keyvault secret set \
    --vault-name "${key_vault_name}" \
    --name runtime-env \
    --file "${runtime_env}" \
    --content-type text/plain \
    --output none; then
    echo "Converted ${env_file} into Key Vault secret runtime-env"
    exit 0
  fi

  if [[ ${attempt} -lt 6 ]]; then
    echo "Key Vault access is not ready; retrying in 10 seconds..." >&2
    sleep 10
  fi
done

echo "Unable to import runtime-env into Key Vault" >&2
exit 1
