/**
 * Fallback Manager - Smart provider switching
 * Handles automatic failover and retry logic
 */

class FallbackManager {
  constructor(factory) {
    this.factory = factory;
    this.fallbackChain = ['gemini', 'ollama', 'openai']; // Default priority
    this.retryConfig = {
      maxRetries: 2,
      retryDelay: 1000,
      backoffMultiplier: 2
    };
    this.circuitBreaker = new Map(); // Track provider failures
  }

  /**
   * Set custom fallback chain
   */
  setFallbackChain(chain) {
    if (!Array.isArray(chain) || chain.length === 0) {
      throw new Error('Fallback chain must be a non-empty array');
    }
    this.fallbackChain = chain;
    logInfo('Fallback chain updated', { chain });
  }

  /**
   * Execute operation with automatic fallback
   */
  async executeWithFallback(operation, context = {}) {
    const { 
      capability = 'translation',
      forceProvider = null 
    } = context;

    // If specific provider requested, use it without fallback
    if (forceProvider) {
      return await this._executeWithRetry(forceProvider, operation, context);
    }

    // Try providers in fallback chain order
    const availableProviders = this._getAvailableProvidersInOrder(capability);

    if (availableProviders.length === 0) {
      return {
        success: false,
        error: 'No providers available',
        provider: null
      };
    }

    let lastError = null;
    const attemptLog = [];

    for (const providerName of availableProviders) {
      // Check circuit breaker
      if (this._isCircuitOpen(providerName)) {
        attemptLog.push({ provider: providerName, skipped: 'circuit open' });
        continue;
      }

      try {
        logInfo(`Attempting with provider: ${providerName}`);
        
        const result = await this._executeWithRetry(providerName, operation, context);

        if (result.success) {
          // Success - reset circuit breaker
          this._resetCircuit(providerName);
          
          return {
            ...result,
            fallbackChain: attemptLog,
            attemptedProviders: attemptLog.length + 1
          };
        }

        // Failed - record and try next
        lastError = result.error;
        attemptLog.push({ 
          provider: providerName, 
          error: result.error,
          latency: result.latency 
        });

        // Update circuit breaker
        this._recordFailure(providerName);

      } catch (error) {
        lastError = error.message;
        attemptLog.push({ provider: providerName, error: error.message });
        this._recordFailure(providerName);
      }
    }

    // All providers failed
    logError('All providers failed', { attemptLog });

    return {
      success: false,
      error: lastError || 'All providers failed',
      provider: null,
      fallbackChain: attemptLog,
      attemptedProviders: attemptLog.length
    };
  }

  /**
   * Execute with retry logic
   */
  async _executeWithRetry(providerName, operation, context) {
    const provider = this.factory.getProvider(providerName);
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Wait before retry (exponential backoff)
        if (attempt > 0) {
          const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          logInfo(`Retry attempt ${attempt} for ${providerName}`);
        }

        // Execute operation
        const result = await operation(provider, context);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // Don't retry on certain errors
        if (this._shouldNotRetry(result.error)) {
          break;
        }

      } catch (error) {
        lastError = error.message;
      }
    }

    return {
      success: false,
      error: lastError || 'Operation failed',
      provider: providerName
    };
  }

  /**
   * Get available providers in fallback order
   */
  _getAvailableProvidersInOrder(capability) {
    const available = [];

    for (const providerName of this.fallbackChain) {
      try {
        const provider = this.factory.getProvider(providerName);
        
        // Check if provider supports the capability
        if (!provider.capabilities[capability]) {
          continue;
        }

        // Check if provider is online
        if (provider.status === 'online') {
          available.push(providerName);
        }
      } catch (error) {
        // Provider not found, skip
        continue;
      }
    }

    return available;
  }

  /**
   * Check if error should not trigger retry
   */
  _shouldNotRetry(error) {
    const noRetryErrors = [
      'INVALID_API_KEY',
      'QUOTA_EXCEEDED',
      'INVALID_INPUT',
      'AUTHENTICATION_FAILED'
    ];

    return noRetryErrors.some(err => error.includes(err));
  }

  /**
   * Circuit Breaker: Record failure
   */
  _recordFailure(providerName) {
    const circuit = this.circuitBreaker.get(providerName) || {
      failures: 0,
      lastFailure: null,
      openUntil: null
    };

    circuit.failures++;
    circuit.lastFailure = Date.now();

    // Open circuit after 5 failures
    if (circuit.failures >= 5) {
      circuit.openUntil = Date.now() + 60000; // 1 minute cooldown
      logWarning(`Circuit breaker opened for ${providerName}`);
    }

    this.circuitBreaker.set(providerName, circuit);
  }

  /**
   * Circuit Breaker: Check if open
   */
  _isCircuitOpen(providerName) {
    const circuit = this.circuitBreaker.get(providerName);
    if (!circuit || !circuit.openUntil) {
      return false;
    }

    const now = Date.now();
    if (now > circuit.openUntil) {
      // Circuit can be closed
      this._resetCircuit(providerName);
      return false;
    }

    return true;
  }

  /**
   * Circuit Breaker: Reset
   */
  _resetCircuit(providerName) {
    this.circuitBreaker.set(providerName, {
      failures: 0,
      lastFailure: null,
      openUntil: null
    });
  }

  /**
   * Translate with automatic fallback
   */
  async translate(text, context = {}) {
    return await this.executeWithFallback(
      async (provider, ctx) => await provider.translate(text, ctx),
      { ...context, capability: 'translation' }
    );
  }

  /**
   * Transcribe with automatic fallback
   */
  async transcribe(audioFile, context = {}) {
    return await this.executeWithFallback(
      async (provider, ctx) => await provider.transcribe(audioFile, ctx),
      { ...context, capability: 'transcription' }
    );
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus() {
    const status = {};
    
    this.circuitBreaker.forEach((circuit, providerName) => {
      status[providerName] = {
        failures: circuit.failures,
        isOpen: this._isCircuitOpen(providerName),
        openUntil: circuit.openUntil,
        lastFailure: circuit.lastFailure
      };
    });

    return status;
  }

  /**
   * Configure retry behavior
   */
  setRetryConfig(config) {
    this.retryConfig = { ...this.retryConfig, ...config };
    logInfo('Retry config updated', this.retryConfig);
  }

  /**
   * Get manager info
   */
  getInfo() {
    return {
      fallbackChain: this.fallbackChain,
      retryConfig: this.retryConfig,
      circuitBreakers: this.getCircuitStatus(),
      availableProviders: this._getAvailableProvidersInOrder('translation')
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits() {
    this.circuitBreaker.clear();
    logInfo('All circuit breakers reset');
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FallbackManager;
}
