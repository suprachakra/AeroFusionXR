```hcl
output "bedrock_domain_arn" {
  value = aws_cloudformation_stack.bedrock_domain.outputs["DomainArn"]
}
output "sagemaker_endpoint_url" {
  value = aws_sagemaker_endpoint.this.endpoint_name
}
output "model_registry_table" {
  value = aws_dynamodb_table.model_registry.name
}
```
