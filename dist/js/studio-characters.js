/**
 * Studio Characters Manager - Dabbing Pro v6.0
 * Character Profiles, Voice Mapping, Emotion Assignment & Testing
 */

(function(window) {
  'use strict';

  class StudioCharactersManager {
    constructor() {
      this.state = window.studioState;
      this.api = window.studioApi;
      this.initEvents();
    }

    initEvents() {
      this.state.on('characters:updated', (chars) => this.renderCharacters(chars));

      // Test Audio Button in character tab
      const testVoiceBtn = document.getElementById('testVoiceSampleBtn');
      if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', () => this.handleTestVoice());
      }

      // Add character button
      const addCharBtn = document.getElementById('addNewCharBtn');
      if (addCharBtn) {
        addCharBtn.addEventListener('click', () => this.handleAddCharacter());
      }
    }

    renderCharacters(characters) {
      const container = document.getElementById('charactersGridContainer');
      if (!container) return;

      container.innerHTML = '';

      characters.forEach((char, index) => {
        const card = document.createElement('div');
        card.className = 'studio-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '14px';

        const genderLabel = char.gender === 'male' ? 'ប្រុស' : 'ស្រី';
        const ageLabel = char.age === 'young_adult' ? 'ពេញវ័យ' : (char.age === 'child' ? 'កុមារ' : 'ចាស់ទុំ');

        card.innerHTML = `
          <div class="card-header" style="margin-bottom: 0; padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 2rem;">${char.avatar || '👤'}</span>
              <div>
                <strong style="font-size: 1rem; color: var(--text-main);">${char.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${char.id}</div>
              </div>
            </div>
            <span class="pill ${char.gender === 'male' ? 'pill-info' : 'pill-warning'}">${genderLabel} • ${ageLabel}</span>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">ជ្រើសរើសសំឡេង TTS (Voice)</label>
            <select class="form-control char-voice-select" data-char-id="${char.id}">
              <option value="km-KH-PisethNeural" ${char.voice === 'km-KH-PisethNeural' ? 'selected' : ''}>ពិសិដ្ឋ (ប្រុស) - Edge-TTS Standard</option>
              <option value="km-KH-SreymomNeural" ${char.voice === 'km-KH-SreymomNeural' ? 'selected' : ''}>ស្រីមុំ (ស្រី) - Edge-TTS Standard</option>
              <option value="google-km-male" ${char.voice === 'google-km-male' ? 'selected' : ''}>Google Cloud Khmer (ប្រុស)</option>
              <option value="google-km-female" ${char.voice === 'google-km-female' ? 'selected' : ''}>Google Cloud Khmer (ស្រី)</option>
              <option value="elevenlabs-khmer" ${char.voice === 'elevenlabs-khmer' ? 'selected' : ''}>ElevenLabs Multilingual v2</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="form-label">អារម្មណ៍តួអង្គ (Emotion)</label>
              <select class="form-control char-emotion-select" data-char-id="${char.id}">
                <option value="ធម្មតា" ${char.emotion === 'ធម្មតា' ? 'selected' : ''}>ធម្មតា</option>
                <option value="សប្បាយ" ${char.emotion === 'សប្បាយ' ? 'selected' : ''}>សប្បាយរីករាយ</option>
                <option value="ខឹង" ${char.emotion === 'ខឹង' ? 'selected' : ''}>ខឹងសម្បារ</option>
                <option value="ក្រៀមក្រំ" ${char.emotion === 'ក្រៀមក្រំ' ? 'selected' : ''}>ក្រៀមក្រំ/យំ</option>
                <option value="ភ័យខ្លាច" ${char.emotion === 'ភ័យខ្លាច' ? 'selected' : ''}>ភ័យខ្លាច</option>
                <option value="ខ្សឹប" ${char.emotion === 'ខ្សឹប' ? 'selected' : ''}>ខ្សឹបខ្សៀវ</option>
              </select>
            </div>
            <div>
              <label class="form-label">ល្បឿននិយាយ (Speed)</label>
              <select class="form-control char-speed-select">
                <option value="0%">1.0x (ធម្មតា)</option>
                <option value="-10%">0.9x (យឺតបន្តិច)</option>
                <option value="+10%">1.1x (លឿនបន្តិច)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">
            <button class="btn btn-secondary btn-block test-char-voice-btn" data-char-id="${char.id}" style="font-size: 0.82rem; padding: 8px;">
              🔊 សាកល្បងសំឡេង
            </button>
            <button class="btn btn-secondary delete-char-btn" data-char-id="${char.id}" style="padding: 8px 12px; color: var(--danger);">
              🗑️
            </button>
          </div>
        `;

        container.appendChild(card);
      });

      // Bind events on dynamically created elements
      container.querySelectorAll('.char-voice-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const charId = e.target.getAttribute('data-char-id');
          const char = characters.find(c => c.id === charId);
          if (char) char.voice = e.target.value;
        });
      });

      container.querySelectorAll('.test-char-voice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const charId = btn.getAttribute('data-char-id');
          this.testCharacterVoice(charId);
        });
      });

      container.querySelectorAll('.delete-char-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const charId = btn.getAttribute('data-char-id');
          this.deleteCharacter(charId);
        });
      });
    }

    async testCharacterVoice(charId) {
      const char = this.state.characters.find(c => c.id === charId);
      if (!char) return;

      const sampleText = `សួស្តី ខ្ញុំឈ្មោះ ${char.name}។ នេះជាសំឡេងគំរូរបស់ខ្ញុំក្នុងរឿង។`;
      window.studioStepper.showToast(`កំពុងតេស្តសំឡេង ${char.name}...`, 'info');

      try {
        const res = await this.api.testVoiceSample(sampleText, char.voice);
        if (res && res.audioUrl) {
          const audio = new Audio(res.audioUrl);
          audio.play();
          window.studioStepper.showToast(`កំពុងចាក់សំឡេង៖ ${char.name}`, 'success');
        } else {
          // Play simulated beep or notification
          window.studioStepper.showToast(`សំឡេង ${char.voice} ដំណើរការប្រក្រតី!`, 'success');
        }
      } catch (err) {
        window.studioStepper.showToast(`កំហុសតេស្តសំឡេង៖ ${err.message}`, 'danger');
      }
    }

    handleAddCharacter() {
      const newId = `SPEAKER_0${this.state.characters.length}`;
      const newChar = {
        id: newId,
        name: `តួអង្គថ្មី ${this.state.characters.length + 1}`,
        gender: 'female',
        age: 'young_adult',
        voice: 'km-KH-SreymomNeural',
        avatar: '🎭',
        emotion: 'ធម្មតា'
      };

      const updated = [...this.state.characters, newChar];
      this.state.setCharacters(updated);
      window.studioStepper.showToast(`បានបន្ថែមតួអង្គ៖ ${newChar.name}`, 'success');
    }

    deleteCharacter(charId) {
      if (this.state.characters.length <= 1) {
        window.studioStepper.showToast('មិនអាចលុបបានទេ៖ យ៉ាងហោចណាស់ត្រូវមានតួអង្គចំនួន ១!', 'warning');
        return;
      }
      const updated = this.state.characters.filter(c => c.id !== charId);
      this.state.setCharacters(updated);
      window.studioStepper.showToast(`បានលុបតួអង្គរួចរាល់`, 'info');
    }
  }

  window.studioCharacters = new StudioCharactersManager();
})(window);

