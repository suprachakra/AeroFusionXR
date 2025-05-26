### Overview
Handles AR-based duty-free shopping, product catalog, and checkout flows.

### Features
- 3D product catalog API
- Shopping cart & wishlist
- Coupon & promotions engine
- Secure checkout with multi-gateway failover

### Structure
```
commerce/
├── src/
│   ├── index.js
│   ├── controllers/
│   │   └── commerceController.js
│   ├── services/
│   │   ├── productCatalogService.js
│   │   └── checkoutService.js
│   ├── models/
│   │   └── orderModel.js
│   └── middlewares/
│       └── authMiddleware.js
├── tests/
│   ├── commerce.test.js
│   └── coupons.test.js
├── package.json
└── Dockerfile
```
