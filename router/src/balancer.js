const store = require('./store');

class LoadBalancer {
  constructor() {
    this.roundRobinIndex = 0;
    this.telemetrySubscribers = new Set();
  }

  subscribeTelemetry(res) {
    this.telemetrySubscribers.add(res);
    res.on('close', () => {
      this.telemetrySubscribers.delete(res);
    });
  }

  broadcastTelemetry(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.telemetrySubscribers) {
      try {
        res.write(payload);
      } catch (e) {
        this.telemetrySubscribers.delete(res);
      }
    }
  }

  /**
   * Acquire a candidate account according to current strategy
   * @param {string[]} excludeIds - IDs of accounts already tried in current request chain
   */
  pickAccount(excludeIds = []) {
    const accounts = store.getAll();
    const readyNodes = accounts.filter(a => a.enabled && a.status === 'READY' && !excludeIds.includes(a.id));

    if (readyNodes.length === 0) {
      // Check if any WORKING node can take a second concurrent request if needed
      const workingNodes = accounts.filter(a => a.enabled && a.status === 'WORKING' && a.activeRequests < 3 && !excludeIds.includes(a.id));
      if (workingNodes.length > 0) {
        return workingNodes[0];
      }
      return null;
    }

    const strategy = store.getStrategy();

    if (strategy === 'round-robin') {
      const idx = this.roundRobinIndex % readyNodes.length;
      this.roundRobinIndex = (this.roundRobinIndex + 1) % 100000;
      return readyNodes[idx];
    }

    if (strategy === 'least-used') {
      // Sort by activeRequests first, then totalServed
      const sorted = [...readyNodes].sort((a, b) => {
        if (a.activeRequests !== b.activeRequests) return a.activeRequests - b.activeRequests;
        return a.totalServed - b.totalServed;
      });
      return sorted[0];
    }

    if (strategy === 'random') {
      const randIdx = Math.floor(Math.random() * readyNodes.length);
      return readyNodes[randIdx];
    }

    return readyNodes[0];
  }

  startRequest(account) {
    account.activeRequests = (account.activeRequests || 0) + 1;
    account.status = 'WORKING';
    account.lastUsed = Date.now();
    store.save();
    this.broadcastTelemetry('account_update', { account, metrics: store.getMetrics() });
  }

  finishRequestSuccess(account, latencyMs, responseSnippet) {
    account.activeRequests = Math.max(0, (account.activeRequests || 1) - 1);
    account.status = account.activeRequests === 0 ? 'READY' : 'WORKING';
    account.totalServed = (account.totalServed || 0) + 1;
    account.lastLatencyMs = latencyMs;
    store.totalServed = (store.totalServed || 0) + 1;
    if (responseSnippet) {
      store.lastResponseSnippet = `ag/gemini-3.8-flash answered in ${(latencyMs / 1000).toFixed(1)} s ("${responseSnippet.slice(0, 15)}...").`;
    }
    store.save();
    this.broadcastTelemetry('account_update', { account, metrics: store.getMetrics() });
  }

  handleRateLimit(account, cooldownSeconds = 180) {
    account.activeRequests = Math.max(0, (account.activeRequests || 1) - 1);
    account.status = 'RATE_LIMITED';
    account.rateLimitedUntil = Date.now() + (cooldownSeconds * 1000);
    store.totalFailed = (store.totalFailed || 0) + 1;
    store.save();
    this.broadcastTelemetry('account_update', { account, metrics: store.getMetrics() });
  }

  handleQuarantine(account, reason = 'HTTP 403 Forbidden') {
    account.activeRequests = Math.max(0, (account.activeRequests || 1) - 1);
    account.status = 'QUARANTINED';
    account.quarantineReason = reason;
    store.totalFailed = (store.totalFailed || 0) + 1;
    store.save();
    this.broadcastTelemetry('account_update', { account, metrics: store.getMetrics() });
  }

  releaseAccount(account) {
    account.activeRequests = Math.max(0, (account.activeRequests || 1) - 1);
    if (account.status === 'WORKING' && account.activeRequests === 0) {
      account.status = 'READY';
    }
    store.save();
    this.broadcastTelemetry('account_update', { account, metrics: store.getMetrics() });
  }
}

const balancer = new LoadBalancer();
module.exports = balancer;

