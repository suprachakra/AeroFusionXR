aws_region      = "us-east-1"
vpc_cidr_block  = "10.1.0.0/16"
azs             = ["us-east-1a", "us-east-1b"]
environment     = "dev"
tags            = { Environment = "dev", Owner = "dev-team" }
trusted_cidrs   = ["10.1.0.0/24"]
cluster_name    = "aero-dev-cluster"
cluster_role_arn= "arn:aws:iam::123456789012:role/dev-sagemaker-role"
node_role_arn   = "arn:aws:iam::123456789012:role/dev-node-role"
k8s_version     = "1.26"
desired_capacity= 1
max_size        = 2
min_size        = 1
instance_types  = ["t3.medium"]
task_cpu        = "256"
task_memory     = "512"
container_defs  = file("../k8s/manifests/dev-container-defs.json")
desired_count   = 1
lambda_configs  = { name="dev-hook", role_arn="arn:aws:iam::123456789012:role/dev-lambda", handler="index.handler", runtime="python3.9", package="../lambda/dev-hook.zip", memory=128, timeout=30, env_vars={ENV="dev"} }
