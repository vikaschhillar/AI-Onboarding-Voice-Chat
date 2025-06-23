import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('OpenAI Key starts with:', process.env.OPENAI_API_KEY?.slice(0, 5));  // Safe preview


const app = express();
app.use(cors());
app.use(express.json());

const NEWS_API_KEY = '7e260eb6cf7f4349bf2d75f802860ce1';

app.post('/api/company-news', async (req, res) => {
  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(company)}&apiKey=${NEWS_API_KEY}`
    );
    const newsData = await response.json();
    console.log(newsData)

    if (newsData.status !== 'ok') {
      return res.status(500).json({ error: 'Failed to fetch news' });
    }

    const articles = newsData.articles.slice(0, 3).map(({ title, url, source, publishedAt }) => ({
      title,
      url,
      source: source.name,
      publishedAt,
    }));

    res.json({ articles });
  } catch (error) {
    console.error('News fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.post('/api/validate-industry', (req, res) => {
  const { company } = req.body;
  const foodCompanies = ['Nestle', 'PepsiCo', 'Coca-Cola', 'ABCD'];
  const match = foodCompanies.includes(company);
  res.json({
    industryMatch: match,
    companyOverview: match ? `Overview of ${company}` : 'Generic company',
  });
});


app.post('/api/company-details', async (req, res) => {
  const { company } = req.body;
  if (!company) return res.status(400).json({ error: "Company name required" });

  const prompt = `Provide a detailed summary about the company named "${company}". Include industry, history, and key facts.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const companySummary = completion.choices[0].message.content || "No details available.";

    res.json({
      companySummary,
    });
  } catch (err) {
    console.error('OpenAI company summary failed:', err);
    res.status(500).json({ error: "Failed to generate company summary" });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Properly setup __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post('/api/report', async (req, res) => {
  const {
    userName,
    companyName,
    role,
    objective,
    idealOutput,
    industryConfirmed,
    companyOverview,
    companySummary,
    Company_News,
    transcript,
  } = req.body;

  const report = {
    userName,
    companyName,
    role,
    objective,
    industryConfirmed,
    idealOutput,
    companyOverview,
    companySummary,
    Company_News
  };

  const prompt = `You are generating a professional onboarding summary for a voice interview.

User Info:
- Name: ${userName}
- Company: ${companyName}
- Role: ${role}
- Objective: ${objective}
- Ideal Output: ${idealOutput}
- Industry Confirmed: ${industryConfirmed}
- Company Overview: ${companyOverview}

Transcript:
${transcript}

Generate a clear and concise summary for internal documentation or a client report.`;

  let llmSummary = '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    llmSummary = completion.choices[0].message.content || '';
  } catch (err) {
    console.error('OpenAI summarization failed:', err);
    llmSummary = '[LLM summary unavailable]';
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'reports');
  const reportPath = path.join(reportDir, `report-${timestamp}.json`);
  const transcriptPath = path.join(reportDir, `transcript-${timestamp}.txt`);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify({ ...report, llmSummary }, null, 2));
  fs.writeFileSync(transcriptPath, transcript || '');

  res.json({ message: 'Report saved', report: { ...report, llmSummary } });
});


app.listen(4567, () => console.log('Mock API running on port 4567'));
