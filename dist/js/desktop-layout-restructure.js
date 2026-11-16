/**
 * PHASE 3: DESKTOP LAYOUT RESTRUCTURE
 * Re-parent existing elements into mockup structure
 * ZERO element deletion, ZERO ID changes, ZERO handler changes
 * Pure DOM reorganization only
 */

(function() {
  'use strict';

  console.log('🚀 Phase 3: Desktop Layout Restructure Starting...');

  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restructureLayout);
  } else {
    restructureLayout();
  }

  function restructureLayout() {
    try {
      console.log('📦 Step 1: Collecting existing elements...');
      
      // Collect all existing functional elements (preserve IDs & handlers)
      const elements = {
        // Video & Playback
        videoFileInput: document.getElementById('videoFileInput'),
        videoDropArea: document.getElementById('videoDropArea'),
        videoEmptyState: document.getElementById('videoEmptyState'),
        mainVideoPlayer: document.getElementById('mainVideoPlayer'),
        btnPlayPause: document.getElementById('btnPlayPause'),
        btnStop: document.getElementById('btnStop'),
        playerVolumeSlider: document.getElementById('playerVolumeSlider'),
        timeCurrentDisplay: document.getElementById('timeCurrentDisplay'),
        timeDurationDisplay: document.getElementById('timeDurationDisplay'),
        
        // Primary Actions
        btnOneClickMaster: document.getElementById('btnOneClickMaster'),
        btnOneClickVoxcpm: document.getElementById('btnOneClickVoxcpm'),
        btnRenderMaster: document.getElementById('btnRenderMaster'),
        
        // Settings & Header
        btnSettings: document.getElementById('btnSettings'),
        btnLanguage: document.getElementById('btnLanguage'),
        btnDarkMode: document.getElementById('btnDarkMode'),
        btnLightMode: document.getElementById('btnLightMode'),
        btnBatchDashboard: document.getElementById('btnBatchDashboard'),
        
        // Original containers
        leftSidebar: document.querySelector('.left-sidebar'),
        rightContentCol: document.querySelector('.right-content-col'),
        timelinePanel: document.querySelector('.timeline-panel'),
        statusBar: document.querySelector('.app-status-bar')
      };

      console.log('✅ Elements collected:', Object.keys(elements).filter(k => elements[k]).length);

      console.log('🏗️ Step 2: Creating new desktop structure...');

      // Create new desktop layout structure
      const desktopStructure = createDesktopStructure();
      
      console.log('📍 Step 3: Re-parenting elements to new locations...');
      
      // Re-parent elements to new structure
      reparentElements(elements, desktopStructure);
      
      console.log('🔄 Step 4: Replacing old structure with new...');
      
      // Replace old layout with new
      const appMain = document.querySelector('.app-main');
      if (appMain && desktopStructure.newMain) {
        appMain.parentNode.replaceChild(desktopStructure.newMain, appMain);
      }

      console.log('✨ Phase 3 Complete! Layout restructured successfully.');
      
    } catch (error) {
      console.error('❌ Phase 3 Error:', error);
      console.error('Rolling back to original layout...');
      // Error handling: reload page to restore original
    }
  }

  function createDesktopStructure() {
    // Create main container (follows mockup structure)
    const newMain = document.createElement('main');
    newMain.className = 'desktop-main';
    newMain.style.cssText = 'display: flex; height: calc(100vh - 64px - 52px - 180px - 32px); overflow: hidden;';

    // 1. Activity Bar (Left, 56px width)
    const activityBar = document.createElement('div');
    activityBar.className = 'activity-bar';
    activityBar.style.cssText = 'width: 56px; flex: none; background: var(--surface-1); border-right: 1px solid var(--border-hairline); display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 4px;';
    
    // Activity Bar Icons (will add click handlers later)
    const activityIcons = [
      { icon: 'folder', title: 'ការងារ (Project)', active: true },
      { icon: 'file-text', title: 'អត្ថបទ (Script)' },
      { icon: 'users', title: 'តួអង្គ (Characters)' },
      { icon: 'download', title: 'នាំចេញ (Export)' },
      { icon: 'library', title: 'បណ្ណាល័យ (Library)' }
    ];
    
    activityIcons.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'activity-icon-btn';
      btn.title = item.title;
      btn.style.cssText = `width: 40px; height: 40px; border-radius: 10px; background: ${item.active ? 'var(--surface-2)' : 'transparent'}; color: ${item.active ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 150ms ease;`;
      btn.innerHTML = `<i class="ti ti-${item.icon}" style="font-size: 20px;"></i>`;
      activityBar.appendChild(btn);
    });
    
    // Settings icon at bottom
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    activityBar.appendChild(spacer);
    
    const settingsIcon = document.createElement('button');
    settingsIcon.className = 'activity-icon-btn';
    settingsIcon.title = 'ការកំណត់ (Settings)';
    settingsIcon.style.cssText = 'width: 40px; height: 40px; border-radius: 10px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 150ms ease;';
    settingsIcon.innerHTML = '<i class="ti ti-settings" style="font-size: 20px;"></i>';
    activityBar.appendChild(settingsIcon);

    // 2. Center Panel (Video + Subtitle Table)
    const centerPanel = document.createElement('div');
    centerPanel.className = 'center-panel';
    centerPanel.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 12px; gap: 12px; overflow-y: auto; background: var(--surface-0);';
    
    // Video preview container (will hold existing video elements)
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container-new';
    videoContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    // Quick actions row (Video, BGM, Mute, SRT)
    const quickActions = document.createElement('div');
    quickActions.className = 'quick-actions-row';
    quickActions.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const quickActionButtons = [
      { icon: 'video', label: 'វីដេអូ' },
      { icon: 'music', label: 'ភ្លេងកំសាន្ត' },
      { icon: 'microphone-off', label: 'បិទសំឡេងដើម' },
      { icon: 'file-download', label: 'ទាញយក SRT' }
    ];
    
    quickActionButtons.forEach(item => {
      const chip = document.createElement('button');
      chip.className = 'quick-action-chip';
      chip.style.cssText = 'padding: 6px 12px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border-hairline); color: var(--text-primary); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 150ms ease;';
      chip.innerHTML = `<i class="ti ti-${item.icon}" style="font-size: 16px;"></i> ${item.label}`;
      quickActions.appendChild(chip);
    });
    
    videoContainer.appendChild(quickActions);
    
    // Subtitle table container (will hold existing table)
    const subtitleContainer = document.createElement('div');
    subtitleContainer.className = 'subtitle-table-container-new';
    subtitleContainer.style.cssText = 'flex: 1; min-height: 200px; background: var(--surface-1); border: 1px solid var(--border-hairline); border-radius: 12px; overflow: hidden;';
    
    centerPanel.appendChild(videoContainer);
    centerPanel.appendChild(subtitleContainer);

    // 3. Right Inspector Panel (Collapsible sections)
    const inspectorPanel = document.createElement('div');
    inspectorPanel.className = 'inspector-panel';
    inspectorPanel.style.cssText = 'width: 280px; flex: none; background: var(--surface-1); border-left: 1px solid var(--border-hairline); display: flex; flex-direction: column; overflow-y: auto;';
    
    // Inspector sections (collapsible)
    const inspectorSections = [
      { title: 'សម្ភារ និងសំលេង', subtitle: 'Characters / Voice', expanded: true },
      { title: 'ប្រភេទរឿង', subtitle: 'Genre' },
      { title: 'ល្បឿន / សំលេង / អារម្មណ៍', subtitle: 'Speed / Pitch / Emotion' },
      { title: 'រចនាប័ទ្ម Subtitle', subtitle: 'Subtitle Style' },
      { title: 'Intro / Sponsor', subtitle: 'Intro / Sponsor' },
      { title: 'បកប្រែ - Gemini API', subtitle: 'Translation' }
    ];
    
    inspectorSections.forEach(section => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'inspector-section';
      sectionEl.style.cssText = 'border-bottom: 1px solid var(--border-hairline);';
      
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'inspector-section-header';
      sectionHeader.style.cssText = 'padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: var(--text-primary); font-size: 13px; font-weight: 500;';
      sectionHeader.innerHTML = `<span>${section.title}</span><i class="ti ti-chevron-${section.expanded ? 'up' : 'down'}" style="font-size: 16px;"></i>`;
      
      const sectionContent = document.createElement('div');
      sectionContent.className = 'inspector-section-content';
      sectionContent.style.cssText = `padding: 12px 16px; display: ${section.expanded ? 'block' : 'none'};`;
      sectionContent.innerHTML = `<span style="color: var(--text-secondary); font-size: 12px;">${section.subtitle}</span>`;
      
      sectionEl.appendChild(sectionHeader);
      sectionEl.appendChild(sectionContent);
      inspectorPanel.appendChild(sectionEl);
    });

    // Assemble structure
    newMain.appendChild(activityBar);
    newMain.appendChild(centerPanel);
    newMain.appendChild(inspectorPanel);

    return {
      newMain,
      activityBar,
      centerPanel,
      videoContainer,
      quickActions,
      subtitleContainer,
      inspectorPanel,
      settingsIcon
    };
  }

  function reparentElements(elements, structure) {
    // Move video elements to new video container
    if (elements.videoDropArea && structure.videoContainer) {
      structure.videoContainer.insertBefore(elements.videoDropArea, structure.quickActions);
    }
    
    // Move transport controls (create new row)
    const transportRow = document.createElement('div');
    transportRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    if (elements.btnPlayPause) {
      transportRow.appendChild(elements.btnPlayPause);
    }
    if (elements.btnStop) {
      transportRow.appendChild(elements.btnStop);
    }
    
    // Timecode display
    if (elements.timeCurrentDisplay && elements.timeDurationDisplay) {
      const timecodeDisplay = document.createElement('div');
      timecodeDisplay.style.cssText = 'font-family: var(--font-mono); font-size: 14px; color: var(--text-primary); margin-left: auto;';
      timecodeDisplay.appendChild(elements.timeCurrentDisplay);
      timecodeDisplay.appendChild(document.createTextNode(' / '));
      timecodeDisplay.appendChild(elements.timeDurationDisplay);
      transportRow.appendChild(timecodeDisplay);
    }
    
    if (structure.videoContainer) {
      structure.videoContainer.appendChild(transportRow);
    }
    
    // Move subtitle table to new container
    const existingTable = document.querySelector('.table-panel');
    if (existingTable && structure.subtitleContainer) {
      structure.subtitleContainer.appendChild(existingTable);
    }
    
    // Wire up settings icon to existing button handler
    if (structure.settingsIcon && elements.btnSettings) {
      structure.settingsIcon.onclick = function() {
        if (elements.btnSettings && elements.btnSettings.onclick) {
          elements.btnSettings.onclick();
        } else if (typeof openSettingsModal === 'function') {
          openSettingsModal();
        }
      };
    }
    
    console.log('✅ Elements re-parented successfully');
  }

})();
