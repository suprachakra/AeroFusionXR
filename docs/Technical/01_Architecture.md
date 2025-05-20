# System Architecture

A unified, narrative-driven architecture for **Aerofusion XR**, an enterprise-scale GenAI + XR platform tailored for a leading aviation group.

---

## 1. Introduction & Goals

**Objective:** Align every architectural decision with business targets, compliance requirements, and operational excellence—providing a single reference for all SVP stakeholders.

**Key Goals & Metrics:**

* **User Adoption:** 10% MAU in Year 1
* **AR Commerce Conversion:** 7% of users complete purchases
* **Eco Engagement:** 25% badge redemption rate
* **Performance SLAs:** 99.9% uptime, GenAI <100 ms median latency, Wayfinding <5 s route compute
* **Compliance:** Full GDPR, PDPL, AI-Act, XRSI traceability

---

## 2. Unified Architecture Views

### 2.1 Context + Container Diagram

Visualize how passengers, kiosks, and external systems interact with core Aerofusion XR services, and how those services deploy across edge and cloud.

```mermaid
flowchart TB
  %% Users & External
  subgraph "Users & External"
    App[Passenger App]
    Kiosk[On-Prem Kiosk]
    PSS[Amadeus PSS]
    Loyalty[Loyalty Platform]
    CarbonAPI[Carbon-Offset API]
    Pay[Payment Gateway]
  end

  %% Core Services Edge & Cloud
  subgraph "Airport Edge"
    Ingress[Edge Ingress LB]
    Renderer[AR Rendering]
    Cache[Redis Cache]
  end
  subgraph "AWS Region A"
    ALB(ALB)
    APIGW(API Gateway)
    Auth(Cognito)
    GenAI(GenAI Concierge)
    Way(Wayfinding Service)
    Bagg(Baggage ETA)
    Shop(AR Commerce)
    Eco(Sustainability)
    LoyaltyEng(Loyalty Engine)
    Infer(SageMaker Inference)
    DB[(Aurora PostgreSQL)]
    Kafka[(Kafka Cluster)]
    FS[(Redis Feature Store)]
    Lake[(S3 Data Lake)]
    Glue(EMR/Glue)
    Train(SageMaker Training)
  end
  subgraph "AWS Region B (Failover)"
    ALB2(ALB)
    APIGW2(API GW Replica)
  end

  App -->|HTTPS| APIGW
  App -->|AR SDK| Way
  App -->|WS| Bagg
  App -->|Webview| Shop
  App -->|Widget| Eco
  Kiosk -->|HTTPS| APIGW

  APIGW --> Auth
  APIGW --> GenAI --> Infer --> FS
  APIGW --> Way
  APIGW --> Bagg
  APIGW --> Shop
  APIGW --> Eco
  APIGW --> LoyaltyEng
  APIGW --> DB
  APIGW --> Kafka --> Lake --> Glue --> Train --> Infer

  Lake -->|BI reports| BI((Dashboards))
  ALB --- ALB2
  APIGW --- APIGW2
```

**Callouts:**

* **Edge Layer:** <50 ms local AR renders
* **Multi-Region HA:** Active–active with DNS failover
* **SLA Enforcement:** Probes, autoscaling, health checks on all services

---

## 3. Data & Control Flow

End-to-end journey for a GenAI concierge query, showing data ingestion, feature serving, model inference, and audit logging.

```mermaid
flowchart LR
  User[Passenger App] -->|POST /query| APIGW
  APIGW --> Parser[Intents & Entities]
  Parser --> FS[Feature Store]
  Parser -->|features| LLMRouter[LLM Router]
  LLMRouter -->|invoke| Infer(SageMaker)
  Infer -->|response| LLMRouter
  LLMRouter --> Formatter[Response Formatter]
  Formatter -->|localized| UI[Return to App]
  Formatter --> Audit[Audit Logger]
  Audit -->|logs| Lake

  subgraph Training & Governance
    Lake --> Glue[Batch ETL]
    Glue --> Train[Model Training & HPO]
    Train --> Reg[Model Registry]
    Reg --> Infer
    LLMRouter --> Drift[Drift Detector]
    LLMRouter --> Bias[Bias Auditor]
    Drift --> Retrain[Retrain Trigger]
    Bias --> Ethics[AI Ethics Board Review]
  end
```

**Callouts:**

