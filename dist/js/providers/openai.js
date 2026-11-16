/**
 * OpenAI Provider - GPT models
 * Premium quality, highest cost
 * Ultimate fallback
 */

class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super('openai', config);
    
    this.capabilities = {
      translation: true,
      transcription: true, // Whisper
      tts: true, // TTS API
      khmerSupport: 'excellent'
    };

    this.apiEndpoint = 'https://api.openai.com/v1';
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.model || 'gpt-4o-mini';
  }

  async initialize() {
    try {
      if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
        this.status = 'offline';
        return { success: false, error: 'Invalid OpenAI API key' };
      }

      // Test with a simple models list request
      const response = await fetch(`${this.apiEndpoint}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      if (!response || !response.ok) {
        this.status = 'offline';
        return { success: false, error: 'Invalid API key or network error' };
      }

      this.status = 'online';
      logInfo('OpenAI initialized', { model: this.defaultModel });
      return { success: true };

    } catch (error) {
      this.status = 'error';
      logError('OpenAI initialization failed', { error: error.message });
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
          message: `✅ OpenAI connected! Model: ${this.defaultModel}`,
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
        message: `❌ ${error.message}`,
        error: error.message
      };
    }
  }

  async translate(text, context = {}) {
    const startTime = Date.now();

    try {
      const messages = this._buildMessages(text, context);
      
      const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: messages,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2048
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for rate limit
        if (response.status === 429) {
          this.status = 'limited';
          throw new Error('API_RATE_LIMIT');
        }
        
        // Check for quota exceeded
        if (response.status === 402 || response.status === 403) {
          this.status = 'error';
          throw new Error('QUOTA_EXCEEDED');
        }
        
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content || '';

      if (!translatedText) {
        throw new Error('Empty response from OpenAI');
      }

      const latency = Date.now() - startTime;
      this._updateStats(true, latency);
      this.stats.requestsToday++;

      return {
        success: true,
        data: translatedText.trim(),
        latency,
        provider: this.name,
        model: this.defaultModel,
        tokensUsed: data.usage?.total_tokens || 0
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateStats(false, latency);

      logError('OpenAI translation failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        latency,
        provider: this.name
      };
    }
  }

  /**
   * Build chat messages for translation
   */
  _buildMessages(text, context = {}) {
    const { 
      genre = 'general',
      emotion = 'neutral',
      speaker = 'unknown',
      test = false
    } = context;

    if (test) {
      return [
        {
          role: 'system',
          content: 'You are a professional translator. Translate text to Khmer accurately.'
        },
        {
          role: 'user',
          content: `Translate to Khmer: ${text}`
        }
      ];
    }

    // Full context-aware translation
    const systemPrompt = `You are a professional Khmer translator specializing in video dubbing and subtitling. 
You understand cultural nuances and can adapt translations to maintain the original tone and emotion.
Always provide natural, conversational Khmer that sounds native.`;

    const userPrompt = `Translate this dialogue to Khmer for video dubbing:

Context:
- Genre: ${genre}
- Emotion: ${emotion}
- Speaker: ${speaker}

Original text: "${text}"

Provide ONLY the Khmer translation, no explanations:`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribe(audioFile, options = {}) {
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      
      if (options.language) {
        formData.append('language', options.language);
      }
      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      const response = await fetch(`${this.apiEndpoint}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this._updateStats(true, latency);

      return {
        success: true,
        data: data.text,
        latency,
        provider: this.name
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateStats(false, latency);

      logError('OpenAI transcription failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        latency,
        provider: this.name
      };
    }
  }

  /**
   * Generate speech using TTS
   */
  async generateSpeech(text, options = {}) {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.apiEndpoint}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: options.voice || 'alloy',
          response_format: options.format || 'mp3',
          speed: options.speed || 1.0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const latency = Date.now() - startTime;

      this._updateStats(true, latency);

      return {
        success: true,
        data: audioBlob,
        latency,
        provider: this.name
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateStats(false, latency);

      logError('OpenAI TTS failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        latency,
        provider: this.name
      };
    }
  }

  /**
   * Get provider info
   */
  getInfo() {
    const baseInfo = super.getInfo();
    
    return {
      ...baseInfo,
      displayName: 'OpenAI',
      model: this.defaultModel,
      endpoint: this.apiEndpoint,
      features: ['Translation', 'Whisper STT', 'TTS'],
      cost: 'Premium'
    };
  }

  validateConfig() {
    const result = super.validateConfig();
    
    if (!this.apiKey) {
      result.errors.push('API key is required');
      result.valid = false;
    } else if (!this.apiKey.startsWith('sk-')) {
      result.errors.push('Invalid API key format (should start with sk-)');
      result.valid = false;
    }

    return result;
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenAIProvider;
}
