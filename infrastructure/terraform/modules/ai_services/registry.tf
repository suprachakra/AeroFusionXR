```hcl
resource "aws_dynamodb_table" "model_registry" {
  name         = "${var.environment}-model-registry"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "model_id"
  attribute { name = "model_id" type = "S" }
  attribute { name = "version" type = "N" }
  ttl { attribute_name = "expires_at" enabled = true }
  tags = var.tags
}
resource "aws_lambda_function" "registry_hook" {
  function_name = "${var.environment}-registry-hook"
  role          = var.registry_lambda_role_arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.9"
  filename      = var.registry_hook_package
  environment { variables = var.registry_env }
  tags = var.tags
}
```
