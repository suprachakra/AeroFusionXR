```hcl
resource "aws_cloudhsm_v2_cluster" "this" {
  cluster_id             = var.cluster_id
  hsm_type               = var.hsm_type
  source_backup_identifier = var.backup_id
  subnet_ids             = var.subnet_ids
  tags = var.tags
}
``` 
