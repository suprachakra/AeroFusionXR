```hcl
resource "aws_s3_bucket" "raw" {
  bucket = "${var.bucket_prefix}-raw-${var.environment}"
  acl    = "private"
  tags   = var.tags
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
    }
  }
}
resource "aws_s3_bucket" "clean" {
  bucket = "${var.bucket_prefix}-clean-${var.environment}"
  acl    = "private"
  tags   = var.tags
}
resource "aws_s3_bucket" "processed" {
  bucket = "${var.bucket_prefix}-processed-${var.environment}"
  acl    = "private"
  tags   = var.tags
}
```
