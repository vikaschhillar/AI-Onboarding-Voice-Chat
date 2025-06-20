import express from 'express';
import cors from 'cors';

const app = express();
const port = 3002;

app.use(express.json());

// Enable CORS for all origins (for development)
app.use(cors());

// Endpoint to validate if a company is in the food industry
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
  });
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
