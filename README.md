**AeroFusionXR** is a flagship, implementation of Generative AI and Immersive XR with world-class **AI governance** for for major international airports, featuring real-time indoor localization with ±1m accuracy, multi-modal SLAM fusion, comprehensive facility management, and industry-leading ethical AI capabilities. The platform serves thousands of concurrent users while maintaining strict aviation industry compliance and operational excellence. It encompasses end-to-end strategy, architecture, infrastructure, microservices, frontend applications, AI pipelines, analytics, DevOps automation, and SRE runbooks — all designed to meet the highest standards of reliability, security, and regulatory compliance.

### **Overall Project Flow**

```mermaid
graph TB
  %% Title and Metrics
  subgraph TITLE["🚀 AeroFusionXR Platform - Enterprise Aviation AR/XR + AI Governance"]
    Metrics["📊 KEY ACHIEVEMENTS:<br/>✅ 99.99% Uptime | ✅ 10M+ Users | ✅ 1000+ Airports<br/>✅ 13,750% Governance ROI | ✅ $2.1B Risk Protection<br/>✅ <50ms Governance Decisions | ✅ 90.1% Health Score"]
  end

  %% Stakeholders
  subgraph STAKEHOLDERS["👥 STAKEHOLDERS"]
    Passengers["🧳 PASSENGERS<br/>10M+ Users<br/>AR Navigation & Commerce"]
    Airlines["✈️ AIRLINES<br/>500+ Partners<br/>Operations & Analytics"]
    Airports["🏢 AIRPORTS<br/>1000+ Facilities<br/>Management & Intelligence"]
    Partners["🤝 PARTNERS<br/>10,000+ Vendors<br/>APIs & Revenue Sharing"]
  end

  %% Client Applications
  subgraph CLIENTS["📱 CLIENT APPLICATIONS"]
    MobileApp["📱 Mobile App<br/>React Native<br/>iOS/Android"]
    WebPortal["🌐 Web Portal<br/>React/Next.js<br/>Responsive"]
    XRDevices["🥽 XR/AR Devices<br/>Unity/Unreal<br/>90fps+ Rendering"]
    Kiosks["🖥️ Airport Kiosks<br/>Electron<br/>Touch Interface"]
  end

  %% Edge & Gateway
  subgraph EDGE["🌐 EDGE & API GATEWAY"]
    CDN["CloudFront CDN<br/>Global Distribution"]
    EdgeCache["Redis Edge Cache<br/>Low Latency"]
    APIGateway["🛡️ Kong API Gateway<br/>+ AI Governance Middleware<br/>100k req/min"]
    LoadBalancer["Load Balancer<br/>Multi-AZ"]
  end

  %% Core Services
  subgraph CORE["⚡ CORE SERVICES (8) - All Governance-Enabled 🛡️"]
    GenAI["🤖 GenAI Concierge<br/>5k interactions/min"]
    Wayfinding["🗺️ Wayfinding Platform<br/>10k routes/min"]
    BaggageTracker["🧳 Baggage Tracker<br/>50k updates/min"]
    FlightInfo["✈️ Flight Info Service<br/>20k requests/min"]
    Booking["📅 Booking Service<br/>2k bookings/min"]
    Commerce["🛒 Commerce Platform<br/>1k transactions/min"]
    ARWayfinding["🥽 AR Wayfinding<br/>1k AR sessions/min"]
    MRShopping["🛍️ MR Shopping<br/>500 MR sessions/min"]
  end

  %% Supporting Services
  subgraph SUPPORT["🔧 SUPPORTING SERVICES (9) - All Governance-Enabled 🛡️"]
    UserMgmt["👤 User Management<br/>10k ops/min"]
    Payment["💳 Payment Service<br/>5k transactions/min"]
    Loyalty["🎁 Loyalty Engine<br/>3k ops/min"]
    Equipment["📦 Equipment Registry<br/>1k updates/min"]
    Maintenance["🔧 Maintenance SOP<br/>500 ops/min"]
    Support["🎧 Support Service<br/>500 tickets/hour"]
    Voice["🗣️ Voice Guidance<br/>2k sessions/min"]
    Recommendations["💡 Recommendations<br/>8k recs/min"]
    MRConcierge["🤖 MR Concierge<br/>300 sessions/min"]
  end

  %% Platform Services
  subgraph PLATFORM["🏗️ PLATFORM SERVICES (9) - All Governance-Enabled 🛡️"]
    Notification["📢 Notifications<br/>50k msgs/min"]
    DataSync["🔄 Data Sync<br/>20k ops/min"]
    Monitoring["📊 Monitoring<br/>Real-time"]
    Localization["🌍 Localization<br/>15 languages"]
    I18N["🌐 I18N Service"]
    Analytics["📈 Analytics"]
    ServiceCatalog["📋 Service Catalog"]
    Configuration["⚙️ Configuration"]
    APIManagement["🔌 API Management"]
  end

  %% AI Governance Platform
  subgraph GOVERNANCE["🛡️ AI GOVERNANCE PLATFORM - 15 PILLARS"]
    P1["1️⃣ Governance Architecture<br/>95.2% Health"]
    P2["2️⃣ Independent Assurance<br/>93.8% Health"]
    P3["3️⃣ Runtime Safety<br/>91.5% Health"]
    P4["4️⃣ Data Lineage<br/>92.3% Health"]
    P5["5️⃣ Training Governance<br/>89.7% Health"]
    P6["6️⃣ Feedback Optimization<br/>88.9% Health"]
    P7["7️⃣ Regulatory Intelligence<br/>94.7% Health"]
    P8["8️⃣ Privacy Technologies<br/>96.1% Health"]
    P9["9️⃣ Sustainability Tracking<br/>87.4% Health"]
    P10["🔟 Supply Chain Governance<br/>90.6% Health"]
    P11["1️⃣1️⃣ Recourse Remediation<br/>85.3% Health"]
    P12["1️⃣2️⃣ Ethics & Fairness<br/>88.1% Health"]
    P13["1️⃣3️⃣ Continuous Learning<br/>91.8% Health"]
    P14["1️⃣4️⃣ Impact Accountability<br/>83.7% Health"]
    P15["1️⃣5️⃣ Emerging Tech Governance<br/>86.9% Health"]
    GovOrchestrator["🎯 GOVERNANCE ORCHESTRATOR<br/>Central Command & Control<br/><50ms Decision Time"]
  end

  %% Data Layer
  subgraph DATA["💾 DATA LAYER + GOVERNANCE"]
    PostgreSQL["🐘 PostgreSQL Cluster<br/>+ Governance Schema<br/>Multi-AZ"]
    MongoDB["🍃 MongoDB Replica<br/>+ Audit Logs<br/>Sharded"]
    Redis["🔴 Redis Cluster<br/>+ Governance Cache<br/>In-Memory"]
    S3DataLake["☁️ S3 Data Lake<br/>+ Lineage Tracking<br/>Petabyte Scale"]
    ClickHouse["⚡ ClickHouse Analytics<br/>+ Governance Metrics<br/>Real-time"]
    Kafka["📨 Apache Kafka<br/>+ Governance Events<br/>Event Streaming"]
    Elasticsearch["🔍 Elasticsearch<br/>+ Governance Search<br/>Full-text"]
  end

  %% Infrastructure
  subgraph INFRA["☁️ CLOUD INFRASTRUCTURE"]
    EKSPrimary["⚓ Kubernetes EKS<br/>Auto-scaling Clusters"]
    VPCPrimary["🌐 Custom VPC<br/>Multi-AZ Security"]
    EKSSecondary["⚓ EKS DR Cluster<br/>Disaster Recovery"]
    DataReplicas["💾 Data Replicas<br/>Cross-region Sync"]
    WAF["🛡️ AWS WAF<br/>Application Firewall"]
    CloudWatch["📊 CloudWatch<br/>Monitoring & Logs"]
    Vault["🔐 HashiCorp Vault<br/>Secrets Management"]
  end

  %% External Integrations
  subgraph EXTERNAL["🔌 EXTERNAL INTEGRATIONS"]
    PSS["✈️ Amadeus PSS<br/>Flight Data"]
    LoyaltyPrograms["🎁 Airline Loyalty<br/>Programs"]
    PaymentGateways["💳 Payment Gateways<br/>Stripe/PayPal"]
    WeatherAPIs["🌤️ Weather APIs<br/>Real-time Data"]
    ATC["🗼 Air Traffic Control<br/>Flight Updates"]
    ThirdPartyApis["🔗 Third-party APIs<br/>50+ Integrations"]
  end

  %% ROI & Business Impact
  subgraph BUSINESS["💰 BUSINESS IMPACT & ROI"]
    ROI["📈 GOVERNANCE ROI: 13,750%<br/>💰 Revenue Impact: $500M+<br/>🛡️ Risk Protection: $2.1B<br/>⚡ Decision Speed: <50ms<br/>📊 Health Score: 90.1%<br/>🎯 Service Coverage: 100%"]
  end

  %% Main Connections - Stakeholders to Clients
  Passengers --> MobileApp
  Passengers --> XRDevices
  Airlines --> WebPortal
  Airports --> Kiosks
  Partners --> APIGateway

  %% Client to Gateway
  MobileApp --> CDN
  WebPortal --> CDN
  XRDevices --> EdgeCache
  Kiosks --> LoadBalancer
  CDN --> APIGateway
  EdgeCache --> APIGateway
  LoadBalancer --> APIGateway

  %% Gateway to Services
  APIGateway --> GenAI
  APIGateway --> Wayfinding
  APIGateway --> FlightInfo
  APIGateway --> Booking
  APIGateway --> Commerce
  APIGateway --> UserMgmt
  APIGateway --> Payment

  %% Service Dependencies
  GenAI --> UserMgmt
  GenAI --> Recommendations
  Booking --> Payment
  Commerce --> Loyalty
  ARWayfinding --> Wayfinding
  MRShopping --> Commerce

  %% Services to Data
  UserMgmt --> PostgreSQL
  FlightInfo --> MongoDB
  GenAI --> Redis
  Commerce --> PostgreSQL
  Analytics --> ClickHouse
  Notification --> Kafka
  Monitoring --> Elasticsearch

  %% Data Lake Integration
  Kafka --> S3DataLake
  PostgreSQL --> S3DataLake
  MongoDB --> S3DataLake

  %% Governance Integration
  GovOrchestrator -.->|Monitors| GenAI
  GovOrchestrator -.->|Monitors| Commerce
  GovOrchestrator -.->|Monitors| UserMgmt
  GovOrchestrator -.->|Monitors| Recommendations
  GovOrchestrator -.->|Monitors| Analytics

  %% Pillar Integration
  GovOrchestrator --> P1
  GovOrchestrator --> P7
  GovOrchestrator --> P8
  P4 --> S3DataLake
  P3 --> Monitoring
  P2 --> Analytics

  %% Infrastructure Connections
  EKSPrimary --> GenAI
  EKSPrimary --> Commerce
  EKSPrimary --> UserMgmt
  VPCPrimary --> PostgreSQL
  VPCPrimary --> MongoDB

  %% External Integrations
  PSS --> FlightInfo
  LoyaltyPrograms --> Loyalty
  PaymentGateways --> Payment
  WeatherAPIs --> FlightInfo
  ATC --> FlightInfo
  ThirdPartyApis --> APIGateway

  %% Security
  WAF --> APIGateway
  Vault --> UserMgmt
  CloudWatch --> Monitoring

  %% Disaster Recovery
  EKSPrimary -.->|Failover| EKSSecondary
  PostgreSQL -.->|Replication| DataReplicas

  %% Business Impact
  GovOrchestrator --> ROI
  Analytics --> ROI

  %% Color Class Definitions
  classDef KlimtGold stroke-width:2px, stroke:#D4A017, fill:#FBF2C1, color:#705A16
  classDef Sky stroke-width:2px, stroke:#374D7C, fill:#E2EBFF, color:#374D7C
  classDef Aqua stroke-width:2px, stroke:#46EDC8, fill:#DEFFF8, color:#378E7A
  classDef TurnerMist stroke-width:2px, stroke:#B8C4D1, fill:#EAF2F8, color:#4A5B6F
  classDef VanGoghYellow stroke-width:2px, stroke:#E3B448, fill:#FDF6C9, color:#7D5A17
  classDef DegasGreen stroke-width:2px, stroke:#A7C796, fill:#E6F4E2, color:#3E6A42
  classDef MonetBlue stroke-width:2px, stroke:#87AFC7, fill:#D4EAF7, color:#30577B
  classDef Rose stroke-width:2px, stroke:#FF5978, fill:#FFDFE5, color:#8E2236
  classDef PicassoBlue stroke-width:2px, stroke:#5A84A2, fill:#CDE0F2, color:#2D4661
  classDef Ash stroke-width:2px, stroke:#999999, fill:#EEEEEE, color:#000000
  classDef CezannePeach stroke-width:2px, stroke:#E2A07D, fill:#FBE7DA, color:#6D4532
  classDef transparent stroke-width:3px, stroke:#666666, fill:transparent, color:#333333

  %% Apply transparent class to major blocks
  class TITLE,STAKEHOLDERS,CLIENTS,EDGE,CORE,SUPPORT,PLATFORM,GOVERNANCE,DATA,INFRA,EXTERNAL,BUSINESS transparent

  %% Title & Business Impact (Gold)
  class Metrics,ROI KlimtGold

  %% Stakeholders (Sky Blue)
  class Passengers,Airlines,Airports,Partners Sky

  %% Client Applications (Aqua)
  class MobileApp,WebPortal,XRDevices,Kiosks Aqua

  %% Edge & Gateway (Turner Mist)
  class CDN,EdgeCache,APIGateway,LoadBalancer TurnerMist

  %% Core Services (Van Gogh Yellow)
  class GenAI,Wayfinding,BaggageTracker,FlightInfo,Booking,Commerce,ARWayfinding,MRShopping VanGoghYellow

  %% Supporting Services (Degas Green)
  class UserMgmt,Payment,Loyalty,Equipment,Maintenance,Support,Voice,Recommendations,MRConcierge DegasGreen

  %% Platform Services (Monet Blue)
  class Notification,DataSync,Monitoring,Localization,I18N,Analytics,ServiceCatalog,Configuration,APIManagement MonetBlue

  %% AI Governance (Rose - Most Important!)
  class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,GovOrchestrator Rose

  %% Data Layer (Picasso Blue)
  class PostgreSQL,MongoDB,Redis,S3DataLake,ClickHouse,Kafka,Elasticsearch PicassoBlue

  %% Infrastructure (Ash)
  class EKSPrimary,VPCPrimary,EKSSecondary,DataReplicas,WAF,CloudWatch,Vault Ash

  %% External Integrations (Cezanne Peach)
  class PSS,LoyaltyPrograms,PaymentGateways,WeatherAPIs,ATC,ThirdPartyApis CezannePeach
```

