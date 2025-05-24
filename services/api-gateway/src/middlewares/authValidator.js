import Joi from 'joi';

const loginSchema = Joi.object({ username: Joi.string().required(), password: Joi.string().required() });
const refreshSchema = Joi.object({ token: Joi.string().required() });

export default {
  login: (req, res, next) => {
    const { error } = loginSchema.validate(req.body);
    return error ? res.status(400).json({ error: error.message }) : next();
  },
  refresh: (req, res, next) => {
    const { error } = refreshSchema.validate(req.body);
    return error ? res.status(400).json({ error: error.message }) : next();
  }
};
