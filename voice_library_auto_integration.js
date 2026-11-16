/**
 * ═══════════════════════════════════════════════════════════════════
 * AUTO VOICE LIBRARY INTEGRATION WITH VOXCPM CHARACTER ASSIGNMENT
 * បង្ហាញសំឡេងទាំងអស់ពី voice_split_tool និង ភ្ជាប់ជាមួយ VoxCPM
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. AUTO-LOAD VOICES FROM voice_split_tool ON STARTUP
  // ផ្ទុកសំឡេងដោយស្វ័យប្រវត្តិពេលបើកកម្មវិធី
  // ═══════════════════════════════════════════════════════════════════

  let voiceLibraryCache = [];
  let voiceSplitToolCache = [];

  /**
   * ស្កេនសំឡេងពី voice_split_tool ដោយស្វ័យប្រវត្តិ
   */
  window.autoLoadVoiceLibrary = async function() {
    try {
      console.log('[Voice Library] Auto-loading voices from voice_split_tool...');
      
      // Scan voice_split_tool folder
      const scanRes = await fetch('/api/voice-library/scan');
      const scanData = await scanRes.json();
      
      if (scanData.success && scanData.voices) {
        voiceSplitToolCache = scanData.voices;
        console.log('[Voice Library] Found', scanData.voices.length, 'voices in voice_split_tool');
      }
      
      // Load existing library
      const libRes = await fetch('/api/voice-library');
      const libData = await libRes.json();
      
      if (libData.success && libData.voices) {
        voiceLibraryCache = libData.voices;
        console.log('[Voice Library] Loaded', libData.voices.length, 'voices from library');
      }
      
      // Auto-import new voices if library is empty
      if (voiceLibraryCache.length === 0 && voiceSplitToolCache.length > 0) {
        console.log('[Voice Library] Auto-importing voices into library...');
        await autoImportAllVoices();
      }
      
      return {
        scanned: voiceSplitToolCache.length,
        inLibrary: voiceLibraryCache.length
      };
    } catch (e) {
      console.error('[Voice Library] Auto-load failed:', e);
      return { scanned: 0, inLibrary: 0 };
    }
  };

  /**
   * បញ្ចូលសំឡេងទាំងអស់ដោយស្វ័យប្រវត្តិ
   */
  async function autoImportAllVoices() {
    let importedCount = 0;
    
    for (const voice of voiceSplitToolCache) {
      try {
        // Auto-detect character type from filename
        const characterType = detectCharacterTypeFromFilename(voice.filename);
        
        const res = await fetch('/api/voice-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: voice.filename,
            name: voice.name,
            characterType: characterType,
            gender: characterType.includes('ប្រុស') ? 'male' : 'female'
          })
        });
        
        if (res.ok) {
          importedCount++;
          console.log('[Voice Library] Auto-imported:', voice.name, '→', characterType);
        }
      } catch (e) {
        console.error('[Voice Library] Failed to import:', voice.name, e);
      }
    }
    
    if (importedCount > 0) {
      console.log('[Voice Library] Auto-imported', importedCount, 'voices successfully');
      
      // Reload library cache
      const libRes = await fetch('/api/voice-library');
      const libData = await libRes.json();
      if (libData.success) {
        voiceLibraryCache = libData.voices;
      }
    }
    
    return importedCount;
  }

  /**
   * វិភាគប្រភេទតួអង្គពីឈ្មោះឯកសារ
   */
  function detectCharacterTypeFromFilename(filename) {
    const lower = filename.toLowerCase();
    
    // Check for keywords
    if (lower.includes('male') || lower.includes('boy') || lower.includes('man')) {
      if (lower.includes('lead') || lower.includes('main') || lower.includes('hero')) {
        return 'ឯកប្រុស';
      }
      if (lower.includes('child') || lower.includes('kid') || lower.includes('young')) {
        return 'ក្មេងប្រុស';
      }
      if (lower.includes('old') || lower.includes('elder')) {
        return 'ចាស់';
      }
      if (lower.includes('villain') || lower.includes('bad') || lower.includes('evil')) {
        return 'កាច';
      }
      if (lower.includes('general') || lower.includes('commander') || lower.includes('boss')) {
        return 'មេទ័ព';
      }
      return 'ឯកប្រុស'; // Default male
    }
    
    if (lower.includes('female') || lower.includes('girl') || lower.includes('woman')) {
      if (lower.includes('lead') || lower.includes('main') || lower.includes('hero')) {
        return 'ឯកស្រី';
      }
      if (lower.includes('child') || lower.includes('kid') || lower.includes('young')) {
        return 'ក្មេងស្រី';
      }
      if (lower.includes('old') || lower.includes('elder')) {
        return 'ចាស់';
      }
      return 'ឯកស្រី'; // Default female
    }
    
    // Check for numbers (assume character ID)
    const numMatch = filename.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0]);
      // Odd numbers = male, Even = female (simple heuristic)
      return (num % 2 === 1) ? 'ឯកប្រុស' : 'ឯកស្រី';
    }
    
    return 'ឯកប្រុស'; // Default
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. ENHANCED VOICE LIBRARY UI WITH ALL VOICES VISIBLE
  // បង្ហាញសំឡេងទាំងអស់ក្នុង Voice Library
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បង្ហាញ Voice Library ជាមួយសំឡេងទាំងអស់
   */
  window.openEnhancedVoiceLibrary = async function() {
    // Auto-load if not loaded
    if (voiceLibraryCache.length === 0) {
      await window.autoLoadVoiceLibrary();
    }
    
    // Open modal
    if (typeof window.openVoiceLibraryModal === 'function') {
      window.openVoiceLibraryModal();
    } else {
      console.warn('[Voice Library] Modal function not found');
    }
  };

  /**
   * បង្ហាញសំឡេងទាំងអស់ក្នុង Character Assignment
   */
  window.showVoiceLibraryForCharacter = function(characterId) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'voiceSelectionModal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 700px; width: 90%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));">
          <div class="modal-title-group">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
              🎙️
            </div>
            <div>
              <div class="modal-title" style="font-size: 14px;">ជ្រើសរើសសំឡេងសម្រាប់តួអង្គ</div>
              <div style="font-size: 10.5px; color: var(--muted);">បណ្ណាល័យសំឡេង • ${voiceLibraryCache.length} សំឡេង</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('voiceSelectionModal').remove()">✕</button>
        </div>
        
        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 16px;">
          <div id="voiceSelectionList" style="display: grid; gap: 10px;"></div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('voiceSelectionModal').remove()">បោះបង់</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate voice list
    const listDiv = modal.querySelector('#voiceSelectionList');
    
    if (voiceLibraryCache.length === 0) {
      listDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted); font-size: 12px;">មិនមានសំឡេងនៅក្នុងបណ្ណាល័យ<br><button class="btn-primary" onclick="window.autoLoadVoiceLibrary().then(() => location.reload())" style="margin-top: 10px;">ស្កេនសំឡេង</button></div>';
      return;
    }
    
    voiceLibraryCache.forEach(voice => {
      const item = document.createElement('div');
      item.style.cssText = 'background: var(--soft); border-radius: 8px; padding: 12px; border: 1px solid var(--line); cursor: pointer; transition: all 0.2s;';
      item.onmouseenter = () => item.style.borderColor = '#8b5cf6';
      item.onmouseleave = () => item.style.borderColor = 'var(--line)';
      
      const characterTypeIcon = {
        'ឯកប្រុស': '👨',
        'ឯកស្រី': '👩',
        'ក្មេងប្រុស': '👦',
        'ក្មេងស្រី': '👧',
        'ចាស់': '👴',
        'កាច': '😈',
        'មេទ័ព': '⚔️'
      };
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px;">
              ${characterTypeIcon[voice.characterType] || '🎙️'} ${voice.name}
            </div>
            <div style="font-size: 10.5px; color: var(--muted);">
              ${voice.characterType} • ${voice.filename}
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-primary" onclick="playVoicePreview('${voice.filename}')" style="font-size: 11px; padding: 5px 10px;">▶️</button>
            <button class="btn-primary" onclick="selectVoiceForCharacter('${characterId}', '${voice.id}', '${voice.name}')" style="font-size: 11px; padding: 5px 12px;">រើស</button>
          </div>
        </div>
      `;
      
      listDiv.appendChild(item);
    });
  };

  /**
   * Play voice preview
   */
  window.playVoicePreview = function(filename) {
    const audio = new Audio(`/voice-library-files/${filename}`);
    audio.play().catch(e => {
      console.error('[Voice Preview] Failed to play:', e);
      alert('មិនអាចចាក់សំឡេងបានទេ');
    });
  };

  /**
   * Select voice for character
   */
  window.selectVoiceForCharacter = function(characterId, voiceId, voiceName) {
    console.log('[Character Assignment] Selected voice:', voiceName, 'for character:', characterId);
    
    // Update character voice in VoxCPM config
    if (window.voxcpmCharacterVoices) {
      window.voxcpmCharacterVoices[characterId] = {
        voiceId: voiceId,
        voiceName: voiceName,
        source: 'library'
      };
    }
    
    // Update UI if character selector exists
    const selector = document.querySelector(`[data-character-id="${characterId}"] .voice-name`);
    if (selector) {
      selector.textContent = voiceName;
    }
    
    // Close modal
    document.getElementById('voiceSelectionModal')?.remove();
    
    // Show success
    if (typeof showToast === 'function') {
      showToast(`✅ បានរើសសំឡេង: ${voiceName}`);
    } else {
      alert(`✅ បានរើសសំឡេង: ${voiceName}`);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. INTEGRATE WITH VOXCPM CHARACTER ASSIGNMENT
  // ភ្ជាប់ជាមួយប្រព័ន្ធកំណត់សំឡេងតួអង្គ
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បង្កើតប៊ូតុង "ជ្រើសពីបណ្ណាល័យ" ក្នុង Character Assignment UI
   */
  window.addVoiceLibraryButtonToCharacters = function() {
    // Find all character assignment sections
    const characterSections = document.querySelectorAll('[data-character-section]');
    
    characterSections.forEach(section => {
      const characterId = section.dataset.characterId;
      if (!characterId) return;
      
      // Check if button already exists
      if (section.querySelector('.voice-library-btn')) return;
      
      // Create button
      const btn = document.createElement('button');
      btn.className = 'btn-primary voice-library-btn';
      btn.style.cssText = 'font-size: 11px; padding: 6px 12px; margin-top: 8px;';
      btn.innerHTML = '📚 ជ្រើសពីបណ្ណាល័យសំឡេង';
      btn.onclick = () => window.showVoiceLibraryForCharacter(characterId);
      
      // Add to section
      const voiceSelector = section.querySelector('.voice-selector-container');
      if (voiceSelector) {
        voiceSelector.appendChild(btn);
      }
    });
  };

  /**
   * Get all available voices for dropdown
   */
  window.getAllAvailableVoices = function() {
    const voices = [
      // Edge-TTS
      { id: 'edgetts_piseth', name: 'ពិសិទ្ធ - Lead Male', type: 'edgetts', gender: 'male' },
      { id: 'edgetts_sreymom', name: 'ស្រីមុំ - Lead Female', type: 'edgetts', gender: 'female' }
    ];
    
    // Add Voice Library voices
    voiceLibraryCache.forEach(voice => {
      voices.push({
        id: `library_${voice.id}`,
        name: `${voice.name} (${voice.characterType})`,
        type: 'library',
        gender: voice.gender || 'unknown',
        libraryId: voice.id,
        filepath: voice.filepath
      });
    });
    
    return voices;
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. AUTO-INITIALIZE ON PAGE LOAD
  // ចាប់ផ្តើមដោយស្វ័យប្រវត្តិ
  // ═══════════════════════════════════════════════════════════════════

  async function initializeVoiceLibraryIntegration() {
    console.log('[Voice Library Integration] Initializing...');
    
    // Auto-load voices
    const result = await window.autoLoadVoiceLibrary();
    console.log('[Voice Library Integration] Loaded:', result);
    
    // Add buttons to character assignment (if exists)
    setTimeout(() => {
      window.addVoiceLibraryButtonToCharacters();
    }, 2000);
    
    // Refresh every 5 minutes to catch new voices
    setInterval(() => {
      window.autoLoadVoiceLibrary();
    }, 5 * 60 * 1000);
    
    console.log('[Voice Library Integration] Ready! Total voices:', voiceLibraryCache.length);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVoiceLibraryIntegration);
  } else {
    initializeVoiceLibraryIntegration();
  }

  setTimeout(initializeVoiceLibraryIntegration, 1500);

  console.log('[Voice Library Integration] Script loaded!');
})();

/**
 * ═══════════════════════════════════════════════════════════════════
 * USAGE INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1. ADD THIS SCRIPT TO dist/index.html AFTER voice_library_modal.html
 * 
 * 2. AUTOMATIC FEATURES:
 *    - Auto-scans voice_split_tool on startup
 *    - Auto-imports voices into library if empty
 *    - Shows all voices in Voice Library modal
 *    - Adds "Select from Library" button to character assignment
 * 
 * 3. MANUAL USAGE:
 *    // Open enhanced voice library
 *    window.openEnhancedVoiceLibrary()
 *    
 *    // Show voice selection for character
 *    window.showVoiceLibraryForCharacter('character_1')
 *    
 *    // Get all available voices
 *    const voices = window.getAllAvailableVoices()
 *    
 *    // Reload voices
 *    await window.autoLoadVoiceLibrary()
 * 
 * 4. WORKFLOW:
 *    Upload → Transcribe → Translate → Character Assignment
 *    → Click "📚 ជ្រើសពីបណ្ណាល័យសំឡេង" button
 *    → Select voice from library
 *    → Dub with selected voices
 * 
 * ═══════════════════════════════════════════════════════════════════
 */
