# Booking Service

## Overview
Orchestrates end-to-end booking flows with inventory reservation, payment processing, loyalty integration, and idempotent operations.

## Features
- Workflow engine (Step functions style)
- Payment orchestration with 3DS & retry
- Loyalty points crediting
- Idempotency for POST endpoints
- Validation & schema enforcement

## Structure
```
booking/
├── src/
│   ├── index.js
│   ├── workflows/
│   │   ├── bookingFlow\.js
│   │   ├── paymentStep.js
│   │   └── loyaltyStep.js
│   ├── controllers/
│   │   └── bookingController.js
│   ├── services/
│   │   ├── inventoryService.js
│   │   ├── paymentService.js
│   │   └── loyaltyService.js
│   └── utils/
│       ├── idempotency.js
│       └── validator.js
├── tests/
│   ├── booking.test.js
│   ├── payment.test.js
│   └── concurrency.test.js
├── package.json
└── Dockerfile
````
