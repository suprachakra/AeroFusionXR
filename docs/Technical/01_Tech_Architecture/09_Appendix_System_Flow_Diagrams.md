### A. Core User Journey Flows

#### A.1 GenAI Concierge Interaction Flow
```mermaid
sequenceDiagram
  participant U as Passenger
  participant App as Mobile App
  participant APIGW as API Gateway
  participant Auth as Auth Service
  participant GenAI as GenAI Service
  participant Vector as Vector DB
  participant LLM as LLM Router
  participant SageMaker as SageMaker
  participant Audit as Audit Logger
  participant Cache as Redis Cache

  U->>App: "Where is Gate B12?"
  App->>APIGW: POST /query { text, userID }
  APIGW->>Auth: Validate JWT Token
  Auth-->>APIGW: Valid Session
  APIGW->>GenAI: Process Query
  GenAI->>Vector: Fetch Context Embeddings
  Vector-->>GenAI: Relevant Context
  GenAI->>Cache: Check Cached Response
  Cache-->>GenAI: Cache Miss
  GenAI->>LLM: Route to Appropriate Model
  LLM->>SageMaker: Invoke LLM Endpoint
  SageMaker-->>LLM: Generated Response
  LLM-->>GenAI: Formatted Response
  GenAI->>Cache: Cache Response (TTL: 300s)
  GenAI->>Audit: Log Interaction
  GenAI-->>APIGW: Response + Metadata
  APIGW-->>App: 200 OK + Response
  App-->>U: "Gate B12 is on Level 2, Terminal B. Walk straight for 200m, then turn left."
```

#### A.2 AR Wayfinding Navigation Flow
```mermaid
sequenceDiagram
  participant U as Passenger
  participant AR as AR App
  participant APIGW as API Gateway
  participant Way as Wayfinding Service
  participant Beacon as Beacon Fusion
  participant SLAM as SLAM Engine
  participant Path as Path Calculator
  participant Maps as Airport Maps DB

  U->>AR: Start Navigation to Gate
  AR->>APIGW: GET /navigation/start
  APIGW->>Way: Initialize Navigation Session
  Way->>Beacon: Get Beacon Signals
  Beacon-->>Way: Signal Strength Data
  Way->>SLAM: Process Camera Frames
  SLAM-->>Way: Visual Features
  Way->>Path: Calculate Current Position
  Path->>Maps: Query Airport Layout
  Maps-->>Path: Layout Data
  Path-->>Way: Current Coordinates
  Way->>Path: Calculate Route to Destination
  Path-->>Way: Optimized Route
  Way-->>APIGW: Navigation Instructions
  APIGW-->>AR: Route + AR Overlays
  
  loop Every 2 seconds
    AR->>APIGW: Update Position
    APIGW->>Way: Process Position Update
    Way->>Path: Recalculate if Needed
    Path-->>Way: Updated Instructions
    Way-->>APIGW: Live Updates
    APIGW-->>AR: Updated AR Overlays
  end
```

#### A.3 Baggage Tracking with ETA Flow
```mermaid
sequenceDiagram
  participant U as Passenger
  participant App as Mobile App
  participant APIGW as API Gateway
  participant Baggage as Baggage Service
  participant CV as Computer Vision
  participant QR as QR Scanner
  participant ETA as ETA Calculator
  participant Notif as Notification Service
  participant Push as Push Service

  U->>App: Track Baggage (Scan Tag)
  App->>APIGW: POST /baggage/track { tagID }
  APIGW->>Baggage: Start Tracking
  Baggage->>CV: Monitor Video Streams
  
  loop Every 30 seconds
    CV->>CV: Process Baggage Area Cameras
    alt Baggage Detected
      CV-->>Baggage: Location Update
    else Fallback to QR
      CV->>QR: Scan QR Codes
      QR-->>CV: QR Data
      CV-->>Baggage: Location Update
    end
    
    Baggage->>ETA: Calculate ETA
    ETA-->>Baggage: Estimated Time
    Baggage->>Notif: Check If Update Needed
    Notif->>Push: Send Push Notification
    Push-->>App: Baggage Update
    App-->>U: "Your bag is at Conveyor 3, ETA: 8 minutes"
  end
```

#### A.4 AR Commerce Purchase Flow
```mermaid
sequenceDiagram
  participant U as Passenger
  participant AR as AR Commerce App
  participant APIGW as API Gateway
  participant Commerce as Commerce Service
  participant Catalog as Product Catalog
  participant Cart as Cart Manager
  participant Payment as Payment Engine
  participant Stripe as Stripe API
  participant Inventory as Inventory Service
  participant Order as Order Service

  U->>AR: Browse Products in AR
  AR->>APIGW: GET /products/category/duty-free
  APIGW->>Commerce: Get Products
  Commerce->>Catalog: Fetch Product Data
  Catalog-->>Commerce: Products + 3D Models
  Commerce-->>APIGW: Product List
  APIGW-->>AR: Products + AR Assets
  AR-->>U: Display Products in AR

  U->>AR: Add Item to Cart
  AR->>APIGW: POST /cart/add { productID, quantity }
  APIGW->>Commerce: Add to Cart
  Commerce->>Cart: Update Cart
  Cart->>Inventory: Check Availability
  Inventory-->>Cart: Available (Stock: 15)
  Cart-->>Commerce: Cart Updated
  Commerce-->>APIGW: 200 OK
  APIGW-->>AR: Cart Confirmation
  
  U->>AR: Proceed to Checkout
  AR->>APIGW: POST /checkout/initiate
  APIGW->>Commerce: Start Checkout
  Commerce->>Payment: Initialize Payment
  Payment->>Stripe: Create Payment Intent
  Stripe-->>Payment: Client Secret
  Payment-->>Commerce: Payment Setup
  Commerce-->>APIGW: Checkout Ready
  APIGW-->>AR: Payment Form
  
  U->>AR: Complete Payment
  AR->>APIGW: POST /payment/confirm { paymentMethodID }
  APIGW->>Payment: Process Payment
  Payment->>Stripe: Confirm Payment
  Stripe-->>Payment: Payment Success
  Payment->>Order: Create Order
  Order->>Inventory: Reserve Items
  Inventory-->>Order: Items Reserved
  Order-->>Payment: Order Created
  Payment-->>Commerce: Payment Complete
  Commerce-->>APIGW: Purchase Confirmation
  APIGW-->>AR: Receipt + QR Code
  AR-->>U: "Purchase successful! Show QR at pickup."
```

