aws_region      = "us-east-1"
vpc_cidr_block  = "10.2.0.0/16"
azs             = ["us-east-1a", "us-east-1b"]
environment     = "staging"
tags            = { Environment = "staging", Owner = "qa-team" }
trusted_cidrs   = ["10.2.0.0/24"]
cluster_name    = "aero-staging-cluster"
cluster_role_arn= "arn:aws:iam::123456789012:role/staging-sagemaker-role"
node_role_arn   = "arn:aws:iam::123456789012:role/staging-node-role"
k8s_version     = "1.26"
desired_capacity= 2
max_size        = 4
min_size        = 1
instance_types  = ["t3.medium", "t3.large"]
task_cpu        = "512"
task_memory     = "1024"
container_defs  = file("../k8s/manifests/staging-container-defs.json")
desired_count   = 2
lambda_configs  = { name="staging-hook", role_arn="arn:aws:iam::123456789012:role/staging-lambda", handler="index.handler", runtime="python3.9", package="../lambda/staging-hook.zip", memory=256, timeout=60, env_vars={ENV="staging"} }
