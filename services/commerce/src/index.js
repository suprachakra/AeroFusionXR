import express from 'express';
import checkoutService from './services/checkoutService.js';
import morgan from 'morgan';

const app = express();
app.use(express.json()); app.use(morgan('combined'));

app.post('/checkout', async (req, res, next) => {
  try {
    const result = await checkoutService.process(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
const port = process.env.PORT||6000; app.listen(port);
