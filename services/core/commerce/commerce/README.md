# Commerce Service

AR-enabled commerce service with real-time 3D product visualization and checkout for AeroFusion XR.

## Features

### Core Features

- **3D Product Catalog & AR Try-On**
  - GLTF/USDC asset loading with LOD management
  - Client-side rendering optimizations (10 fps min)
  - ARKit/ARCore live preview + fallback to 2D zoom
  - Device-specific model optimization

- **Cart & Checkout Flow**
  - Persistent cart across devices & sessions
  - Multi-gateway payment with retry & rollback
  - 3DS strong customer authentication support
  - Real-time inventory validation

- **Promotions & Campaigns**
  - Dynamic overlay promotions (time-limited, geo-fenced)
  - CMS hook for "flash sale" banners
  - A/B testing toggles for campaign variants
  - Personalized recommendations

- **Order Management & Fulfillment**
  - Real-time inventory sync with warehouses
  - Instant digital receipt & order status updates
  - Returns & refund workflows
  - Order history & tracking

### Technical Features

- **AR & 3D**
  - Automatic LOD selection based on device
  - Progressive model loading
  - Texture compression & streaming
  - WebXR integration

- **Performance & Scalability**
  - Redis-based cart persistence
  - MongoDB for product & order data
  - S3 for 3D model storage
  - Auto-scaling support

- **Security & Compliance**
  - PCI DSS compliance for payments
  - GDPR-compliant data handling
  - Rate limiting & DDoS protection
  - Input validation & sanitization

- **Monitoring & Observability**
  - OpenTelemetry integration
  - Prometheus metrics
  - Structured logging
  - Health checks

## Getting Started

### Prerequisites

- Node.js 20.x
- npm 10.x
- MongoDB 7.x
- Redis 7.x
- AWS Account (for S3)
- Docker (optional)
- Kubernetes (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aerofusion/aerofusion-xr.git
   cd services/commerce
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the service:
   ```bash
   npm run dev
   ```

### Docker

Build and run with Docker:

```bash
docker build -t aerofusion/commerce .
docker run -p 3000:3000 aerofusion/commerce
```

### Kubernetes

Deploy to Kubernetes:

```bash
kubectl apply -f k8s/
```

## API Documentation

### AR & 3D Models

```http
GET /api/ar/compatibility
```

Response:
```json
{
  "arSupported": true,
  "maxTriangles": 100000,
  "maxTextureSize": 4096,
  "supportedFormats": ["gltf", "usdc"]
}
```

```http
GET /api/ar/model/:productId
```

Response:
```json
{
  "modelUrl": "https://...",
  "format": "gltf",
  "triangleCount": 50000
}
```

### Products & Cart

```http
GET /api/products
```

Response:
```json
{
  "products": [
    {
      "id": "prod123",
      "name": "Product Name",
      "price": 99.99,
      "arAssets": {
        "gltfUrl": "https://...",
        "thumbnailUrl": "https://..."
      }
    }
  ]
}
```

```http
POST /api/cart/items
Content-Type: application/json

{
  "productId": "prod123",
  "quantity": 1
}
```

### Orders & Checkout

```http
POST /api/orders
Content-Type: application/json

{
  "cartId": "cart123",
  "paymentToken": "tok_visa"
}
```

Response:
```json
{
  "orderId": "ord123",
  "status": "CONFIRMED",
  "total": 99.99
}
```

## Architecture

### **Commerce Service Architecture**

```mermaid
graph TB
    subgraph "Client Applications"
        A[Mobile Apps<br/>iOS/Android]
        B[Web Browser<br/>WebXR]
        C[AR Headsets<br/>HoloLens/Quest]
        D[Kiosk Displays<br/>Airport Terminals]
    end
    
    subgraph "Commerce Service"
        E[API Gateway<br/>Express.js]
        F[AR Service<br/>3D Model Optimization]
        G[Product Service<br/>Catalog Management]
        H[Cart Service<br/>Session Management]
        I[Order Service<br/>Checkout Processing]
        J[Payment Service<br/>Gateway Integration]
    end
    
    subgraph "External Services"
        K[Payment Gateways<br/>Stripe/PayPal]
        L[3D Model CDN<br/>AWS S3/CloudFront]
        M[Inventory Systems<br/>ERP Integration]
        N[Shipping APIs<br/>FedEx/UPS]
    end
    
    subgraph "Data Storage"
        O[(MongoDB<br/>Products & Orders)]
        P[(Redis<br/>Cart & Sessions)]
        Q[(S3<br/>3D Models & Assets)]
        R[(Analytics DB<br/>Purchase Data)]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    E --> G
    E --> H
    E --> I
    E --> J
    
    F --> L
    G --> M
    I --> K
    I --> N
    
    G --> O
    I --> O
    H --> P
    F --> Q
    I --> R
```

### **AR Commerce Purchase Flow**

```mermaid
sequenceDiagram
    participant U as User
    participant A as Mobile App
    participant C as Commerce API
    participant AR as AR Service
    participant P as Payment Gateway
    participant I as Inventory System
    
    U->>A: Browse products
    A->>C: GET /api/products
    C-->>A: Product catalog
    
    U->>A: Select product for AR view
    A->>AR: GET /api/ar/model/:productId
    AR->>AR: Optimize model for device
    AR-->>A: 3D model URL + metadata
    
    A->>A: Load AR experience
    U->>A: Add to cart
    A->>C: POST /api/cart/items
    C-->>A: Cart updated
    
    U->>A: Proceed to checkout
    A->>C: POST /api/orders
    C->>I: Check inventory
    I-->>C: Stock confirmed
    
    C->>P: Process payment
    P-->>C: Payment confirmed
    
    C->>I: Reserve inventory
    C-->>A: Order confirmed
    A-->>U: Show order confirmation
    
    Note over C,I: Background fulfillment process
```

### **3D Model Optimization Pipeline**

```mermaid
flowchart TD
    A[Original 3D Model<br/>High-poly GLTF] --> B[Device Detection]
    
    B --> C{Device Capability}
    
    C -->|High-end| D[Full Quality Model<br/>100k+ triangles]
    C -->|Mid-range| E[Optimized Model<br/>50k triangles]
    C -->|Low-end| F[Simplified Model<br/>10k triangles]
    
    D --> G[Texture Compression<br/>4K textures]
    E --> H[Texture Compression<br/>2K textures]
    F --> I[Texture Compression<br/>1K textures]
    
    G --> J[Progressive Loading<br/>LOD streaming]
    H --> J
    I --> J
    
    J --> K[CDN Distribution<br/>Global edge caching]
    K --> L[Client Delivery<br/>Optimized for device]
    
    L --> M[AR Rendering<br/>Real-time display]
    M --> N[Performance Monitoring<br/>FPS tracking]
    
    N --> O{Performance OK?}
    O -->|No| P[Reduce Quality<br/>Dynamic LOD]
    O -->|Yes| Q[Maintain Quality]
    
    P --> M
    Q --> M
```

### Components

- **AR Service**: Handles 3D model loading and optimization
- **Product Service**: Manages product catalog and inventory
- **Cart Service**: Handles shopping cart persistence
- **Order Service**: Manages order processing and fulfillment
- **Payment Service**: Integrates with payment gateways

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 