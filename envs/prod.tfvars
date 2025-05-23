aws_region      = "us-east-1"
vpc_cidr_block  = "10.0.0.0/16"
azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
environment     = "prod"
tags            = { Environment = "prod", Owner = "ops-team" }
trusted_cidrs   = ["10.0.0.0/24"]
cluster_name    = "aero-prod-cluster"
cluster_role_arn= "arn:aws:iam::123456789012:role/prod-sagemaker-role"
node_role_arn   = "arn:aws:iam::123456789012:role/prod-node-role"
k8s_version     = "1.26"
desired_capacity= 3
max_size        = 6
min_size        = 2
instance_types  = ["t3.large", "t3.xlarge"]
task_cpu        = "1024"
task_memory     = "2048"
container_defs  = file("../k8s/manifests/prod-container-defs.json")
desired_count   = 3
lambda_configs  = { name="prod-hook", role_arn="arn:aws:iam::123456789012:role/prod-lambda", handler="index.handler", runtime="python3.9", package="../lambda/prod-hook.zip", memory=512, timeout=120, env_vars={ENV="prod"} }
