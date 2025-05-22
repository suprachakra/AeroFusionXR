```hcl
resource "aws_lambda_function" "this" {
  function_name = var.lambda_configs.name
  role          = var.lambda_configs.role_arn
  handler       = var.lambda_configs.handler
  runtime       = var.lambda_configs.runtime
  filename      = var.lambda_configs.package
  memory_size   = var.lambda_configs.memory
  timeout       = var.lambda_configs.timeout
  environment {
    variables = var.lambda_configs.env_vars
  }
  tags = var.tags
}
```
