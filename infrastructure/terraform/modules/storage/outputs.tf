```hcl
output "raw_bucket_id"       { value = aws_s3_bucket.raw.id }
output "clean_bucket_id"     { value = aws_s3_bucket.clean.id }
output "processed_bucket_id" { value = aws_s3_bucket.processed.id }
output "efs_id"              { value = aws_efs_file_system.this.id }
output "dynamodb_table"      { value = aws_dynamodb_table.events.name }
```
