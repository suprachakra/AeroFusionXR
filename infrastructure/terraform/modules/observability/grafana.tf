```hcl
resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = "6.5.0"

  values = [
    templatefile("${path.module}/values/grafana-values.yaml", { admin_password = var.admin_password })
  ]
}
```
