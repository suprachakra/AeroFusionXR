variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security resources will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for security deployment"
  type        = list(string)
}

variable "certificate_domains" {
  description = "List of domains for SSL certificates"
  type        = list(string)
}

variable "waf_config" {
  description = "WAF configuration"
  type = object({
    enabled        = bool
    rate_limit     = number
    blocked_countries = list(string)
  })
} 