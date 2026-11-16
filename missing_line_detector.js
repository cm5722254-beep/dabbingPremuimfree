/**
 * ═══════════════════════════════════════════════════════════════════
 * MISSING LINE DETECTOR & AUTO-FIXER
 * រកឃើញឃ្លាដែលមិនទាន់បកប្រែ ឬមិនទាន់បញ្ចូលសំឡេង
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. MISSING LINE DETECTION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * វិភាគឃ្លាទាំងអស់ និងរកឃើញឃ្លាដែលខ្វះ
   */
  window.detectMissingLines = function() {
    if (!window.subtitleDB || window.subtitleDB.length === 0) {
      return {
        total: 0,
        untranslated: [],
        unvoiced: [],
        ready: []
      };
    }
    
    const result = {
      total: window.subtitleDB.length,
      untranslated: [],
      unvoiced: [],
      ready: []
    };
    
    window.subtitleDB.forEach((line, index) => {
      const lineInfo = {
        index: index,
        id: line.id,
        originalText: line.originalText || line.text,
        translatedText: line.kh || line.text,
        speakerTag: line.speakerTag,
        hasTranslation: false,
        hasVoice: false,
        hasAudio: false
      };
      
      // Check translation
      if (line.kh && line.kh.trim() !== '' && line.kh !== line.text) {
        lineInfo.hasTranslation = true;
      }
      
      // Check voice assignment
      if (line.speakerTag && window.characterVoiceAssignment && window.characterVoiceAssignment[line.speakerTag]) {
        lineInfo.hasVoice = true;
      }
      
      // Check audio file
      if (line.audioFile || line.dubbedAudio) {
        lineInfo.hasAudio = true;
      }
      
      // Categorize
      if (!lineInfo.hasTranslation) {
        result.untranslated.push(lineInfo);
      } else if (!lineInfo.hasVoice) {
        result.unvoiced.push(lineInfo);
      } else if (lineInfo.hasTranslation && lineInfo.hasVoice) {
        result.ready.push(lineInfo);
      }
    });
    
    console.log('[Missing Line Detector] Analysis:', {
      total: result.total,
      untranslated: result.untranslated.length,
      unvoiced: result.unvoiced.length,
      ready: result.ready.length
    });
    
    return result;
  };

  /**
   * បង្ហាញ Missing Lines Report Modal
   */
  window.showMissingLinesReport = function() {
    const analysis = detectMissingLines();
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'missingLinesReportModal';
    modal.style.zIndex = '10002';
    
    const hasIssues = analysis.untranslated.length > 0 || analysis.unvoiced.length > 0;
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 800px; width: 95%; max-height: 85vh;">
        <div class="modal-header" style="background: ${hasIssues ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.12), rgba(239, 68, 68, 0.12))' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.12))';}">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, ${hasIssues ? '#fb923c, #ef4444' : '#10b981, #059669'}); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              ${hasIssues ? '⚠️' : '✅'}
            </div>
            <div>
              <div class="modal-title" style="font-size: 15px;">រាយការណ៍ឃ្លា (Line Status Report)</div>
              <div style="font-size: 11px; color: var(--muted);">ពិនិត្យឃ្លាដែលនៅខ្វះ និងឃ្លាដែលរួចរាល់</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeMissingLinesReport()">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; overflow-y: auto; max-height: calc(85vh - 140px);">
          <!-- Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            <!-- Total Lines -->
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${analysis.total}</div>
              <div style="font-size: 11px; color: var(--text); margin-top: 4px;">ឃ្លាសរុប</div>
            </div>
            
            <!-- Ready Lines -->
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #10b981;">${analysis.ready.length}</div>
              <div style="font-size: 11px; color: var(--text); margin-top: 4px;">រួចរាល់</div>
            </div>
            
            <!-- Missing Lines -->
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${analysis.untranslated.length + analysis.unvoiced.length}</div>
              <div style="font-size: 11px; color: var(--text); margin-top: 4px;">មិនទាន់រួច</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; font-weight: 600; color: var(--text);">ភាពរួចរាល់ (Progress)</span>
              <span style="font-size: 12px; font-weight: 700; color: #10b981;">${Math.round((analysis.ready.length / analysis.total) * 100)}%</span>
            </div>
            <div style="width: 100%; height: 10px; background: var(--soft); border-radius: 10px; overflow: hidden; border: 1px solid var(--line);">
              <div style="height: 100%; background: linear-gradient(90deg, #10b981, #059669); width: ${(analysis.ready.length / analysis.total) * 100}%; transition: width 0.3s;"></div>
            </div>
          </div>

          ${analysis.untranslated.length > 0 ? `
            <!-- Untranslated Lines -->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text);">❌ ឃ្លាមិនទាន់បកប្រែ (${analysis.untranslated.length})</div>
                <button class="btn-primary" onclick="autoTranslateMissingLines()" style="font-size: 11px; padding: 5px 12px;">
                  🤖 Auto-Translate
                </button>
              </div>
              <div style="max-height: 200px; overflow-y: auto; background: var(--soft); border-radius: 8px; border: 1px solid var(--line); padding: 10px;">
                ${analysis.untranslated.slice(0, 10).map(line => `
                  <div style="padding: 6px 8px; margin-bottom: 6px; background: var(--panel); border-radius: 6px; border-left: 3px solid #ef4444;">
                    <div style="font-size: 10.5px; color: var(--muted); margin-bottom: 2px;">Line ${line.index + 1} • ${line.speakerTag || 'Unknown'}</div>
                    <div style="font-size: 11px; color: var(--text);">${line.originalText || 'No text'}</div>
                  </div>
                `).join('')}
                ${analysis.untranslated.length > 10 ? `<div style="text-align: center; font-size: 10px; color: var(--muted); margin-top: 6px;">...និង ${analysis.untranslated.length - 10} ឃ្លាទៀត</div>` : ''}
              </div>
            </div>
          ` : ''}

          ${analysis.unvoiced.length > 0 ? `
            <!-- Unvoiced Lines -->
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text);">🔇 ឃ្លាមិនទាន់កំណត់សំឡេង (${analysis.unvoiced.length})</div>
                <button class="btn-primary" onclick="autoAssignVoicesToLines()" style="font-size: 11px; padding: 5px 12px;">
                  🎙️ Auto-Assign
                </button>
              </div>
              <div style="max-height: 200px; overflow-y: auto; background: var(--soft); border-radius: 8px; border: 1px solid var(--line); padding: 10px;">
                ${analysis.unvoiced.slice(0, 10).map(line => `
                  <div style="padding: 6px 8px; margin-bottom: 6px; background: var(--panel); border-radius: 6px; border-left: 3px solid #fb923c;">
                    <div style="font-size: 10.5px; color: var(--muted); margin-bottom: 2px;">Line ${line.index + 1} • ${line.speakerTag || 'Unknown'}</div>
                    <div style="font-size: 11px; color: var(--text);">${line.translatedText}</div>
                  </div>
                `).join('')}
                ${analysis.unvoiced.length > 10 ? `<div style="text-align: center; font-size: 10px; color: var(--muted); margin-top: 6px;">...និង ${analysis.unvoiced.length - 10} ឃ្លាទៀត</div>` : ''}
              </div>
            </div>
          ` : ''}

          ${!hasIssues ? `
            <!-- All Good -->
            <div style="padding: 20px; background: rgba(16, 185, 129, 0.08); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.25); text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
              <div style="font-size: 14px; font-weight: 700; color: #10b981; margin-bottom: 6px;">រួចរាល់ទាំងអស់!</div>
              <div style="font-size: 11px; color: var(--text); opacity: 0.9;">ឃ្លាទាំងអស់បានបកប្រែ និងកំណត់សំឡេងរួចរាល់<br>អ្នកអាចចាប់ផ្តើម Dubbing ឥឡូវនេះ</div>
            </div>
          ` : ''}
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11px; color: var(--muted);">
            ${hasIssues ? '⚠️ សូមដោះស្រាយបញ្ហាមុនពេល Dubbing' : '✓ ត្រៀមរួចសម្រាប់ Dubbing'}
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" onclick="closeMissingLinesReport()">បិទ</button>
            ${!hasIssues ? `<button class="btn-primary" onclick="closeMissingLinesReport(); startVoxCPMDubbing()">ចាប់ផ្តើម Dubbing</button>` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  /**
   * បិទ Modal
   */
  window.closeMissingLinesReport = function() {
    const modal = document.getElementById('missingLinesReportModal');
    if (modal) {
      modal.remove();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. AUTO-FIX MISSING LINES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Auto-translate missing lines
   */
  window.autoTranslateMissingLines = async function() {
    const analysis = detectMissingLines();
    
    if (analysis.untranslated.length === 0) {
      showToast('✅ ឃ្លាទាំងអស់បានបកប្រែរួចហើយ');
      return;
    }
    
    showToast(`🤖 កំពុងបកប្រែ ${analysis.untranslated.length} ឃ្លា...`);
    
    try {
      // Call translation API for each untranslated line
      let translated = 0;
      
      for (const lineInfo of analysis.untranslated) {
        const line = window.subtitleDB[lineInfo.index];
        
        if (!line.text || line.text.trim() === '') continue;
        
        // Call translation API
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text,
            targetLang: 'km'
          })
        });
        
        const data = await res.json();
        
        if (data.success && data.translated) {
          line.kh = data.translated;
          translated++;
          console.log('[Auto-Translate] Line', lineInfo.index + 1, 'translated');
        }
      }
      
      showToast(`✅ បានបកប្រែ ${translated} ឃ្លាជោគជ័យ`);
      
      // Refresh report
      closeMissingLinesReport();
      setTimeout(() => showMissingLinesReport(), 500);
    } catch (e) {
      console.error('[Auto-Translate] Failed:', e);
      showToast('❌ មិនអាចបកប្រែបានទេ: ' + e.message);
    }
  };

  /**
   * Auto-assign voices to lines
   */
  window.autoAssignVoicesToLines = function() {
    const analysis = detectMissingLines();
    
    if (analysis.unvoiced.length === 0) {
      showToast('✅ ឃ្លាទាំងអស់បានកំណត់សំឡេងរួចហើយ');
      return;
    }
    
    // Auto-assign voices from character assignment
    analysis.unvoiced.forEach(lineInfo => {
      const line = window.subtitleDB[lineInfo.index];
      
      if (line.speakerTag && window.characterVoiceAssignment[line.speakerTag]) {
        line.assignedVoice = window.characterVoiceAssignment[line.speakerTag];
        console.log('[Auto-Assign] Line', lineInfo.index + 1, 'assigned voice');
      }
    });
    
    showToast(`✅ បានកំណត់សំឡេងសម្រាប់ឃ្លាដែលខ្វះ`);
    
    // Refresh report
    closeMissingLinesReport();
    setTimeout(() => showMissingLinesReport(), 500);
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. VALIDATION BEFORE DUBBING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Validate subtitles before dubbing
   */
  window.validateSubtitlesForDubbing = function() {
    const analysis = detectMissingLines();
    
    const validation = {
      isValid: false,
      errors: [],
      warnings: [],
      stats: {
        total: analysis.total,
        ready: analysis.ready.length,
        untranslated: analysis.untranslated.length,
        unvoiced: analysis.unvoiced.length
      }
    };
    
    // Check for errors
    if (analysis.untranslated.length > 0) {
      validation.errors.push(`មានឃ្លា ${analysis.untranslated.length} មិនទាន់បកប្រែ`);
    }
    
    if (analysis.unvoiced.length > 0) {
      validation.errors.push(`មានឃ្លា ${analysis.unvoiced.length} មិនទាន់កំណត់សំឡេង`);
    }
    
    // Check for warnings
    if (analysis.total === 0) {
      validation.errors.push('មិនមានឃ្លាក្នុង subtitle');
    }
    
    if (!window.characterVoiceAssignment || Object.keys(window.characterVoiceAssignment).length === 0) {
      validation.errors.push('មិនទាន់កំណត់សំឡេងតួអង្គ');
    }
    
    validation.isValid = validation.errors.length === 0;
    
    return validation;
  };

  /**
   * Show validation modal before dubbing
   */
  window.showValidationBeforeDubbing = function(callback) {
    const validation = validateSubtitlesForDubbing();
    
    if (validation.isValid) {
      // All good, proceed
      if (callback) callback();
      return true;
    }
    
    // Show validation errors
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'validationModal';
    modal.style.zIndex = '10003';
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.12));">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #ef4444, #dc2626); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              ⚠️
            </div>
            <div>
              <div class="modal-title" style="font-size: 15px;">មិនអាចចាប់ផ្តើម Dubbing</div>
              <div style="font-size: 11px; color: var(--muted);">សូមដោះស្រាយបញ្ហាខាងក្រោម</div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeValidationModal()">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12.5px; font-weight: 700; color: #ef4444; margin-bottom: 8px;">❌ បញ្ហារកឃើញ:</div>
            ${validation.errors.map(err => `
              <div style="padding: 8px 10px; margin-bottom: 6px; background: rgba(239, 68, 68, 0.08); border-radius: 6px; border-left: 3px solid #ef4444; font-size: 11px; color: var(--text);">
                • ${err}
              </div>
            `).join('')}
          </div>

          <div style="padding: 12px; background: rgba(59, 130, 246, 0.08); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25);">
            <div style="font-size: 11px; font-weight: 600; color: #3b82f6; margin-bottom: 6px;">💡 ដំណោះស្រាយ:</div>
            <div style="font-size: 10.5px; color: var(--text); line-height: 1.5;">
              1. ចុច "មើលរាយការណ៍" ដើម្បីពិនិត្យឃ្លាដែលខ្វះ<br>
              2. ប្រើ Auto-Translate និង Auto-Assign<br>
              3. បន្ទាប់មកព្យាយាម Dubbing ម្តងទៀត
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-secondary" onclick="closeValidationModal()">បោះបង់</button>
          <button class="btn-primary" onclick="closeValidationModal(); showMissingLinesReport()">
            📋 មើលរាយការណ៍
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    return false;
  };

  /**
   * Close validation modal
   */
  window.closeValidationModal = function() {
    const modal = document.getElementById('validationModal');
    if (modal) {
      modal.remove();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. INTEGRATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Override start dubbing to validate first
   */
  const originalStartDubbing = window.startVoxCPMDubbing;
  
  window.startVoxCPMDubbing = function() {
    // Validate first
    if (!showValidationBeforeDubbing(originalStartDubbing)) {
      console.log('[Validation] Dubbing blocked due to validation errors');
      return;
    }
    
    // Proceed with original function
    if (originalStartDubbing) {
      originalStartDubbing();
    }
  };

  console.log('[Missing Line Detector] System loaded');

})();
