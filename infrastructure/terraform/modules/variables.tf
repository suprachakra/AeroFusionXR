variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where AI services will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for AI services deployment"
  type        = list(string)
}

variable "model_registry_config" {
  description = "Model Registry configuration"
  type = object({
    instance_type = string
    storage_size  = number
  })
}

variable "feature_store_config" {
  description = "Feature Store configuration"
  type = object({
    instance_type = string
    storage_size  = number
  })
}

variable "sagemaker_execution_role" {
  description = "SageMaker execution role ARN"
  type        = string
} 