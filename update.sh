#!/usr/bin/env bash
# Deploy committed HEAD to prod via infra/ansible/site.yml (see infra/README.md).
# Extra args go to ansible-playbook, e.g. ./update.sh -v
set -euo pipefail
cd "$(dirname "$0")/infra/ansible"

[ -f inventory.yml ] || { echo "Missing infra/ansible/inventory.yml (copy inventory.example.yml)." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || echo "Warning: uncommitted changes are NOT deployed; only committed HEAD ships." >&2

echo "Deploying $(git rev-parse --short=12 HEAD) ($(git branch --show-current)) to prod"
ansible-playbook site.yml --diff "$@"
