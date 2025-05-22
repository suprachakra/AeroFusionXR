*End-to-End Data Governance: DPIA, Retention, Anonymization, Consent Lifecycle*

### 1. DPIA & Data Flow Mapping

1. **Map Data Flows**: Document pipelines for PII through GenAI, AR, Analytics (M1).
2. **Risk Scoring**: Rate each flow by sensitivity & volume (M1–M2).
3. **Mitigation Plans**: Define technical & organizational measures (M2).
4. **Board Review**: DPO & Ethics Board sign-off (M3).

### 2. Retention & Deletion Policy

| Data Category       | Retention Period | Storage Type & Location   | Deletion Mechanism           | Review & Sign-off    |
| ------------------- | ---------------- | ------------------------- | ---------------------------- | -------------------- |
| User Profiles       | 2 years          | Encrypted, WORM-protected | Automated purge script       | DPO; Annual          |
| Session Logs        | 90 days          | Data Lake                 | Lifecycle rule               | Data Team; Quarterly |
| Model Training Sets | 5 years          | Offline Archive Storage   | Secure tape rotation         | AI Ops; Bi-Annual    |
| Audit Logs          | 7 years          | Immutable ledger          | Retention policy enforcement | Compliance; Annual   |

### 3. Anonymization & Pseudonymization

* **Techniques**: k-anonymity, l-diversity, differential privacy for PII subsets.
* **Tooling**: Custom Python pipeline in `ai/utils/anonymizer.py`, integrated in ETL.
* **Validation**: Monthly re-identification risk scoring (SVP Data).

### 4. Consent Lifecycle Management

* **Capture**: Granular UI + API, purpose-specific consents.
* **Audit**: Immutable consent logs in WORM storage; access via `ConsentService` API.
* **Revocation & Portability**: One-click endpoints, data export in JSON/CSV.
* **Monitoring**: Consent expiry alerts, monthly compliance dashboards.
