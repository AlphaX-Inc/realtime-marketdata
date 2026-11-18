# Native Azure deployment

This deployment runs the application directly on one Ubuntu 24.04 Azure VM in Singapore
(`southeastasia`). PostgreSQL,
Redis, Node.js, Caddy, and Tailscale are managed by systemd; Docker is not used. Caddy is
reachable only on `127.0.0.1:3000`, and Tailscale Serve provides the private HTTPS endpoint.

## Architecture

```text
tailnet client
  -> Tailscale Serve (private HTTPS)
  -> Caddy 127.0.0.1:3000
     -> React static files
     -> /api/*       -> API 127.0.0.1:8000
     -> /ws/prices   -> API 127.0.0.1:8000

worker -> Twelve Data / J-Quants / Alpha Vantage
API and worker -> PostgreSQL 127.0.0.1:55432
API and worker -> Redis 127.0.0.1:56379
```

The Azure public IP supplies explicit outbound connectivity. The NSG exposes no application
ports. Public SSH is optional during bootstrap and must be removed after Tailscale access is
verified.

## Prerequisites

- Terraform 1.7 or newer
- Azure CLI authenticated with `az login`
- Ansible Core with no additional collections
- An SSH key pair
- A Tailscale tailnet and permission to create a tagged auth key
- A committed Git revision containing the application and infrastructure files

The Azure identity running Terraform must be allowed to create role assignments (for example,
Owner or User Access Administrator plus Contributor on the target subscription or resource
group).

Enable Tailscale MagicDNS and HTTPS certificates, then create `tag:server` in the tailnet policy
before provisioning the node. Limit HTTPS access to the intended users and SSH access to
administrators. The playbook uses OpenSSH over the Tailscale network by default. Set
`tailscale_ssh` in `ansible/group_vars/all.yml` to `true` only when the tailnet has a matching
Tailscale SSH policy.

## 1. Provision Azure

```sh
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Replace `bootstrap_ssh_source_cidr` with the operator's current public IPv4 address followed by
`/32`. Then provision the resources:

```sh
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan -out=tfplan
terraform -chdir=infra/terraform apply tfplan
terraform -chdir=infra/terraform output
```

The Terraform state contains infrastructure metadata, but no application secret values.

## 2. Prepare and import `.env`

The converter preserves the values in the local `.env`. The native services use the existing
development ports, so `DATABASE_URL` and `REDIS_URL` may use this format when they are already
present:

```env
DATABASE_URL="postgresql://realtime_pricing:CHANGE_ME@localhost:55432/realtime_pricing?schema=public"
REDIS_URL="redis://localhost:56379"
API_HOST="127.0.0.1"
API_PORT="8000"
VITE_API_BASE_URL="/api"
TWELVEDATA_API_KEY="CHANGE_ME"
JQUANTS_API_KEY=""
ALPHAVANTAGE_API_KEY=""
API_KEY_ENCRYPTION_SECRET="CHANGE_ME"
```

Use a strong URL-safe PostgreSQL password. Generate the API-key encryption secret with:

```sh
openssl rand -base64 32
```

Do not use the placeholder password or encryption key from `.env.example` in production.

Convert the local `.env` into the `runtime-env` Key Vault secret:

```sh
infra/scripts/import-env-to-key-vault.sh "$(terraform -chdir=infra/terraform output -raw key_vault_name)" .env
```

If the local `.env` has no `DATABASE_URL`, the converter creates a strong PostgreSQL credential
in the Key Vault copy. If it has no `REDIS_URL`, the converter adds the localhost Redis endpoint.
If `API_KEY_ENCRYPTION_SECRET` still has the `.env.example` placeholder, the converter replaces it
with a generated 32-byte key in the Key Vault copy. Generated database and encryption credentials
are reused from the existing Key Vault secret on later imports, and accidental database or
encryption-key rotation is rejected. The source `.env` is never changed. The importer validates
the required variables and native database/cache endpoints and never prints secret values. Azure
RBAC can take up to two minutes to propagate, so the importer retries.

## 3. Configure the VM and deploy

Create the Ansible inventory from the examples and Terraform outputs:

```sh
cp infra/ansible/inventory.example.yml infra/ansible/inventory.yml
terraform -chdir=infra/terraform output -raw vm_public_ip
terraform -chdir=infra/terraform output -raw key_vault_name
```

Generate a one-time, pre-approved, non-ephemeral Tailscale auth key carrying `tag:server`, then
run:

```sh
export TS_AUTHKEY="tskey-auth-..."
ansible-playbook -i infra/ansible/inventory.yml infra/ansible/site.yml
unset TS_AUTHKEY
```

The playbook installs native packages, adds 2 GiB of swap, fetches `.env` using the VM managed
identity, creates the PostgreSQL role/database, builds the application, applies migrations,
starts the API and singleton worker, configures Caddy, and enables Tailscale Serve. The final
message contains the private `https://...ts.net` URL.

Subsequent deployments do not need `TS_AUTHKEY` while the server remains connected to the
tailnet. The playbook deploys the committed `HEAD`, keeps three releases, and never copies the
local `.env` to the source release.

## 4. Close public SSH

After both the HTTPS application and Tailscale SSH work, edit `terraform.tfvars`:

```hcl
bootstrap_ssh_source_cidr = null
```

Run `terraform apply` again. The VM retains its public IP for outbound provider and Tailscale
traffic, but the NSG then has no public inbound allow rule.

Update `infra/ansible/inventory.yml` to use the Tailscale MagicDNS hostname instead of the public
IP before future deployments.

## Operations

Inspect services:

```sh
sudo systemctl status realtime-marketdata-api realtime-marketdata-worker
sudo journalctl -u realtime-marketdata-api -u realtime-marketdata-worker --since today
sudo tailscale serve status
```

After replacing the Key Vault `runtime-env` secret, refresh the services:

```sh
sudo systemctl restart realtime-marketdata-secrets
sudo systemctl restart realtime-marketdata-api realtime-marketdata-worker
```

PostgreSQL data and Redis persistence live on the OS disk. Before considering the deployment
business-critical, add an off-VM PostgreSQL backup with a tested restore procedure. The current
single-VM topology is intentionally cost-optimized and has no automatic failover.
