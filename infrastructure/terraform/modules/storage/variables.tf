```hcl
variable "bucket_prefix"       { type = string }
variable "environment"         { type = string }
variable "tags"                { type = map(string) }
variable "subnet_ids"          { type = list(string) }
variable "security_group_ids"  { type = list(string) }
variable "retention_days"      { type = number }
```
