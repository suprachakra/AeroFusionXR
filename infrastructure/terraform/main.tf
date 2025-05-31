terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "aerofusion-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "aerofusion-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "AeroFusionXR"
      ManagedBy   = "Terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

# Data Sources
data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
}

# EKS Module
module "eks" {
  source = "./modules/eks"

  environment      = var.environment
  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids

  node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 5
      instance_types = ["t3.large"]
    }
    compute = {
      desired_size = 2
      min_size     = 1
      max_size     = 4
      instance_types = ["c5.xlarge"]
      taints = [{
        key    = "workload"
        value  = "compute"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}

# Database Module
module "databases" {
  source = "./modules/databases"

  environment     = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  mongodb_config = var.mongodb_config
  redis_config   = var.redis_config
}

# AI Services Module
module "ai_services" {
  source = "./modules/ai_services"

  environment                = var.environment
  vpc_id                    = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnet_ids
  model_registry_config    = var.model_registry_config
  feature_store_config     = var.feature_store_config
  sagemaker_execution_role = aws_iam_role.sagemaker_execution.arn
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  prometheus_config = var.prometheus_config
  grafana_config   = var.grafana_config
  jaeger_config    = var.jaeger_config
}

# Security Module
module "security" {
  source = "./modules/security"

  environment = var.environment
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  certificate_domains = var.certificate_domains
  waf_config         = var.waf_config
}

# IAM Roles
resource "aws_iam_role" "sagemaker_execution" {
  name = "${var.environment}-sagemaker-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })
}

# Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "mongodb_endpoint" {
  description = "MongoDB endpoint"
  value       = module.databases.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.databases.redis_endpoint
  sensitive   = true
}

output "model_registry_endpoint" {
  description = "Model Registry endpoint"
  value       = module.ai_services.model_registry_endpoint
}

output "feature_store_endpoint" {
  description = "Feature Store endpoint"
  value       = module.ai_services.feature_store_endpoint
} 