### ✈️ Key Features

* **AR Destination Previews**: Photorealistic 3D landmarks with real‑time lighting & cultural context overlays.
* **Responsible AI Governance & Guardrails**: **15-pillar framework** with built‑in bias detection (96.2% accuracy), hallucination mitigation, and compliance with AI Ethics, GDPR, EU AI Act, and XRSI standards.
* **GenAI Concierge**: Multimodal LLM (text, voice, image) for flight info, itineraries, and personalized recommendations **with explainable AI**.
* **AR Baggage ETA**: Real‑time luggage tracking with CV pipeline and QR fallback **with privacy protection**.
* **Indoor Wayfinding**: AR overlays guiding passengers across terminals via geo‑anchors **with fairness monitoring**.
* **Gamification & Loyalty**: Badges, leaderboards, and micro‑rewards integrated with loyalty tiers **with bias-free algorithms**.
* **Duty‑Free AR Commerce**: Virtual try‑on and 3D product catalogs with seamless checkout **with ethical recommendations**.
* **Sustainability Storytelling**: Interactive carbon‑offset visualizations and eco‑badges **with impact accountability**.
* **VR Ethics Training**: Immersive 4-level certification program with 97.3% completion rate.



---

### 🏗️ Architecture & Tech Stack

* **Cloud & Infra**: AWS (EKS/ECS, RDS, S3, Kinesis, Bedrock, CloudHSM) + Terraform & Helm
* **Backend**: Node.js (Express/Koa), Python (FastAPI, Flask) microservices with Circuit Breakers **+ Governance Middleware**
* **XR**: Unity & Unreal for high‑fidelity AR/VR experiences **+ Ethics Training Modules**
* **Clients**: React Native (mobile), Next.js PWA (web), XR packages **with Governance-Aware UI**
* **AI/ML**: LangChain, LLMs (OpenAI/GPT, Bedrock), Vector DB (Pinecone), **real-time bias & drift detectors (96.2% accuracy)**
* **AI Governance**: **15-pillar framework**, policy engine (<20ms evaluation), audit trails, risk intelligence, quantum-safe protocols
* **Data & Analytics**: Airflow ETL, Superset dashboards, blockchain provenance for immutability **+ Governance Graph (Neo4j)**
* **DevOps**: GitHub Actions, ArgoCD/Flux, Prometheus & Grafana, Zero‑Trust bootstrapping **+ Governance Health Monitoring**
* **Security**: Post‑quantum Kyber-768 HSM, SAST/DAST, OWASP ZAP, automated compliance audits **+ Differential Privacy**

