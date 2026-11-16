/**
 * ═══════════════════════════════════════════════════════════════════
 * VOICE CONSISTENCY ENFORCER v1.0
 * ធ្វើឱ្យតួអង្គមួយ = សំឡេងមួយ (100% Consistent)
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. VOICE MAPPING VALIDATOR
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Validate that each character has exactly ONE voice
   */
  window.validateVoiceConsistency = function(characterVoiceMap) {
    const issues = [];
    const voiceUsage = {};
    
    // Build voice usage map
    Object.entries(characterVoiceMap).forEach(([charId, assignment]) => {
      const voiceKey = assignment.source || assignment.voiceName || 'unknown';
      
      if (!voiceUsage[voiceKey]) {
        voiceUsage[voiceKey] = [];
      }
      voiceUsage[voiceKey].push({
        character: charId,
        voiceName: assignment.voiceName,
        mode: assignment.mode
      });
    });
    
    // Check for duplicates (one voice used by multiple characters)
    Object.entries(voiceUsage).forEach(([voiceKey, chars]) => {
      if (chars.length > 1) {
        issues.push({
          type: 'DUPLICATE_VOICE',
          severity: 'HIGH',
          voice: voiceKey,
          characters: chars.map(c => c.character),
          message: `សំឡេង "${voiceKey}" ត្រូវបានប្រើដោយតួអង្គ ${chars.length} នាក់: ${chars.map(c => c.character).join(', ')}`
        });
      }
    });
    
    // Check for characters without voices
    if (window.subtitleDB && window.subtitleDB.length > 0) {
      const allSpeakers = new Set();
      window.subtitleDB.forEach(line => {
        if (line.speakerTag) allSpeakers.add(line.speakerTag);
      });
      
      allSpeakers.forEach(speaker => {
        if (!characterVoiceMap[speaker]) {
          issues.push({
            type: 'MISSING_VOICE',
            severity: 'CRITICAL',
            character: speaker,
            message: `តួអង្គ "${speaker}" មិនទាន់កំណត់សំឡេងទេ`
          });
        }
      });
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      voiceUsage: voiceUsage
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. AUTO-FIX VOICE CONFLICTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Automatically fix voice assignment conflicts
   */
  window.autoFixVoiceConflicts = async function() {
    if (!window.characterVoiceAssignment) {
      showToast('⚠️ មិនមាន voice assignments ទេ');
      return;
    }
    
    const validation = validateVoiceConsistency(window.characterVoiceAssignment);
    
    if (validation.isValid) {
      showToast('✅ គ្មានបញ្ហា! គ្រប់តួអង្គមានសំឡេងខ្លួនឯង');
      return;
    }
    
    showToast('🔧 កំពុងដោះស្រាយបញ្ហាសំឡេង...');
    
    let fixedCount = 0;
    
    // Fix duplicate voices by reassigning
    validation.issues.forEach(issue => {
      if (issue.type === 'DUPLICATE_VOICE' && issue.characters.length > 1) {
        // Keep first character's assignment, reassign others from original movie
        const keepChar = issue.characters[0];
        const reassignChars = issue.characters.slice(1);
        
        reassignChars.forEach(charId => {
          window.characterVoiceAssignment[charId] = {
            mode: 'clone_from_original',
            source: 'auto_detected',
            voiceName: `${charId} (Auto-Fixed ពីរឿងដើម)`,
            isAutoFixed: true
          };
          fixedCount++;
        });
      }
    });
    
    // Fix missing voices
    validation.issues.forEach(issue => {
      if (issue.type === 'MISSING_VOICE') {
        window.characterVoiceAssignment[issue.character] = {
          mode: 'clone_from_original',
          source: 'auto_detected',
          voiceName: `${issue.character} (Auto-Added ពីរឿងដើម)`,
          isAutoFixed: true
        };
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {
      showToast(`✅ បានដោះស្រាយបញ្ហា ${fixedCount} ករណី`);
      console.log('[Voice Consistency] Fixed', fixedCount, 'issues');
      
      // Re-validate
      const newValidation = validateVoiceConsistency(window.characterVoiceAssignment);
      if (!newValidation.isValid) {
        console.warn('[Voice Consistency] Still have issues:', newValidation.issues);
      }
    } else {
      showToast('⚠️ មិនអាចដោះស្រាយដោយស្វ័យប្រវត្តិបានទេ');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. VOICE CONSISTENCY REPORT UI
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Show voice consistency report
   */
  window.showVoiceConsistencyReport = function() {
    if (!window.characterVoiceAssignment) {
      showToast('⚠️ មិនមាន voice assignments ទេ');
      return;
    }
    
    const validation = validateVoiceConsistency(window.characterVoiceAssignment);
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.id = 'voiceConsistencyModal';
    modal.style.zIndex = '10006';
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 800px; width: 95%;">
        <div class="modal-header" style="background: linear-gradient(135deg, ${validation.isValid ? 'rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.12)' : 'rgba(251, 146, 60, 0.12), rgba(239, 68, 68, 0.12)'});">
          <div class="modal-title-group">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, ${validation.isValid ? '#10b981, #059669' : '#fb923c, #ef4444'}); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
              ${validation.isValid ? '✅' : '⚠️'}
            </div>
            <div>
              <div class="modal-title">របាយការណ៍ Voice Consistency</div>
              <div style="font-size: 11px; color: var(--muted);">
                ${validation.isValid ? 'គ្មានបញ្ហា - តួអង្គមួយ = សំឡេងមួយ' : `រកឃើញបញ្ហា ${validation.issues.length} ករណី`}
              </div>
            </div>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('voiceConsistencyModal').remove()">✕</button>
        </div>

        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          ${validation.isValid ? `
            <div style="padding: 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <div style="font-size: 15px; font-weight: 700; color: #10b981; margin-bottom: 8px;">ល្អឥតខ្ចោះ!</div>
              <div style="font-size: 12px; color: var(--muted);">គ្រប់តួអង្គទាំងអស់មានសំឡេងផ្ទាល់ខ្លួន</div>
            </div>
            
            <div style="padding: 14px; background: var(--soft); border-radius: 8px;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 10px;">📊 ការកំណត់សំឡេង:</div>
              <div style="display: grid; gap: 8px;">
                ${Object.entries(window.characterVoiceAssignment).map(([charId, assignment]) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--panel); border-radius: 6px;">
                    <div style="font-size: 11px; color: var(--text); font-weight: 600;">${charId}</div>
                    <div style="font-size: 10px; color: var(--muted);">${assignment.voiceName || 'Unknown Voice'}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div style="padding: 14px; background: rgba(239, 68, 68, 0.08); border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(239, 68, 68, 0.25);">
              <div style="font-size: 13px; font-weight: 600; color: #ef4444; margin-bottom: 8px;">🚨 បញ្ហាដែលរកឃើញ:</div>
              <div style="display: grid; gap: 8px;">
                ${validation.issues.map(issue => `
                  <div style="padding: 10px 12px; background: var(--panel); border-radius: 6px; border-left: 3px solid ${issue.severity === 'CRITICAL' ? '#dc2626' : '#fb923c'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                      <span style="font-size: 10px; padding: 2px 6px; background: ${issue.severity === 'CRITICAL' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(251, 146, 60, 0.15)'}; color: ${issue.severity === 'CRITICAL' ? '#dc2626' : '#fb923c'}; border-radius: 3px; font-weight: 600;">
                        ${issue.type}
                      </span>
                      <span style="font-size: 10px; color: var(--muted);">${issue.severity}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text); line-height: 1.5;">
                      ${issue.message}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="padding: 14px; background: rgba(59, 130, 246, 0.08); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25);">
              <div style="font-size: 12px; font-weight: 700; color: #3b82f6; margin-bottom: 8px;">💡 ដំណោះស្រាយ:</div>
              <div style="font-size: 11px; color: var(--text); line-height: 1.6;">
                • ចុចប៊ូតុង "Auto-Fix" ខាងក្រោមដើម្បីដោះស្រាយដោយស្វ័យប្រវត្តិ<br>
                • ប្រព័ន្ធនឹងកំណត់សំឡេងពីរឿងដើមសម្រាប់តួអង្គដែលមានបញ្ហា<br>
                • សំឡេងនីមួយៗនឹងត្រូវបានប្រើសម្រាប់តួអង្គតែមួយប៉ុណ្ណោះ
              </div>
            </div>
          `}
        </div>

        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn-secondary" onclick="document.getElementById('voiceConsistencyModal').remove()">បិទ</button>
          ${!validation.isValid ? `
            <button class="btn-primary" onclick="autoFixVoiceConflicts(); document.getElementById('voiceConsistencyModal').remove(); setTimeout(showVoiceConsistencyReport, 500);">
              🔧 Auto-Fix បញ្ហា
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. INTEGRATION WITH VOXCPM SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Hook into VoxCPM dubbing to validate before starting
   */
  const originalStartDubbing = window.startVoxCPMDubbing;
  if (originalStartDubbing) {
    window.startVoxCPMDubbing = async function() {
      // Validate voice consistency first
      const validation = validateVoiceConsistency(window.characterVoiceAssignment || {});
      
      if (!validation.isValid) {
        const criticalIssues = validation.issues.filter(i => i.severity === 'CRITICAL');
        
        if (criticalIssues.length > 0) {
          showVoiceConsistencyReport();
          return; // Block dubbing
        } else {
          // Only warnings, show but allow to continue
          if (!confirm('⚠️ មានបញ្ហាសំឡេងខ្លះៗ។ តើចង់មើលរបាយការណ៍មុនបន្តទេ?')) {
            return originalStartDubbing.apply(this, arguments);
          } else {
            showVoiceConsistencyReport();
            return;
          }
        }
      }
      
      // All good, proceed
      return originalStartDubbing.apply(this, arguments);
    };
  }

  // Initialize
  console.log('[Voice Consistency Enforcer] Initialized');

})();
