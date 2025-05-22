```hcl
output "eks_cluster_name" { value = aws_eks_cluster.this.name }
output "ecs_cluster_id"    { value = aws_ecs_cluster.this.id }
output "lambda_arn"       { value = aws_lambda_function.this.arn }
```
