import express from 'express';
import helmet from 'helmet';
import rateLimiter from './middlewares/rateLimiter.js';
import authRoutes from './routes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import morgan from 'morgan';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(morgan('combined'));
app.use(rateLimiter());

const apiSpec = YAML.load('./src/openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
app.use('/auth', authRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API-Gateway listening on ${port}`));
