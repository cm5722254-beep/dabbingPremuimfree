const http = require('http');
const https = require('https');
const { URL } = require('url');

class GeminiClient {
  constructor() {
    this.defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
  }

  /**
   * Convert OpenAI messages array into Gemini contents structure
   */
  transformMessages(messages) {
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role: role,
          parts: [{ text: msg.content || '' }]
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    return { contents, systemInstruction };
  }

  /**
   * Verify a Google API Key against Google's live endpoint
   */
  async verifyGoogleKey(apiKey) {
    if (!apiKey) return { valid: false, error: 'API Key is empty' };
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    return new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': this.defaultUserAgent } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              const modelCount = data.models ? data.models.length : 0;
              resolve({ valid: true, modelCount, models: (data.models || []).slice(0, 5).map(m => m.name) });
            } catch (e) {
              resolve({ valid: false, error: 'Invalid JSON from Google API' });
            }
          } else {
            resolve({ valid: false, statusCode: res.statusCode, error: `Google API returned HTTP ${res.statusCode}` });
          }
        });
      }).on('error', (err) => {
        resolve({ valid: false, error: err.message });
      });
    });
  }

  /**
   * Dispatches request to Gemini Upstream endpoint
   */
  async executeRequest(account, payload, options = {}) {
    const { stream = false, model = 'gemini-2.0-flash' } = options;

    const apiKey = account.apiKey || (account.sessionCookie && account.sessionCookie.startsWith('AIza') ? account.sessionCookie : null);
    
    // Choose model endpoint
    const cleanModel = model.replace(/^ag\//, '').replace(/^openai\//, '');
    const targetModel = cleanModel.includes('gemini') ? cleanModel : 'gemini-2.0-flash';

    const action = stream ? 'streamGenerateContent' : 'generateContent';
    let endpointUrl;
    if (apiKey) {
      const q = stream ? `?alt=sse&key=${apiKey}` : `?key=${apiKey}`;
      endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${action}${q}`;
    } else {
      endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${action}${stream ? '?alt=sse' : ''}`;
    }

    const { contents, systemInstruction } = this.transformMessages(payload.messages || []);
    const requestBody = JSON.stringify({
      contents,
      systemInstruction,
      generationConfig: {
        temperature: payload.temperature ?? 0.7,
        maxOutputTokens: payload.max_tokens ?? 2048,
        topP: payload.top_p ?? 0.95
      }
    });

    const parsedUrl = new URL(endpointUrl);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
      'User-Agent': this.defaultUserAgent,
      'Accept': stream ? 'text/event-stream' : 'application/json',
      'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    };

    if (account.sessionCookie && !apiKey) {
      headers['Cookie'] = account.sessionCookie;
    }
    if (account.bearerToken && !apiKey) {
      headers['Authorization'] = `Bearer ${account.bearerToken}`;
    }

    return new Promise((resolve, reject) => {
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.request(parsedUrl, {
        method: 'POST',
        headers: headers,
        timeout: 45000
      }, (res) => {
        const statusCode = res.statusCode || 200;

        if (statusCode === 429) {
          const err = new Error('HTTP 429 Rate Limit Exceeded');
          err.statusCode = 429;
          return reject(err);
        }

        if (statusCode === 401 || statusCode === 403) {
          const err = new Error(`HTTP ${statusCode} Authentication Failed`);
          err.statusCode = statusCode;
          return reject(err);
        }

        if (stream) {
          return resolve({ stream: res, statusCode });
        }

        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            if (statusCode >= 400) {
              const err = new Error(`Upstream Error: HTTP ${statusCode} ${body.slice(0, 150)}`);
              err.statusCode = statusCode;
              return reject(err);
            }
            const json = JSON.parse(body);
            resolve({ data: json, statusCode });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Upstream request timeout (45s)'));
      });

      req.write(requestBody);
      req.end();
    });
  }
}

const geminiClient = new GeminiClient();
module.exports = geminiClient;
