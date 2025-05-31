import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 📊 Custom Metrics
const apiErrorRate = new Rate('api_error_rate');
const responseTime = new Trend('response_time', true);
const apiCalls = new Counter('api_calls_total');

// 🎯 Test Configuration
export let options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp-up to 100 users
    { duration: '5m', target: 100 },    // Stay at 100 users
    { duration: '2m', target: 200 },    // Ramp-up to 200 users
    { duration: '5m', target: 200 },    // Stay at 200 users
    { duration: '2m', target: 300 },    // Ramp-up to 300 users
    { duration: '5m', target: 300 },    // Stay at 300 users
    { duration: '5m', target: 0 },      // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],          // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],             // Error rate must be below 5%
    api_error_rate: ['rate<0.05'],              // API error rate must be below 5%
    checks: ['rate>0.95'],                      // 95% of checks must pass
  },
  ext: {
    loadimpact: {
      projectID: process.env.K6_PROJECT_ID,
      name: 'AeroFusionXR Load Test',
    },
  },
};

// 🌐 Base Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// 🧪 Test Data
const testUsers = [
  { email: 'test1@example.com', password: 'TestPass123!' },
  { email: 'test2@example.com', password: 'TestPass123!' },
  { email: 'test3@example.com', password: 'TestPass123!' },
];

const airports = ['JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'LHR', 'CDG', 'NRT'];
const baggageIds = ['BAG001', 'BAG002', 'BAG003', 'BAG004', 'BAG005'];

// 🔧 Helper Functions
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

function getRandomAirport() {
  return airports[Math.floor(Math.random() * airports.length)];
}

function getRandomBaggage() {
  return baggageIds[Math.floor(Math.random() * baggageIds.length)];
}

function generateHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// 🔐 Authentication Flow
function authenticate() {
  const user = getRandomUser();
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: generateHeaders(),
      tags: { endpoint: 'auth_login' },
    }
  );

  apiCalls.add(1);
  responseTime.add(loginResponse.timings.duration);

  const success = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => r.json('token') !== undefined,
  });

  apiErrorRate.add(!success);

  if (success) {
    return loginResponse.json('token');
  }
  
  return null;
}

