variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where monitoring will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for monitoring deployment"
  type        = list(string)
}

variable "prometheus_config" {
  description = "Prometheus configuration"
  type = object({
    retention_days = number
    storage_size   = string
  })
}

variable "grafana_config" {
  description = "Grafana configuration"
  type = object({
    admin_password = string
    storage_size   = string
  })
}

variable "jaeger_config" {
  description = "Jaeger configuration"
  type = object({
    collector_replicas = number
    storage_type      = string
  })
} 