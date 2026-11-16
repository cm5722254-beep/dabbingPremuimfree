/**
 * ═══════════════════════════════════════════════════════════════════
 * ENHANCED UI INTEGRATION
 * រួមបញ្ចូលមុខងារថ្មីទាំងអស់ចូលក្នុង UI
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  console.log('[Enhanced UI] Initializing...');

  // ═══════════════════════════════════════════════════════════════════
  // 1. ADD NEW BUTTONS TO MAIN TOOLBAR
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បន្ថែម Enhanced Features buttons
   */
  function addEnhancedFeatureButtons() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addEnhancedFeatureButtons);
      return;
    }

    // Find the main button container (near dub button)
    const dubButton = document.getElementById('dubsel');
    if (!dubButton) {
      console.warn('[Enhanced UI] Dub button not found, retrying...');
      setTimeout(addEnhancedFeatureButtons, 1000);
      return;
    }

    const buttonContainer = dubButton.parentElement;
    if (!buttonContainer) return;

    // Check if buttons already added
    if (document.getElementById('btnEnhancedVoxCPM')) {
      console.log('[Enhanced UI] Buttons already added');
      return;
    }

    // Create separator
    const separator1 = document.createElement('div');
    separator1.style.cssText = 'width:1px;height:20px;background:var(--line);opacity:.6;';
    buttonContainer.appendChild(separator1);

    // Button 1: Enhanced VoxCPM (Dual Mode)
    const btnVoxCPM = document.createElement('button');
    btnVoxCPM.id = 'btnEnhancedVoxCPM';
    btnVoxCPM.className = 'b';
    btnVoxCPM.onclick = () => {
      window.openVoxCPMDualModeModal();
    };
    btnVoxCPM.title = 'VoxCPM Dual Mode: Clone ពីរឿងដើម ឬពីបណ្ណាល័យ';
    btnVoxCPM.style.cssText = 'gap:5px;background:rgba(124,58,237,0.12);color:#a855f7;border-color:rgba(124,58,237,0.35);';
    btnVoxCPM.innerHTML = `
      <svg class="i" style="width:16px;height:16px;"><use href="#mic"/></svg>
      <span>VoxCPM Pro</span>
      <span style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;background:rgba(124,58,237,0.18);letter-spacing:.04em;">2 MODES</span>
    `;
    buttonContainer.appendChild(btnVoxCPM);

    // Create separator
    const separator2 = document.createElement('div');
    separator2.style.cssText = 'width:1px;height:20px;background:var(--line);opacity:.6;';
    buttonContainer.appendChild(separator2);

    // Button 2: Missing Line Checker
    const btnMissingLines = document.createElement('button');
    btnMissingLines.id = 'btnMissingLines';
    btnMissingLines.className = 'b';
    btnMissingLines.onclick = () => {
      window.showMissingLinesReport();
    };
    btnMissingLines.title = 'ពិនិត្យឃ្លាដែលមិនទាន់បកប្រែ ឬមិនទាន់កំណត់សំឡេង';
    btnMissingLines.style.cssText = 'gap:5px;background:rgba(251,146,60,0.12);color:#fb923c;border-color:rgba(251,146,60,0.35);';
    btnMissingLines.innerHTML = `
      <svg class="i" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <span>ពិនិត្យឃ្លា</span>
      <span id="missingLinesBadge" style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;background:rgba(251,146,60,0.18);letter-spacing:.04em;display:none;">!</span>
    `;
    buttonContainer.appendChild(btnMissingLines);

    // Create separator
    const separator3 = document.createElement('div');
    separator3.style.cssText = 'width:1px;height:20px;background:var(--line);opacity:.6;';
    buttonContainer.appendChild(separator3);

    // Button 3: Audio Enhancement Settings
    const btnAudioSettings = document.createElement('button');
    btnAudioSettings.id = 'btnAudioSettings';
    btnAudioSettings.className = 'b';
    btnAudioSettings.onclick = () => {
      window.openAudioEnhancementSettings();
    };
    btnAudioSettings.title = 'កំណត់គុណភាពសំឡេង: Voice Clarity, BGM Boost, Auto-Ducking';
    btnAudioSettings.style.cssText = 'gap:5px;background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.35);';
    btnAudioSettings.innerHTML = `
      <svg class="i" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1v6m0 6v6m-8-3h6m6 0h6m-3-9l-4 4m-4-4l4 4m4 4l-4-4m-4 4l4-4"/>
      </svg>
      <span>Audio Pro</span>
      <span style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.18);letter-spacing:.04em;">48kHz</span>
    `;
    buttonContainer.appendChild(btnAudioSettings);

    // Create separator
    const separator4 = document.createElement('div');
    separator4.style.cssText = 'width:1px;height:20px;background:var(--line);opacity:.6;';
    buttonContainer.appendChild(separator4);

    // Button 4: Voice Library
    const btnVoiceLibrary = document.createElement('button');
    btnVoiceLibrary.id = 'btnVoiceLibrary';
    btnVoiceLibrary.className = 'b';
    btnVoiceLibrary.onclick = () => {
      if (typeof window.openEnhancedVoiceLibrary === 'function') {
        window.openEnhancedVoiceLibrary();
      } else if (typeof window.openVoiceLibraryModal === 'function') {
        window.openVoiceLibraryModal();
      } else {
        alert('Voice Library មិនទាន់ផ្ទុកទេ');
      }
    };
    btnVoiceLibrary.title = 'បណ្ណាល័យសំឡេង: គ្រប់គ្រងសំឡេងសម្រាប់ voice cloning';
    btnVoiceLibrary.style.cssText = 'gap:5px;background:rgba(139,92,246,0.12);color:#a855f7;border-color:rgba(139,92,246,0.35);';
    btnVoiceLibrary.innerHTML = `
      <svg class="i" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6l3-3h12l3 3v12l-3 3H6l-3-3V6z"/>
        <path d="M12 8v8m-4-4h8"/>
      </svg>
      <span>បណ្ណាល័យ</span>
      <span id="voiceLibraryCount" style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;background:rgba(139,92,246,0.18);letter-spacing:.04em;">0</span>
    `;
    buttonContainer.appendChild(btnVoiceLibrary);

    console.log('[Enhanced UI] Added all feature buttons to toolbar');

    // Update voice library count
    updateVoiceLibraryCount();
    
    // Update missing lines badge periodically
    setInterval(updateMissingLinesBadge, 5000);
  }

  /**
   * Update voice library count badge
   */
  async function updateVoiceLibraryCount() {
    try {
      const res = await fetch('/api/voice-library');
      const data = await res.json();
      
      const badge = document.getElementById('voiceLibraryCount');
      if (badge && data.success && data.voices) {
        badge.textContent = data.voices.length;
      }
    } catch (e) {
      console.error('[Enhanced UI] Failed to update voice library count:', e);
    }
  }

  /**
   * Update missing lines badge
   */
  function updateMissingLinesBadge() {
    if (typeof window.detectMissingLines !== 'function') return;
    
    const analysis = window.detectMissingLines();
    const missingCount = analysis.untranslated.length + analysis.unvoiced.length;
    
    const badge = document.getElementById('missingLinesBadge');
    if (badge) {
      if (missingCount > 0) {
        badge.style.display = 'inline';
        badge.textContent = missingCount;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. ADD FLOATING ACTION BUTTON (FAB) MENU
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បង្កើត Floating Action Button សម្រាប់ quick access
   */
  function createFloatingActionButton() {
    // Check if already exists
    if (document.getElementById('enhancedFAB')) return;

    const fab = document.createElement('div');
    fab.id = 'enhancedFAB';
    fab.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-end;
    `;

    // Main FAB button
    const mainButton = document.createElement('button');
    mainButton.id = 'fabMainButton';
    mainButton.style.cssText = `
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      border: none;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      transition: all 0.3s;
    `;
    mainButton.innerHTML = '⚡';
    mainButton.title = 'Enhanced Features Menu';
    mainButton.onclick = () => toggleFABMenu();
    
    // FAB Menu (initially hidden)
    const fabMenu = document.createElement('div');
    fabMenu.id = 'fabMenu';
    fabMenu.style.cssText = `
      display: none;
      flex-direction: column;
      gap: 8px;
    `;

    // Menu items
    const menuItems = [
      {
        id: 'fabVoxCPM',
        icon: '🎙️',
        label: 'VoxCPM Dual Mode',
        color: '#7c3aed',
        onclick: () => {
          toggleFABMenu();
          window.openVoxCPMDualModeModal();
        }
      },
      {
        id: 'fabMissingLines',
        icon: '📋',
        label: 'ពិនិត្យឃ្លា',
        color: '#fb923c',
        onclick: () => {
          toggleFABMenu();
          window.showMissingLinesReport();
        }
      },
      {
        id: 'fabAudioSettings',
        icon: '🎚️',
        label: 'Audio Quality',
        color: '#10b981',
        onclick: () => {
          toggleFABMenu();
          window.openAudioEnhancementSettings();
        }
      },
      {
        id: 'fabVoiceLibrary',
        icon: '📚',
        label: 'បណ្ណាល័យសំឡេង',
        color: '#8b5cf6',
        onclick: () => {
          toggleFABMenu();
          if (typeof window.openEnhancedVoiceLibrary === 'function') {
            window.openEnhancedVoiceLibrary();
          } else if (typeof window.openVoiceLibraryModal === 'function') {
            window.openVoiceLibraryModal();
          }
        }
      }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.id = item.id;
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-radius: 24px;
        background: ${item.color};
        border: none;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        white-space: nowrap;
      `;
      menuItem.innerHTML = `
        <span style="font-size: 18px;">${item.icon}</span>
        <span>${item.label}</span>
      `;
      menuItem.onclick = item.onclick;
      menuItem.onmouseenter = () => {
        menuItem.style.transform = 'translateX(-4px)';
        menuItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      };
      menuItem.onmouseleave = () => {
        menuItem.style.transform = 'translateX(0)';
        menuItem.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      };
      
      fabMenu.appendChild(menuItem);
    });

    fab.appendChild(fabMenu);
    fab.appendChild(mainButton);

    document.body.appendChild(fab);

    console.log('[Enhanced UI] Created floating action button');
  }

  /**
   * Toggle FAB menu
   */
  window.toggleFABMenu = function() {
    const menu = document.getElementById('fabMenu');
    const button = document.getElementById('fabMainButton');
    
    if (!menu || !button) return;
    
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      button.innerHTML = '✕';
      button.style.transform = 'rotate(90deg)';
    } else {
      menu.style.display = 'none';
      button.innerHTML = '⚡';
      button.style.transform = 'rotate(0deg)';
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. ADD KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+V: Open VoxCPM Dual Mode
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        window.openVoxCPMDualModeModal();
      }
      
      // Ctrl+Shift+M: Open Missing Lines Report
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        window.showMissingLinesReport();
      }
      
      // Ctrl+Shift+A: Open Audio Enhancement Settings
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        window.openAudioEnhancementSettings();
      }
      
      // Ctrl+Shift+L: Open Voice Library
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        if (typeof window.openEnhancedVoiceLibrary === 'function') {
          window.openEnhancedVoiceLibrary();
        } else if (typeof window.openVoiceLibraryModal === 'function') {
          window.openVoiceLibraryModal();
        }
      }
    });

    console.log('[Enhanced UI] Keyboard shortcuts enabled');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. ADD STATUS INDICATOR
  // ═══════════════════════════════════════════════════════════════════

  /**
   * បង្កើត status indicator សម្រាប់បង្ហាញស្ថានភាព
   */
  function createStatusIndicator() {
    // Check if already exists
    if (document.getElementById('enhancedStatusIndicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'enhancedStatusIndicator';
    indicator.style.cssText = `
      position: fixed;
      top: 60px;
      right: 16px;
      z-index: 9998;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11px;
      color: var(--text);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: none;
      max-width: 300px;
    `;

    document.body.appendChild(indicator);

    // Auto-hide after 3 seconds
    window.showStatusIndicator = function(message, type = 'info') {
      indicator.style.display = 'block';
      
      let bgColor = 'rgba(59, 130, 246, 0.1)';
      let borderColor = 'rgba(59, 130, 246, 0.3)';
      let textColor = '#3b82f6';
      
      if (type === 'success') {
        bgColor = 'rgba(16, 185, 129, 0.1)';
        borderColor = 'rgba(16, 185, 129, 0.3)';
        textColor = '#10b981';
      } else if (type === 'error') {
        bgColor = 'rgba(239, 68, 68, 0.1)';
        borderColor = 'rgba(239, 68, 68, 0.3)';
        textColor = '#ef4444';
      } else if (type === 'warning') {
        bgColor = 'rgba(251, 146, 60, 0.1)';
        borderColor = 'rgba(251, 146, 60, 0.3)';
        textColor = '#fb923c';
      }
      
      indicator.style.background = bgColor;
      indicator.style.borderColor = borderColor;
      indicator.style.color = textColor;
      indicator.textContent = message;
      
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000);
    };

    console.log('[Enhanced UI] Status indicator created');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Initialize all UI enhancements
   */
  function initializeEnhancedUI() {
    console.log('[Enhanced UI] Starting initialization...');
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeEnhancedUI);
      return;
    }

    // Add feature buttons to toolbar
    addEnhancedFeatureButtons();

    // Create floating action button
    setTimeout(() => {
      createFloatingActionButton();
    }, 1000);

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Create status indicator
    createStatusIndicator();

    // Log initialization complete
    console.log('[Enhanced UI] ✓ All UI enhancements initialized');
    
    // Show welcome message
    setTimeout(() => {
      if (typeof window.showStatusIndicator === 'function') {
        window.showStatusIndicator('🎉 Enhanced Features activated!', 'success');
      }
    }, 2000);
  }

  // Start initialization
  initializeEnhancedUI();

  // Also try again after a delay (in case DOM wasn't ready)
  setTimeout(initializeEnhancedUI, 2000);

})();

/**
 * ═══════════════════════════════════════════════════════════════════
 * KEYBOARD SHORTCUTS REFERENCE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Ctrl+Shift+V - បើក VoxCPM Dual Mode
 * Ctrl+Shift+M - បើក Missing Lines Report
 * Ctrl+Shift+A - បើក Audio Enhancement Settings
 * Ctrl+Shift+L - បើក Voice Library
 * 
 * ═══════════════════════════════════════════════════════════════════
 */
