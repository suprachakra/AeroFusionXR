import express from 'express';
import mapService from './services/mapService.js';

const app = express();
app.use(express.json());

app.post('/route', async (req, res, next) => {
  try {
    const path = await mapService.computeRoute(req.body);
    res.json(path);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Wayfinding listening on ${port}`));
