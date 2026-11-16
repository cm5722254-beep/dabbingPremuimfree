/**
 * Ollama Provider - Local AI models
 * FREE, OFFLINE, UNLIMITED
 * Perfect fallback for Gemini
 */

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super('ollama', config);
    
    this.capabilities = {
      translation: true,
      transcription: false,
      tts: false,
      khmerSupport: 'good' // Depends on model
    };

    this.endpoint = config.endpoint || 'http://localhost:11434';
    this.defaultModel = config.model || 'llama3.2';
    this.availableModels = [];
  }

  async initialize() {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      if (!response || !response.ok) {
        this.status = 'offline';
        return { 
          success: false, 
          error: 'Ollama not running. Install from ollama.com' 
        };
      }

      const data = await response.json();
      this.availableModels = data.models || [];

      if (this.availableModels.length === 0) {
        this.status = 'offline';
        return {
          success: false,
          error: 'No models installed. Run: ollama pull llama3.2'
        };
      }

      this.status = 'online';
      logInfo('Ollama initialized', { 
        models: this.availableModels.length,
        endpoint: this.endpoint 
      });

      return { success: true, models: this.availableModels.length };

    } catch (error) {
      this.status = 'offline';
      logError('Ollama initialization failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async testConnection() {
    const startTime = Date.now();
    
    try {
      const testPrompt = 'Say "Hello from Ollama" in 5 words or less.';
      const result = await this._generate(testPrompt, { max_tokens: 20 });
      const latency = Date.now() - startTime;

      if (result.success) {
        this.status = 'online';
        return {
          success: true,
          latency,
          message: `✅ Local Ollama ready! Model: ${this.defaultModel}`,
          testResponse: result.data
        };
      } else {
        this.status = 'error';
        return {
          success: false,
          latency,
          message: `❌ ${result.error}`,
          error: result.error
        };
      }
    } catch (error) {
      this.status = 'error';
      return {
        success: false,
        latency: Date.now() - startTime,
        message: `❌ ${error.message}`,
        error: error.message
      };
    }
  }

  async translate(text, context = {}) {
    const startTime = Date.now();

    try {
      const prompt = this._buildTranslationPrompt(text, context);
      const result = await this._generate(prompt);

      if (!result.success) {
        throw new Error(result.error);
      }

      const latency = Date.now() - startTime;
      this._updateStats(true, latency);
      this.stats.requestsToday++;

      return {
        success: true,
        data: result.data.trim(),
        latency,
        provider: this.name,
        model: this.defaultModel,
        local: true
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateStats(false, latency);

      logError('Ollama translation failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        latency,
        provider: this.name
      };
    }
  }

  /**
   * Core generation method
   */
  async _generate(prompt, options = {}) {
    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || this.config.temperature || 0.7,
            num_predict: options.max_tokens || this.config.maxTokens || 2048
          }
        }),
        signal: AbortSignal.timeout(options.timeout || 30000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.response || '';

      if (!generatedText) {
        throw new Error('Empty response from Ollama');
      }

      return {
        success: true,
        data: generatedText,
        tokensUsed: data.eval_count || 0
      };

    } catch (error) {
      if (error.name === 'TimeoutError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Build translation prompt
   */
  _buildTranslationPrompt(text, context = {}) {
    const { test = false } = context;

    if (test) {
      return `Translate to Khmer: ${text}`;
    }

    // Structured prompt for better translation
    return `You are a professional Khmer translator for video dubbing.

Translate the following English text to natural, conversational Khmer.
Keep the same tone and emotion as the original.

English: "${text}"

Khmer:`;
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logError('Failed to list Ollama models', { error: error.message });
      return [];
    }
  }

  /**
   * Pull a new model
   */
  async pullModel(modelName) {
    try {
      logInfo('Pulling Ollama model', { model: modelName });

      const response = await fetch(`${this.endpoint}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      const data = await response.json();
      logInfo('Model pulled successfully', { model: modelName });
      
      // Refresh available models
      await this.initialize();

      return { success: true, data };
    } catch (error) {
      logError('Failed to pull model', { model: modelName, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get provider info
   */
  getInfo() {
    const baseInfo = super.getInfo();
    
    return {
      ...baseInfo,
      displayName: 'Ollama (Local)',
      endpoint: this.endpoint,
      model: this.defaultModel,
      availableModels: this.availableModels.length,
      cost: 'FREE',
      limits: 'UNLIMITED',
      offline: true
    };
  }

  validateConfig() {
    const result = super.validateConfig();
    
    // No API key needed for Ollama
    if (!this.endpoint) {
      result.errors.push('Endpoint URL is required');
      result.valid = false;
    }

    return result;
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OllamaProvider;
}
