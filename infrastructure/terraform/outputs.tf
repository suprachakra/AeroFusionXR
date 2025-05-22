```hcl
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.network.vpc_id
}
output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.network.public_subnet_ids
}
output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.network.private_subnet_ids
}
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.compute.eks_cluster_name
}
output "raw_bucket_id" {
  description = "S3 raw bucket ID"
  value       = module.storage.raw_bucket_id
}
output "processed_bucket_id" {
  description = "S3 processed bucket ID"
  value       = module.storage.processed_bucket_id
}
```
