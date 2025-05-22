```hcl
resource "aws_kms_key" "this" {
  description             = "HSM backed master key"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage              = "ENCRYPT_DECRYPT"
  multi_region_key        = true
  policy = data.aws_iam_policy_document.key_policy.json
  tags = var.tags
}
resource "aws_iam_policy" "hsm_access" {
  name   = "${var.environment}-hsm-access"
  policy = data.aws_iam_policy_document.policy.json
}
resource "aws_iam_role_policy_attachment" "attach" {
  role       = var.hsm_role_name
  policy_arn = aws_iam_policy.hsm_access.arn
}
```