// 🛫 Flight Information Tests
function testFlightInfo(token) {
  const airport = getRandomAirport();
  
  const response = http.get(
    `${BASE_URL}/api/flights/arrivals?airport=${airport}&limit=10`,
    {
      headers: generateHeaders(token),
      tags: { endpoint: 'flight_arrivals' },
    }
  );

  apiCalls.add(1);
  responseTime.add(response.timings.duration);

  const success = check(response, {
    'flight info status is 200': (r) => r.status === 200,
    'flight info has data': (r) => r.json('data') !== undefined,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  apiErrorRate.add(!success);
}

// 🎒 Baggage Tracking Tests
function testBaggageTracking(token) {
  const baggageId = getRandomBaggage();
  
  const response = http.get(
    `${BASE_URL}/api/baggage/${baggageId}/status`,
    {
      headers: generateHeaders(token),
      tags: { endpoint: 'baggage_tracking' },
    }
  );

  apiCalls.add(1);
  responseTime.add(response.timings.duration);

  const success = check(response, {
    'baggage status is 200': (r) => r.status === 200,
    'baggage has location': (r) => r.json('location') !== undefined,
    'response time < 1.5s': (r) => r.timings.duration < 1500,
  });

  apiErrorRate.add(!success);
}

// 🗺️ Wayfinding Tests
function testWayfinding(token) {
  const fromGate = `A${Math.floor(Math.random() * 20) + 1}`;
  const toGate = `B${Math.floor(Math.random() * 20) + 1}`;
  
  const response = http.post(
    `${BASE_URL}/api/wayfinding/route`,
    JSON.stringify({
      from: fromGate,
      to: toGate,
      accessibility: false,
    }),
    {
      headers: generateHeaders(token),
      tags: { endpoint: 'wayfinding_route' },
    }
  );

  apiCalls.add(1);
  responseTime.add(response.timings.duration);

  const success = check(response, {
    'wayfinding status is 200': (r) => r.status === 200,
    'wayfinding has route': (r) => r.json('route') !== undefined,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  apiErrorRate.add(!success);
}

// 🤖 AI Concierge Tests
function testAIConcierge(token) {
  const questions = [
    "Where is gate A15?",
    "What time does flight AA123 depart?",
    "Where can I find coffee?",
    "How do I get to baggage claim?",
    "What restaurants are open now?",
  ];
  
  const question = questions[Math.floor(Math.random() * questions.length)];
  
  const response = http.post(
    `${BASE_URL}/api/ai-concierge/chat`,
    JSON.stringify({
      message: question,
      context: {
        location: getRandomAirport(),
        terminal: Math.floor(Math.random() * 4) + 1,
      },
    }),
    {
      headers: generateHeaders(token),
      tags: { endpoint: 'ai_concierge' },
    }
  );

  apiCalls.add(1);
  responseTime.add(response.timings.duration);

  const success = check(response, {
    'ai concierge status is 200': (r) => r.status === 200,
    'ai response has message': (r) => r.json('response') !== undefined,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  apiErrorRate.add(!success);
}

// 🛒 Commerce Tests
function testCommerce(token) {
  // Get products
  const productsResponse = http.get(
    `${BASE_URL}/api/commerce/products?category=food&limit=5`,
    {
      headers: generateHeaders(token),
      tags: { endpoint: 'commerce_products' },
    }
  );

  apiCalls.add(1);
  responseTime.add(productsResponse.timings.duration);

  const productsSuccess = check(productsResponse, {
    'products status is 200': (r) => r.status === 200,
    'products has data': (r) => r.json('products') !== undefined,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  apiErrorRate.add(!productsSuccess);

  // Simulate cart operations
  if (productsSuccess) {
    const cartResponse = http.post(
      `${BASE_URL}/api/commerce/cart/add`,
      JSON.stringify({
        productId: 'PROD001',
        quantity: 1,
      }),
      {
        headers: generateHeaders(token),
        tags: { endpoint: 'commerce_cart' },
      }
    );

    apiCalls.add(1);
    responseTime.add(cartResponse.timings.duration);

    const cartSuccess = check(cartResponse, {
      'cart add status is 200': (r) => r.status === 200,
      'response time < 1s': (r) => r.timings.duration < 1000,
    });

    apiErrorRate.add(!cartSuccess);
  }
}

// 📊 Health Check
function testHealthCheck() {
  const response = http.get(`${BASE_URL}/health`, {
    tags: { endpoint: 'health_check' },
  });

  apiCalls.add(1);
  responseTime.add(response.timings.duration);

  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  apiErrorRate.add(!success);
}

// 🎯 Main Test Function
export default function () {
  // Health check (10% of requests)
  if (Math.random() < 0.1) {
    testHealthCheck();
    sleep(1);
    return;
  }

  // Authenticate user
  const token = authenticate();
  
  if (!token) {
    sleep(2);
    return;
  }

  // Random API usage simulation
  const apiTests = [
    () => testFlightInfo(token),
    () => testBaggageTracking(token),
    () => testWayfinding(token),
    () => testAIConcierge(token),
    () => testCommerce(token),
  ];

  // Execute 2-4 random API calls per user session
  const numCalls = Math.floor(Math.random() * 3) + 2;
  
  for (let i = 0; i < numCalls; i++) {
    const testFunction = apiTests[Math.floor(Math.random() * apiTests.length)];
    testFunction();
    
    // Random think time between calls
    sleep(Math.random() * 2 + 0.5);
  }

  // Session end pause
  sleep(1);
}

// 📈 Test Lifecycle Hooks
export function setup() {
  console.log('🚀 Starting AeroFusionXR Load Test');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log('📊 Metrics: Response Time, Error Rate, Throughput');
  
  // Verify API is reachable
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`API health check failed: ${healthResponse.status}`);
  }
  
  console.log('✅ API health check passed');
  return { startTime: new Date() };
}

export function teardown(data) {
  const duration = (new Date() - data.startTime) / 1000;
  console.log(`🏁 Load test completed in ${duration.toFixed(2)} seconds`);
  console.log('📊 Check detailed metrics in the k6 output above');
} 