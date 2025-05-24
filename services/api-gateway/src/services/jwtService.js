import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET;

export default {
  authenticate: async (user, pass) => {
    // TODO: validate against user store
    if (user === 'admin' && pass === 'password') {
      return jwt.sign({ sub: user }, secret, { expiresIn: '15m' });
    }
    throw new Error('Unauthorized');
  },
  refresh: async (token) => jwt.verify(token, secret, (err, decoded) => {
    if (err) throw err;
    return jwt.sign({ sub: decoded.sub }, secret, { expiresIn: '15m' });
  })
};