* **Traceability:** end-to-end correlation IDs
* **Governance:** automated drift/bias alerts
* **Retention:** Raw logs 7 d, features 30 d, models 365 d

---

## 4. Core Features Overview

For each feature: a combined mini-diagram plus bullet summary of modules, SLAs, and failovers.

### 4.1 GenAI Concierge

```mermaid
flowchart LR
  APIGW --> GenAI[GenAI Svc]
  GenAI --> Infer(SageMaker)
  GenAI --> FS[Redis Feat Store]
  GenAI --> VDB[Vector DB]
  GenAI --> Audit[Guardrail Logger]
```

* **Modules:** Intent Parser, Vector Retriever, LLM Router, Response Formatter, Multilingual Middleware, Guardrail Logger
* **SLAs:** 95% requests <100 ms; 99.9% uptime
* **Resilience:** Circuit breakers, caching fallback (10 s)

### 4.2 AR Wayfinding

```mermaid
flowchart LR
  APIGW --> Way[Wayfinding Svc]
  Way --> Beacon[Fusion]
  Way --> SLAM[Optical SLAM]
  Way --> Router[Path Engine]
```

* **Modules:** Beacon Fusion, Optical SLAM, Path Engine, Route Formatter, Audit Logger
* **SLAs:** ≤5 s path compute; 99.5% accuracy
* **Fallback:** Vision-only on beacon loss

### 4.3 Baggage ETA

```mermaid
flowchart LR
  APIGW --> ETA[Baggage ETA Svc]
  ETA --> CV[CV Pipeline]
  ETA --> QR[QR Fallback]
  ETA --> Notifier[Notifier]
```

* **Modules:** Video Processor, QR Reader, ETA Calculator, Notification Service
* **SLAs:** 99% ETA within ±30 s
* **Fallback:** QR re-scan loops

### 4.4 AR Commerce

```mermaid
flowchart LR
  APIGW --> Shop[AR Commerce Svc]
  Shop --> Loader[3D Asset Loader]
  Shop --> Render[WebGL Renderer]
  Shop --> Cart[Cart Service]
  Shop --> Pay[Payment Engine]
```

* **Modules:** Asset Loader, Renderer, Cart Manager, Payment SDK, Recommender
* **SLAs:** +12% basket size; cart persistence
* **Fallback:** Local storage on network issues

### 4.5 Sustainability

```mermaid
flowchart LR
  APIGW --> Eco[Eco Svc]
  Eco --> Collector[CO₂ Collector]
  Eco --> Badge[Badge Engine]
  Eco --> Share[Social Share]
```

* **Modules:** CO₂ Collector, Badge Minting, Leaderboard, Social Share
* **SLAs:** 25% badge redemption
* **Fallback:** Cached offset data

---

## 5. Cross-Cutting Concerns

### 5.1 Security & Compliance

* **Zero-Trust:** mTLS, network policies
* **Key Management:** KMS/HSM flows embedded in services
* **Policy as Code:** OPA/GitHub Actions gates on GDPR/PDPL/AI-Act
* **Audit Trail:** WORM storage, blockchain anchoring

### 5.2 Network Topology

```mermaid
flowchart TB
  K8sEdge[K8s Edge] --> VPN[Tunnel] --> TGW[Transit GW] --> EKS[EKS Cluster]
  EKS --> ALB[ALB]
```

* <50 ms edge, <100 ms regional

### 5.3 CI/CD & Testing

```mermaid
flowchart LR
  Repo --> CI[CI Pipeline]
  CI --> LintTest[Lint & Test]
  CI --> SecurityScans[Security Scans]
  CI --> PolicyChecks[Policy Checks]
  CI --> BuildSign[Build & Sign]
  CI --> Deploy["Dev→QA→Prod"]
  Deploy --> CanaryChaosTests["Canary & Chaos Tests"]
  CanaryChaosTests --> Rollback[Rollback]
```

* Automated beacon & network failure tests

---

## 6. Appendices

### A. Full Sequence Diagrams

#### A.1 GenAI Concierge Query Flow

