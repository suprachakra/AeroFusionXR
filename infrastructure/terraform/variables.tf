```hcl
variable "aws_region" {
  type        = string
  description = "AWS region for deployment"
  default     = "us-east-1"
}
variable "aws_profile" {
  type        = string
  description = "AWS CLI profile"
  default     = "default"
}
variable "vpc_cidr_block" { type = string description = "VPC CIDR block" }
variable "azs"           { type = list(string) description = "Availability zones" }
variable "environment"   { type = string description = "Deployment env (dev/staging/prod)" }
variable "tags"          { type = map(string) description = "Common resource tags" }
variable "trusted_cidrs" { type = list(string) description = "CIDRs allowed SSH access" }

# Compute variables
variable "cluster_name"     { type = string }
variable "cluster_role_arn" { type = string }
variable "node_role_arn"    { type = string }
variable "k8s_version"      { type = string }
variable "desired_capacity" { type = number }
variable "max_size"         { type = number }
variable "min_size"         { type = number }
variable "instance_types"   { type = list(string) }
variable "task_cpu"         { type = string }
variable "task_memory"      { type = string }
variable "container_defs"   { type = any }
variable "desired_count"    { type = number }
variable "lambda_configs"   { type = map(any) }

# Storage variables
variable "bucket_prefix"    { type = string }
variable "retention_days"   { type = number }
```
