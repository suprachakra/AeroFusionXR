import axios from 'axios';

export default async function(data) {
  const resp = await axios.post(process.env.INVENTORY_URL + '/reserve', data);
  return resp.data;
}
