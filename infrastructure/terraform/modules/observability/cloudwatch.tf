```hcl
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aerofusion/app"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}
resource "aws_cloudwatch_metric_alarm" "llm_latency" {
  alarm_name          = "LLMLatencyAlarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "P95LatencyMs"
  namespace           = "Aerofusion/GenAI"
  period              = 60
  statistic           = "p95"
  threshold           = var.latency_threshold
  alarm_actions       = var.alert_arns
}
```
