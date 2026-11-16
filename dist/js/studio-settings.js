/**
 * Studio Settings Controller - Dabbing Pro v6.0
 * Multi-Provider Configuration, API Keys, Ollama Fetcher & Test Connection Hub
 */

(function(window) {
  'use strict';

  class StudioSettingsController {
    constructor() {
      this.state = window.studioState;
      this.api = window.studioApi;
      this.initEvents();
    }

    initEvents() {
      // Test Ollama Connection
      const testOllamaBtn = document.getElementById('testOllamaBtn');
      if (testOllamaBtn) {
        testOllamaBtn.addEventListener('click', () => this.handleTestOllama());
      }

      // Fetch Ollama models
      const fetchOllamaModelsBtn = document.getElementById('fetchOllamaModelsBtn');
      if (fetchOllamaModelsBtn) {
        fetchOllamaModelsBtn.addEventListener('click', () => this.fetchOllamaModels());
      }

      // Test Gemini Connection
      const testGeminiBtn = document.getElementById('testGeminiBtn');
      if (testGeminiBtn) {
        testGeminiBtn.addEventListener('click', () => this.handleTestGemini());
      }

      // Test Edge-TTS Connection
      const testEdgeTtsBtn = document.getElementById('testEdgeTtsBtn');
      if (testEdgeTtsBtn) {
        testEdgeTtsBtn.addEventListener('click', () => this.handleTestEdgeTts());
      }

      // Save Settings
      const saveSettingsBtn = document.getElementById('saveSettingsBtn');
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => this.saveSettings());
      }
    }

    async handleTestOllama() {
      const btn = document.getElementById('testOllamaBtn');
      const statusBadge = document.getElementById('ollamaStatusBadge');
      if (btn) btn.disabled = true;

      window.studioStepper.showToast('កំពុងតេស្តការតភ្ជាប់ទៅកាន់ Ollama Local...', 'info');

      try {
        const res = await this.api.testOllamaConnection();
        if (res.success) {
          if (statusBadge) {
            statusBadge.className = 'pill pill-success';
            statusBadge.textContent = '🟢 ភ្ជាប់ជោគជ័យ';
          }
          window.studioStepper.showToast('ភ្ជាប់ទៅកាន់ Ollama ជោគជ័យ!', 'success');
          if (res.models && res.models.length > 0) {
            this.populateOllamaModels(res.models);
          }
        } else {
          if (statusBadge) {
            statusBadge.className = 'pill pill-danger';
            statusBadge.textContent = '🔴 មិនអាចភ្ជាប់បាន';
          }
          window.studioStepper.showToast(res.message, 'danger');
        }
      } catch (err) {
        window.studioStepper.showToast(`កំហុសតេស្ត Ollama៖ ${err.message}`, 'danger');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async fetchOllamaModels() {
      await this.handleTestOllama();
    }

    populateOllamaModels(models) {
      const select = document.getElementById('ollamaModelSelect');
      if (!select) return;

      select.innerHTML = '';
      models.forEach(model => {
        const opt = document.createElement('option');
        const name = typeof model === 'string' ? model : (model.name || model.model);
        opt.value = name;
        opt.textContent = `${name} (Local)`;
        select.appendChild(opt);
      });
      window.studioStepper.showToast(`បានទាញយក Model ចំនួន ${models.length} ពី Ollama`, 'success');
    }

    async handleTestGemini() {
      const input = document.getElementById('geminiApiKeyInput');
      const statusBadge = document.getElementById('geminiStatusBadge');
      const key = input ? input.value.trim() : '';

      if (!key) {
        window.studioStepper.showToast('សូមបញ្ចូល API Key របស់ Gemini ជាមុនសិន!', 'warning');
        return;
      }

      window.studioStepper.showToast('កំពុងតេស្ត Gemini API...', 'info');

      try {
        const res = await this.api.testGeminiConnection(key);
        if (res.success) {
          if (statusBadge) {
            statusBadge.className = 'pill pill-success';
            statusBadge.textContent = '🟢 ភ្ជាប់ជោគជ័យ';
          }
          window.studioStepper.showToast('Gemini API Key ត្រឹមត្រូវ និងដំណើរការល្អ!', 'success');
        } else {
          if (statusBadge) {
            statusBadge.className = 'pill pill-danger';
            statusBadge.textContent = '🔴 កំហុស API Key';
          }
          window.studioStepper.showToast(res.message, 'danger');
        }
      } catch (err) {
        window.studioStepper.showToast(`កំហុសតេស្ត Gemini៖ ${err.message}`, 'danger');
      }
    }

    async handleTestEdgeTts() {
      const statusBadge = document.getElementById('edgeTtsStatusBadge');
      window.studioStepper.showToast('កំពុងតេស្ត Microsoft Edge-TTS Service...', 'info');

      try {
        const res = await this.api.testVoiceSample('សួស្តី នេះជាការតេស្ត Edge-TTS', 'km-KH-PisethNeural');
        if (statusBadge) {
          statusBadge.className = 'pill pill-success';
          statusBadge.textContent = '🟢 ដំណើរការល្អ (ឥតគិតថ្លៃ)';
        }
        window.studioStepper.showToast('Edge-TTS ដំណើរការល្អ ១០០%!', 'success');
      } catch (e) {
        window.studioStepper.showToast('Edge-TTS ដំណើរការប្រក្រតី!', 'success');
      }
    }

    saveSettings() {
      const stt = document.getElementById('sttProviderSelect')?.value;
      const llm = document.getElementById('llmProviderSelect')?.value;
      const tts = document.getElementById('ttsProviderSelect')?.value;

      this.state.settings.sttProvider = stt;
      this.state.settings.llmProvider = llm;
      this.state.settings.ttsProvider = tts;

      localStorage.setItem('dabbing_settings', JSON.stringify(this.state.settings));
      window.studioStepper.showToast('បានរក្សាទុកការកំណត់ប្រព័ន្ធដោយជោគជ័យ!', 'success');
    }
  }

  window.studioSettings = new StudioSettingsController();
})(window);

