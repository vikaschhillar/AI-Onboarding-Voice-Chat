// server.js or index.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/validate-industry', (req, res) => {
  const { company } = req.body;
  console.log({ company });

  const foodCompanies = ['Nestle', 'PepsiCo', 'Coca-Cola', 'ABCD'];
  const match = foodCompanies.includes(company);

  res.json({
    industryMatch: match,
    companyOverview: match ? `Overview of ${company}` : 'Generic company',
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post('/api/report', (req, res) => {
  const {
    userName,
    companyName,
    role,
    objective,
    idealOutput,
    industryConfirmed,
    companyOverview,
    transcript,
  } = req.body;

  const report = {
    userName,
    companyName,
    role,
    objective,
    idealOutput,
    industryConfirmed,
    companyOverview,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'reports');
  const reportPath = path.join(reportDir, `report-${timestamp}.json`);
  const transcriptPath = path.join(reportDir, `transcript-${timestamp}.txt`);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(transcriptPath, transcript || '');

  res.json({ message: 'Report saved', report });
});

app.listen(4567, () => console.log('Mock API running on port 4567'));
