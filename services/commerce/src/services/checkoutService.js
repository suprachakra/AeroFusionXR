import axios from 'axios';
const PAYMENT_API = process.env.PAYMENT_API_URL;
export default {
  process: async ({ cart, user }) => {
    const pay = await axios.post(`${PAYMENT_API}/pay`, { amount: cart.total, user });
    return { orderId: pay.data.id, status: 'completed' };
  }
};
