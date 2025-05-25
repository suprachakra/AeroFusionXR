Simplified, granular SLO runbook, mandatory tests, and self-healing CI/CD.

### 1. Simplified SLO Runbook

| Service       | SLO (95th pct)  | Trigger Condition          | Immediate Action                             | Escalation                             |
| ------------- | --------------- | -------------------------- | -------------------------------------------- | -------------------------------------- |
| GenAI API     | <100 ms latency | >100 ms for 5m consecutive | Rollback to stable; scale up pods            | Page SRE & ML Ops; notify stakeholders |
| AR Overlay    | <200 ms render  | >200 ms for 3m             | Enable low-res fallback; clear cache         | Page XR Eng; log incident              |
| ETL Pipeline  | <15m end-to-end | Run >15m or miss SLA       | Abort & restart DAG; notify data team        | Page Data Eng; open incident ticket    |
| BI Dashboards | <1m refresh     | Refresh >1m                | Trigger manual reload; inform analytics team | Page BI Lead; update incident log      |

### 2. Mandatory Testing Matrix

| Test Type           | Tool           | Scope                | Frequency | Gate Condition                          |
| ------------------- | -------------- | -------------------- | --------- | --------------------------------------- |
| Unit Tests          | Jest, PyTest   | All new code         | On PR     | 100% new coverage; no critical failures |
| Adversarial Fuzzing | Custom harness | GenAI & CV pipelines | Nightly   | No severity ≥Medium                     |
| API Contract        | Schemathesis   | All endpoints        | On PR     | 0 schema violations                     |
| SAST                | SonarQube      | Full repo            | On commit | 0 new critical issues                   |
| DAST                | OWASP ZAP      | Staging env          | Weekly    | 0 medium+ vulnerabilities               |

### 3. Self-Healing CI/CD

* **Block on Failures:** tests, security, coverage.
* **Auto-Rollback:** on canary failure.
* **Dependency Updates:** auto-merge minor patches; alert on major.

### 4. Test-Driven Development (TDD)

* **Unit Tests**: 100% coverage enforced via CI
* **Integration Tests**: Service-to-service contracts validated
* **Mocking**: Use WireMock and pytest fixtures for external deps

### 5. Security Testing

* **SAST**: CodeQL scans on every PR
* **DAST**: OWASP ZAP nightly scans
* **Dependency Scans**: Snyk alerts for vulnerable packages

### 6. Adversarial & Chaos

* **Adversarial Testing**: Prompt injections, schema fuzzers
* **Chaos Engineering**: Gremlin scripts for network latency, pod killing

## 4. Coverage & Quality Gates

* **Coverage**: Minimum 90% for new code
* **Linting**: ESLint + Flake8 rules
* **Contract Tests**: Pact-based consumer/provider checks
