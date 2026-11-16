/**
 * Gemini Provider - Google Gemini API
 * REFACTORED from existing Gemini implementation
 * Maintains 100% backward compatibility
 */

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super('gemini', config);
    
    this.capabilities = {
      translation: true,
      transcription: false, // Uses Whisper separately
      tts: false,
      khmerSupport: 'excellent'
    };

    this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.apiKeys = [];
    this.currentKeyIndex = 0;
    this.keyUsage = new Map(); // Track usage per key
  }

  async initialize() {
    try {
      // Load API keys from config
      if (this.config.apiKey) {
        this.apiKeys = [this.config.apiKey];
      }
      if (this.config.apiKeys && Array.isArray(this.config.apiKeys)) {
        this.apiKeys = this.config.apiKeys.filter(k => k && k.trim());
      }

      if (this.apiKeys.length === 0) {
        this.status = 'offline';
        return { success: false, error: 'No API keys configured' };
      }

      // Initialize key usage tracking
      this.apiKeys.forEach(key => {
        if (!this.keyUsage.has(key)) {
          this.keyUsage.set(key, {
            requests: 0,
            failures: 0,
            lastUsed: null,
            cooldownUntil: null
          });
        }
      });

      this.status = 'online';
      return { success: true };
    } catch (error) {
      this.status = 'error';
      logError('Gemini initialization failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async testConnection() {
    const startTime = Date.now();
    
    try {
      const testText = 'Hello, how are you?';
      const result = await this.translate(testText, { test: true });
      const latency = Date.now() - startTime;

      if (result.success) {
        this.status = 'online';
        return {
          success: true,
          latency,
          message: `✅ Connected successfully! Response: "${result.data}"`,
          testTranslation: result.data
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
        message: `❌ Connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Get next available API key (round-robin with cooldown)
   */
  _getNextApiKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available');
    }

    // Try to find a key not in cooldown
    const now = Date.now();
    for (let i = 0; i < this.apiKeys.length; i++) {
      const keyIndex = (this.currentKeyIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[keyIndex];
      const usage = this.keyUsage.get(key);

      if (!usage.cooldownUntil || usage.cooldownUntil < now) {
        this.currentKeyIndex = (keyIndex + 1) % this.apiKeys.length;
        return key;
      }
    }

    // All keys in cooldown, use the one with shortest cooldown
    let shortestCooldown = Infinity;
    let bestKey = this.apiKeys[0];
    
    this.apiKeys.forEach(key => {
      const usage = this.keyUsage.get(key);
      if (usage.cooldownUntil < shortestCooldown) {
        shortestCooldown = usage.cooldownUntil;
        bestKey = key;
      }
    });

    return bestKey;
  }

  /**
   * Mark key as rate limited (put in cooldown)
   */
  _markKeyAsLimited(apiKey, cooldownMs = 60000) {
    const usage = this.keyUsage.get(apiKey);
    if (usage) {
      usage.cooldownUntil = Date.now() + cooldownMs;
      usage.failures++;
      
      // If all keys are limited, update provider status
      const allLimited = Array.from(this.keyUsage.values()).every(u => 
        u.cooldownUntil && u.cooldownUntil > Date.now()
      );
      
      if (allLimited) {
        this.status = 'limited';
      }
    }
  }

  async translate(text, context = {}) {
    const startTime = Date.now();

    try {
      const apiKey = this._getNextApiKey();
      const model = this.config.model || 'gemini-2.0-flash-exp';
      
      // Build prompt based on context
      const prompt = this._buildTranslationPrompt(text, context);
      
      const url = `${this.apiEndpoint}/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 8192
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for rate limit
        if (response.status === 429) {
          this._markKeyAsLimited(apiKey);
          throw new Error('API_RATE_LIMIT');
        }
        
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!translatedText) {
        throw new Error('Empty response from Gemini');
      }

      const latency = Date.now() - startTime;
      
      // Update key usage
      const usage = this.keyUsage.get(apiKey);
      if (usage) {
        usage.requests++;
        usage.lastUsed = Date.now();
      }

      this._updateStats(true, latency);
      this.stats.requestsToday++;

      return {
        success: true,
        data: translatedText.trim(),
        latency,
        provider: this.name,
        model
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateStats(false, latency);

      logError('Gemini translation failed', { error: error.message, text: text.substring(0, 100) });

      return {
        success: false,
        error: error.message,
        latency,
        provider: this.name
      };
    }
  }

  /**
   * Build translation prompt with context
   */
  _buildTranslationPrompt(text, context = {}) {
    const { 
      genre = 'general',
      emotion = 'neutral',
      speaker = 'unknown',
      test = false
    } = context;

    if (test) {
      // Simple test translation
      return `Translate to Khmer: ${text}`;
    }

    // Full context-aware prompt (existing logic)
    let prompt = `អ្នកគឺជាអ្នកបកប្រែខ្មែរដ៏ពូកែសម្រាប់ Dubbing រឿង។\n\n`;
    prompt += `ប្រភេទរឿង: ${genre}\n`;
    prompt += `អារម្មណ៍: ${emotion}\n`;
    prompt += `តួអង្គ: ${speaker}\n\n`;
    prompt += `សូមបកប្រែឃ្លានេះទៅជាភាសាខ្មែរ ឱ្យស័ក្តិសមនឹងបរិបទ និងអារម្មណ៍របស់តួអង្គ។\n`;
    prompt += `អត្ថបទដើម: "${text}"\n\n`;
    prompt += `ឃ្លាខ្មែរ:`;

    return prompt;
  }

  /**
   * Get provider-specific info
   */
  getInfo() {
    const baseInfo = super.getInfo();
    
    return {
      ...baseInfo,
      displayName: 'Google Gemini',
      totalKeys: this.apiKeys.length,
      keysAvailable: Array.from(this.keyUsage.values()).filter(u => 
        !u.cooldownUntil || u.cooldownUntil < Date.now()
      ).length,
      model: this.config.model || 'gemini-2.0-flash-exp',
      endpoint: this.apiEndpoint
    };
  }

  validateConfig() {
    const result = super.validateConfig();
    
    if (this.apiKeys.length === 0) {
      result.errors.push('At least one API key is required');
      result.valid = false;
    }

    return result;
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiProvider;
}
