import CircuitBreaker from 'opossum';
export default new CircuitBreaker(async (req) => fetch(req.originalUrl), { timeout: 3000, errorThresholdPercentage: 50 });
