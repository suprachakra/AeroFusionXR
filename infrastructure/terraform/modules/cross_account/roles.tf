```hcl
resource "aws_iam_role" "cross_account_role" {
  name = "${var.environment}-cross-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags = var.tags
}
```
