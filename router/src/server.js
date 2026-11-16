const express = require('express');
const cors = require('cors');
const path = require('path');
const store = require('./store');
const balancer = require('./balancer');
const geminiClient = require('./geminiClient');

const app = express();
const PORT = 20128;
const HOST = '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// -------------------------------------------------------------
// TELEMETRY REAL-TIME SSE STREAM
// -------------------------------------------------------------
app.get('/api/telemetry/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`event: snapshot\ndata: ${JSON.stringify({ accounts: store.getAll(), metrics: store.getMetrics() })}\n\n`);
  balancer.subscribeTelemetry(res);
});

// -------------------------------------------------------------
// METRICS & ACCOUNTS MANAGEMENT APIS
// -------------------------------------------------------------
app.get('/api/metrics', (req, res) => {
  res.json({ success: true, metrics: store.getMetrics() });
});

app.get('/api/accounts', (req, res) => {
  res.json({
    success: true,
    strategy: store.getStrategy(),
    accounts: store.getAll(),
    metrics: store.getMetrics()
  });
});

// Real Google Account / Gemini Sign-In & Verification
app.post('/api/accounts/google-login', async (req, res) => {
  try {
    const { apiKey, email, proxy } = req.body;
    if (!apiKey || apiKey.length < 15) {
      return res.status(400).json({ success: false, error: 'សូមបញ្ចូល Google Gemini API Key ឬ Token ឱ្យបានត្រឹមត្រូវ!' });
    }

    // Verify key with live Google API endpoint
    const check = await geminiClient.verifyGoogleKey(apiKey.trim());
    if (!check.valid) {
      return res.status(400).json({ success: false, error: 'Google API Key មិនត្រឹមត្រូវ ឬអស់សុពលភាព: ' + (check.error || 'Authentication Failed') });
    }

    const cleanEmail = (email && email.includes('@')) ? email.trim() : `google.ai.${Date.now().toString().slice(-4)}@gmail.com`;
    const acc = store.addAccount({
      email: cleanEmail,
      apiKey: apiKey.trim(),
      channel: 'GOOGLE_AUTH',
      proxy: proxy || ''
    });

    balancer.broadcastTelemetry('account_update', { account: acc, metrics: store.getMetrics() });
    res.json({
      success: true,
      account: acc,
      verified: true,
      models: check.models,
      metrics: store.getMetrics()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear Mock/Demo Accounts (Leaves only Real Accounts)
app.post('/api/accounts/clear-demo', (req, res) => {
  store.clearDemoAccounts();
  balancer.broadcastTelemetry('snapshot', { accounts: store.getAll(), metrics: store.getMetrics() });
  res.json({ success: true, count: store.getAll().length, accounts: store.getAll(), metrics: store.getMetrics() });
});

app.post('/api/accounts', (req, res) => {
  const { email, sessionCookie, apiKey, proxy, channel } = req.body;
  if (!email && !apiKey) {
    return res.status(400).json({ success: false, error: 'Email or API Key is required' });
  }
  const acc = store.addAccount({ email, sessionCookie, apiKey, proxy, channel });
  balancer.broadcastTelemetry('account_update', { account: acc, metrics: store.getMetrics() });
  res.json({ success: true, account: acc });
});

app.delete('/api/accounts/:id', (req, res) => {
  const success = store.deleteAccount(req.params.id);
  balancer.broadcastTelemetry('snapshot', { accounts: store.getAll(), metrics: store.getMetrics() });
  res.json({ success });
});

app.post('/api/router/strategy', (req, res) => {
  const { strategy } = req.body;
  if (['round-robin', 'least-used', 'random'].includes(strategy)) {
    store.setStrategy(strategy);
    balancer.broadcastTelemetry('strategy_change', { strategy, metrics: store.getMetrics() });
    return res.json({ success: true, strategy });
  }
  res.status(400).json({ success: false, error: 'Invalid strategy' });
});

// Test single account
app.post('/api/accounts/:id/test', async (req, res) => {
  const acc = store.getById(req.params.id);
  if (!acc) return res.status(404).json({ success: false, error: 'Account not found' });

  const startTime = Date.now();
  balancer.startRequest(acc);

  try {
    const testPayload = {
      messages: [{ role: 'user', content: 'Ping' }]
    };
    
    let replyText = 'OK';
    if (acc.apiKey || (acc.sessionCookie && acc.sessionCookie.length > 20)) {
      const result = await geminiClient.executeRequest(acc, testPayload, { stream: false });
      replyText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
    } else {
      await new Promise(r => setTimeout(r, 300));
    }

    const latency = Date.now() - startTime;
    balancer.finishRequestSuccess(acc, latency, replyText);
    res.json({ success: true, latencyMs: latency, reply: replyText });
  } catch (err) {
    if (err.statusCode === 429) {
      balancer.handleRateLimit(acc, 180);
    } else if (err.statusCode === 401 || err.statusCode === 403) {
      balancer.handleQuarantine(acc, `[${err.statusCode}]: ${err.message}`);
    } else {
      balancer.releaseAccount(acc);
    }
    res.json({ success: false, error: err.message, status: acc.status });
  }
});

// Verify all accounts
app.post('/api/accounts/verify-all', async (req, res) => {
  const accounts = store.getAll();
  const results = [];

  for (const acc of accounts) {
    if (acc.status === 'QUARANTINED') {
      results.push({ id: acc.id, status: acc.status, error: acc.quarantineReason });
      continue;
    }
    const startTime = Date.now();
    balancer.startRequest(acc);
    try {
      if (acc.apiKey) {
        await geminiClient.executeRequest(acc, { messages: [{ role: 'user', content: 'Ping' }] }, { stream: false });
      } else {
        await new Promise(r => setTimeout(r, 100));
      }
      const lat = Date.now() - startTime;
      balancer.finishRequestSuccess(acc, lat, 'OK');
      results.push({ id: acc.id, status: 'READY', latencyMs: lat });
    } catch (e) {
      if (e.statusCode === 429) {
        balancer.handleRateLimit(acc, 180);
      } else {
        balancer.handleQuarantine(acc, `[${e.statusCode || 500}]`);
      }
      results.push({ id: acc.id, status: acc.status });
    }
  }

  res.json({ success: true, verified: results.length, metrics: store.getMetrics() });
});

// -------------------------------------------------------------
// OPENAI-COMPATIBLE API ENDPOINTS (/v1/chat/completions)
// -------------------------------------------------------------
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'gemini-2.0-flash', object: 'model', created: 1700000000, owned_by: 'google' },
      { id: 'gemini-1.5-flash', object: 'model', created: 1700000000, owned_by: 'google' },
      { id: 'gemini-2.5-flash', object: 'model', created: 1700000000, owned_by: 'google' },
      { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'openai-mapped' }
    ]
  });
});

