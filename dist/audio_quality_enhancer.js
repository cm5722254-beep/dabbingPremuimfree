/**
 * ═══════════════════════════════════════════════════════════════════
 * AUDIO QUALITY ENHANCEMENT PIPELINE
 * ធ្វើឱ្យសំឡេងច្បាស់ ភ្លេងខ្លាំង Audio Mixing ស្អាត
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. AUDIO ENHANCEMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════

  window.audioEnhancementConfig = {
    // Voice Enhancement
    voiceClarity: {
      enabled: true,
      noiseReduction: 0.7,        // 0-1 (0.7 = 70% noise reduction)
      deEsser: 0.5,                // Remove harsh "S" sounds
      compression: 0.6,            // Dynamic range compression
      normalize: true              // Normalize voice levels
    },
    
    // BGM Enhancement
    bgmBoost: {
      enabled: true,
      volumeBoost: 1.5,            // 1.5x louder
      bassBoost: 1.3,              // Enhance bass frequencies
      trebleBoost: 1.2,            // Enhance high frequencies
      stereoWidth: 1.4             // Widen stereo field
    },
    
    // Mixing
    mixing: {
      voiceVolume: 1.0,            // Voice level (1.0 = 100%)
      bgmVolume: 0.5,              // BGM level during dialogue (0.5 = 50%)
      bgmVolumeNoDub: 1.0,         // BGM level when no dialogue (1.0 = 100%)
      fadeInDuration: 0.3,         // Fade in voice (seconds)
      fadeOutDuration: 0.2,        // Fade out voice (seconds)
      ducking: {
        enabled: true,             // Auto-duck BGM when voice plays
        duckAmount: -12,           // dB reduction when voice plays
        attackTime: 0.05,          // How fast to duck (seconds)
        releaseTime: 0.3           // How fast to restore (seconds)
      }
    },
    
    // Master Output
    master: {
      limiter: {
        enabled: true,
        threshold: -1,             // dB (prevent clipping)
        ceiling: -0.1              // dB (absolute max)
      },
      finalNormalize: true,        // Normalize final output
      outputFormat: {
        bitrate: '192k',           // Audio bitrate
        sampleRate: 48000,         // 48kHz (Hi-Fi)
        channels: 2                // Stereo
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. VOICE ENHANCEMENT FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enhance voice quality
   */
  window.enhanceVoiceQuality = async function(inputAudioPath, outputAudioPath) {
    const config = window.audioEnhancementConfig.voiceClarity;
    
    if (!config.enabled) {
      console.log('[Audio Enhancement] Voice enhancement disabled, copying file');
      // Just copy file
      return { success: true, output: inputAudioPath };
    }
    
    console.log('[Audio Enhancement] Enhancing voice:', inputAudioPath);
    
    try {
      // Build FFmpeg filter chain
      const filters = [];
      
      // 1. Noise Reduction (High-pass filter + Noise gate)
      if (config.noiseReduction > 0) {
        filters.push(`highpass=f=80`);  // Remove low rumble
        filters.push(`lowpass=f=15000`);  // Remove high hiss
        filters.push(`afftdn=nf=${config.noiseReduction * 50}`);  // AI noise reduction
      }
      
      // 2. De-Esser (Reduce harsh S sounds)
      if (config.deEsser > 0) {
        filters.push(`deesser=i=${config.deEsser * 20}:m=0.5:f=0.5:s=o`);
      }
      
      // 3. Compression (Even out volume)
      if (config.compression > 0) {
        const ratio = 2 + (config.compression * 4);  // 2:1 to 6:1
        filters.push(`acompressor=threshold=-20dB:ratio=${ratio}:attack=5:release=50`);
      }
      
      // 4. EQ (Voice clarity boost)
      filters.push(`equalizer=f=3000:width_type=h:width=1000:g=3`);  // Presence boost
      filters.push(`equalizer=f=200:width_type=h:width=100:g=-2`);   // Remove muddiness
      
      // 5. Normalize
      if (config.normalize) {
        filters.push(`loudnorm=I=-16:TP=-1.5:LRA=11`);  // EBU R128 normalization
      }
      
      const filterChain = filters.join(',');
      
      // Call FFmpeg via API
      const response = await fetch('/api/audio/enhance-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputAudioPath,
          output: outputAudioPath,
          filters: filterChain,
          config: config
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[Audio Enhancement] Voice enhanced successfully');
        return { success: true, output: outputAudioPath };
      } else {
        throw new Error(result.error || 'Enhancement failed');
      }
    } catch (e) {
      console.error('[Audio Enhancement] Voice enhancement failed:', e);
      return { success: false, error: e.message };
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. BGM ENHANCEMENT FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enhance BGM quality
   */
  window.enhanceBGMQuality = async function(inputAudioPath, outputAudioPath) {
    const config = window.audioEnhancementConfig.bgmBoost;
    
    if (!config.enabled) {
      console.log('[Audio Enhancement] BGM enhancement disabled, copying file');
      return { success: true, output: inputAudioPath };
    }
    
    console.log('[Audio Enhancement] Enhancing BGM:', inputAudioPath);
    
    try {
      const filters = [];
      
      // 1. Volume Boost
      if (config.volumeBoost !== 1.0) {
        const volumeDb = 20 * Math.log10(config.volumeBoost);
        filters.push(`volume=${volumeDb}dB`);
      }
      
      // 2. Bass Boost
      if (config.bassBoost > 1.0) {
        const bassDb = 20 * Math.log10(config.bassBoost);
        filters.push(`equalizer=f=80:width_type=h:width=50:g=${bassDb}`);
        filters.push(`equalizer=f=150:width_type=h:width=80:g=${bassDb * 0.7}`);
      }
      
      // 3. Treble Boost
      if (config.trebleBoost > 1.0) {
        const trebleDb = 20 * Math.log10(config.trebleBoost);
        filters.push(`equalizer=f=8000:width_type=h:width=4000:g=${trebleDb}`);
        filters.push(`equalizer=f=12000:width_type=h:width=4000:g=${trebleDb * 0.8}`);
      }
      
      // 4. Stereo Width Enhancement
      if (config.stereoWidth > 1.0) {
        filters.push(`stereotools=mlev=1:mwid=${config.stereoWidth}`);
      }
      
      // 5. Compression (Keep dynamics controlled)
      filters.push(`acompressor=threshold=-24dB:ratio=3:attack=20:release=200`);
      
      const filterChain = filters.join(',');
      
      // Call FFmpeg via API
      const response = await fetch('/api/audio/enhance-bgm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputAudioPath,
          output: outputAudioPath,
          filters: filterChain,
          config: config
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[Audio Enhancement] BGM enhanced successfully');
        return { success: true, output: outputAudioPath };
      } else {
        throw new Error(result.error || 'Enhancement failed');
      }
    } catch (e) {
      console.error('[Audio Enhancement] BGM enhancement failed:', e);
      return { success: false, error: e.message };
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. AUDIO MIXING FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Mix voice with BGM (with auto-ducking)
   */
  window.mixVoiceWithBGM = async function(voicePath, bgmPath, outputPath, timeline) {
    const mixConfig = window.audioEnhancementConfig.mixing;
    const masterConfig = window.audioEnhancementConfig.master;
    
    console.log('[Audio Enhancement] Mixing voice with BGM');
    
    try {
      // Prepare mixing instructions
      const mixingInstructions = {
        voice: {
          path: voicePath,
          volume: mixConfig.voiceVolume,
          fadeIn: mixConfig.fadeInDuration,
          fadeOut: mixConfig.fadeOutDuration
        },
        bgm: {
          path: bgmPath,
          volumeDuringDialogue: mixConfig.bgmVolume,
          volumeNoDub: mixConfig.bgmVolumeNoDub,
          ducking: mixConfig.ducking
        },
        timeline: timeline,  // Array of {start, end, hasVoice}
        output: {
          path: outputPath,
          limiter: masterConfig.limiter,
          normalize: masterConfig.finalNormalize,
          format: masterConfig.outputFormat
        }
      };
      
      // Call mixing API
      const response = await fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mixingInstructions)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[Audio Enhancement] Mixing completed successfully');
        return { success: true, output: outputPath };
      } else {
        throw new Error(result.error || 'Mixing failed');
      }
    } catch (e) {
      console.error('[Audio Enhancement] Mixing failed:', e);
      return { success: false, error: e.message };
    }
  };

  /**
   * Generate timeline for mixing (where voice exists)
   */
  window.generateMixingTimeline = function() {
    if (!window.subtitleDB || window.subtitleDB.length === 0) {
      return [];
    }
    
    const timeline = [];
    
    window.subtitleDB.forEach(line => {
      if (line.dubbedAudio || line.audioFile) {
        timeline.push({
          start: line.start,
          end: line.end,
          hasVoice: true,
          speaker: line.speakerTag
        });
      } else {
        timeline.push({
          start: line.start,
          end: line.end,
          hasVoice: false
        });
      }
    });
    
    return timeline;
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. ENHANCEMENT SETTINGS UI
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បើក Audio Enhancement Settings Modal
   */
  window.openAudioEnhancementSettings = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'audioEnhancementSettingsModal';
    modal.style.zIndex = '10001';
    
    const config = window.audioEnhancementConfig;
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 700px; width: 95%; max-height: 90vh;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.12));">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              🎚️
            </div>
            <div>
              <div class="modal-title" style="font-size: 15px;">Audio Quality Enhancement</div>
              <div style="font-size: 11px; color: var(--muted);">កំណត់គុណភាពសំឡេង និងភ្លេង (Professional)</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeAudioEnhancementSettings()">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; overflow-y: auto; max-height: calc(90vh - 140px);">
          
          <!-- Voice Enhancement Section -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="font-size: 13.5px; font-weight: 700; color: var(--text);">🎙️ Voice Enhancement (សំឡេងនិយាយ)</div>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="voiceEnhanceToggle" ${config.voiceClarity.enabled ? 'checked' : ''} onchange="toggleVoiceEnhancement()" style="width: 16px; height: 16px;">
                <span style="font-size: 11px; color: var(--text);">បើកដំណើរការ</span>
              </label>
            </div>

            <div id="voiceEnhanceControls" style="${config.voiceClarity.enabled ? '' : 'opacity: 0.5; pointer-events: none;'}">
              <!-- Noise Reduction -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Noise Reduction (លុបសំឡេងរំខាន)</label>
                  <span id="noiseReductionValue" style="font-size: 11px; font-weight: 600; color: #10b981;">${Math.round(config.voiceClarity.noiseReduction * 100)}%</span>
                </div>
                <input type="range" id="noiseReductionSlider" min="0" max="100" value="${config.voiceClarity.noiseReduction * 100}" oninput="updateNoiseReduction(this.value)" style="width: 100%;">
              </div>

              <!-- De-Esser -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">De-Esser (កាត់សំឡេង S ប្លែក)</label>
                  <span id="deEsserValue" style="font-size: 11px; font-weight: 600; color: #10b981;">${Math.round(config.voiceClarity.deEsser * 100)}%</span>
                </div>
                <input type="range" id="deEsserSlider" min="0" max="100" value="${config.voiceClarity.deEsser * 100}" oninput="updateDeEsser(this.value)" style="width: 100%;">
              </div>

              <!-- Compression -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Compression (ធ្វើឱ្យសំឡេងស្មើគ្នា)</label>
                  <span id="compressionValue" style="font-size: 11px; font-weight: 600; color: #10b981;">${Math.round(config.voiceClarity.compression * 100)}%</span>
                </div>
                <input type="range" id="compressionSlider" min="0" max="100" value="${config.voiceClarity.compression * 100}" oninput="updateCompression(this.value)" style="width: 100%;">
              </div>

              <!-- Normalize -->
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: var(--soft); border-radius: 6px;">
                <input type="checkbox" id="normalizeToggle" ${config.voiceClarity.normalize ? 'checked' : ''} onchange="toggleNormalize()" style="width: 14px; height: 14px;">
                <span style="font-size: 11px; color: var(--text);">Auto-Normalize (កំរិតសំឡេងស្វ័យប្រវត្តិ)</span>
              </label>
            </div>
          </div>

          <div style="height: 1px; background: var(--line); margin: 20px 0;"></div>

          <!-- BGM Enhancement Section -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="font-size: 13.5px; font-weight: 700; color: var(--text);">🎵 BGM Enhancement (ភ្លេងផ្ទៃខាងក្រោយ)</div>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="bgmEnhanceToggle" ${config.bgmBoost.enabled ? 'checked' : ''} onchange="toggleBGMEnhancement()" style="width: 16px; height: 16px;">
                <span style="font-size: 11px; color: var(--text);">បើកដំណើរការ</span>
              </label>
            </div>

            <div id="bgmEnhanceControls" style="${config.bgmBoost.enabled ? '' : 'opacity: 0.5; pointer-events: none;'}">
              <!-- Volume Boost -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Volume Boost (សំឡេងខ្លាំង)</label>
                  <span id="bgmVolumeValue" style="font-size: 11px; font-weight: 600; color: #3b82f6;">${config.bgmBoost.volumeBoost.toFixed(1)}x</span>
                </div>
                <input type="range" id="bgmVolumeSlider" min="100" max="200" value="${config.bgmBoost.volumeBoost * 100}" oninput="updateBGMVolume(this.value)" style="width: 100%;">
              </div>

              <!-- Bass Boost -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Bass Boost (សំឡេងបាស)</label>
                  <span id="bassBoostValue" style="font-size: 11px; font-weight: 600; color: #3b82f6;">${config.bgmBoost.bassBoost.toFixed(1)}x</span>
                </div>
                <input type="range" id="bassBoostSlider" min="100" max="200" value="${config.bgmBoost.bassBoost * 100}" oninput="updateBassBoost(this.value)" style="width: 100%;">
              </div>

              <!-- Treble Boost -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Treble Boost (សំឡេងខ្ពស់)</label>
                  <span id="trebleBoostValue" style="font-size: 11px; font-weight: 600; color: #3b82f6;">${config.bgmBoost.trebleBoost.toFixed(1)}x</span>
                </div>
                <input type="range" id="trebleBoostSlider" min="100" max="200" value="${config.bgmBoost.trebleBoost * 100}" oninput="updateTrebleBoost(this.value)" style="width: 100%;">
              </div>

              <!-- Stereo Width -->
              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <label style="font-size: 11.5px; color: var(--text);">Stereo Width (ទទឹងសំឡេង)</label>
                  <span id="stereoWidthValue" style="font-size: 11px; font-weight: 600; color: #3b82f6;">${config.bgmBoost.stereoWidth.toFixed(1)}x</span>
                </div>
                <input type="range" id="stereoWidthSlider" min="100" max="200" value="${config.bgmBoost.stereoWidth * 100}" oninput="updateStereoWidth(this.value)" style="width: 100%;">
              </div>
            </div>
          </div>

          <div style="height: 1px; background: var(--line); margin: 20px 0;"></div>

          <!-- Mixing Settings -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 12px;">🎛️ Mixing Settings (លាយសំឡេង)</div>

            <!-- Auto-Ducking -->
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px; background: var(--soft); border-radius: 6px; margin-bottom: 10px;">
              <input type="checkbox" id="duckingToggle" ${config.mixing.ducking.enabled ? 'checked' : ''} onchange="toggleDucking()" style="width: 14px; height: 14px;">
              <div style="flex: 1;">
                <div style="font-size: 11.5px; font-weight: 600; color: var(--text);">Auto-Ducking (បន្ថយភ្លេងពេលនិយាយ)</div>
                <div style="font-size: 10px; color: var(--muted);">ភ្លេងនឹងបន្ថយស្វ័យប្រវត្តិពេលមានសំឡេងនិយាយ</div>
              </div>
            </label>

            <!-- Voice/BGM Balance -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">Voice Volume</div>
                <div style="font-size: 12px; font-weight: 600; color: #10b981;">${Math.round(config.mixing.voiceVolume * 100)}%</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">BGM Volume (During Voice)</div>
                <div style="font-size: 12px; font-weight: 600; color: #3b82f6;">${Math.round(config.mixing.bgmVolume * 100)}%</div>
              </div>
            </div>
          </div>

          <!-- Presets -->
          <div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 8px;">⚡ Quick Presets</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="btn-secondary" onclick="applyEnhancementPreset('default')" style="font-size: 10.5px; padding: 8px;">
                Default
              </button>
              <button class="btn-secondary" onclick="applyEnhancementPreset('cinema')" style="font-size: 10.5px; padding: 8px;">
                🎬 Cinema
              </button>
              <button class="btn-secondary" onclick="applyEnhancementPreset('podcast')" style="font-size: 10.5px; padding: 8px;">
                🎙️ Podcast
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button class="btn-secondary" onclick="resetEnhancementSettings()" style="font-size: 11px;">
            🔄 Reset
          </button>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" onclick="closeAudioEnhancementSettings()">បោះបង់</button>
            <button class="btn-primary" onclick="saveEnhancementSettings()">រក្សាទុក</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  /**
   * Close modal
   */
  window.closeAudioEnhancementSettings = function() {
    const modal = document.getElementById('audioEnhancementSettingsModal');
    if (modal) {
      modal.remove();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. SETTINGS UPDATE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  window.toggleVoiceEnhancement = function() {
    const toggle = document.getElementById('voiceEnhanceToggle');
    const controls = document.getElementById('voiceEnhanceControls');
    window.audioEnhancementConfig.voiceClarity.enabled = toggle.checked;
    if (controls) {
      controls.style.opacity = toggle.checked ? '1' : '0.5';
      controls.style.pointerEvents = toggle.checked ? 'auto' : 'none';
    }
  };

  window.updateNoiseReduction = function(value) {
    window.audioEnhancementConfig.voiceClarity.noiseReduction = value / 100;
    document.getElementById('noiseReductionValue').textContent = Math.round(value) + '%';
  };

  window.updateDeEsser = function(value) {
    window.audioEnhancementConfig.voiceClarity.deEsser = value / 100;
    document.getElementById('deEsserValue').textContent = Math.round(value) + '%';
  };

  window.updateCompression = function(value) {
    window.audioEnhancementConfig.voiceClarity.compression = value / 100;
    document.getElementById('compressionValue').textContent = Math.round(value) + '%';
  };

  window.toggleNormalize = function() {
    window.audioEnhancementConfig.voiceClarity.normalize = document.getElementById('normalizeToggle').checked;
  };

  window.toggleBGMEnhancement = function() {
    const toggle = document.getElementById('bgmEnhanceToggle');
    const controls = document.getElementById('bgmEnhanceControls');
    window.audioEnhancementConfig.bgmBoost.enabled = toggle.checked;
    if (controls) {
      controls.style.opacity = toggle.checked ? '1' : '0.5';
      controls.style.pointerEvents = toggle.checked ? 'auto' : 'none';
    }
  };

  window.updateBGMVolume = function(value) {
    window.audioEnhancementConfig.bgmBoost.volumeBoost = value / 100;
    document.getElementById('bgmVolumeValue').textContent = (value / 100).toFixed(1) + 'x';
  };

  window.updateBassBoost = function(value) {
    window.audioEnhancementConfig.bgmBoost.bassBoost = value / 100;
    document.getElementById('bassBoostValue').textContent = (value / 100).toFixed(1) + 'x';
  };

  window.updateTrebleBoost = function(value) {
    window.audioEnhancementConfig.bgmBoost.trebleBoost = value / 100;
    document.getElementById('trebleBoostValue').textContent = (value / 100).toFixed(1) + 'x';
  };

  window.updateStereoWidth = function(value) {
    window.audioEnhancementConfig.bgmBoost.stereoWidth = value / 100;
    document.getElementById('stereoWidthValue').textContent = (value / 100).toFixed(1) + 'x';
  };

  window.toggleDucking = function() {
    window.audioEnhancementConfig.mixing.ducking.enabled = document.getElementById('duckingToggle').checked;
  };

  /**
   * Apply presets
   */
  window.applyEnhancementPreset = function(preset) {
    const config = window.audioEnhancementConfig;
    
    if (preset === 'default') {
      config.voiceClarity.noiseReduction = 0.7;
      config.voiceClarity.deEsser = 0.5;
      config.voiceClarity.compression = 0.6;
      config.bgmBoost.volumeBoost = 1.5;
      config.bgmBoost.bassBoost = 1.3;
      config.bgmBoost.trebleBoost = 1.2;
    } else if (preset === 'cinema') {
      config.voiceClarity.noiseReduction = 0.8;
      config.voiceClarity.deEsser = 0.6;
      config.voiceClarity.compression = 0.7;
      config.bgmBoost.volumeBoost = 1.8;
      config.bgmBoost.bassBoost = 1.6;
      config.bgmBoost.trebleBoost = 1.4;
    } else if (preset === 'podcast') {
      config.voiceClarity.noiseReduction = 0.9;
      config.voiceClarity.deEsser = 0.7;
      config.voiceClarity.compression = 0.8;
      config.bgmBoost.volumeBoost = 1.2;
      config.bgmBoost.bassBoost = 1.0;
      config.bgmBoost.trebleBoost = 1.0;
    }
    
    closeAudioEnhancementSettings();
    setTimeout(() => openAudioEnhancementSettings(), 100);
    showToast(`✅ បានអនុវត្ត ${preset} preset`);
  };

  /**
   * Reset settings
   */
  window.resetEnhancementSettings = function() {
    if (confirm('តើអ្នកចង់ reset ការកំណត់ទាំងអស់មែនទេ?')) {
      applyEnhancementPreset('default');
    }
  };

  /**
   * Save settings
   */
  window.saveEnhancementSettings = function() {
    try {
      localStorage.setItem('audio_enhancement_config', JSON.stringify(window.audioEnhancementConfig));
      closeAudioEnhancementSettings();
      showToast('✅ បានរក្សាទុកការកំណត់');
    } catch (e) {
      console.error('[Audio Enhancement] Failed to save settings:', e);
      showToast('❌ មិនអាចរក្សាទុកបានទេ');
    }
  };

  /**
   * Load settings
   */
  window.loadEnhancementSettings = function() {
    try {
      const saved = localStorage.getItem('audio_enhancement_config');
      if (saved) {
        window.audioEnhancementConfig = Object.assign(window.audioEnhancementConfig, JSON.parse(saved));
        console.log('[Audio Enhancement] Settings loaded');
      }
    } catch (e) {
      console.error('[Audio Enhancement] Failed to load settings:', e);
    }
  };

  // Load settings on init
  loadEnhancementSettings();
  
  console.log('[Audio Quality Enhancer] System loaded');

})();
