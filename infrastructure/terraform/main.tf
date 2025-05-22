```hcl
terraform {
  required_version = ">= 1.3.0"
  backend "s3" {
    bucket  = "infra-state-prod"
    key     = "global/terraform.tfstate"
    region  = var.aws_region
    encrypt = true
  }
  required_providers {
    aws        = { source = "hashicorp/aws" version = ">= 4.0" }
    kubernetes = { source = "hashicorp/kubernetes" version = ">= 2.0" }
    helm       = { source = "hashicorp/helm" version = ">= 2.0" }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

module "network" {
  source          = "./modules/network"
  vpc_cidr_block  = var.vpc_cidr_block
  azs             = var.azs
  environment     = var.environment
  tags            = var.tags
  trusted_cidrs   = var.trusted_cidrs
}

module "compute" {
  source             = "./modules/compute"
  cluster_name       = var.cluster_name
  cluster_role_arn   = var.cluster_role_arn
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [module.network.bastion_sg_id]
  k8s_version        = var.k8s_version
  node_role_arn      = var.node_role_arn
  desired_capacity   = var.desired_capacity
  max_size           = var.max_size
  min_size           = var.min_size
  instance_types     = var.instance_types
  task_cpu           = var.task_cpu
  task_memory        = var.task_memory
  container_defs     = var.container_defs
  desired_count      = var.desired_count
  lambda_configs     = var.lambda_configs
  tags               = var.tags
}

module "storage" {
  source            = "./modules/storage"
  bucket_prefix     = var.bucket_prefix
  environment       = var.environment
  tags              = var.tags
  subnet_ids        = module.network.private_subnet_ids
  security_group_ids= [module.network.bastion_sg_id]
  retention_days    = var.retention_days
}
```
