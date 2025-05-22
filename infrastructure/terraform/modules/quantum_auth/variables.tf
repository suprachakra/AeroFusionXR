```hcl
variable "cluster_id"   { type = string }
variable "hsm_type"      { type = string }
variable "backup_id"     { type = string }
variable "subnet_ids"    { type = list(string) }
variable "hsm_role_name" { type = string }
variable "tags"          { type = map(string) }
```
