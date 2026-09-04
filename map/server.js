require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const responseCache = new Map();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getApiKey = () => process.env.GROQ_API_KEY;

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    hasApiKey: !!getApiKey(),
  });
});

const validateRequest = (req, res, next) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid prompt. Please provide a non-empty string.' });
  }
  next();
};

const generateCacheKey = (prompt) => prompt.trim().toLowerCase();

const callGroq = async (prompt, temperature, maxTokens) => {
  if (!getApiKey()) {
    throw new Error('GROQ_API_KEY is not defined');
  }

  return groq.chat.completions.create({
    model: 'groq/compound',
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  });
};

app.post('/api/generate-summary', validateRequest, async (req, res) => {
  const { prompt } = req.body;
  const cacheKey = `summary:${generateCacheKey(prompt)}`;

  if (responseCache.has(cacheKey)) {
    return res.json(responseCache.get(cacheKey));
  }

  try {
    const data = await callGroq(prompt, 0.3, 160);
    responseCache.set(cacheKey, data);
    return res.json(data);
  } catch (error) {
    const errorPayload = error?.error || error?.message || error;
    console.error('Groq API error in generate-summary:', errorPayload);
    return res.status(error?.status || 502).json({
      error: 'Unable to generate response',
      message: 'Please try again later',
    });
  }
});

app.post('/api/generate-insight', validateRequest, async (req, res) => {
  const { prompt } = req.body;
  const cacheKey = `insight:${generateCacheKey(prompt)}`;

  if (responseCache.has(cacheKey)) {
    return res.json(responseCache.get(cacheKey));
  }

  try {
    const data = await callGroq(prompt, 0.5, 150);
    responseCache.set(cacheKey, data);
    return res.json(data);
  } catch (error) {
    const errorPayload = error?.error || error?.message || error;
    console.error('Groq API error in generate-insight:', errorPayload);
    return res.status(error?.status || 502).json({ error: 'Unable to generate insight' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Please try again later',
  });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`API Key present: ${!!getApiKey()}`);
  });
}

module.exports = app;
