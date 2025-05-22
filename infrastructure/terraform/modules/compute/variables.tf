```hcl
variable "cluster_name"       { type = string }
variable "cluster_role_arn"   { type = string }
variable "subnet_ids"        { type = list(string) }
variable "security_group_ids"{ type = list(string) }
variable "node_role_arn"      { type = string }
variable "k8s_version"       { type = string }
variable "desired_capacity"  { type = number }
variable "max_size"          { type = number }
variable "min_size"          { type = number }
variable "instance_types"    { type = list(string) }
variable "task_cpu"          { type = string }
variable "task_memory"       { type = string }
variable "container_defs"    { type = any }
variable "desired_count"     { type = number }
variable "lambda_configs"    { type = map(any) }
variable "tags"              { type = map(string) }
```
