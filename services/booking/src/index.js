import express from 'express';
import bookingFlow from './workflows/bookingFlow.js';
import paymentService from './services/paymentService.js';
import morgan from 'morgan';

const app = express();
app.use(express.json());
app.use(idempotency);
app.use(validator);
app.use('/booking', bookingRouter);
app.use(morgan('combined'));

app.post('/book', async (req, res, next) => {
  try {
    const result = await bookingFlow.execute(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Booking service listening on ${port}`));
