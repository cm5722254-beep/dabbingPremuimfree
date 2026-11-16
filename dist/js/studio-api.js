/**
 * Studio API Client - Dabbing Pro v6.0
 * Handles all backend communications, SSE progress, and robust Khmer error handling
 */

(function(window) {
  'use strict';

  class StudioApiClient {
    constructor() {
      this.baseUrl = window.location.origin;
    }

    async checkSystemStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Status check failed');
        return await res.json();
      } catch (err) {
        return { status: 'offline', error: err.message };
      }
    }

    async uploadVideo(file, onProgress) {
      const formData = new FormData();
      formData.append('videoFile', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload-video');

        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              onProgress(pct);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText);
              resolve(resp);
            } catch (e) {
              reject(new Error('ការឆ្លើយតបពី Server មិនត្រឹមត្រូវ'));
            }
          } else {
            reject(new Error(`ការផ្ទុកឡើងបរាជ័យ (កូដ: ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('មិនអាចតភ្ជាប់ទៅកាន់ Server បានទេ'));
        xhr.send(formData);
      });
    }

    async testOllamaConnection(url = 'http://127.0.0.1:11434') {
      try {
        const res = await fetch('/api/ollama/status');
        const data = await res.json();
        return {
          success: data.online || data.success,
          models: data.models || [],
          message: data.online ? 'ភ្ជាប់ទៅ Ollama ជោគជ័យ' : 'មិនអាចភ្ជាប់ទៅ Ollama បានទេ (សូមពិនិត្យថាតើបានបើក Ollama ហើយឬនៅ)'
        };
      } catch (err) {
        return { success: false, message: 'កំហុសបណ្តាញពេលតេស្ត Ollama' };
      }
    }

    async testGeminiConnection(apiKey) {
      try {
        const res = await fetch('/api/gemini-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, testOnly: true })
        });
        const data = await res.json();
        return {
          success: data.success,
          message: data.success ? 'ភ្ជាប់ Gemini API ជោគជ័យ!' : (data.error || 'API Key មិនត្រឹមត្រូវ')
        };
      } catch (err) {
        return { success: false, message: 'មិនអាចតភ្ជាប់ទៅ Gemini បានទេ' };
      }
    }

    async openOutputFolder(folderPath = '') {
      try {
        const res = await fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async testVoiceSample(text, voiceId) {
      try {
        const res = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: voiceId, speed: '0%' })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  }

  window.studioApi = new StudioApiClient();
})(window);