#### A.5 Sustainability Badge Earning Flow
```mermaid
sequenceDiagram
  participant U as Passenger
  participant App as Mobile App
  participant APIGW as API Gateway
  participant Eco as Sustainability Service
  participant Carbon as Carbon Calculator
  participant Badge as Badge Engine
  participant Blockchain as Badge Blockchain
  participant Social as Social Sharing
  participant Leaderboard as Leaderboard Service

  U->>App: Complete Sustainable Action
  App->>APIGW: POST /sustainability/action { actionType, data }
  APIGW->>Eco: Process Sustainable Action
  Eco->>Carbon: Calculate CO2 Impact
  Carbon-->>Eco: CO2 Saved: 2.5kg
  Eco->>Badge: Check Badge Eligibility
  Badge-->>Eco: Eligible for "Green Traveler" Badge
  Eco->>Blockchain: Mint NFT Badge
  Blockchain-->>Eco: Badge Minted (TokenID: 12345)
  Eco->>Leaderboard: Update User Score
  Leaderboard-->>Eco: New Rank: #247
  Eco-->>APIGW: Badge Earned
  APIGW-->>App: Achievement Unlocked
  App-->>U: "🌱 Badge Earned: Green Traveler! You saved 2.5kg CO2"
  
  U->>App: Share Achievement
  App->>APIGW: POST /sustainability/share { badgeID }
  APIGW->>Social: Generate Share Content
  Social-->>APIGW: Share Link + Image
  APIGW-->>App: Share Ready
  App-->>U: Share on Social Media
```

### B. System Integration Flows

#### B.1 Real-Time Flight Data Synchronization
```mermaid
sequenceDiagram
  participant Airline as Airline API
  participant APIGW as API Gateway
  participant Flight as Flight Service
  participant Kafka as Kafka Cluster
  participant Analytics as Analytics Engine
  participant ML as ML Pipeline
  participant Cache as Redis Cache
  participant Notif as Notification Service

  loop Every 30 seconds
    Airline->>APIGW: Flight Status Update
    APIGW->>Flight: Process Update
    Flight->>Kafka: Publish Flight Event
    Flight->>Cache: Update Cache
    
    Kafka->>Analytics: Stream Processing
    Analytics->>ML: Feed ML Pipeline
    ML-->>Analytics: Delay Prediction
    Analytics->>Kafka: Publish Prediction
    
    Kafka->>Flight: Consume Prediction
    Flight->>Notif: Trigger Notifications
    Notif-->>APIGW: Notification Sent
  end
```

#### B.2 Multi-Service Health Check Flow
```mermaid
sequenceDiagram
  participant LB as Load Balancer
  participant APIGW as API Gateway
  participant UserSvc as User Service
  participant FlightSvc as Flight Service
  participant DB as Database
  participant Monitoring as Prometheus

  loop Every 10 seconds
    LB->>APIGW: Health Check
    APIGW->>UserSvc: /health
    UserSvc->>DB: Simple Query
    DB-->>UserSvc: OK
    UserSvc-->>APIGW: 200 OK
    APIGW->>FlightSvc: /health
    FlightSvc-->>APIGW: 200 OK
    APIGW-->>LB: 200 OK
    
    Monitoring->>APIGW: Scrape Metrics
    APIGW-->>Monitoring: Metrics Data
  end
```

### C. Security and Compliance Flows

#### C.1 Zero-Trust Authentication Flow
```mermaid
sequenceDiagram
  participant User as User
  participant App as Mobile App
  participant WAF as Web Application Firewall
  participant APIGW as API Gateway
  participant Auth as Auth Service
  participant MFA as MFA Service
  participant Vault as HashiCorp Vault
  participant Audit as Audit Logger

  User->>App: Login Request
  App->>WAF: HTTPS Request
  WAF->>WAF: Bot Detection & Rate Limiting
  WAF->>APIGW: Forward Request
  APIGW->>Auth: Authenticate User
  Auth->>Vault: Get Secret Keys
  Vault-->>Auth: Encryption Keys
  Auth->>MFA: Trigger MFA
  MFA-->>User: SMS/Push Notification
  User->>App: Enter MFA Code
  App->>APIGW: Verify MFA
  APIGW->>Auth: Validate MFA
  Auth->>MFA: Verify Code
  MFA-->>Auth: Valid
  Auth->>Vault: Store Session
  Auth->>Audit: Log Authentication
  Auth-->>APIGW: JWT Token
  APIGW-->>App: Authentication Success
```
