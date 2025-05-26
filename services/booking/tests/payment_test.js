import axios from 'axios';
import step from '../src/workflows/paymentStep.js';

test('payment step returns data', async () => {
  jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
  await expect(step({})).resolves.toEqual({});
});
