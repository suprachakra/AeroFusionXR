```hcl
resource "aws_iam_policy" "cross_account_policy" {
  name        = "${var.environment}-cross-policy"
  description = "Least privilege for cross-account operations"
  policy      = data.aws_iam_policy_document.policy.json
}
resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.cross_account_role.name
  policy_arn = aws_iam_policy.cross_account_policy.arn
}
