```hcl
variable "vpc_cidr_block" { type = string }
variable "azs"           { type = list(string) }
variable "environment"   { type = string }
variable "tags"          { type = map(string) }
variable "trusted_cidrs" { type = list(string) }
```
