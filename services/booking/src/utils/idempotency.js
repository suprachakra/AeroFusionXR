import { v4 as uuidv4 } from 'uuid';

export default (req, res, next) => {
  req.idempotencyKey = req.headers['idempotency-key'] || uuidv4();
  // TODO: store/check key in Redis
  next();
};
