import express from 'express';
import dotenv from 'dotenv';
import routes from './routes';
dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', routes);

app.listen(4000, () => console.log('🚀 Backend listening on http://localhost:4000'));
