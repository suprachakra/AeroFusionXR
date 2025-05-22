```hcl
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = "15.0.0"

  values = [
    templatefile("${path.module}/values/prometheus-values.yaml", {
      namespace = var.namespace
    })
  ]
  tags = var.tags
}
```
