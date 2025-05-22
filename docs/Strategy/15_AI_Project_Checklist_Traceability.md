*Master AI Governance Checklist Mapped to Repo & Processes for Absolute Traceability*

| Item ID | Checklist Item                   | Description                                                 | Repo Path / Artifact                          | Owner & Validation                          |
| ------- | -------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| **C1**  | DPIA Completion                  | DPIA for each AI component completed                        | `docs/data_governance.md`                     | DPO; M3 Sign-off                            |
| **C2**  | Model Cards Publication          | Comprehensive model cards for all production models         | `docs/Technical/model_cards/`                 | AI Ethics Board; CI gate                    |
| **C3**  | Quarterly Bias & Fairness Audits | Automated scanning & reporting                              | `ai/utils/bias_detector.py`                   | Data Team; Dashboard; Monthly               |
| **C4**  | Explainability Reports           | Generated for top 10 intents & critical use cases           | `analytics/pipelines/explainability.py`       | QA Lead; Bi-Annual                          |
| **C5**  | SAST & DAST Integration          | Security scans integrated into CI/CD                        | `.github/workflows/ci.yml`                    | CISO; Per-commit audit                      |
| **C6**  | Policy-as-Code Checks            | Automated PDPL, GDPR, EU AI Act validations                 | `automation/compliance_workflows.yml`         | Legal; Continuous                           |
| **C7**  | Incident Runbook Links           | Embedded in alert notifications                             | `services/notifications/`                     | Ops Lead; Incident Drill Validation         |
| **C8**  | DR/BCP Simulation & Report       | Quarterly DR drills & documented outcomes                   | `automation/model_testing_scripts/`           | SRE Lead; Quarterly report                  |
| **C9**  | Training & Certification         | Stakeholder training completion tracked in LMS              | `LMS Reports`; `08_Stakeholder_Enablement.md` | SVP QA; Monthly compliance check            |
| **C10** | Documentation Coverage Audit     | 100% strategic & technical docs reviewed                    | Confluence Space; Repo `README.md`            | SVP Product; Annual audit                   |
| **C11** | Governance Cadence Compliance    | Confirmed meetings & logs for daily, weekly, monthly cycles | `10_Responsible_AI_Governance.md`             | Exec Leadership; Calendar sync & audit logs |
