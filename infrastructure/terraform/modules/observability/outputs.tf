```hcl
output "grafana_url" {
  description = "Grafana dashboard URL"
  value       = helm_release.grafana.status[0].url
}
```
