/**
 * Base Provider Interface
 * All translation/AI providers must implement this interface
 */

class BaseProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.status = 'unknown'; // unknown, online, offline, limited, error
    this.capabilities = {
      translation: false,
      transcription: false,
      tts: false,
      khmerSupport: 'none' // none, weak, medium, good, excellent
    };
    this.stats = {
      requestsToday: 0,
      successCount: 0,
      failureCount: 0,
      averageLatency: 0,
      lastUsed: null
    };
  }

  /**
   * Initialize provider - setup connection, load config
   */
  async initialize() {
    throw new Error('initialize() must be implemented by provider');
  }

  /**
   * Test connection to provider
   * @returns {Promise<{success: boolean, latency: number, message: string}>}
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by provider');
  }

  /**
   * Translate text with context awareness
   * @param {string|Array} text - Text to translate (single or array)
   * @param {Object} context - Translation context
   * @returns {Promise<{success: boolean, data: string|Array, latency: number}>}
   */
  async translate(text, context = {}) {
    throw new Error('translate() must be implemented by provider');
  }

  /**
   * Transcribe audio to text (if supported)
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<{success: boolean, data: Object}>}
   */
  async transcribe(audioPath, options = {}) {
    if (!this.capabilities.transcription) {
      return { success: false, error: `${this.name} does not support transcription` };
    }
    throw new Error('transcribe() must be implemented by provider');
  }

  /**
   * Synthesize text to speech (if supported)
   * @param {string} text - Text to synthesize
   * @param {Object} options - TTS options (voice, rate, pitch)
   * @returns {Promise<{success: boolean, data: Buffer}>}
   */
  async synthesize(text, options = {}) {
    if (!this.capabilities.tts) {
      return { success: false, error: `${this.name} does not support TTS` };
    }
    throw new Error('synthesize() must be implemented by provider');
  }

  /**
   * Get current provider status
   * @returns {string} - online, offline, limited, error
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get provider capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return this.capabilities;
  }

  /**
   * Get provider statistics
   * @returns {Object}
   */
  getStats() {
    return this.stats;
  }

  /**
   * Update statistics after request
   * @param {boolean} success
   * @param {number} latency
   */
  _updateStats(success, latency) {
    this.stats.lastUsed = new Date().toISOString();
    
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    // Update average latency
    const total = this.stats.successCount + this.stats.failureCount;
    this.stats.averageLatency = ((this.stats.averageLatency * (total - 1)) + latency) / total;
  }

  /**
   * Reset daily request counter (called at midnight)
   */
  resetDailyStats() {
    this.stats.requestsToday = 0;
  }

  /**
   * Check if provider is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const result = await this.testConnection();
      this.status = result.success ? 'online' : 'offline';
      return result.success;
    } catch (error) {
      this.status = 'error';
      return false;
    }
  }

  /**
   * Get provider info for UI display
   * @returns {Object}
   */
  getInfo() {
    return {
      name: this.name,
      displayName: this.config.displayName || this.name,
      status: this.status,
      capabilities: this.capabilities,
      stats: this.stats,
      config: {
        enabled: this.config.enabled !== false,
        model: this.config.model,
        khmerSupport: this.capabilities.khmerSupport,
        costPerRequest: this.config.costPerRequest || 0
      }
    };
  }

  /**
   * Validate configuration
   * @returns {{valid: boolean, errors: Array<string>}}
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config) {
      errors.push('Configuration is missing');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseProvider;
}
