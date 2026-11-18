output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "vm_name" {
  value = azurerm_linux_virtual_machine.main.name
}

output "vm_public_ip" {
  description = "Used for explicit outbound connectivity and temporary SSH bootstrap only."
  value       = azurerm_public_ip.main.ip_address
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

output "bootstrap_ssh_command" {
  value = var.bootstrap_ssh_source_cidr == null ? "Public SSH disabled" : "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}
