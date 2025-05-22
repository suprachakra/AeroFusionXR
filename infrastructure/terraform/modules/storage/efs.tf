```hcl
resource "aws_efs_file_system" "this" {
  creation_token   = "${var.environment}-efs"
  performance_mode = "generalPurpose"
  tags             = var.tags
}
resource "aws_efs_mount_target" "this" {
  count           = length(var.subnet_ids)
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = var.subnet_ids[count.index]
  security_groups = var.security_group_ids
}
```
