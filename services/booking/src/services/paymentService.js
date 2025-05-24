import axios from 'axios';

const PAYMENT_API = process.env.PAYMENT_API_URL;

export default {
  charge: async ({ amount, currency, userId }) => {
    const resp = await axios.post(`${PAYMENT_API}/charge`, { amount, currency, userId });
    return resp.data;
  }
};
