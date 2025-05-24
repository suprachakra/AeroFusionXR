import request from 'supertest';
import app from '../index.js';

describe('Wayfinding Service', () => {
  it('health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});
