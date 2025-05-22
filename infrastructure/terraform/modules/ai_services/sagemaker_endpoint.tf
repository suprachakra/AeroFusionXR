```hcl
resource "aws_sagemaker_model" "this" {
  name          = "${var.environment}-model"
  execution_role_arn = var.sagemaker_execution_role_arn
  primary_container {
    image          = var.inference_image
    model_data_url = var.model_artifacts_s3
  }
  tags = var.tags
}
resource "aws_sagemaker_endpoint_configuration" "this" {
  name = "${var.environment}-endpoint-config"
  production_variants {
    variant_name          = "AllTraffic"
    model_name            = aws_sagemaker_model.this.name
    initial_instance_count= var.instance_count
    instance_type         = var.instance_type
  }
  tags = var.tags
}
resource "aws_sagemaker_endpoint" "this" {
  name               = "${var.environment}-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.this.name
  tags = var.tags
}
```
