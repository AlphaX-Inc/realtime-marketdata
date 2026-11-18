variable "name_prefix" {
  description = "Lowercase prefix used for Azure resource names."
  type        = string
  default     = "marketdata-prod"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,17}$", var.name_prefix))
    error_message = "name_prefix must start with a letter and contain 3-18 lowercase letters, digits, or hyphens."
  }
}

variable "location" {
  description = "Azure region for the deployment."
  type        = string
  default     = "southeastasia"
}

variable "vm_size" {
  description = "Azure VM SKU. B2als_v2 provides 2 vCPU and 4 GiB RAM."
  type        = string
  default     = "Standard_B2als_v2"
}

variable "admin_username" {
  description = "Initial operating-system administrator."
  type        = string
  default     = "azureadmin"
}

variable "ssh_public_key_path" {
  description = "Local path to the SSH public key installed on the VM."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "bootstrap_ssh_source_cidr" {
  description = "Temporary CIDR allowed to SSH over the public IP. Set to null after Tailscale works."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.bootstrap_ssh_source_cidr == null || can(cidrhost(var.bootstrap_ssh_source_cidr, 0))
    error_message = "bootstrap_ssh_source_cidr must be a valid CIDR or null."
  }
}

variable "os_disk_size_gb" {
  description = "Standard SSD OS disk capacity."
  type        = number
  default     = 64

  validation {
    condition     = var.os_disk_size_gb >= 64
    error_message = "The OS disk must be at least 64 GiB."
  }
}

variable "tags" {
  description = "Additional Azure resource tags."
  type        = map(string)
  default     = {}
}