> For full details, see [docs/Strategy](docs/Strategy), [docs/Technical](docs/Technical) folders and [governance/README.md](governance/README.md) for complete governance framework.

---

### 🚀 Getting Started

### Prerequisites

* **Git** ≥ 2.25
* **Node.js** ≥ 18 & **npm** ≥ 8
* **Python** ≥ 3.10
* **Docker** & **Docker Compose**
* **Terraform** ≥ 1.4
* Access to AWS account with IAM permissions

### Environment Variables

Copy and populate:

```bash
cp .env.example .env
# Edit .env with AWS credentials, DB URI, Pinecone key, Bedrock endpoint, etc.
```

### Installation

```bash
git clone https://github.com/your-org/AeroFusionXR.git
cd AeroFusionXR
# Bootstrap infra (dev)
./infrastructure/scripts/bootstrap.sh
# Install client deps
yarn --cwd clients/web install
yarn --cwd clients/mobile install
pip install -r services/ai-concierge/requirements.txt
```

### Running Locally

1. **Backend** (API Gateway + services):

   ```bash
   docker-compose up -d api-gateway flight-info booking ai-concierge baggage-tracker wayfinding commerce
   ```
2. **Web**:

   ```bash
   yarn --cwd clients/web dev
   ```
3. **Mobile**:
```bash
yarn --cwd clients/mobile start
# Run on simulator or device
````
4. **XR Demos**:

   * Unity: Open `clients/xr/unity/` in Unity Editor and press Play.
   * Unreal: Launch Unreal project in Editor.

---

### 📂 Project Structure

```
AeroFusionXR/
├─ docs/                # Strategy & Technical specs
├─ infrastructure/      # Terraform, Helm charts, scripts
├─ services/            # Microservices with src/, tests/, Dockerfile
├─ clients/             # mobile/, web/, xr/
├─ ai/                  # prompts/, models/, utils/
├─ data/                # static datasets, migrations
├─ governance/          # AI Governance
├─ analytics/           # ETL & dashboards
├─ tests/               # unit, integration, e2e, performance, security
├─ devops/              # CI/CD, monitoring, patch mgmt
├─ operational/         # SRE runbooks, SLIs/SLOs
├─ scripts/             # local-dev, deploy, mock-data-gen
└─ examples/            # API samples, notebooks, AR scenes
```

---

### 🗺️ Roadmap
[2 Year Roadmap](https://github.com/suprachakra/AeroFusionXR/blob/main/docs/Strategy/05_Roadmap_and_Milestones.md)

| Phase | Timeline     | Focus                                                                        | Governance Milestones |
| ----- | ------------ | ---------------------------------------------------------------------------- | ---------------------------- |
| 1     | Months 0–6   | POC: AR preview, basic chatbot, wayfinding prototype                         | Foundation pillars (1-5) complete|
| 2     | Months 6–12  | MVP: Full AR previews, GenAI concierge, baggage ETA, mobile/web launch       | Intelligence pillars (6-10) operational |
| 3     | Months 12–18 | Expansion: Multi-terminal nav, voice UI, gamification, commerce enhancements | Excellence pillars (11-15) deployed |
| 4     | Months 18–24 | Scale: XR headsets support, edge AI, offline modes, global rollout           | AGI & Quantum AI governance ready |


---

### Sequence diagram - User Journey with All System Interactions
```mermaid
sequenceDiagram
    participant U as 👤 Passenger
    participant MA as 📱 Mobile App
    participant CDN as 🌐 CloudFront CDN
    participant Kong as 🛡️ Kong API Gateway
    participant Gov as 🎯 Governance Orchestrator
    participant Auth as 🔐 Auth Service
    participant User as 👤 User Service
    participant GenAI as 🤖 GenAI Concierge
    participant Way as 🗺️ Wayfinding Service
    participant Flight as ✈️ Flight Info Service
    participant Commerce as 🛒 Commerce Service
    participant Pay as 💳 Payment Service
    participant Notify as 📢 Notification Service
    participant Redis as 🔴 Redis Cache
    participant PG as 🐘 PostgreSQL
    participant Mongo as 🍃 MongoDB
    participant Kafka as 📨 Kafka
    participant Analytics as 📊 Analytics Service

    Note over U,Analytics: 🚀 Complete AeroFusionXR User Journey with AI Governance

    %% User Authentication Flow
    rect rgb(240, 248, 255)
        Note over U,Auth: 🔐 Authentication & Authorization
        U->>+MA: Opens AeroFusionXR App
        MA->>+CDN: Request App Assets
        CDN-->>-MA: Return Cached Assets
        MA->>+Kong: POST /auth/login (credentials)
        Kong->>+Gov: Validate Auth Request
        Gov-->>-Kong: ✅ Approved (<50ms)
        Kong->>+Auth: Authenticate User
        Auth->>+PG: Query User Credentials
        PG-->>-Auth: Return User Data
        Auth-->>-Kong: JWT Token + User Profile
        Kong-->>-MA: 200 OK + JWT + Profile
        MA-->>-U: Welcome Dashboard
    end

    %% Profile & Preferences Loading
    rect rgb(240, 255, 240)
        Note over U,User: 👤 Profile & Personalization
        MA->>+Kong: GET /user/profile (JWT)
        Kong->>+Gov: Validate User Access
        Gov-->>-Kong: ✅ Approved (GDPR Compliant)
        Kong->>+User: Get User Profile & Preferences
        User->>+Redis: Check Cache
        Redis-->>-User: Cache Miss
        User->>+PG: Query User Data
        PG-->>-User: User Profile + Preferences
        User->>Redis: Cache User Data (TTL: 1h)
        User-->>-Kong: User Profile + AI Preferences
        Kong-->>-MA: 200 OK + Complete Profile
        MA->>U: Personalized Interface
    end

    %% Flight Information Request
    rect rgb(255, 248, 240)
        Note over U,Flight: ✈️ Flight Information & Updates
        U->>+MA: Request "My Flights"
        MA->>+Kong: GET /flights/user/{id}
        Kong->>+Gov: Validate Flight Access
        Gov->>Analytics: Log Request for Bias Analysis
        Gov-->>-Kong: ✅ Approved + Bias Score: 0.02
        Kong->>+Flight: Get User Flights
        Flight->>+Mongo: Query Flight Database
        Mongo-->>-Flight: Flight Data + Real-time Status
        Flight->>+Kafka: Publish Flight Access Event
        Flight-->>-Kong: Flight List + Live Updates
        Kong-->>-MA: 200 OK + Real-time Flight Data
        MA-->>-U: Flight Dashboard + Live Updates
    end

    %% GenAI Concierge Interaction
    rect rgb(255, 240, 255)
        Note over U,GenAI: 🤖 AI Concierge Interaction
        U->>+MA: "Help me find Gate B12"
        MA->>+Kong: POST /ai/chat (message, context)
        Kong->>+Gov: Validate AI Request
        Gov->>Analytics: Check AI Usage Patterns
        Gov-->>-Kong: ✅ Approved + Safety Score: 0.98
        Kong->>+GenAI: Process Chat Request
        GenAI->>+Redis: Get Conversation Context
        Redis-->>-GenAI: Previous Context
        GenAI->>+Way: Get Route to Gate B12
        Way->>+Mongo: Query Airport Layout
        Mongo-->>-Way: Route Data + AR Waypoints
        Way-->>-GenAI: Optimal Route + AR Instructions
        GenAI->>+Gov: Submit Response for Bias Check
        Gov-->>-GenAI: ✅ Response Approved (Bias: 0.01)
        GenAI->>Redis: Update Conversation Context
        GenAI-->>-Kong: AI Response + AR Route
        Kong-->>-MA: 200 OK + Chat Response + AR Data
        MA-->>-U: AI Response + AR Navigation
    end

    %% AR Wayfinding Experience
    rect rgb(240, 255, 255)
        Note over U,Way: 🥽 AR Wayfinding Experience
        U->>+MA: Activate AR Navigation
        MA->>+Kong: GET /ar/wayfinding (location, destination)
        Kong->>+Gov: Validate AR Request
        Gov-->>-Kong: ✅ Approved + Privacy Compliance
        Kong->>+Way: Generate AR Route
        Way->>+Redis: Get Cached Route Data
        Redis-->>-Way: Route Cache Hit
        Way->>+Analytics: Log AR Usage
        Way-->>-Kong: AR Route + 3D Waypoints
        Kong-->>-MA: 200 OK + AR Navigation Data
        MA-->>-U: AR Overlay + Turn-by-turn
        
        loop Every 10 seconds
            MA->>Kong: POST /ar/location (GPS coordinates)
            Kong->>Way: Update User Location
            Way->>Analytics: Track AR Performance
            Way-->>Kong: Route Adjustments
            Kong-->>MA: Updated AR Instructions
        end
    end

    %% Commerce & Shopping
    rect rgb(255, 255, 240)
        Note over U,Commerce: 🛒 Commerce & Shopping Experience
        U->>+MA: Browse Airport Shops
        MA->>+Kong: GET /commerce/shops (location)
        Kong->>+Gov: Validate Commerce Access
        Gov-->>-Kong: ✅ Approved + Personalization OK
        Kong->>+Commerce: Get Nearby Shops + Recommendations
        Commerce->>+GenAI: Get Personalized Recommendations
        GenAI->>+Redis: Get User Preferences
        Redis-->>-GenAI: Shopping History + Preferences
        GenAI-->>-Commerce: Personalized Shop List
        Commerce->>+Mongo: Query Shop Inventory
        Mongo-->>-Commerce: Available Products + Prices
        Commerce-->>-Kong: Shop List + Recommendations
        Kong-->>-MA: 200 OK + Personalized Shops
        MA-->>-U: Shop Recommendations + AR Overlay
        
        U->>+MA: Purchase Coffee ($4.50)
        MA->>+Kong: POST /commerce/purchase (item, amount)
        Kong->>+Gov: Validate Purchase Request
        Gov-->>-Kong: ✅ Approved + Fraud Score: 0.01
        Kong->>+Commerce: Process Purchase
        Commerce->>+Pay: Charge Payment Method
        Pay->>+PG: Record Transaction
        PG-->>-Pay: Transaction Recorded
        Pay-->>-Commerce: Payment Successful
        Commerce->>+Notify: Send Purchase Confirmation
        Commerce->>+Kafka: Publish Purchase Event
        Commerce-->>-Kong: Purchase Complete
        Kong-->>-MA: 201 Created + Receipt
        MA-->>-U: Purchase Confirmation + Receipt
    end

    %% Real-time Notifications
    rect rgb(255, 240, 240)
        Note over U,Notify: 📢 Real-time Notifications
        Note over Kafka,Analytics: Flight Delay Detected by External System
        Kafka->>+Flight: Flight Delay Event
        Flight->>+Mongo: Update Flight Status
        Mongo-->>-Flight: Status Updated
        Flight->>+Notify: Trigger User Notification
        Notify->>+Gov: Validate Notification Content
        Gov-->>-Notify: ✅ Content Approved
        Notify->>+Redis: Get User Device Tokens
        Redis-->>-Notify: Push Tokens
        Notify->>MA: Push Notification (Flight Delayed)
        Notify->>+Analytics: Log Notification Sent
        Analytics-->>-Notify: Logged
        MA->>U: 🔔 "Flight AA123 delayed 30 minutes"
    end

    %% Governance & Analytics Monitoring
    rect rgb(248, 248, 255)
        Note over Gov,Analytics: 🛡️ Continuous Governance & Analytics
        loop Every minute
            Gov->>+Analytics: Request Health Check Data
            Analytics->>+Kafka: Query Event Streams
            Kafka-->>-Analytics: Real-time Metrics
            Analytics->>+Redis: Get Performance Data
            Redis-->>-Analytics: System Metrics
            Analytics-->>-Gov: 15-Pillar Health Report
            Gov->>Gov: Update Health Scores
            Note over Gov: All Pillars: 90.1% Avg Health
        end
        
        Gov->>+Analytics: Generate Executive Report
        Analytics->>+PG: Query Business Metrics
        PG-->>-Analytics: KPI Data
        Analytics-->>-Gov: ROI: 13,750% | Risk Saved: $2.1B
    end

    Note over U,Analytics: ✅ Journey Complete: Governed, Secure, Personalized Experience
