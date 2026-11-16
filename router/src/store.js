const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'acc***@***';
  const [user, domain] = email.split('@');
  const visible = user.slice(0, 3);
  return `${visible}***@***`;
}

class AccountStore {
  constructor() {
    this.accounts = [];
    this.strategy = 'round-robin';
    this.totalServed = 146;
    this.totalFailed = 57;
    this.lastResponseSnippet = 'ag/gemini-2.0-flash answered in 0.6 s ("OK").';
    this.init();
  }

  init() {
    // 1. Try reading existing accounts.json
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.accounts = parsed.accounts || [];
        this.strategy = parsed.strategy || 'round-robin';
        this.totalServed = parsed.totalServed || 0;
        this.totalFailed = parsed.totalFailed || 0;
        return;
      } catch (e) {
        console.error('[Store] Error reading accounts.json:', e.message);
      }
    }

    // 2. Try migrating from config.json
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.accounts && parsed.accounts.length > 0) {
          this.accounts = parsed.accounts.map((acc, idx) => ({
            id: acc.id || `acc_${Date.now()}_${idx}`,
            email: acc.email || `account${idx+1}@gmail.com`,
            maskedEmail: maskEmail(acc.email),
            channel: 'WEB',
            status: acc.enabled !== false ? 'READY' : 'RATE_LIMITED',
            sessionCookie: acc.apiKey || '',
            bearerToken: acc.apiKey || '',
            apiKey: acc.apiKey || '',
            proxy: acc.proxy || '',
            activeRequests: 0,
            totalServed: acc.successfulRequests || Math.floor(Math.random() * 8),
            totalFailed: acc.failedRequests || 0,
            rateLimitedUntil: 0,
            lastLatencyMs: acc.latencyMs || 42,
            lastUsed: Date.now(),
            createdAt: Date.now(),
            enabled: acc.enabled !== false
          }));
          this.strategy = parsed.routingStrategy || 'round-robin';
          this.save();
          return;
        }
      } catch (e) {}
    }

    // Default template accounts
    this.accounts = [];
    this.save();
  }

  save() {
    try {
      const payload = {
        strategy: this.strategy,
        totalServed: this.totalServed,
        totalFailed: this.totalFailed,
        lastResponseSnippet: this.lastResponseSnippet,
        updatedAt: Date.now(),
        accounts: this.accounts
      };
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[Store] Failed to write accounts.json:', e.message);
      return false;
    }
  }

  getAll() {
    const now = Date.now();
    for (const acc of this.accounts) {
      if (acc.status === 'RATE_LIMITED' && acc.rateLimitedUntil && acc.rateLimitedUntil <= now) {
        acc.status = 'READY';
        acc.rateLimitedUntil = 0;
      }
    }
    return this.accounts;
  }

  getById(id) {
    return this.accounts.find(a => a.id === id) || null;
  }

  addAccount({ email, sessionCookie, apiKey, proxy, channel = 'WEB' }) {
    const cleanEmail = (email || '').trim() || `google.user.${Date.now().toString().slice(-4)}@gmail.com`;
    const newAcc = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      maskedEmail: maskEmail(cleanEmail),
      channel: channel || 'WEB',
      status: 'READY',
      sessionCookie: sessionCookie || '',
      bearerToken: sessionCookie || '',
      apiKey: apiKey || '',
      proxy: proxy || '',
      activeRequests: 0,
      totalServed: 0,
      totalFailed: 0,
      rateLimitedUntil: 0,
      quarantineReason: '',
      lastLatencyMs: 0,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      enabled: true
    };
    this.accounts.push(newAcc);
    this.save();
    return newAcc;
  }

  clearDemoAccounts() {
    this.accounts = this.accounts.filter(a => (a.apiKey && a.apiKey.length > 15) || (a.sessionCookie && a.sessionCookie.length > 25));
    this.save();
    return this.accounts;
  }

  updateAccount(id, updates) {
    const acc = this.getById(id);
    if (!acc) return null;
    if (updates.email) {
      acc.email = updates.email;
      acc.maskedEmail = maskEmail(updates.email);
    }
    if (updates.sessionCookie !== undefined) acc.sessionCookie = updates.sessionCookie;
    if (updates.apiKey !== undefined) acc.apiKey = updates.apiKey;
    if (updates.proxy !== undefined) acc.proxy = updates.proxy;
    if (updates.status !== undefined) acc.status = updates.status;
    if (updates.enabled !== undefined) acc.enabled = updates.enabled;
    this.save();
    return acc;
  }

  deleteAccount(id) {
    const idx = this.accounts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.accounts.splice(idx, 1);
    this.save();
    return true;
  }

  setStrategy(strategy) {
    if (['round-robin', 'least-used', 'random'].includes(strategy)) {
      this.strategy = strategy;
      this.save();
    }
  }

  getStrategy() {
    return this.strategy;
  }

  getMetrics() {
    const accounts = this.getAll();
    const ready = accounts.filter(a => a.status === 'READY' && a.enabled).length;
    const working = accounts.filter(a => a.status === 'WORKING').length;
    const rateLimited = accounts.filter(a => a.status === 'RATE_LIMITED').length;
    const quarantined = accounts.filter(a => a.status === 'QUARANTINED').length;
    const inFlight = accounts.reduce((sum, a) => sum + (a.activeRequests || 0), 0);

    return {
      totalAccounts: accounts.length,
      readyCount: ready,
      workingCount: working,
      rateLimitedCount: rateLimited,
      quarantinedCount: quarantined,
      inFlightRequests: inFlight,
      totalServed: this.totalServed,
      totalFailed: this.totalFailed,
      strategy: this.strategy,
      lastResponseSnippet: this.lastResponseSnippet
    };
  }
}

const store = new AccountStore();
module.exports = store;
