# Requirements FRs & NFRs
*Functional and Non-Functional Requirements (performance, security, compliance)*

This document enumerates all **Functional Requirements (FR)**, **Non-Functional Requirements (NFR)** and **FR & NFR Coverage for Epics** in AerofusionXR. Each requirement includes **Acceptance Criteria**, **Risks & Mitigation**, **Departmental Checks**, and **Priority** to ensure no loopholes and end-to-end accountability.

---

### 1. Functional Requirements (FR)
| FR ID | Description                                            | Acceptance Criteria                                                                      | Risks & Mitigation                                            | Departments                        | Priority |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- | -------- |
| FR1a  | Text-only GenAI Concierge                              | • ≥95% resolution accuracy<br>• <100 ms latency<br>• Fallback text UI                    | ASR/CV artifacts → fallback to next-best modality             | Product, Engineering, QA           | Critical |
| FR1b  | Voice-only GenAI Concierge                             | • ≥98% ASR accuracy in noise<br>• <150 ms latency<br>• Fallback to text                  | Noise interference → noise-cancel; threshold fallback         | Design, Engineering, QA            | High     |
| FR1c  | Image-only GenAI Concierge                             | • ≥90% CV parse success<br>• Graceful error prompt<br>• Retry option                     | Poor image quality → pre-process; guidance; fallback to text  | Engineering, QA                    | Medium   |
| FR2   | LLM Response Guardrails & Bias Mitigation              | • Zero hallucinations in pilot<br>• Quarterly bias audit pass                            | Model drift → continuous scans; selective retrain triggers    | Data, Compliance, Engineering      | Critical |
| FR3   | Personalized Concierge Actions (book, upgrade, info)   | • ≥90% transaction success<br>• Rollback on any failure                                  | API sync errors → idempotent ops; transactional rollback      | Product, Engineering, UX, QA       | High     |
| FR4   | AR Wayfinding & Dynamic Re-Routing                     | • <5 s compute 95%<br>• ≥99.5% accuracy<br>• Auto-recompute on obstacles                 | Beacon drift → SLAM fallback; beacon health checks            | Engineering, SRE, QA               | Critical |
| FR5   | Baggage ETA Notifications via CV + QR Fallback         | • 99% ETA within ±30 s<br>• Notifications <2 s post-calc<br>• Setup <2 s                 | CV lag → QR fallback; caching; back-off                       | Engineering, Operations, QA        | High     |
| FR6   | AR Commerce Virtual Try-on & Checkout                  | • 3 s asset load<br>• ≥98% checkout success<br>• Cart persistence                        | Gateway outages → multi-gateway; offline sync                 | Product, Engineering, Payments, QA | High     |
| FR7   | Eco-Badge Issuance, Redemption & Social Sharing        | • <2 s minting<br>• ≥90% redemption<br>• Share events logged                             | API downtime → local cache; retry; user notification          | Sustainability, Marketing, QA      | Medium   |
| FR8   | Loyalty Points & AR Gamification                       | • <5 s crediting<br>• <10 s leaderboard refresh<br>• Zero event loss                     | Sync issues → event sourcing; reconciliation                  | Loyalty, Engineering, QA           | Medium   |
| FR9   | Global UI Brand, Localization & Accessibility          | • JSON theme support<br>• 100% i18n strings<br>• <1 s locale switch<br>• WCAG 2.1 AA     | Style drift → centralized theme; design QA                    | Design, Marketing, Engineering     | Critical |
| FR10  | Automated Analytics & Smart Alerting                   | • <15 m dash refresh<br>• <5 m alert-to-ack with runbook link                            | Alert storm → grouping; threshold tuning; smart notifications | Data, BI, Operations, QA           | Medium   |
| FR11  | Edge Node Offline Operation & Config Drift Remediation | • Resume <1 m post-network<br>• Auto-correct drift >95%                                  | Network partitions → local queue; remediation scripts         | Infra, SRE, Engineering            | High     |
| FR12  | Admin & Ops Manual Override Dashboard                  | • <5 s load<br>• <2 s action exec<br>• RBAC enforced                                     | Unauthorized access → RBAC; MFA; audit logs                   | Product, Ops, Security, UX, QA     | Medium   |
| FR13  | Compliance Reporting & Audit Export                    | • <60 s report gen<br>• 100% policy coverage<br>• PDF/CSV export                         | Missing logs → immutable storage; policy validation           | Legal, Compliance, Engineering, QA | Critical |
| FR14  | Partner API Lifecycle & Sandbox Management             | • <1 h onboarding<br>• >99% health checks<br>• Rollback support                          | Breaking changes → versioned contracts; sandbox tests         | Engineering, Partners, QA          | Medium   |
| FR15  | Feature Flagging & A/B Experimentation Control         | • 100% feature flag coverage<br>• 2 concurrent tests<br>• <1% misrouting                 | Overlap → isolation scopes; analytics guardrails              | Product, Engineering, Data, QA     | Medium   |
| FR16  | In-App Guided Walkthrough & Onboarding                 | • <2 m completion<br>• ≥95% task success<br>• Replayable tutorial                        | User drop-off → contextual prompts; skip option; A/B tests    | Design, UX, QA                     | High     |
| FR17  | Branded UI Components & Campaign Integration           | • <1 s asset load<br>• 3 banner slots/screen<br>• Campaign API hooks                     | Asset bloat → lazy load; optimization                         | Marketing, Design, Engineering     | Medium   |
| FR18  | Critical Alert Templates (In-App/Email/SMS)            | • 5 scenario templates<br>• Multi-channel fallback<br>• Audit logs                       | Notification failures → multi-channel retry; log audit        | Comms, Engineering, QA             | Critical |
| FR19  | Developer Portal, API Docs & SDK Distribution          | • Live OpenAPI portal<br>• SDK packages <5 m build<br>• Sandbox ready                    | Doc drift → CI docs validation; version tags                  | Tech PM, Engineering, QA           | Medium   |
| FR20  | Client SDK Health & Telemetry API                      | • <50 ms endpoint<br>• Reports init, mem, threads                                        | Telemetry overhead → sampled metrics; adaptive reporting      | Engineering, QA                    | Medium   |
| FR21  | Data Lineage, Schema Versioning & Metadata Registry    | • 100% pipeline lineage<br>• <500 ms metadata queries<br>• Versioned schemas             | Catalog lag → incremental updates; local cache                | Data, Engineering, QA              | High     |
| FR22  | Automated Security Pen-Tests & Chaos Engineering       | • Weekly scans ≥90% pass<br>• Monthly chaos on key flows<br>• Cross-browser regression   | Unidentified vulns → dedicated sprints; plugin updates        | QA, Security, Engineering          | High     |
| FR23  | Incident Management & Automated Runbook Access         | • P1/P2 alerts in PagerDuty<br>• Runbook link in each alert<br>• Quarterly DR/BCP drills | Misrouting → routing rules; drill retrospectives              | Ops, SRE, Engineering, QA          | Critical |

