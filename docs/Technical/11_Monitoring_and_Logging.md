### Summary

Full-stack telemetry and alerting, with predictive thresholds, service SLO dashboards, real-time logs, and drift detection.

### 1. Metrics & SLIs

| Metric                   | Source              | Alert Threshold        |
| ------------------------ | ------------------- | ---------------------- |
| Inference Latency (p95)  | Prometheus          | >100 ms for 5 min      |
| Positional Accuracy (AR) | Wayfinding API      | <99.5% for >10 samples |
| Data Pipeline Freshness  | ETL Service         | >30m stale → critical  |
| CV Model Accuracy        | S3 Logs + Snowflake | <85% on last batch     |

### 2. Logging Architecture

* **Structured JSON logs** via Fluent Bit → Loki
* User events stored with consent flag; PII auto-redacted
* Logs queried via Grafana, AlertManager escalates to Slack/Email

### 3. Drift Detection

* **Infra Drift**: Terraform plan in CI; diff alert via OPA policy
* **Data Drift**: Model schema validator triggers re-training workflow

### 4. Dashboards

| Dashboard Name       | Tool     | Monitors                             |
| -------------------- | -------- | ------------------------------------ |
| SRE Overview         | Grafana  | CPU/mem, latency, error rate         |
| CV Model Performance | Superset | Accuracy, fail rate, retries         |
| LLM Prompt Health    | Grafana  | Latency, unhandled queries, fallback |
| Edge Node Status     | Looker   | Device heartbeat, queue backlog      |

### 5. Alert Routing & Escalation

* Auto-tag alerts with priority level (P1–P4)
* Primary → Slack + PagerDuty
* Secondary → Email + Jira ticket
* SLA violations log incident root cause

---