app.post('/v1/chat/completions', async (req, res) => {
  const { model = 'gemini-2.0-flash', messages = [], stream = false, temperature = 0.7 } = req.body;
  const requestId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const triedAccountIds = [];
  const maxRetries = Math.min(3, store.getAll().length || 1);

  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    attempt++;
    const account = balancer.pickAccount(triedAccountIds);

    if (!account) {
      return res.status(503).json({
        error: {
          message: 'No healthy accounts available in GodMode Pool. All accounts are rate-limited or quarantined.',
          type: 'insufficient_quota',
          code: 503
        }
      });
    }

    triedAccountIds.push(account.id);
    const startTime = Date.now();
    balancer.startRequest(account);

    try {
      if (account.apiKey || (account.sessionCookie && account.sessionCookie.length > 20)) {
        if (stream) {
          const upstreamRes = await geminiClient.executeRequest(account, { messages, temperature }, { stream: true, model });

          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders();

          let fullContent = '';
          upstreamRes.stream.on('data', chunk => {
            const str = chunk.toString();
            const match = str.match(/"text":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
            if (match) {
              const text = JSON.parse(`"${match[1]}"`);
              fullContent += text;
              const sseChunk = {
                id: requestId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
              };
              res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
            }
          });

          upstreamRes.stream.on('end', () => {
            const finalChunk = {
              id: requestId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: model,
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
            };
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();

            const latency = Date.now() - startTime;
            balancer.finishRequestSuccess(account, latency, fullContent);
          });

          upstreamRes.stream.on('error', (err) => {
            balancer.releaseAccount(account);
            res.end();
          });

          success = true;
          return;
        } else {
          // Non-streaming
          const upstreamData = await geminiClient.executeRequest(account, { messages, temperature }, { stream: false, model });
          const answer = upstreamData.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const latency = Date.now() - startTime;
          balancer.finishRequestSuccess(account, latency, answer);

          success = true;
          return res.json({
            id: requestId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: answer },
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 }
          });
        }
      } else {
        // Simulation passthrough if mock account
        const promptText = messages.map(m => m.content).join(' ');
        const simLatency = 300;
        await new Promise(r => setTimeout(r, simLatency));

        const simAnswer = `[GodMode Proxy Node ${account.maskedEmail}]: Ready.`;
        balancer.finishRequestSuccess(account, simLatency, simAnswer);

        success = true;
        return res.json({
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: simAnswer },
            finish_reason: 'stop'
          }]
        });
      }
    } catch (err) {
      console.error(`[Router] Attempt ${attempt} failed on node ${account.email}:`, err.message);

      if (err.statusCode === 429) {
        balancer.handleRateLimit(account, 180);
      } else if (err.statusCode === 401 || err.statusCode === 403) {
        balancer.handleQuarantine(account, `HTTP ${err.statusCode}`);
      } else {
        balancer.releaseAccount(account);
      }
    }
  }

  res.status(502).json({
    error: {
      message: 'All load balanced retry attempts failed. Upstream Google service unavailable.',
      type: 'upstream_error',
      code: 502
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`
  ============================================================
   ⚡ GODMODE POOL PRO — LOCAL AI REQUEST ROUTER & ACCOUNT POOL
  ============================================================
   🌐 Dashboard UI   : http://${HOST}:${PORT}
   🔌 OpenAI Endpoint : http://${HOST}:${PORT}/v1/chat/completions
   👥 Managed Accounts: ${store.getAll().length} Nodes
   ⚡ Balancing Modes : Round-Robin | Least-Used | Random
   🛡️  Failover Mode   : Transparent In-Flight Auto-Retry
  ============================================================
  `);
});
