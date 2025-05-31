output "cloudwatch_log_group_application" {
  description = "CloudWatch log group for applications"
  value       = aws_cloudwatch_log_group.application_logs.name
}

output "cloudwatch_log_group_infrastructure" {
  description = "CloudWatch log group for infrastructure"
  value       = aws_cloudwatch_log_group.infrastructure_logs.name
}

output "sns_topic_alerts_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
} 