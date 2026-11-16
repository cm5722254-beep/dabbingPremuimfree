/**
 * Provider Factory - Creates and manages all providers
 * Single point of provider instantiation
 */

class ProviderFactory {
  constructor() {
    this.providers = new Map();
    this.configs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all providers from config
   */
  async initialize(config = {}) {
    try {
      logInfo('Initializing provider factory', { config });

      // Store configs
      if (config.gemini) {
        this.configs.set('gemini', config.gemini);
      }
      if (config.ollama) {
        this.configs.set('ollama', config.ollama);
      }
      if (config.openai) {
        this.configs.set('openai', config.openai);
      }

      // Create providers
      await this._createProviders();

      // Initialize each provider
      const initResults = await Promise.allSettled(
        Array.from(this.providers.values()).map(p => p.initialize())
      );

      // Log results
      initResults.forEach((result, idx) => {
        const providerName = Array.from(this.providers.keys())[idx];
        if (result.status === 'fulfilled') {
          logInfo(`Provider ${providerName} initialized`, result.value);
        } else {
          logError(`Provider ${providerName} failed`, { error: result.reason });
        }
      });

      this.initialized = true;
      return { 
        success: true, 
        providers: this.getAvailableProviders() 
      };

    } catch (error) {
      logError('Provider factory initialization failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create provider instances
   */
  async _createProviders() {
    // Gemini Provider
    if (this.configs.has('gemini')) {
      const geminiConfig = this.configs.get('gemini');
      if (geminiConfig.enabled !== false) {
        const gemini = new GeminiProvider(geminiConfig);
        this.providers.set('gemini', gemini);
      }
    }

    // Ollama Provider (always try to create)
    const ollamaConfig = this.configs.get('ollama') || { 
      enabled: true,
      endpoint: 'http://localhost:11434',
      model: 'llama3.2'
    };
    if (ollamaConfig.enabled !== false) {
      const ollama = new OllamaProvider(ollamaConfig);
      this.providers.set('ollama', ollama);
    }

    // OpenAI Provider
    if (this.configs.has('openai')) {
      const openaiConfig = this.configs.get('openai');
      if (openaiConfig.enabled !== false) {
        const openai = new OpenAIProvider(openaiConfig);
        this.providers.set('openai', openai);
      }
    }

    logInfo('Providers created', { 
      count: this.providers.size,
      names: Array.from(this.providers.keys())
    });
  }

  /**
   * Get a specific provider
   */
  getProvider(name) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found`);
    }
    return provider;
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Get available (online) providers
   */
  getAvailableProviders() {
    return this.getAllProviders()
      .filter(p => p.status === 'online')
      .map(p => ({
        name: p.name,
        status: p.status,
        displayName: p.getInfo().displayName,
        capabilities: p.capabilities
      }));
  }

  /**
   * Get provider by capability
   */
  getProvidersByCapability(capability) {
    return this.getAllProviders()
      .filter(p => p.capabilities[capability] === true)
      .filter(p => p.status === 'online');
  }

  /**
   * Check if any provider is available
   */
  hasAvailableProvider() {
    return this.getAllProviders().some(p => p.status === 'online');
  }

  /**
   * Get provider statistics
   */
  getStats() {
    const stats = {};
    
    this.providers.forEach((provider, name) => {
      stats[name] = provider.getStats();
    });

    return stats;
  }

  /**
   * Test all providers
   */
  async testAllProviders() {
    const results = {};

    for (const [name, provider] of this.providers) {
      logInfo(`Testing provider: ${name}`);
      results[name] = await provider.testConnection();
    }

    return results;
  }

  /**
   * Reload provider configuration
   */
  async reloadConfig(config) {
    logInfo('Reloading provider configuration');
    
    // Clear existing providers
    this.providers.clear();
    this.configs.clear();
    this.initialized = false;

    // Reinitialize with new config
    return await this.initialize(config);
  }

  /**
   * Get provider status summary
   */
  getStatusSummary() {
    const summary = {
      total: this.providers.size,
      online: 0,
      offline: 0,
      error: 0,
      limited: 0,
      providers: {}
    };

    this.providers.forEach((provider, name) => {
      const status = provider.status;
      summary[status]++;
      
      summary.providers[name] = {
        status: status,
        displayName: provider.getInfo().displayName,
        stats: provider.getStats()
      };
    });

    return summary;
  }

  /**
   * Enable/disable a provider
   */
  async setProviderEnabled(name, enabled) {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`No config found for provider: ${name}`);
    }

    config.enabled = enabled;

    if (enabled) {
      // Re-create and initialize the provider
      await this._createProviders();
      const provider = this.providers.get(name);
      if (provider) {
        await provider.initialize();
      }
    } else {
      // Remove the provider
      this.providers.delete(name);
    }

    logInfo(`Provider ${name} ${enabled ? 'enabled' : 'disabled'}`);
    return { success: true };
  }

  /**
   * Update provider config
   */
  async updateProviderConfig(name, newConfig) {
    const existingConfig = this.configs.get(name) || {};
    const mergedConfig = { ...existingConfig, ...newConfig };
    
    this.configs.set(name, mergedConfig);

    // Recreate the provider
    const wasEnabled = this.providers.has(name);
    if (wasEnabled) {
      this.providers.delete(name);
      await this._createProviders();
      
      const provider = this.providers.get(name);
      if (provider) {
        await provider.initialize();
      }
    }

    logInfo(`Provider ${name} config updated`);
    return { success: true };
  }

  /**
   * Get factory info
   */
  getInfo() {
    return {
      initialized: this.initialized,
      totalProviders: this.providers.size,
      availableProviders: this.getAvailableProviders().length,
      status: this.getStatusSummary(),
      providers: Array.from(this.providers.values()).map(p => p.getInfo())
    };
  }
}

// Create singleton instance
const providerFactory = new ProviderFactory();

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProviderFactory, providerFactory };
} else {
  window.providerFactory = providerFactory;
}
