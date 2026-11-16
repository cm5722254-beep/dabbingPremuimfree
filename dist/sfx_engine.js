// Web Audio Sound Effects Engine for GenZ DramaHub PRO
(function() {
  let audioCtx = null;
  let sfxEnabled = localStorage.getItem('genz_sfx_enabled') !== 'false';

  function getCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.playSfx = function(type) {
    if (!sfxEnabled) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'click') {
        // Crisp, tactile mechanical micro-click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.035);

      } else if (type === 'action') {
        // Ascending futuristic chime (C5 -> G5)
        const freqs = [523.25, 783.99];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.06);
          gain.gain.setValueAtTime(0, now + i * 0.06);
          gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.16);
        });

      } else if (type === 'success') {
        // Lush celebratory triad (E5, G#5, B5, E6)
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.07);
          gain.gain.setValueAtTime(0, now + i * 0.07);
          gain.gain.linearRampToValueAtTime(0.1, now + i * 0.07 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.35);
        });

      } else if (type === 'tab') {
        // Smooth sci-fi pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.045);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);

      } else if (type === 'warning') {
        // Gentle warm alert
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch(e) {}
  };

  window.toggleSfx = function() {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('genz_sfx_enabled', sfxEnabled ? 'true' : 'false');
    const btn = document.getElementById('btnToggleSfx');
    if (btn) {
      btn.innerHTML = sfxEnabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      btn.title = sfxEnabled ? 'បិទសំឡេងប៊ូតុង' : 'បើកសំឡេងប៊ូតុង';
    }
    if (sfxEnabled) window.playSfx('success');
  };

  // Auto attach click sounds on document
  document.addEventListener('click', function(e) {
    const target = e.target.closest('button, .tab, .pill, .pro-choice-card, .pro-aspect-card, [onclick]');
    if (!target) return;
    if (target.classList.contains('pri') || target.classList.contains('go') || target.id === 'btnAutoDub' || target.id === 'btnStartAutoDubModal') {
      window.playSfx('action');
    } else if (target.classList.contains('tab') || target.classList.contains('pill') || target.classList.contains('pro-choice-card')) {
      window.playSfx('tab');
    } else if (target.classList.contains('dng')) {
      window.playSfx('warning');
    } else {
      window.playSfx('click');
    }
  }, true);
})();

