### Summary
Resilient CI/CD with GitOps-based delivery, canary + blue-green deployments, multi-cloud IaC, automated rollback, and DR simulations.

### 1. CI/CD Pipeline Overview

| Stage       | Tooling               | Validation Hook                              |
| ----------- | --------------------- | -------------------------------------------- |
| Lint & Test | GitHub Actions + Jest | Unit test pass + lint ruleset enforcement    |
| SAST        | SonarQube             | Block PR if critical found                   |
| Build       | Docker, BuildKit      | SBOM attach, vulnerability scan (Trivy)      |
| Sign        | Cosign, Rekor         | Sigstore chain verified                      |
| Deploy      | ArgoCD                | Canary by default; failover fallback enabled |

### 2. IaC Modules

* Terraform & Helm managed by **environment-specific Git branches**
* Resources split by domain: compute, network, observability, LLM infra
* Automatic drift detection via OpenPolicyAgent (OPA) policies

### 3. Deployment Strategies

| Type       | Use Case                   | Mechanism                               |
| ---------- | -------------------------- | --------------------------------------- |
| Canary     | API rollout                | 10%-25%-50%-100% with SLA gate control  |
| Blue-Green | Web/mobile frontend        | Green env active only after full health |
| Shadow     | LLMs pre-production tuning | Traffic mirroring, output comparison    |

### 4. Rollback & Incident Strategy

* Canary SLO failure → auto-revert within 90s
* Rollback command enabled in **admin dashboard**
* **DR Drills** quarterly: simulate API outage, data corruption, node loss
* Recovery Time Objective (RTO) < 15 min; Recovery Point Objective (RPO) = 0
