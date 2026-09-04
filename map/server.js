require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const responseCache = new Map();

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;

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

const callOpenRouter = async (prompt, temperature, maxTokens) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY (or GROQ_API_KEY for transition) is not defined');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const err = new Error('OpenRouter request failed');
    err.status = response.status;
    err.payload = errorData;
    throw err;
  }

  return response.json();
};

app.post('/api/generate-summary', validateRequest, async (req, res) => {
  const { prompt } = req.body;
  const cacheKey = `summary:${generateCacheKey(prompt)}`;

  if (responseCache.has(cacheKey)) {
    return res.json(responseCache.get(cacheKey));
  }

  try {
    const data = await callOpenRouter(prompt, 0.3, 160);
    responseCache.set(cacheKey, data);
    return res.json(data);
  } catch (error) {
    if (error.payload) {
      console.error('OpenRouter API error:', error.payload);
      return res.status(error.status || 502).json({
        error: 'Unable to generate response',
        message: 'Please try again later',
      });
    }

    console.error('Error in generate-summary endpoint:', error);
    return res.status(500).json({
      error: 'Service temporarily unavailable',
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
    const data = await callOpenRouter(prompt, 0.5, 150);
    responseCache.set(cacheKey, data);
    return res.json(data);
  } catch (error) {
    if (error.payload) {
      console.error('OpenRouter API error on insight generation:', error.payload);
      return res.status(error.status || 502).json({ error: 'Unable to generate insight' });
    }

    console.error('Error in generate-insight endpoint:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
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
