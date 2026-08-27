import 'dotenv/config';
import fetch from 'node-fetch';

const provider = 'mistral';
const endpoint = 'https://api.mistral.ai/v1/chat/completions';
const model = process.env.MISTRAL_MODEL || process.env.MISTRAL_FAST_MODEL || 'mistral-small-latest';
const apiKey = String(process.env.MISTRAL_API_KEY || '').trim();

function classifyStatus(status) {
  if (status === 401) return 'AUTHENTICATION_ERROR';
  if (status === 403) return 'PERMISSION_ERROR';
  if (status === 404) return 'ENDPOINT_OR_MODEL_ERROR';
  if (status === 400) return 'REQUEST_ERROR';
  if (status === 408) return 'TIMEOUT_ERROR';
  if (status === 429) return 'RATE_LIMIT_ERROR';
  if (status >= 500) return 'PROVIDER_ERROR';
  return status >= 200 && status < 300 ? 'SUCCESS' : 'UNKNOWN_ERROR';
}

console.log('MISTRAL DIRECT TEST');
console.log({ provider, baseUrl: new URL(endpoint).origin, endpoint: new URL(endpoint).pathname, model });

if (!apiKey) {
  console.error({ category: 'CONFIGURATION_ERROR', error_message: 'MISTRAL_API_KEY is missing' });
  process.exitCode = 1;
} else {
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 32,
        temperature: 0
      })
    });
    const responseBody = await response.text();
    console.log({
      status: response.status,
      category: classifyStatus(response.status),
      responseReceived: Boolean(responseBody),
      responseBody: responseBody.slice(0, 2000),
      requestDurationMs: Date.now() - startedAt
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error({
      category: error.name === 'AbortError' ? 'TIMEOUT_ERROR' : 'REQUEST_ERROR',
      errorType: error.name,
      errorMessage: error.message,
      requestDurationMs: Date.now() - startedAt
    });
    process.exitCode = 1;
  }
}
