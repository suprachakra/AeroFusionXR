```hcl
resource "aws_ecs_cluster" "this" {
  name = "${var.cluster_name}-ecs"
  tags = var.tags
}
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.cluster_name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  container_definitions    = var.container_defs
}
resource "aws_ecs_service" "app" {
  name            = "${var.cluster_name}-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
    assign_public_ip = false
  }
  tags = var.tags
}
```
