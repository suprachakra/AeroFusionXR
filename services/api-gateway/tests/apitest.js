import request from 'supertest';
import app from '../src/index.js';

describe('Auth API', () => {
  it('should return 200 on health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
