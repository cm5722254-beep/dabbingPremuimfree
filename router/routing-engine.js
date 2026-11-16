/**
 * 9Router Translation Routing Engine
 * Handles: Priority Failover, Round-Robin, Random, Least-Used, Sticky Session, Adaptive Smart
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const CACHE_FILE = path.join(__dirname, 'cache.json');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'router.log');

// ============ CONFIG MANAGEMENT ============
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    console.error('[Router] Failed to load config:', e.message);
    return null;
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Router] Failed to save config:', e.message);
    return false;
  }
}

// ============ CACHE MANAGEMENT ============
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { chunks: {}, characters: {} };
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error('[Router] Failed to save cache:', e.message);
  }
}

// ============ LOGGING ============
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {}
  
  console.log(line.trim());
}

// ============ ROUTING STRATEGIES ============
class RoutingStrategies {
  static priorityFailover(accounts) {
    // Sort by priority (lower = higher priority), then by remaining quota
    return accounts
      .filter(a => a.enabled && a.quotaRemaining > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.quotaRemaining - a.quotaRemaining;
      });
  }

  static roundRobin(accounts, lastUsedIndex = 0) {
    const available = accounts.filter(a => a.enabled && a.quotaRemaining > 0);
    if (available.length === 0) return [];
    
    const nextIndex = (lastUsedIndex + 1) % available.length;
    return [
      ...available.slice(nextIndex),
      ...available.slice(0, nextIndex)
    ];
  }

  static random(accounts) {
    const available = accounts.filter(a => a.enabled && a.quotaRemaining > 0);
    return available.sort(() => Math.random() - 0.5);
  }

  static leastUsed(accounts) {
    return accounts
      .filter(a => a.enabled && a.quotaRemaining > 0)
      .sort((a, b) => a.totalRequests - b.totalRequests);
  }

  static stickySession(accounts, sessionId) {
    // Hash session ID to pick a consistent account
    const hash = sessionId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    const available = accounts.filter(a => a.enabled && a.quotaRemaining > 0);
    if (available.length === 0) return [];
    
    const index = Math.abs(hash) % available.length;
    return [
      available[index],
      ...available.filter((_, i) => i !== index)
    ];
  }

  static adaptiveSmart(accounts) {
    // Highest remaining quota percentage first
    return accounts
      .filter(a => a.enabled && a.quotaRemaining > 0)
      .map(a => ({
        ...a,
        quotaPercentage: (a.quotaRemaining / a.quotaTotal) * 100
      }))
      .sort((a, b) => b.quotaPercentage - a.quotaPercentage);
  }
}

// ============ ACCOUNT SELECTION ============
function selectAccount(strategy = 'adaptive-smart', accounts = [], context = {}) {
  if (!accounts || accounts.length === 0) {
    log('No accounts available', 'WARN');
    return null;
  }

  let sorted = [];
  
  switch (strategy) {
    case 'priority-failover':
      sorted = RoutingStrategies.priorityFailover(accounts);
      break;
    case 'round-robin':
      sorted = RoutingStrategies.roundRobin(accounts, context.lastUsedIndex || 0);
      break;
    case 'random':
      sorted = RoutingStrategies.random(accounts);
      break;
    case 'least-used':
      sorted = RoutingStrategies.leastUsed(accounts);
      break;
    case 'sticky-session':
      sorted = RoutingStrategies.stickySession(accounts, context.sessionId || 'default');
      break;
    case 'adaptive-smart':
    default:
      sorted = RoutingStrategies.adaptiveSmart(accounts);
      break;
  }

  if (sorted.length === 0) {
    log('All accounts exhausted or disabled', 'ERROR');
    return null;
  }

  return sorted[0];
}

// ============ TRANSLATION REQUEST ============
async function makeTranslationRequest(provider, prompt, retries = 0) {
  const maxRetries = provider.maxRetries || 3;
  
  try {
    const url = `${provider.baseUrl}/chat/completions`;
    const requestBody = JSON.stringify({
      model: provider.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Always return valid JSON only, no extra text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey || 'dummy'}`
      }
    };

    const response = await fetch(url, {
      ...options,
      body: requestBody,
      timeout: 30000
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Check for quota errors (429)
      if (response.status === 429) {
        log(`Provider ${provider.name} hit quota limit (429)`, 'WARN');
        return { error: 'quota_exceeded', status: 429, retryable: true };
      }

      // Other errors
      log(`Provider ${provider.name} error ${response.status}: ${errorText}`, 'ERROR');
      return { error: errorText, status: response.status, retryable: response.status >= 500 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return { success: true, content, provider: provider.name };

  } catch (error) {
    log(`Request failed for ${provider.name}: ${error.message}`, 'ERROR');
    
    // Retry with exponential backoff
    if (retries < maxRetries) {
      const backoff = Math.min(1000 * Math.pow(2, retries), 10000);
      log(`Retrying in ${backoff}ms... (attempt ${retries + 1}/${maxRetries})`, 'INFO');
      await new Promise(resolve => setTimeout(resolve, backoff));
      return makeTranslationRequest(provider, prompt, retries + 1);
    }

    return { error: error.message, retryable: true };
  }
}

// ============ TRANSLATE WITH ROUTING ============
async function translateWithRouting(lines, targetLang = 'km', options = {}) {
  const config = loadConfig();
  if (!config) {
    return { success: false, error: 'Failed to load router config' };
  }

  const { routingStrategy, providers, accounts } = config;
  const strategy = options.strategy || routingStrategy || 'adaptive-smart';

  log(`Starting translation: ${lines.length} lines, strategy: ${strategy}`, 'INFO');

  // Build prompt
  const prompt = `Translate the following lines to ${targetLang === 'km' ? 'Khmer' : targetLang}. Return ONLY valid JSON with line IDs as keys and translated text as values. Do not add any extra text or explanation.

Input lines:
${lines.map(l => `${l.id}: "${l.text}"`).join('\n')}

Output format: {"1": "translated text", "2": "translated text", ...}`;

  // Try 9router pool first
  const routerProvider = providers.find(p => p.id === '9router-pool' && p.enabled);
  if (routerProvider && accounts.length > 0) {
    const account = selectAccount(strategy, accounts, options.context || {});
    
    if (account) {
      log(`Using account: ${maskEmail(account.email)} (quota: ${account.quotaRemaining}%)`, 'INFO');
      
      const result = await makeTranslationRequest(routerProvider, prompt);
      
      if (result.success) {
        // Update account stats
        account.totalRequests++;
        account.lastUsed = new Date().toISOString();
        saveConfig(config);
        
        return {
          success: true,
          content: result.content,
          provider: '9router',
          account: maskEmail(account.email)
        };
      }

      // Mark account as exhausted if quota error
      if (result.error === 'quota_exceeded') {
        log(`Marking account ${maskEmail(account.email)} as exhausted`, 'WARN');
        account.quotaRemaining = 0;
        account.enabled = false;
        saveConfig(config);
      }
    }
  }

  // Fallback to local Ollama
  const ollamaProvider = providers.find(p => p.id === 'ollama-local' && p.enabled);
  if (ollamaProvider) {
    log('Falling back to local Ollama GPU', 'INFO');
    
    const result = await makeTranslationRequest(ollamaProvider, prompt);
    
    if (result.success) {
      return {
        success: true,
        content: result.content,
        provider: 'ollama-local',
        account: 'local-gpu'
      };
    }
  }

  return { success: false, error: 'All providers failed' };
}

// ============ HELPERS ============
function maskEmail(email) {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.substring(0, 2)}***@${domain}`;
}

module.exports = {
  loadConfig,
  saveConfig,
  selectAccount,
  translateWithRouting,
  RoutingStrategies,
  log
};