---

### 2. Non-Functional Requirements (NFR)
| NFR ID | Requirement                             | Metric/Target                                                      | Risks & Fallback                                             | Priority |
| ------ | --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| NFR1   | Global Multi-Region Availability        | 99.9% uptime; <5 m cross-region failover                           | Regional outage → DNS failover; auto-promote replica         | Critical |
| NFR2   | End-to-End Latency Performance          | GenAI <100 ms median, <200 ms 95th pct; Wayfinding <5 s; ETA ±30 s | Surge → cached responses; degraded mode; autoscaling         | Critical |
| NFR3   | Horizontal Scalability                  | 100k concurrent users/region; auto-scale <2 m                      | Capacity limits → rate limit; queue                          | High     |
| NFR4   | Security & Compliance                   | 100% SAST/DAST; policy-as-code; GDPR/PDPL/AI-Act & XRSI adherence  | New vuln → PR block; hotfix pipeline                         | Critical |
| NFR5   | Observability & Diagnostics             | 100% emit traces/metrics; alert fidelity >95%; MTTD <5 m           | Telemetry gaps → synthetic canaries; manual checks           | High     |
| NFR6   | Data Governance & Retention             | Logs 7 d; sessions 30 d; audits 365 d; lineage registry            | Storage overflow → archive to Glacier; retention enforcement | High     |
| NFR7   | Resilience & Disaster Recovery          | RTO <15 m; RPO <5 m; quarterly drills                              | DR fail → manual DR playbook; hot standby                    | Critical |
| NFR8   | Internationalization & Accessibility    | WCAG 2.1 AA; 100% locale coverage; RTL/LTR support                 | Audit failures → remediation backlog; sprints                | Medium   |
| NFR9   | Maintainability & Documentation         | ≥80% coverage; docs updated per release; <10% tech debt            | Stale docs → CI doc gates; scheduled updates                 | Medium   |
| NFR10  | Cost Efficiency & Resource Optimization | Infra spend < budget; cost/MAU monitored; <10% overage             | Overrun → cost alerts; scale-down                            | Medium   |
| NFR11  | Experimentation Platform SLA            | 2 concurrent A/B tests; <1% mis-routing                            | Experiment overlap → isolation; analytics guardrails         | Medium   |
| NFR12  | UX Performance & Usability Metrics      | Onboarding <2 m; task success ≥95%; SUS ≥80                        | Usability issues → UX sprints; A/B tests                     | Medium   |

---
### 3. FR & NFR Coverage for Epics

Each Epic is now mapped to clearly distinct Functional Requirements (FRs) and Non-Functional Requirements (NFRs), ensuring no broad or compound requirements hide gaps.

| Epic | Epics Name                   | Key FRs                                  | Key NFRs         |
| ---- | ---------------------------- | ---------------------------------------- | ---------------- |
| E1   | GenAI Concierge Core         | FR1a, FR1b, FR1c, FR2, FR3               | NFR2, NFR4, NFR5 |
| E2   | AR Wayfinding Engine         | FR4, FR16                                | NFR2, NFR3, NFR5 |
| E3   | Baggage ETA Tracking         | FR5                                      | NFR2, NFR5, NFR7 |
| E4   | AR Commerce Platform         | FR6                                      | NFR2, NFR10      |
| E5   | Sustainability Module        | FR7                                      | NFR6, NFR8       |
| E6   | Hybrid-Cloud Edge Deploy     | FR11                                     | NFR1, NFR7       |
| E7   | Analytics & Monitoring       | FR10, FR12                               | NFR5, NFR9       |
| E8   | Loyalty & Gamification       | FR8                                      | NFR8, NFR9       |
| E9   | Admin & Ops Portal           | FR12, FR23                               | NFR5, NFR9       |
| E10  | Compliance & Audit Dashboard | FR13, FR14                               | NFR4, NFR6       |
| All  | Cross-Cutting Needs          | FR15, FR17, FR18, FR19, FR20, FR21, FR22 | NFR11, NFR12     |
