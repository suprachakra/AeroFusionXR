variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where databases will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for database deployment"
  type        = list(string)
}

variable "mongodb_config" {
  description = "MongoDB configuration"
  type = object({
    instance_class    = string
    allocated_storage = number
    multi_az         = bool
  })
}

variable "redis_config" {
  description = "Redis configuration"
  type = object({
    node_type           = string
    num_cache_clusters  = number
    port               = number
  })
} 