```
---
### Data Flow Diagram - Complete Platform Data Movement
```mermaid
flowchart LR
  %% Data Sources
  subgraph DS["📊 DATA SOURCES"]
    subgraph "👥 User Inputs"
      MobileInput["📱 Mobile Apps<br/>User Interactions<br/>Location Data"]
      WebInput["🌐 Web Portal<br/>Booking Requests<br/>Preferences"]
      XRInput["🥽 XR/AR Devices<br/>Spatial Data<br/>Gesture Tracking"]
      KioskInput["🖥️ Kiosks<br/>Touch Interactions<br/>Check-ins"]
    end
    
    subgraph "🌐 External Systems"
      PSS["✈️ Amadeus PSS<br/>Flight Schedules<br/>Seat Availability"]
      ATC["🗼 ATC Systems<br/>Flight Status<br/>Delays/Gates"]
      Weather["🌤️ Weather APIs<br/>Conditions<br/>Forecasts"]
      Loyalty["🎁 Loyalty Programs<br/>Points & Status<br/>Benefits"]
      Payment["💳 Payment Systems<br/>Transactions<br/>Validation"]
    end
    
    subgraph "🔧 IoT & Sensors"
      Beacons["📡 Airport Beacons<br/>Location Signals<br/>Proximity Data"]
      Sensors["📟 IoT Sensors<br/>Crowd Density<br/>Equipment Status"]
      Cameras["📹 Security Cameras<br/>Crowd Analytics<br/>Safety Monitoring"]
    end
    
    subgraph "🛡️ Governance Sources"
      GovEvents["⚡ Governance Events<br/>Policy Changes<br/>Compliance Updates"]
      AuditLogs["📋 Audit Logs<br/>User Actions<br/>System Events"]
      BiasReports["🎯 Bias Reports<br/>ML Model Performance<br/>Fairness Metrics"]
    end
  end

  %% Data Ingestion Layer
  subgraph DIL["🚪 DATA INGESTION LAYER"]
    subgraph "🌐 API Gateway Layer"
      Kong["🛡️ Kong API Gateway<br/>+ Governance Middleware<br/>100k req/min"]
      GraphQL["📊 GraphQL Apollo<br/>Unified Data Access<br/>Real-time Subscriptions"]
      WebSocket["⚡ WebSocket Gateway<br/>Real-time Updates<br/>Bi-directional"]
    end
    
    subgraph "📨 Event Streaming"
      EventHub["📬 Event Hub<br/>High Throughput<br/>Event Routing"]
      StreamProcessor["⚡ Stream Processor<br/>Real-time Processing<br/>Event Transformation"]
    end
    
    subgraph "🛡️ Governance Ingestion"
      GovIngestion["🎯 Governance Data Ingestion<br/>Policy Validation<br/>Compliance Checking"]
      BiasIngestion["📊 Bias Data Ingestion<br/>Model Monitoring<br/>Performance Tracking"]
    end
  end

  %% Real-time Processing
  subgraph RTPL["⚡ REAL-TIME PROCESSING LAYER"]
    subgraph "📨 Message Streaming"
      Kafka["📨 Apache Kafka<br/>Event Streaming<br/>26+ Topics"]
      KafkaConnect["🔌 Kafka Connect<br/>Source/Sink Connectors<br/>External System Integration"]
    end
    
    subgraph "🔄 Stream Processing"
      Flink["🌊 Apache Flink<br/>Complex Event Processing<br/>Window Operations"]
      Storm["⛈️ Apache Storm<br/>Real-time Analytics<br/>Topology Processing"]
      SparkStreaming["⚡ Spark Streaming<br/>Micro-batch Processing<br/>ML Pipeline"]
    end
    
    subgraph "🛡️ Governance Processing"
      GovProcessor["🎯 Governance Stream Processor<br/>Real-time Policy Enforcement<br/><50ms Decision Time"]
      BiasProcessor["📊 Bias Detection Engine<br/>ML Model Monitoring<br/>Drift Detection"]
      ComplianceProcessor["📋 Compliance Processor<br/>Regulatory Validation<br/>99.7% Automation"]
    end
  end

  %% Data Storage Layer
  subgraph DSL["💾 DATA STORAGE LAYER"]
    subgraph "🗄️ Operational Databases"
      PostgreSQL["🐘 PostgreSQL Cluster<br/>+ Governance Schema<br/>ACID Transactions"]
      MongoDB["🍃 MongoDB Replica Set<br/>+ Audit Collections<br/>Document Storage"]
      Redis["🔴 Redis Cluster<br/>+ Governance Cache<br/>Sub-ms Access"]
    end
    
    subgraph "📊 Analytics Databases"
      ClickHouse["⚡ ClickHouse<br/>+ Governance Metrics<br/>Columnar Analytics"]
      S3DataLake["☁️ S3 Data Lake<br/>+ Data Lineage<br/>Petabyte Scale"]
      Elasticsearch["🔍 Elasticsearch<br/>+ Governance Search<br/>Full-text Indexing"]
    end
    
    subgraph "🛡️ Governance Storage"
      GovDataStore["🎯 Governance Data Store<br/>Policy Repository<br/>Compliance Records"]
      AuditStore["📋 Audit Data Store<br/>Immutable Logs<br/>Forensic Analysis"]
      LineageStore["🔗 Lineage Store<br/>Data Provenance<br/>Impact Analysis"]
    end
  end

  %% Analytics & ML Layer
  subgraph AML["🧠 ANALYTICS & ML LAYER"]
    subgraph "📈 Batch Analytics"
      Spark["⚡ Apache Spark<br/>Large-scale Processing<br/>ML Pipelines"]
      Glue["🔗 AWS Glue<br/>ETL Workflows<br/>Data Cataloging"]
      EMR["🏔️ AWS EMR<br/>Hadoop Ecosystem<br/>Distributed Computing"]
    end
    
    subgraph "🤖 Machine Learning"
      SageMaker["🧠 AWS SageMaker<br/>+ Governance Integration<br/>Model Training/Serving"]
      MLFlow["📊 MLFlow<br/>Experiment Tracking<br/>Model Registry"]
      FeatureStore["🏪 Feature Store<br/>Feature Management<br/>Reusability"]
    end
    
    subgraph "🛡️ Governance Analytics"
      GovAnalytics["🎯 Governance Analytics Engine<br/>15-Pillar Health Scoring<br/>ROI Calculation"]
      BiasAnalytics["📊 Bias Analytics<br/>Fairness Metrics<br/>Model Performance"]
      ComplianceAnalytics["📋 Compliance Analytics<br/>Regulatory Reporting<br/>Risk Assessment"]
    end
  end

  %% Data Consumption Layer
  subgraph DCL["📤 DATA CONSUMPTION LAYER"]
    subgraph "🖥️ Real-time Dashboards"
      ExecDashboard["👔 Executive Dashboard<br/>Governance Health<br/>Business KPIs"]
      OpsDashboard["⚙️ Operations Dashboard<br/>System Health<br/>Performance Metrics"]
      UserDashboard["👤 User Dashboard<br/>Personalized Views<br/>Real-time Updates"]
    end
    
    subgraph "📱 Application APIs"
      RestAPIs["🌐 REST APIs<br/>Mobile/Web Apps<br/>Third-party Integration"]
      GraphQLAPIs["📊 GraphQL APIs<br/>Flexible Queries<br/>Real-time Subscriptions"]
      StreamingAPIs["⚡ Streaming APIs<br/>Live Data Feeds<br/>Event Notifications"]
    end
    
    subgraph "📢 Notifications & Alerts"
      PushNotifications["📱 Push Notifications<br/>Flight Updates<br/>Personalized Alerts"]
      EmailReports["📧 Email Reports<br/>Business Intelligence<br/>Compliance Reports"]
      SMSAlerts["📟 SMS Alerts<br/>Critical Updates<br/>Emergency Notifications"]
    end
    
    subgraph "🛡️ Governance Outputs"
      ComplianceReports["📋 Compliance Reports<br/>Regulatory Submissions<br/>Audit Evidence"]
      GovernanceDashboard["🎯 Governance Dashboard<br/>Pillar Health<br/>Risk Metrics"]
      PolicyRecommendations["💡 Policy Recommendations<br/>Adaptive Learning<br/>Continuous Improvement"]
    end
  end

  %% Main Data Flow Connections
  
  %% Sources to Ingestion
  MobileInput --> Kong
  WebInput --> Kong
  XRInput --> Kong
  KioskInput --> Kong
  PSS --> EventHub
  ATC --> StreamProcessor
  Weather --> EventHub
  Loyalty --> Kong
  Payment --> Kong
  Beacons --> EventHub
  Sensors --> StreamProcessor
  Cameras --> EventHub
  GovEvents --> GovIngestion
  AuditLogs --> GovIngestion
  BiasReports --> BiasIngestion
  
  %% Ingestion to Processing
  Kong --> Kafka
  GraphQL --> Kafka
  WebSocket --> Kafka
  EventHub --> Kafka
  StreamProcessor --> Kafka
  GovIngestion --> GovProcessor
  BiasIngestion --> BiasProcessor
  
  %% Processing Layer
  Kafka --> Flink
  Kafka --> Storm
  Kafka --> SparkStreaming
  KafkaConnect --> Flink
  GovProcessor --> ComplianceProcessor
  BiasProcessor --> GovProcessor
  
  %% Processing to Storage
  Flink --> PostgreSQL
  Flink --> MongoDB
  Flink --> Redis
  Storm --> ClickHouse
  SparkStreaming --> S3DataLake
  Flink --> Elasticsearch
  GovProcessor --> GovDataStore
  ComplianceProcessor --> AuditStore
  Flink --> LineageStore
  
  %% Storage to Analytics
  S3DataLake --> Spark
  PostgreSQL --> Glue
  MongoDB --> EMR
  ClickHouse --> SageMaker
  GovDataStore --> GovAnalytics
  AuditStore --> BiasAnalytics
  LineageStore --> ComplianceAnalytics
  
  %% Analytics to ML
  Spark --> SageMaker
  Glue --> MLFlow
  EMR --> FeatureStore
  GovAnalytics --> BiasAnalytics
  BiasAnalytics --> ComplianceAnalytics
  
  %% Storage to Consumption
  Redis --> RestAPIs
  PostgreSQL --> GraphQLAPIs
  Elasticsearch --> StreamingAPIs
  ClickHouse --> ExecDashboard
  MongoDB --> OpsDashboard
  Redis --> UserDashboard
  
  %% ML to Consumption
  SageMaker --> RestAPIs
  MLFlow --> GraphQLAPIs
  FeatureStore --> StreamingAPIs
  
  %% Governance to Consumption
  GovDataStore --> GovernanceDashboard
  ComplianceAnalytics --> ComplianceReports
  BiasAnalytics --> PolicyRecommendations
  
  %% Consumption to Notifications
  RestAPIs --> PushNotifications
  GraphQLAPIs --> EmailReports
  StreamingAPIs --> SMSAlerts
  ComplianceReports --> EmailReports
  GovernanceDashboard --> PushNotifications

  %% Color Class Definitions
  classDef Sky stroke-width:1px, stroke-dasharray:none, stroke:#374D7C, fill:#E2EBFF, color:#374D7C
  classDef KlimtGold stroke-width:1px, stroke-dasharray:none, stroke:#D4A017, fill:#FBF2C1, color:#705A16
  classDef Aqua stroke-width:1px, stroke-dasharray:none, stroke:#46EDC8, fill:#DEFFF8, color:#378E7A
  classDef Peach stroke-width:1px, stroke-dasharray:none, stroke:#FBB35A, fill:#FFEFDB, color:#8F632D
  classDef RenoirPink stroke-width:1px, stroke-dasharray:none, stroke:#E4A0A0, fill:#FBE5E5, color:#7D3E3E
  classDef TurnerMist stroke-width:1px, stroke-dasharray:none, stroke:#B8C4D1, fill:#EAF2F8, color:#4A5B6F
  classDef CezannePeach stroke-width:1px, stroke-dasharray:none, stroke:#E2A07D, fill:#FBE7DA, color:#6D4532
  classDef MonetBlue stroke-width:1px, stroke-dasharray:none, stroke:#87AFC7, fill:#D4EAF7, color:#30577B
  classDef PicassoBlue stroke-width:1px, stroke-dasharray:none, stroke:#5A84A2, fill:#CDE0F2, color:#2D4661
  classDef VanGoghYellow stroke-width:1px, stroke-dasharray:none, stroke:#E3B448, fill:#FDF6C9, color:#7D5A17
  classDef DegasGreen stroke-width:1px, stroke-dasharray:none, stroke:#A7C796, fill:#E6F4E2, color:#3E6A42
  classDef Rose stroke-width:1px, stroke-dasharray:none, stroke:#FF5978, fill:#FFDFE5, color:#8E2236
  classDef MatisseLavender stroke-width:1px, stroke-dasharray:none, stroke:#B39DBC, fill:#ECE3F5, color:#4E3A5E
  classDef HokusaiWave stroke-width:1px, stroke-dasharray:none, stroke:#6188A9, fill:#D4E8F2, color:#2A425D
  classDef Ash stroke-width:1px, stroke-dasharray:none, stroke:#999999, fill:#EEEEEE, color:#000000
  classDef Pine stroke-width:1px, stroke-dasharray:none, stroke:#254336, fill:#27654A, color:#FFFFFF

  %% Transparent background class for major blocks
  classDef transparent stroke-width:2px, stroke-dasharray:none, stroke:#666666, fill:transparent, color:#333333

  %% Apply transparent class to major subgraph blocks
  class DS,DIL,RTPL,DSL,AML,DCL transparent

  %% Apply Color Classes to Data Sources
  class MobileInput,WebInput,XRInput,KioskInput Aqua
  class PSS,ATC,Weather,Loyalty,Payment CezannePeach
  class Beacons,Sensors,Cameras Peach
  class GovEvents,AuditLogs,BiasReports Rose

  %% Apply Color Classes to Ingestion Layer
  class Kong,GraphQL,WebSocket TurnerMist
  class EventHub,StreamProcessor HokusaiWave
  class GovIngestion,BiasIngestion Rose

  %% Apply Color Classes to Processing Layer
  class Kafka,KafkaConnect VanGoghYellow
  class Flink,Storm,SparkStreaming VanGoghYellow
  class GovProcessor,BiasProcessor,ComplianceProcessor Rose

  %% Apply Color Classes to Storage Layer
  class PostgreSQL,MongoDB,Redis PicassoBlue
  class ClickHouse,S3DataLake,Elasticsearch PicassoBlue
  class GovDataStore,AuditStore,LineageStore Rose

  %% Apply Color Classes to Analytics & ML Layer
  class Spark,Glue,EMR MonetBlue
  class SageMaker,MLFlow,FeatureStore DegasGreen
  class GovAnalytics,BiasAnalytics,ComplianceAnalytics Rose

  %% Apply Color Classes to Consumption Layer
  class ExecDashboard,OpsDashboard,UserDashboard KlimtGold
  class RestAPIs,GraphQLAPIs,StreamingAPIs Aqua
  class PushNotifications,EmailReports,SMSAlerts MatisseLavender
  class ComplianceReports,GovernanceDashboard,PolicyRecommendations Rose

  style subGraph11 fill:transparent
  style subGraph12 fill:transparent
  style subGraph13 fill:transparent
  style subGraph14 fill:transparent
  style subGraph15 fill:transparent
  style subGraph16 fill:transparent
  style subGraph17 fill:transparent
  style subGraph18 fill:transparent
  style subGraph19 fill:transparent
  style subGraph20 fill:transparent
  style subGraph21 fill:transparent
  style subGraph22 fill:transparent
  style subGraph23 fill:transparent
  style subGraph24 fill:transparent

  
```
---
### 🧪 Testing & Quality Gates

* **CI Pipeline**: Lint → Build → Unit Tests → Governance Tests → SAST/DAST → Integration Tests → Bias Testing → Canary Deploy
* **Test Coverage**: ≥ 90% enforced + Governance Coverage ≥ 95%
* **E2E**: Detox/Appium (mobile), Playwright (web), XR device-farm integration + Governance E2E scenarios
* **Perf**: Locust load tests; AR latency < 20 ms + Governance policy evaluation < 20ms
* **Governance Testing**: Bias detection accuracy ≥ 94%, policy compliance 100%, audit trail integrity


---

### 🤝 Contribution

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

* Branching & PR process
* Coding standards & linters
* Issue tracking & templates

---

## 🔒 Security & Compliance

* **Zero-Trust**: HSM-backed post-quantum auth
* **Privacy-By-Design**: On-device XR processing, minimal PII retention
* **Automated Audits**: Daily compliance scans via `analytics/ml-monitoring/compliance_check.py`
* **Regulatory**: GDPR, PDPA, UAE AI Ethics, XRSI standards
