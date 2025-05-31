variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "aerofusion-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "mongodb_config" {
  description = "MongoDB configuration"
  type = object({
    instance_class    = string
    allocated_storage = number
    multi_az         = bool
  })
  default = {
    instance_class    = "db.t3.medium"
    allocated_storage = 100
    multi_az         = true
  }
}

variable "redis_config" {
  description = "Redis configuration"
  type = object({
    node_type           = string
    num_cache_clusters  = number
    port               = number
  })
  default = {
    node_type          = "cache.t3.micro"
    num_cache_clusters = 2
    port              = 6379
  }
}

variable "model_registry_config" {
  description = "Model Registry configuration"
  type = object({
    instance_type = string
    storage_size  = number
  })
  default = {
    instance_type = "ml.t3.medium"
    storage_size  = 100
  }
}

variable "feature_store_config" {
  description = "Feature Store configuration"
  type = object({
    instance_type = string
    storage_size  = number
  })
  default = {
    instance_type = "ml.t3.medium"
    storage_size  = 200
  }
}

variable "prometheus_config" {
  description = "Prometheus configuration"
  type = object({
    retention_days = number
    storage_size   = string
  })
  default = {
    retention_days = 15
    storage_size   = "50Gi"
  }
}

variable "grafana_config" {
  description = "Grafana configuration"
  type = object({
    admin_password = string
    storage_size   = string
  })
  default = {
    admin_password = "admin123"
    storage_size   = "10Gi"
  }
}

variable "jaeger_config" {
  description = "Jaeger configuration"
  type = object({
    collector_replicas = number
    storage_type      = string
  })
  default = {
    collector_replicas = 2
    storage_type      = "elasticsearch"
  }
}

variable "certificate_domains" {
  description = "List of domains for SSL certificates"
  type        = list(string)
  default     = ["aerofusion.local"]
}

variable "waf_config" {
  description = "WAF configuration"
  type = object({
    enabled        = bool
    rate_limit     = number
    blocked_countries = list(string)
  })
  default = {
    enabled        = true
    rate_limit     = 2000
    blocked_countries = []
  }
} 