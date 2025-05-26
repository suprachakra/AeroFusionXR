import axios from 'axios';

export default async function(reservation) {
  const resp = await axios.post(process.env.PAYMENT_URL + '/pay', reservation);
  return resp.data;
