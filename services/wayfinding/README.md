# Wayfinding Service

Indoor navigation service with AR turn-by-turn directions, built for AeroFusion XR.

## Features

### Core Features

- **Beacon + Vision SLAM Fusion**
  - BLE/UWB beacon triangulation with optical SLAM fallback
  - Dynamic weight tuning per environment (crowding, multipath)
  - Auto-calibration scripts & nightly drift correction

- **AR Overlay & Navigation Experience**
  - 3D path overlay aligned to phone/tablet heading
  - Distance & ETA labels updated in <200 ms
  - Audio cues with spatialized sound

- **Multi-Floor & Multi-Building Support**
  - Vertical routing engine with floor-plan graph
  - Seamless transition across concourse/building boundaries
  - Offline tile caching & route compute in 2 s

- **User Personalization**
  - Favorite locations & saved waypoints
  - Accessibility modes (large fonts, high-contrast, audio-only)
  - Indoor "points of interest" contextual tooltips

### Technical Features

- **Monitoring & Observability**
  - OpenTelemetry integration for distributed tracing
  - Prometheus metrics for performance monitoring
  - ELK stack for centralized logging
  - Real-time beacon health metrics

- **Infrastructure**
  - Docker containerization
  - Kubernetes deployment with HPA
  - AWS EKS hosting
  - Service mesh integration

- **CI/CD Pipeline**
  - GitHub Actions workflows
  - Automated testing
  - Security scanning
  - Deployment automation

## Getting Started

### Prerequisites

- Node.js 20.x
- npm 10.x
- Docker (optional)
- Kubernetes (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aerofusion/aerofusion-xr.git
   cd services/wayfinding
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the service:
   ```bash
   npm run build
   ```

4. Start the service:
   ```bash
   npm start
   ```

### Docker

Build and run with Docker:

```bash
docker build -t aerofusion/wayfinding .
docker run -p 3000:3000 aerofusion/wayfinding
```

### Kubernetes

Deploy to Kubernetes:

```bash
kubectl apply -f k8s/
```

## API Documentation

### Position Update

```http
POST /api/position/update
Content-Type: application/json

{
  "beacons": [
    {
      "id": "beacon1",
      "rssi": -65,
      "distance": 2.5
    }
  ],
  "slam": {
    "position": {"x": 10, "y": 20, "z": 0},
    "rotation": {"x": 0, "y": 0.7, "z": 0},
    "confidence": 0.95
  }
}
```

### Route Finding

```http
POST /api/route/find
Content-Type: application/json

{
  "start": {"x": 0, "y": 0, "z": 0},
  "end": {"x": 50, "y": 30, "z": 3},
  "options": {
    "accessibility": true,
    "avoidCrowded": true
  }
}
```

## Monitoring

### Metrics

Available at `/metrics` in Prometheus format:

- `positioning_latency_seconds`: Latency of position calculations
- `positioning_accuracy_meters`: Estimated accuracy of position
- `route_computation_seconds`: Time taken to compute routes
- `route_length_meters`: Length of computed routes

### Health Check

Available at `/health`:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-02-24T12:00:00Z"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 