/**
 * ═══════════════════════════════════════════════════════════════════
 * PROFESSIONAL AUDIO ENHANCEMENT SYSTEM v2.0
 * សំឡេងពិរោះ + ភ្លេងខ្លាំង + Mixing ស្អាត
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. AUDIO ENHANCEMENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════

  window.audioEnhancementSettings = {
    // Voice Enhancement
    voice: {
      normalize: true,          // Normalize voice levels
      denoise: true,           // Remove background noise
      deEsser: true,           // Reduce sibilance (ស, ឝ sounds)
      enhanceClear: true,      // Enhance clarity
      warmth: 0.7,             // Add warmth (0-1)
      presence: 0.8,           // Boost presence (0-1)
      compression: {
        enabled: true,
        threshold: -18,        // dB
        ratio: 4,
        attack: 5,             // ms
        release: 50            // ms
      },
      eq: {
        enabled: true,
        lowCut: 80,            // Hz (remove rumble)
        highCut: 12000,        // Hz (remove harshness)
        midBoost: 2500,        // Hz (enhance clarity)
        midBoostGain: 3        // dB
      }
    },

    // BGM Enhancement
    bgm: {
      normalize: true,
      volumeLevel: 0.3,        // Background music level (0-1)
      ducking: {
        enabled: true,         // Lower BGM when dialogue plays
        amount: -12,           // dB reduction during dialogue
        attack: 50,            // ms
        release: 300           // ms
      },
      eq: {
        enabled: true,
        lowCut: 30,            // Hz
        highCut: 16000         // Hz
      }
    },

    // Master Output
    master: {
      normalize: true,
      targetLoudness: -16,     // LUFS (cinema standard)
      peakLimiter: {
        enabled: true,
        threshold: -1,         // dB (prevent clipping)
        release: 100           // ms
      },
      stereoWidth: 1.0,        // Stereo enhancement (0.5-1.5)
      finalEQ: {
        enabled: true,
        bassBoost: 2,          // dB at 80Hz
        trebleBoost: 1         // dB at 10kHz
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. AUDIO ENHANCEMENT ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Apply professional audio enhancement to dubbed video
   */
  window.applyProfessionalAudioEnhancement = async function(videoId, options = {}) {
    try {
      showToast('🎚️ កំពុងកែលម្អសំឡេង Professional...');

      const settings = {
        ...window.audioEnhancementSettings,
        ...options
      };

      const res = await fetch('/api/audio/enhance-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoId,
          settings: settings,
          tasks: [
            'NORMALIZE_VOICE',
            'DENOISE',
            'COMPRESS',
            'EQ_VOICE',
            'BGM_DUCKING',
            'MASTER_NORMALIZE',
            'PEAK_LIMIT'
          ]
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast('✅ Audio Enhancement បានសម្រេច! សំឡេងពិរោះហើយ');
        return data;
      } else {
        throw new Error(data.error || 'Enhancement failed');
      }
    } catch (e) {
      console.error('[Audio Enhancement] Error:', e);
      showToast('❌ មិនអាចកែលម្អសំឡេងបានទេ: ' + e.message);
      throw e;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. VOICE QUALITY ANALYZER
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Analyze voice quality and suggest improvements
   */
  window.analyzeVoiceQuality = async function(audioFile) {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const res = await fetch('/api/audio/analyze', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        return {
          loudness: data.loudness,           // LUFS
          peak: data.peak,                   // dB
          dynamicRange: data.dynamicRange,   // dB
          noiseLevel: data.noiseLevel,       // dB
          clarity: data.clarity,             // 0-100
          recommendations: data.recommendations
        };
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error('[Voice Quality] Analysis failed:', e);
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. AUDIO ENHANCEMENT UI
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Open audio enhancement settings modal
   */
  window.openAudioEnhancementUI = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'audioEnhancementUI';
    modal.style.zIndex = '10007';

    const settings = window.audioEnhancementSettings;

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 900px; width: 95%; max-height: 90vh;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.12));">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #3b82f6); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              🎚️
            </div>
            <div>
              <div class="modal-title">Professional Audio Enhancement Studio</div>
              <div style="font-size: 11px; color: var(--muted);">កែលម្អសំឡេងកម្រិត Cinema Professional</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeAudioEnhancementUI()">✕</button>
        </div>

        <div class="modal-body" style="max-height: calc(90vh - 150px); overflow-y: auto; padding: 20px;">
          <!-- Voice Enhancement Section -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #8b5cf6, #a855f7); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
                🎤
              </div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text);">Voice Enhancement (សំឡេងនិយាយ)</div>
            </div>

            <div style="display: grid; gap: 14px; padding: 16px; background: var(--soft); border-radius: 10px;">
              <!-- Normalize -->
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span style="font-size: 12px; color: var(--text);">🔊 Normalize Volume (ធ្វើឱ្យសំឡេងស្មើៗ)</span>
                <input type="checkbox" id="voiceNormalize" ${settings.voice.normalize ? 'checked' : ''} 
                  onchange="audioEnhancementSettings.voice.normalize = this.checked"
                  style="width: 18px; height: 18px; cursor: pointer;">
              </label>

              <!-- Denoise -->
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span style="font-size: 12px; color: var(--text);">🔇 Remove Noise (លុបសំឡេងរំខាន)</span>
                <input type="checkbox" id="voiceDenoise" ${settings.voice.denoise ? 'checked' : ''}
                  onchange="audioEnhancementSettings.voice.denoise = this.checked"
                  style="width: 18px; height: 18px; cursor: pointer;">
              </label>

              <!-- Enhance Clarity -->
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span style="font-size: 12px; color: var(--text);">✨ Enhance Clarity (បង្កើនភាពច្បាស់)</span>
                <input type="checkbox" id="voiceClear" ${settings.voice.enhanceClear ? 'checked' : ''}
                  onchange="audioEnhancementSettings.voice.enhanceClear = this.checked"
                  style="width: 18px; height: 18px; cursor: pointer;">
              </label>

              <!-- Warmth Slider -->
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: var(--muted);">🔥 Warmth (ភាពកក់ក្តៅ)</span>
                  <span id="warmthValue" style="font-size: 11px; font-weight: 600; color: var(--text);">${Math.round(settings.voice.warmth * 100)}%</span>
                </div>
                <input type="range" min="0" max="100" value="${settings.voice.warmth * 100}"
                  oninput="audioEnhancementSettings.voice.warmth = this.value / 100; document.getElementById('warmthValue').textContent = this.value + '%'"
                  style="width: 100%; cursor: pointer;">
              </div>

              <!-- Presence Slider -->
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: var(--muted);">💎 Presence (ភាពច្បាស់លាស់)</span>
                  <span id="presenceValue" style="font-size: 11px; font-weight: 600; color: var(--text);">${Math.round(settings.voice.presence * 100)}%</span>
                </div>
                <input type="range" min="0" max="100" value="${settings.voice.presence * 100}"
                  oninput="audioEnhancementSettings.voice.presence = this.value / 100; document.getElementById('presenceValue').textContent = this.value + '%'"
                  style="width: 100%; cursor: pointer;">
              </div>
            </div>
          </div>

          <!-- BGM Enhancement Section -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #ec4899, #f43f5e); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
                🎵
              </div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text);">Background Music (ភ្លេងផ្ទៃខាងក្រោយ)</div>
            </div>

            <div style="display: grid; gap: 14px; padding: 16px; background: var(--soft); border-radius: 10px;">
              <!-- BGM Volume -->
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: var(--muted);">🔊 BGM Volume Level</span>
                  <span id="bgmVolValue" style="font-size: 11px; font-weight: 600; color: var(--text);">${Math.round(settings.bgm.volumeLevel * 100)}%</span>
                </div>
                <input type="range" min="0" max="100" value="${settings.bgm.volumeLevel * 100}"
                  oninput="audioEnhancementSettings.bgm.volumeLevel = this.value / 100; document.getElementById('bgmVolValue').textContent = this.value + '%'"
                  style="width: 100%; cursor: pointer;">
              </div>

              <!-- Auto Ducking -->
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span style="font-size: 12px; color: var(--text);">🎚️ Auto-Duck (បន្ថយពេលនិយាយ)</span>
                <input type="checkbox" id="bgmDuck" ${settings.bgm.ducking.enabled ? 'checked' : ''}
                  onchange="audioEnhancementSettings.bgm.ducking.enabled = this.checked"
                  style="width: 18px; height: 18px; cursor: pointer;">
              </label>
            </div>
          </div>

          <!-- Master Output Section -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
                🎛️
              </div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text);">Master Output (លទ្ធផលចុងក្រោយ)</div>
            </div>

            <div style="display: grid; gap: 14px; padding: 16px; background: var(--soft); border-radius: 10px;">
              <!-- Peak Limiter -->
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <span style="font-size: 12px; color: var(--text);">🛡️ Peak Limiter (ការពារ Clipping)</span>
                <input type="checkbox" id="peakLimit" ${settings.master.peakLimiter.enabled ? 'checked' : ''}
                  onchange="audioEnhancementSettings.master.peakLimiter.enabled = this.checked"
                  style="width: 18px; height: 18px; cursor: pointer;">
              </label>

              <!-- Stereo Width -->
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: var(--muted);">📻 Stereo Width</span>
                  <span id="stereoValue" style="font-size: 11px; font-weight: 600; color: var(--text);">${Math.round(settings.master.stereoWidth * 100)}%</span>
                </div>
                <input type="range" min="50" max="150" value="${settings.master.stereoWidth * 100}"
                  oninput="audioEnhancementSettings.master.stereoWidth = this.value / 100; document.getElementById('stereoValue').textContent = this.value + '%'"
                  style="width: 100%; cursor: pointer;">
              </div>
            </div>
          </div>

          <!-- Preset Buttons -->
          <div style="padding: 16px; background: rgba(59, 130, 246, 0.08); border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.25);">
            <div style="font-size: 12px; font-weight: 700; color: #3b82f6; margin-bottom: 10px;">🎯 Quick Presets:</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <button class="btn-secondary" onclick="applyAudioPreset('cinema')" style="font-size: 11px; padding: 8px 12px; height: auto; justify-content: center;">
                🎬 Cinema
              </button>
              <button class="btn-secondary" onclick="applyAudioPreset('podcast')" style="font-size: 11px; padding: 8px 12px; height: auto; justify-content: center;">
                🎙️ Podcast
              </button>
              <button class="btn-secondary" onclick="applyAudioPreset('music')" style="font-size: 11px; padding: 8px 12px; height: auto; justify-content: center;">
                🎵 Music Focus
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn-secondary" onclick="closeAudioEnhancementUI()">បោះបង់</button>
          <button class="btn-primary" onclick="applyCurrentAudioSettings()">
            ✅ កំណត់ និងប្រើ
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.closeAudioEnhancementUI = function() {
    const modal = document.getElementById('audioEnhancementUI');
    if (modal) modal.remove();
  };

  window.applyCurrentAudioSettings = function() {
    showToast('✅ បានរក្សាទុកការកំណត់ Audio Enhancement');
    closeAudioEnhancementUI();
    console.log('[Audio Enhancement] Settings saved:', window.audioEnhancementSettings);
  };

  window.applyAudioPreset = function(preset) {
    const settings = window.audioEnhancementSettings;
    
    if (preset === 'cinema') {
      settings.voice.warmth = 0.7;
      settings.voice.presence = 0.8;
      settings.bgm.volumeLevel = 0.25;
      settings.master.stereoWidth = 1.2;
    } else if (preset === 'podcast') {
      settings.voice.warmth = 0.6;
      settings.voice.presence = 0.9;
      settings.bgm.volumeLevel = 0.15;
      settings.master.stereoWidth = 0.9;
    } else if (preset === 'music') {
      settings.voice.warmth = 0.5;
      settings.voice.presence = 0.7;
      settings.bgm.volumeLevel = 0.4;
      settings.master.stereoWidth = 1.3;
    }
    
    closeAudioEnhancementUI();
    setTimeout(() => openAudioEnhancementUI(), 200);
    showToast(`✅ បានកំណត់ ${preset.toUpperCase()} preset`);
  };

  // Initialize
  console.log('[Professional Audio Enhancement] Initialized');

})();
