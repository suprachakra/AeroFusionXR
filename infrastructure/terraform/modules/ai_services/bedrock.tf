---
```hcl
resource "aws_cloudformation_stack" "bedrock_domain" {
  name          = "${var.environment}-bedrock-domain"
  template_body = file("${path.module}/templates/bedrock-domain.yaml")
  parameters = {
    DomainName = "${var.environment}-bedrock"
    Tags       = jsonencode(var.tags)
  }
  capabilities = ["CAPABILITY_IAM"]
}
```
