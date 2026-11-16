/**
 * Studio Timeline & Subtitle Engine - Dabbing Pro v6.0
 * Multi-track Visualizer, Audio Sync & Real-time Subtitle Editor
 */

(function(window) {
  'use strict';

  class StudioTimelineEngine {
    constructor() {
      this.state = window.studioState;
      this.isPlaying = false;
      this.currentTime = 0;
      this.duration = 180; // default 3 mins
      this.initEvents();
    }

    initEvents() {
      this.state.on('subtitles:updated', (subs) => this.renderSubtitlesTable(subs));

      // Playback Controls
      const playBtn = document.getElementById('timelinePlayBtn');
      const pauseBtn = document.getElementById('timelinePauseBtn');
      const stopBtn = document.getElementById('timelineStopBtn');
      const videoEl = document.getElementById('timelineVideoPlayer');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          this.isPlaying = true;
          if (videoEl && videoEl.src) videoEl.play();
          this.startPlaybackLoop();
        });
      }

      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          this.isPlaying = false;
          if (videoEl) videoEl.pause();
        });
      }

      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          this.isPlaying = false;
          this.currentTime = 0;
          if (videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
          }
          this.updateTimecode(0);
        });
      }
    }

    startPlaybackLoop() {
      if (!this.isPlaying) return;

      const videoEl = document.getElementById('timelineVideoPlayer');
      if (videoEl && videoEl.duration) {
        this.currentTime = videoEl.currentTime;
      } else {
        this.currentTime += 0.1;
      }

      this.updateTimecode(this.currentTime);

      if (this.isPlaying) {
        requestAnimationFrame(() => this.startPlaybackLoop());
      }
    }

    updateTimecode(seconds) {
      const display = document.getElementById('timelineTimecodeDisplay');
      if (!display) return;

      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 100);

      const fmt = (n) => String(n).padStart(2, '0');
      display.textContent = `${fmt(mins)}:${fmt(secs)}.${fmt(ms)}`;
    }

    renderSubtitlesTable(subs) {
      const tbody = document.getElementById('subtitlesTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!subs || subs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
              មិនទាន់មានអត្ថបទ Subtitle នៅឡើយទេ (សូមដំណើរការជំហាន Transcribe ជាមុន)
            </td>
          </tr>
        `;
        return;
      }

      subs.forEach((sub, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-dim);">${sub.id}</td>
          <td style="font-family: monospace; font-size: 0.8rem; color: var(--accent);">${sub.start} → ${sub.end}</td>
          <td>
            <span class="pill pill-info">${sub.speaker}</span>
          </td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${sub.sourceText}</td>
          <td>
            <input type="text" class="form-control sub-khmer-input" data-sub-id="${sub.id}" value="${sub.khmerText}" style="padding: 6px 10px; font-size: 0.88rem;" />
          </td>
          <td style="text-align: center;">
            <button class="icon-btn play-sub-audio-btn" data-sub-id="${sub.id}" title="ស្តាប់ឃ្លានេះ" style="width: 32px; height: 32px; font-size: 0.85rem;">
              🔊
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Update subtitle input handlers
      tbody.querySelectorAll('.sub-khmer-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const subId = parseInt(e.target.getAttribute('data-sub-id'), 10);
          const item = this.state.subtitles.find(s => s.id === subId);
          if (item) item.khmerText = e.target.value;
        });
      });

      tbody.querySelectorAll('.play-sub-audio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const subId = parseInt(btn.getAttribute('data-sub-id'), 10);
          const item = this.state.subtitles.find(s => s.id === subId);
          if (item) {
            window.studioStepper.showToast(`កំពុងចាក់សំឡេងឃ្លា #${subId}...`, 'info');
            window.studioApi.testVoiceSample(item.khmerText, 'km-KH-PisethNeural');
          }
        });
      });
    }
  }

  window.studioTimeline = new StudioTimelineEngine();
})(window);

