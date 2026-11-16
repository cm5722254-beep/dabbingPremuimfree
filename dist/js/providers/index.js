/**
 * Provider System - Main Entry Point
 * Multi-provider AI with automatic fallback
 */

// Import all providers (browser will use script tags)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  const BaseProvider = require('./base.js');
  const GeminiProvider = require('./gemini.js');
  const OllamaProvider = require('./ollama.js');
  const OpenAIProvider = require('./openai.js');
  const { ProviderFactory, providerFactory } = require('./factory.js');
  const FallbackManager = require('./fallback-manager.js');
  
  module.exports = {
    BaseProvider,
    GeminiProvider,
    OllamaProvider,
    OpenAIProvider,
    ProviderFactory,
    FallbackManager,
    providerFactory
  };
}

/**
 * Initialize the provider system
 * Call this on app startup
 */
async function initializeProviders(config = {}) {
  try {
    logInfo('🚀 Initializing Multi-Provider System');

    // Get config from server or use defaults
    let providerConfig = config;
    
    if (!config || Object.keys(config).length === 0) {
      // Fetch from server
      const response = await fetch('/api/config').catch(() => null);
      if (response && response.ok) {
        const data = await response.json();
        providerConfig = data.providers || {};
      }
    }

    // Initialize factory
    const result = await window.providerFactory.initialize(providerConfig);

    if (!result.success) {
      logError('Provider initialization failed', result);
      return { success: false, error: result.error };
    }

    // Create fallback manager
    window.fallbackManager = new FallbackManager(window.providerFactory);

    // Test all providers
    logInfo('🧪 Testing all providers...');
    const testResults = await window.providerFactory.testAllProviders();

    logInfo('✅ Provider system initialized', {
      available: result.providers.length,
      tests: testResults
    });

    return {
      success: true,
      providers: result.providers,
      testResults
    };

  } catch (error) {
    logError('Failed to initialize providers', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Translate text using fallback chain
 * This is the main function to use in the app
 */
async function translateWithFallback(text, options = {}) {
  try {
    if (!window.fallbackManager) {
      throw new Error('Provider system not initialized. Call initializeProviders() first.');
    }

    const result = await window.fallbackManager.translate(text, options);

    if (result.success) {
      logInfo('Translation successful', { 
        provider: result.provider,
        latency: result.latency 
      });
    } else {
      logError('Translation failed', { 
        error: result.error,
        attempted: result.attemptedProviders 
      });
    }

    return result;

  } catch (error) {
    logError('Translation error', { error: error.message });
    return {
      success: false,
      error: error.message,
      data: text // Return original text as fallback
    };
  }
}

/**
 * Get provider system status
 */
function getProviderStatus() {
  if (!window.providerFactory) {
    return { initialized: false };
  }

  return {
    initialized: true,
    factory: window.providerFactory.getInfo(),
    fallback: window.fallbackManager ? window.fallbackManager.getInfo() : null
  };
}

/**
 * Update provider configuration
 */
async function updateProviderConfig(providerName, config) {
  try {
    if (!window.providerFactory) {
      throw new Error('Provider system not initialized');
    }

    await window.providerFactory.updateProviderConfig(providerName, config);
    
    // Save to server
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providers: {
          [providerName]: config
        }
      })
    });

    logInfo('Provider config updated', { provider: providerName });
    return { success: true };

  } catch (error) {
    logError('Failed to update provider config', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Enable/disable a provider
 */
async function setProviderEnabled(providerName, enabled) {
  try {
    if (!window.providerFactory) {
      throw new Error('Provider system not initialized');
    }

    await window.providerFactory.setProviderEnabled(providerName, enabled);
    
    logInfo(`Provider ${providerName} ${enabled ? 'enabled' : 'disabled'}`);
    return { success: true };

  } catch (error) {
    logError('Failed to toggle provider', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Test a specific provider
 */
async function testProvider(providerName) {
  try {
    if (!window.providerFactory) {
      throw new Error('Provider system not initialized');
    }

    const provider = window.providerFactory.getProvider(providerName);
    const result = await provider.testConnection();

    return result;

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get provider statistics
 */
function getProviderStats() {
  if (!window.providerFactory) {
    return {};
  }

  return window.providerFactory.getStats();
}

// Export global functions for browser
if (typeof window !== 'undefined') {
  window.initializeProviders = initializeProviders;
  window.translateWithFallback = translateWithFallback;
  window.getProviderStatus = getProviderStatus;
  window.updateProviderConfig = updateProviderConfig;
  window.setProviderEnabled = setProviderEnabled;
  window.testProvider = testProvider;
  window.getProviderStats = getProviderStats;
}
