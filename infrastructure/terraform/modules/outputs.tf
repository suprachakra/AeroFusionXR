output "model_registry_endpoint" {
  description = "Model Registry endpoint"
  value       = aws_sagemaker_model_package_group.model_registry.model_package_group_name
}

output "feature_store_endpoint" {
  description = "Feature Store S3 bucket"
  value       = aws_s3_bucket.feature_store.bucket_domain_name
}

output "sagemaker_role_arn" {
  description = "SageMaker execution role ARN"
  value       = aws_iam_role.sagemaker_role.arn
} 