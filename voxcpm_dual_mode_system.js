/**
 * ═══════════════════════════════════════════════════════════════════
 * VOXCPM DUAL MODE SYSTEM v2.0
 * បំបែក Mode ចម្លងសំឡេង ២ប្រភេទច្បាស់លាស់
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. VOICE CLONING MODE DEFINITION
  // ═══════════════════════════════════════════════════════════════════

  window.VoxCPMMode = {
    CLONE_FROM_ORIGINAL: 'clone_from_original',  // Mode 1: Clone ពីរឿងដើម
    CLONE_FROM_LIBRARY: 'clone_from_library'     // Mode 2: Clone ពី Voice Library
  };

  // Current selected mode
  window.currentVoxCPMMode = null;

  // Character voice mapping
  window.characterVoiceAssignment = {
    // Format:
    // 'Speaker_1': {
    //   mode: 'clone_from_original' | 'clone_from_library',
    //   source: 'original_movie_segment.wav' | 'library_voice_id',
    //   voiceName: 'ឯកប្រុស ពីរឿងដើម' | 'custom_voice_vid10',
    //   isAutoFilled: false
    // }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. MODE SELECTION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បើក Modal ជ្រើសរើស Mode
   */
  window.openVoxCPMDualModeModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'voxcpmDualModeModal';
    modal.style.zIndex = '10001';
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 750px; width: 95%; max-height: 85vh;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(219, 39, 119, 0.12));">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #db2777); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              🎙️
            </div>
            <div>
              <div class="modal-title" style="font-size: 15px;">VOXCPM2 Hi-Fi Voice Cloning Studio</div>
              <div style="font-size: 11px; color: var(--muted);">ជ្រើសរើសវិធីសាស្រ្ត Clone សំឡេង (48kHz Professional)</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeVoxCPMDualModeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; overflow-y: auto; max-height: calc(85vh - 140px);">
          <!-- Mode Selection -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
            
            <!-- MODE 1: Clone ពីរឿងដើម -->
            <div class="voxcpm-mode-card" id="modeCardOriginal" onclick="selectVoxCPMMode('clone_from_original')" style="cursor: pointer; border: 2px solid var(--line); border-radius: 10px; padding: 16px; background: var(--soft); transition: all 0.2s;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white;">
                  🎬
                </div>
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: var(--text);">Mode 1: Clone ពីរឿងដើម</div>
                  <div style="font-size: 10px; color: var(--muted);">100% ដូចសំឡេងដើម</div>
                </div>
              </div>
              <div style="font-size: 11px; color: var(--muted); line-height: 1.5; margin-bottom: 10px;">
                • វិភាគតួអង្គពីរឿងដើមដោយស្វ័យប្រវត្តិ<br>
                • Clone សំឡេងពីរបស់តួអង្គនីមួយៗ<br>
                • សំឡេង 100% ដូចទឹកដមដើម<br>
                • លក្ខណៈសំឡេងរក្សាគ្រប់ emotion
              </div>
              <div style="padding: 8px 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.25);">
                <div style="font-size: 10.5px; font-weight: 600; color: #3b82f6; margin-bottom: 2px;">✅ ល្អបំផុតសម្រាប់:</div>
                <div style="font-size: 10px; color: var(--text); opacity: 0.9;">រឿង Movie/Series ដែលមានតួអង្គច្បាស់លាស់</div>
              </div>
            </div>

            <!-- MODE 2: Clone ពី Voice Library -->
            <div class="voxcpm-mode-card" id="modeCardLibrary" onclick="selectVoxCPMMode('clone_from_library')" style="cursor: pointer; border: 2px solid var(--line); border-radius: 10px; padding: 16px; background: var(--soft); transition: all 0.2s;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #8b5cf6, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white;">
                  📚
                </div>
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: var(--text);">Mode 2: Clone ពី Library</div>
                  <div style="font-size: 10px; color: var(--muted);">សំឡេងពីបន្ទប់សំឡេង</div>
                </div>
              </div>
              <div style="font-size: 11px; color: var(--muted); line-height: 1.5; margin-bottom: 10px;">
                • ជ្រើសរើសសំឡេងពីបណ្ណាល័យ<br>
                • កំណត់សំឡេងតួអង្គដោយខ្លួនឯង<br>
                • សំឡេងគុណភាពខ្ពស់<br>
                • ប្រើសំឡេងដដែលគ្រប់ Episode
              </div>
              <div style="padding: 8px 10px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; border: 1px solid rgba(139, 92, 246, 0.25);">
                <div style="font-size: 10.5px; font-weight: 600; color: #8b5cf6; margin-bottom: 2px;">✅ ល្អបំផុតសម្រាប់:</div>
                <div style="font-size: 10px; color: var(--text); opacity: 0.9;">Series ច្រើន Episode ត្រូវការ consistency</div>
              </div>
            </div>
          </div>

          <!-- Selected Mode Info -->
          <div id="selectedModeInfo" style="display: none; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #10b981; margin-bottom: 4px;">✓ បានជ្រើសរើស:</div>
            <div id="selectedModeText" style="font-size: 11px; color: var(--text);"></div>
          </div>

          <!-- Character Assignment Section (Shows after mode selection) -->
          <div id="characterAssignmentSection" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="font-size: 13px; font-weight: 700; color: var(--text);">កំណត់សំឡេងតួអង្គ (Character Assignment)</div>
              <button class="btn-secondary" onclick="autoAssignCharacterVoices()" style="font-size: 11px; padding: 5px 12px;">
                🤖 Auto-Assign
              </button>
            </div>

            <!-- Character List Container -->
            <div id="characterListContainer" style="display: grid; gap: 10px;"></div>

            <!-- Missing Voices Warning -->
            <div id="missingVoicesWarning" style="display: none; margin-top: 12px; padding: 10px 12px; background: rgba(251, 146, 60, 0.1); border-radius: 6px; border: 1px solid rgba(251, 146, 60, 0.3);">
              <div style="font-size: 11px; font-weight: 600; color: #fb923c; margin-bottom: 4px;">⚠️ បញ្ហា:</div>
              <div id="missingVoicesText" style="font-size: 10.5px; color: var(--text);"></div>
              <button class="btn-primary" onclick="autoFillMissingVoices()" style="font-size: 10.5px; padding: 5px 10px; margin-top: 6px;">
                🔄 Auto-Fill ពីរឿងដើម
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <div id="modeStatusText" style="font-size: 11px; color: var(--muted);"></div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" onclick="closeVoxCPMDualModeModal()">បោះបង់</button>
            <button class="btn-primary" id="btnStartVoxCPM" onclick="startVoxCPMDubbing()" disabled style="opacity: 0.5; cursor: not-allowed;">
              ចាប់ផ្តើម Dubbing
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load detected characters
    setTimeout(() => {
      detectCharactersFromSubtitles();
    }, 300);
  };

  /**
   * ជ្រើសរើស Mode
   */
  window.selectVoxCPMMode = function(mode) {
    window.currentVoxCPMMode = mode;
    
    // Update UI - highlight selected card
    const cardOriginal = document.getElementById('modeCardOriginal');
    const cardLibrary = document.getElementById('modeCardLibrary');
    
    if (cardOriginal && cardLibrary) {
      cardOriginal.style.borderColor = mode === 'clone_from_original' ? '#3b82f6' : 'var(--line)';
      cardOriginal.style.background = mode === 'clone_from_original' ? 'rgba(59, 130, 246, 0.08)' : 'var(--soft)';
      cardOriginal.style.boxShadow = mode === 'clone_from_original' ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none';
      
      cardLibrary.style.borderColor = mode === 'clone_from_library' ? '#8b5cf6' : 'var(--line)';
      cardLibrary.style.background = mode === 'clone_from_library' ? 'rgba(139, 92, 246, 0.08)' : 'var(--soft)';
      cardLibrary.style.boxShadow = mode === 'clone_from_library' ? '0 0 0 2px rgba(139, 92, 246, 0.2)' : 'none';
    }
    
    // Show selected mode info
    const infoDiv = document.getElementById('selectedModeInfo');
    const infoText = document.getElementById('selectedModeText');
    if (infoDiv && infoText) {
      infoDiv.style.display = 'block';
      infoText.textContent = mode === 'clone_from_original' 
        ? 'Mode 1: Clone សំឡេងពីរឿងដើម - សំឡេងនឹងដូចតួអង្គក្នុងរឿង 100%'
        : 'Mode 2: Clone សំឡេងពីបណ្ណាល័យ - ជ្រើសរើសសំឡេងដោយខ្លួនឯង';
    }
    
    // Show character assignment section
    const assignSection = document.getElementById('characterAssignmentSection');
    if (assignSection) {
      assignSection.style.display = 'block';
    }
    
    // Load characters and show assignment UI
    loadCharacterAssignmentUI(mode);
    
    console.log('[VoxCPM Dual Mode] Selected mode:', mode);
  };

  /**
   * បិទ Modal
   */
  window.closeVoxCPMDualModeModal = function() {
    const modal = document.getElementById('voxcpmDualModeModal');
    if (modal) {
      modal.remove();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. CHARACTER DETECTION & ASSIGNMENT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * វិភាគតួអង្គពី subtitles
   */
  window.detectCharactersFromSubtitles = function() {
    if (!window.subtitleDB || window.subtitleDB.length === 0) {
      console.warn('[VoxCPM] No subtitles found');
      return [];
    }
    
    const speakers = new Set();
    window.subtitleDB.forEach(line => {
      if (line.speakerTag) {
        speakers.add(line.speakerTag);
      }
    });
    
    const characters = Array.from(speakers).map((speaker, index) => ({
      id: speaker,
      name: speaker,
      dialogueCount: window.subtitleDB.filter(l => l.speakerTag === speaker).length,
      icon: index % 2 === 0 ? '👨' : '👩',  // Simple alternation
      assigned: false
    }));
    
    console.log('[VoxCPM] Detected characters:', characters);
    return characters;
  };

  /**
   * ផ្ទុក Character Assignment UI
   */
  window.loadCharacterAssignmentUI = function(mode) {
    const container = document.getElementById('characterListContainer');
    if (!container) return;
    
    const characters = detectCharactersFromSubtitles();
    
    if (characters.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12px;">មិនរកឃើញតួអង្គទេ<br>សូមធ្វើ Transcribe និង Translation ជាមុនសិន</div>';
      return;
    }
    
    container.innerHTML = '';
    
    characters.forEach(char => {
      const card = document.createElement('div');
      card.className = 'voxcpm-char-assignment-card';
      card.style.cssText = 'background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px;';
      
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 16px;">
              ${char.icon}
            </div>
            <div>
              <div style="font-size: 12.5px; font-weight: 700; color: var(--text);">${char.name}</div>
              <div style="font-size: 10px; color: var(--muted);">${char.dialogueCount} dialogues</div>
            </div>
          </div>
          <div id="voiceStatus_${char.id}" style="font-size: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(251, 146, 60, 0.1); color: #fb923c; border: 1px solid rgba(251, 146, 60, 0.3);">
            ⚠️ មិនទាន់កំណត់
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: ${mode === 'clone_from_library' ? '1fr auto' : '1fr'}; gap: 8px;">
          ${mode === 'clone_from_library' ? `
            <select id="voiceSelect_${char.id}" onchange="assignVoiceToCharacter('${char.id}')" style="font-size: 11px; padding: 6px 10px; border-radius: 6px; background: var(--soft); border: 1px solid var(--line); color: var(--text);">
              <option value="">ជ្រើសរើសសំឡេង...</option>
            </select>
            <button class="btn-primary" onclick="previewVoice('${char.id}')" style="font-size: 11px; padding: 6px 12px;">▶️ ស្តាប់</button>
          ` : `
            <div style="font-size: 11px; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.25); color: #3b82f6;">
              🤖 សំឡេងនឹងត្រូវយកពីរឿងដើមដោយស្វ័យប្រវត្តិ
            </div>
          `}
        </div>
      `;
      
      container.appendChild(card);
    });
    
    // Load voice library options for Mode 2
    if (mode === 'clone_from_library') {
      loadVoiceLibraryOptions();
    } else {
      // Auto-assign for Mode 1
      autoAssignOriginalVoices();
    }
    
    // Check if ready to start
    updateReadyStatus();
  };

  /**
   * ផ្ទុក Voice Library options ក្នុង dropdowns
   */
  window.loadVoiceLibraryOptions = async function() {
    try {
      const res = await fetch('/api/voice-library');
      const data = await res.json();
      
      if (!data.success || !data.voices || data.voices.length === 0) {
        console.warn('[VoxCPM] No voices in library');
        return;
      }
      
      const characters = detectCharactersFromSubtitles();
      
      characters.forEach(char => {
        const select = document.getElementById(`voiceSelect_${char.id}`);
        if (!select) return;
        
        // Add voices to dropdown
        data.voices.forEach(voice => {
          const option = document.createElement('option');
          option.value = voice.id;
          option.textContent = `${voice.characterType} - ${voice.name}`;
          option.dataset.filename = voice.filename;
          select.appendChild(option);
        });
      });
      
      console.log('[VoxCPM] Loaded', data.voices.length, 'voices into dropdowns');
    } catch (e) {
      console.error('[VoxCPM] Failed to load voice library:', e);
    }
  };

  /**
   * Auto-assign original voices (Mode 1)
   */
  window.autoAssignOriginalVoices = function() {
    const characters = detectCharactersFromSubtitles();
    
    characters.forEach(char => {
      window.characterVoiceAssignment[char.id] = {
        mode: 'clone_from_original',
        source: 'auto_detected',
        voiceName: `${char.name} (ពីរឿងដើម)`,
        isAutoFilled: false
      };
      
      // Update status
      const statusEl = document.getElementById(`voiceStatus_${char.id}`);
      if (statusEl) {
        statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
        statusEl.style.color = '#10b981';
        statusEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        statusEl.textContent = '✓ សំឡេងដើម';
      }
    });
    
    updateReadyStatus();
    console.log('[VoxCPM] Auto-assigned original voices');
  };

  /**
   * Assign voice to character (Mode 2)
   */
  window.assignVoiceToCharacter = function(characterId) {
    const select = document.getElementById(`voiceSelect_${characterId}`);
    if (!select || !select.value) return;
    
    const selectedOption = select.options[select.selectedIndex];
    const voiceId = select.value;
    const voiceName = selectedOption.textContent;
    const filename = selectedOption.dataset.filename;
    
    window.characterVoiceAssignment[characterId] = {
      mode: 'clone_from_library',
      source: voiceId,
      voiceName: voiceName,
      filename: filename,
      isAutoFilled: false
    };
    
    // Update status
    const statusEl = document.getElementById(`voiceStatus_${characterId}`);
    if (statusEl) {
      statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
      statusEl.style.color = '#10b981';
      statusEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      statusEl.textContent = '✓ បានកំណត់';
    }
    
    updateReadyStatus();
    console.log('[VoxCPM] Assigned voice:', voiceName, 'to character:', characterId);
  };

  /**
   * Preview voice
   */
  window.previewVoice = function(characterId) {
    const assignment = window.characterVoiceAssignment[characterId];
    if (!assignment || !assignment.filename) {
      alert('សូមជ្រើសរើសសំឡេងជាមុនសិន');
      return;
    }
    
    const audio = new Audio(`/voice-library-files/${assignment.filename}`);
    audio.play().catch(e => {
      console.error('[VoxCPM] Failed to play preview:', e);
      alert('មិនអាចចាក់សំឡេងបានទេ');
    });
  };

  /**
   * ពិនិត្យថាត្រៀមរួចសម្រាប់ start dubbing ឬនៅ
   */
  window.updateReadyStatus = function() {
    const characters = detectCharactersFromSubtitles();
    const assigned = Object.keys(window.characterVoiceAssignment).length;
    
    const btn = document.getElementById('btnStartVoxCPM');
    const statusText = document.getElementById('modeStatusText');
    
    if (assigned === characters.length && characters.length > 0) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
      if (statusText) {
        statusText.textContent = `✓ រួចរាល់! កំណត់សំឡេងគ្រប់ ${characters.length} តួអង្គ`;
        statusText.style.color = '#10b981';
      }
    } else {
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
      if (statusText) {
        statusText.textContent = `⚠️ សូមកំណត់សំឡេងសម្រាប់តួអង្គទាំងអស់ (${assigned}/${characters.length})`;
        statusText.style.color = '#fb923c';
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. AUTO-FILL MISSING VOICES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Auto-fill missing voices from original movie
   */
  window.autoFillMissingVoices = function() {
    const characters = detectCharactersFromSubtitles();
    
    characters.forEach(char => {
      if (!window.characterVoiceAssignment[char.id]) {
        window.characterVoiceAssignment[char.id] = {
          mode: 'clone_from_original',
          source: 'auto_detected',
          voiceName: `${char.name} (Auto-fill ពីរឿងដើម)`,
          isAutoFilled: true
        };
        
        console.log('[VoxCPM] Auto-filled voice for:', char.id);
      }
    });
    
    // Reload UI
    loadCharacterAssignmentUI(window.currentVoxCPMMode);
    
    showToast('✅ បានបំពេញសំឡេងដែលខ្វះដោយស្វ័យប្រវត្តិ');
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. START DUBBING (ENHANCED WITH MISSING LINE DETECTION)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * ចាប់ផ្តើម VoxCPM Dubbing
   */
  window.startVoxCPMDubbing = async function() {
    if (!window.currentVoxCPMMode) {
      alert('សូមជ្រើសរើស Mode ជាមុនសិន');
      return;
    }
    
    const characters = detectCharactersFromSubtitles();
    const assigned = Object.keys(window.characterVoiceAssignment).length;
    
    // Strict validation: ALL characters must have voices
    if (assigned < characters.length) {
      const missingChars = characters.filter(c => !window.characterVoiceAssignment[c.id]);
      const missingNames = missingChars.map(c => c.name).join(', ');
      
      alert(`⚠️ មិនអាចចាប់ផ្តើមបានទេ!\n\nតួអង្គទាំងនេះមិនទាន់កំណត់សំឡេង:\n${missingNames}\n\nសូមកំណត់សំឡេងសម្រាប់គ្រប់តួអង្គជាមុនសិន។`);
      return;
    }
    
    // Validate voice consistency (no duplicate voices unless intentional)
    const voiceUsage = {};
    Object.entries(window.characterVoiceAssignment).forEach(([charId, assignment]) => {
      const voiceKey = assignment.source || assignment.voiceName;
      if (!voiceUsage[voiceKey]) {
        voiceUsage[voiceKey] = [];
      }
      voiceUsage[voiceKey].push(charId);
    });
    
    const duplicates = Object.entries(voiceUsage).filter(([_, chars]) => chars.length > 1);
    if (duplicates.length > 0) {
      const dupMsg = duplicates.map(([voice, chars]) => 
        `សំឡេង "${voice}" ត្រូវបានប្រើសម្រាប់: ${chars.join(', ')}`
      ).join('\n');
      
      if (!confirm(`⚠️ បញ្ហា: តួអង្គច្រើននាក់ប្រើសំឡេងដូចគ្នា!\n\n${dupMsg}\n\nតើចង់បន្តទេ?`)) {
        return;
      }
    }
    
    console.log('[VoxCPM] Starting dubbing with mode:', window.currentVoxCPMMode);
    console.log('[VoxCPM] Character assignments:', window.characterVoiceAssignment);
    
    // Close modal
    closeVoxCPMDualModeModal();
    
    // Call actual dubbing function with validation
    await executeVoxCPMDubbing();
  };

  /**
   * Execute VoxCPM Dubbing (actual implementation with missing line detection)
   */
  window.executeVoxCPMDubbing = async function() {
    try {
      showToast('🚀 កំពុងចាប់ផ្តើម VoxCPM Dubbing...');
      
      // Prepare dubbing request with enhanced settings
      const dubbingRequest = {
        mode: window.currentVoxCPMMode,
        characters: window.characterVoiceAssignment,
        subtitles: window.subtitleDB,
        videoId: window.currentVideoId || 'video_' + Date.now(),
        qualitySettings: {
          detectMissingLines: true,      // Enable missing line detection
          autoRetry: true,                // Auto-retry failed lines
          maxRetries: 3,                  // Max retry attempts
          enforceVoiceConsistency: true,  // Ensure 1 character = 1 voice
          enhanceAudio: true,             // Enable audio enhancement
          normalizeVolume: true,          // Normalize audio levels
          removeNoise: true               // Remove background noise
        }
      };
      
      // Send to backend
      const res = await fetch('/api/voxcpm/dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dubbingRequest)
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Check for missing or failed lines
        if (data.missingLines && data.missingLines.length > 0) {
          showMissingLinesReport(data.missingLines, data.totalLines);
        } else {
          showToast('✅ VoxCPM Dubbing ជោគជ័យ! គ្រប់ឃ្លាទាំងអស់ត្រូវបាននិយាយ');
        }
        console.log('[VoxCPM] Dubbing completed:', data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (e) {
      console.error('[VoxCPM] Dubbing failed:', e);
      showToast('❌ Dubbing មិនបានសម្រេច: ' + e.message);
    }
  };

  /**
   * Show missing lines report
   */
  window.showMissingLinesReport = function(missingLines, totalLines) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'missingLinesModal';
    modal.style.zIndex = '10005';
    
    const percentage = ((totalLines - missingLines.length) / totalLines * 100).toFixed(1);
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 700px; width: 95%;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(251, 146, 60, 0.12), rgba(239, 68, 68, 0.12));">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #fb923c, #ef4444); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              ⚠️
            </div>
            <div>
              <div class="modal-title">បញ្ហា: ឃ្លាខ្លះមិនត្រូវបាននិយាយ</div>
              <div style="font-size: 11px; color: var(--muted);">រកឃើញ ${missingLines.length} ឃ្លាដែលខ្វះសំឡេង</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('missingLinesModal').remove()">✕</button>
        </div>

        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          <div style="padding: 14px; background: rgba(251, 146, 60, 0.1); border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(251, 146, 60, 0.25);">
            <div style="font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px;">📊 សង្ខេបលទ្ធផល:</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div style="padding: 10px; background: var(--panel); border-radius: 6px;">
                <div style="font-size: 11px; color: var(--muted);">ចំនួនឃ្លាសរុប</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--text);">${totalLines}</div>
              </div>
              <div style="padding: 10px; background: var(--panel); border-radius: 6px;">
                <div style="font-size: 11px; color: var(--muted);">ឃ្លាដែលខ្វះ</div>
                <div style="font-size: 20px; font-weight: 700; color: #ef4444;">${missingLines.length}</div>
              </div>
            </div>
            <div style="margin-top: 12px; padding: 8px 12px; background: var(--panel); border-radius: 6px;">
              <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px;">អត្រាជោគជ័យ:</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.5s ease;"></div>
                </div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text);">${percentage}%</div>
              </div>
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 10px;">ឃ្លាដែលមិនត្រូវបាននិយាយ:</div>
          <div style="display: grid; gap: 8px;">
            ${missingLines.map((line, idx) => `
              <div style="padding: 10px 12px; background: var(--soft); border-radius: 6px; border-left: 3px solid #ef4444;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                  <div style="font-size: 11px; color: var(--muted);">
                    <strong>${line.speaker || 'Unknown'}</strong> • ${line.timeStart || '00:00'} → ${line.timeEnd || '00:00'}
                  </div>
                  <button class="btn-primary" onclick="retryLine('${line.id}')" style="font-size: 10px; padding: 4px 10px; height: auto;">
                    🔄 Retry
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text); font-family: var(--kh);">
                  ${line.text || 'គ្មានអត្ថបទ'}
                </div>
                ${line.reason ? `<div style="font-size: 10px; color: #ef4444; margin-top: 4px;">⚠️ មូលហេតុ: ${line.reason}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn-secondary" onclick="document.getElementById('missingLinesModal').remove()">បិទ</button>
          <button class="btn-primary" onclick="retryAllMissingLines()">
            🔄 Retry ឃ្លាទាំងអស់
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  /**
   * Retry single line
   */
  window.retryLine = async function(lineId) {
    showToast('🔄 កំពុង retry ឃ្លានេះ...');
    try {
      const res = await fetch('/api/voxcpm/retry-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, mode: window.currentVoxCPMMode })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Retry ជោគជ័យ!');
        document.getElementById('missingLinesModal').remove();
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast('❌ Retry មិនបានសម្រេច: ' + e.message);
    }
  };

  /**
   * Retry all missing lines
   */
  window.retryAllMissingLines = async function() {
    showToast('🔄 កំពុង retry ឃ្លាទាំងអស់...');
    try {
      const res = await fetch('/api/voxcpm/retry-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: window.currentVoxCPMMode })
      });
      const data = await res.json();
      if (data.success) {
        if (data.stillMissing && data.stillMissing.length > 0) {
          showMissingLinesReport(data.stillMissing, data.totalLines);
        } else {
          showToast('✅ Retry ជោគជ័យ! គ្រប់ឃ្លាទាំងអស់ត្រូវបាននិយាយ');
          document.getElementById('missingLinesModal').remove();
        }
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast('❌ Retry មិនបានសម្រេច: ' + e.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. INTEGRATION WITH EXISTING SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace existing 1-Click VoxCPM function
   */
  window.triggerOneClickVoxcpmDubbing = function() {
    // Open dual mode modal instead of old modal
    window.openVoxCPMDualModeModal();
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[VoxCPM Dual Mode System] Initialized');
    });
  } else {
    console.log('[VoxCPM Dual Mode System] Initialized');
  }

})();
