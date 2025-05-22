```hcl
resource "aws_dynamodb_table" "events" {
  name         = "events-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"
  attribute { name = "event_id" type = "S" }
  ttl { attribute_name = "expires_at" enabled = true }
  tags = var.tags
}
```
