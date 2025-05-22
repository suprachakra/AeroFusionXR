```hcl
resource "aws_sagemaker_training_job" "this" {
  name              = "${var.environment}-training-job"
  role_arn          = var.sagemaker_execution_role_arn
  algorithm_specification {
    training_image = var.training_image
    training_input_mode = "File"
  }
  input_data_config = var.training_data_sources
  output_data_config {
    s3_output_path = var.model_artifacts_s3
  }
  resource_config {
    instance_type  = var.instance_type
    instance_count = var.instance_count
    volume_size_in_gb = var.volume_size
  }
  stopping_condition {
    max_runtime_in_seconds = var.max_runtime
  }
  tags = var.tags
}
```
