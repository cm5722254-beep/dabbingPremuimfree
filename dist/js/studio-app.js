/**
 * Studio Main Application Controller - Dabbing Pro v6.0
 * Initializes the full Production Studio SPA
 */

(function(window) {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Dabbing Pro Studio v6.0...');

    const state = window.studioState;
    const api = window.studioApi;
    const stepper = window.studioStepper;

    // 1. Initialize Theme
    const savedTheme = localStorage.getItem('dabbing_theme') || 'dark';
    state.setTheme(savedTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        state.setTheme(newTheme);
        themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      });
      themeToggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    // 2. Main Tab Navigation
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    function switchTab(tabName) {
      document.querySelectorAll('.nav-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
      });

      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-tab-content') === tabName);
      });

      state.setTab(tabName);
    }

    // 3. Dropzone & File Upload Setup
    const dropzone = document.getElementById('videoDropzone');
    const fileInput = document.getElementById('videoFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          stepper.handleFileUpload(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          stepper.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // 4. Stepper Action Buttons
    document.getElementById('step1NextBtn')?.addEventListener('click', () => stepper.goToStep(2));
    document.getElementById('step2RunBtn')?.addEventListener('click', () => stepper.runVocalRemoval());
    document.getElementById('step2NextBtn')?.addEventListener('click', () => stepper.goToStep(3));
    document.getElementById('step3RunBtn')?.addEventListener('click', () => stepper.runTranscription());
    document.getElementById('step3NextBtn')?.addEventListener('click', () => stepper.goToStep(4));
    document.getElementById('step4RunBtn')?.addEventListener('click', () => stepper.runDiarization());
    document.getElementById('step4NextBtn')?.addEventListener('click', () => stepper.goToStep(5));
    document.getElementById('step5RunBtn')?.addEventListener('click', () => stepper.runTranslation());
    document.getElementById('step5NextBtn')?.addEventListener('click', () => stepper.goToStep(6));
    document.getElementById('step6RunBtn')?.addEventListener('click', () => stepper.runVoiceSynthesis());
    document.getElementById('step6NextBtn')?.addEventListener('click', () => stepper.goToStep(7));
    document.getElementById('step7RunBtn')?.addEventListener('click', () => stepper.runQualityGate());
    document.getElementById('step7NextBtn')?.addEventListener('click', () => stepper.goToStep(8));
    document.getElementById('step8RenderBtn')?.addEventListener('click', () => stepper.runFinalExport());

    // 5. Open Project / Output Folder Button
    document.getElementById('openOutputFolderBtn')?.addEventListener('click', () => {
      api.openOutputFolder();
      stepper.showToast('កំពុងបើកថតរក្សាទុកវីដេអូ...', 'info');
    });

    // 6. Progress Bar & Status Listeners
    state.on('progress:updated', ({ progress, text }) => {
      const fillEl = document.getElementById('studioProgressFill');
      const pctEl = document.getElementById('studioProgressPct');
      const logEl = document.getElementById('studioStatusText');

      if (fillEl) fillEl.style.width = `${progress}%`;
      if (pctEl) pctEl.textContent = `${progress}%`;
      if (logEl) logEl.textContent = text;
    });

    // 7. Check Backend Status on Launch
    api.checkSystemStatus().then(status => {
      const dot = document.getElementById('systemStatusDot');
      const label = document.getElementById('systemStatusLabel');

      if (status && (status.status === 'online' || status.success)) {
        if (dot) dot.style.background = 'var(--success)';
        if (label) label.textContent = 'Server ដំណើរការល្អ';
      } else {
        if (dot) dot.style.background = 'var(--warning)';
        if (label) label.textContent = 'កំពុងរៀបចំប្រព័ន្ធ...';
      }
    });

    // Initial render
    stepper.renderStep(1);
    window.studioCharacters.renderCharacters(state.characters);
    window.studioTimeline.renderSubtitlesTable(state.subtitles);

    console.log('✅ Dabbing Pro Studio v6.0 Ready!');
  });
})(window);