```mermaid
sequenceDiagram
  participant U as Passenger App
  participant AG as API Gateway
  participant IP as Intent Parser
  participant VR as Vector Retriever
  participant LR as LLM Router
  participant SM as SageMaker Endpoint
  participant RF as Response Formatter
  participant MM as Multilingual Middleware
  participant AU as Audit Logger
  participant DB as Session DB

  U->>AG: POST /query { text }
  AG->>IP: parseIntent(text)
  IP-->>AG: intent + entities
  AG->>VR: fetchFeatures(userID)
  VR-->>AG: featureSet
  AG->>LR: routeToLLM(intent, featureSet)
  LR->>SM: invokeModel(prompt)
  SM-->>LR: rawResponse
  LR->>RF: formatResponse(rawResponse)
  RF->>MM: localize(response)
  MM-->>RF: localizedResponse
  RF->>DB: saveSession(userID, metadata)
  RF->>AU: logAudit(request, response)
  RF-->>AG: { response }
  AG-->>U: 200 OK + response
```

#### A.2 AR Wayfinding Request Flow

```mermaid
sequenceDiagram
  participant U as Passenger App
  participant AG as API Gateway
  participant BF as Beacon Fusion Service
  participant OS as Optical SLAM
  participant PE as Path Engine
  participant RF2 as Route Formatter
  participant DB2 as Audit DB

  U->>AG: GET /route?from=A&to=B
  AG->>BF: getBeaconSignals(location)
  BF-->>AG: rawBeaconData
  AG->>OS: computePosition(rawBeaconData, cameraFrames)
  OS-->>AG: coordinates
  AG->>PE: calculatePath(coordinates, destination)
  PE-->>AG: waypoints
  AG->>RF2: formatRoute(waypoints)
  RF2-->>AG: routePayload
  AG->>DB2: logRouteRequest(userID, routePayload)
  AG-->>U: 200 OK + routePayload
```

#### A.3 Baggage ETA Notification Flow

```mermaid
sequenceDiagram
  participant U as Passenger App
  participant AG as API Gateway
  participant VS as Video Processing
  participant QR as QR Fallback
  participant EC as ETA Calculator
  participant NT as Notification Service
  participant DB3 as Event Store

  U->>AG: SUBSCRIBE /eta?bagID=123
  AG->>DB3: registerSubscription(userID, bagID)
  loop Every 5s
    AG->>VS: processVideoStream(bagID)
    alt visual detection success
      VS-->>AG: coords
    else
      AG->>QR: scanQRCode(image)
      QR-->>AG: coords
    end
    AG->>EC: computeETA(coords)
    EC-->>AG: etaValue
    AG->>NT: pushNotification(userID, etaValue)
    AG->>DB3: logETAEvent(userID, bagID, etaValue)
  end
```

#### A.4 AR Commerce Purchase Flow

```mermaid
sequenceDiagram
  participant U as Passenger App
  participant AG as API Gateway
  participant AL as Asset Loader
  participant RD as Renderer
  participant CT as Cart Service
  participant PD as Payment Daemon
  participant OD as Order DB
  participant NT2 as Notification Service

  U->>AG: GET /products
  AG->>AL: load3DAssets()
  AL-->>RD: assetData
  RD-->>AG: renderReady
  AG-->>U: 200 OK + productList

  U->>AG: POST /cart { itemID }
  AG->>CT: addItem(userID, itemID)
  CT-->>OD: createCartEntry
  CT-->>AG: cartState
  AG-->>U: 200 OK + cartState

  U->>AG: POST /checkout { paymentInfo }
  AG->>PD: processPayment(paymentInfo)
  PD-->>AG: paymentConfirmation
  AG->>OD: finalizeOrder(userID)
  OD-->>AG: orderReceipt
  AG->>NT2: sendReceipt(userID, orderReceipt)
  AG-->>U: 200 OK + orderReceipt
```

#### A.5 Sustainability Badge Issuance Flow

```mermaid
sequenceDiagram
  participant U as Passenger App
  participant AG as API Gateway
  participant CC as CO2 Collector
  participant BE2 as Badge Engine
  participant DB5 as Badge DB
  participant SS as Social Share Service

  U->>AG: POST /sustain/earn { activityData }
  AG->>CC: calculateCO2(activityData)
  CC-->>AG: co2Value
  AG->>BE2: mintBadge(userID, co2Value)
  BE2-->>DB5: storeBadge(userID, badgeID)
  BE2-->>AG: badgeInfo
  AG-->>U: 201 Created + badgeInfo
  U->>AG: POST /sustain/share { badgeID }
  AG->>SS: shareOnSocial(userID, badgeID)
  SS-->>AG: shareStatus
  AG-->>U: 200 OK + shareStatus
```
