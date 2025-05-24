import jwtService from '../services/jwtService.js';

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const token = await jwtService.authenticate(username, password);
    res.json({ token });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const newToken = await jwtService.refresh(token);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};
