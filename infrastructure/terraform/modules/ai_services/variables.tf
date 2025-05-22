```hcl
variable "environment" { type = string }
variable "tags"        { type = map(string) }
variable "sagemaker_execution_role_arn" { type = string }
variable "training_image"    { type = string }
variable "training_data_sources" { type = list(map(string)) }
variable "model_artifacts_s3" { type = string }
variable "instance_type"      { type = string }
variable "instance_count"     { type = number }
variable "volume_size"        { type = number }
variable "max_runtime"        { type = number }
variable "inference_image"    { type = string }
variable "registry_lambda_role_arn" { type = string }
variable "registry_hook_package"    { type = string }
variable "registry_env"             { type = map(string) }
```
