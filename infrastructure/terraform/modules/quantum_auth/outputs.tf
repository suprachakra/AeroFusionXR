```hcl
output "hsm_cluster_id" { value = aws_cloudhsm_v2_cluster.this.id }
output "kms_key_id"      { value = aws_kms_key.this.key_id }
```
