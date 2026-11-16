/**
 * DABBING PRO — STUDIO EDITION (v5.0)
 * Core Application Engine & Synchronized Multi-Track Dubbing Studio
 */

// ---------------------------------------------------------
// Global Application State
// ---------------------------------------------------------
const state = {
  videoFile: null,
  videoUrl: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  zoomLevel: 50, // pixels per second on timeline

  // Audio track states
  isOriginalAudioMuted: false,
  isDubMuted: false,
  isBgmMuted: false,
  originalVolume: 0.3,
  dubVolume: 1.8,
  bgmVolume: 0.25,

  // BGM Track
  bgmFile: null,
  bgmUrl: null,
  bgmAudio: new Audio(),

  // Subtitles / Dubbing Script
  subtitles: [
    {
      id: 1,
      start: 1.5,
      end: 4.8,
      text: "សួស្តីបងប្អូនទាំងអស់គ្នា! សូមស្វាគមន៍មកកាន់ Dabbing Pro កម្មវិធីបញ្ចូលសម្លេង AI ទំនើបបំផុត។",
      gender: "Female",
      speed: 1.0,
      audioStatus: "idle", // 'idle' | 'generating' | 'ready' | 'error'
      audioUrl: null,
      audioDuration: 0
    },
    {
      id: 2,
      start: 5.2,
      end: 9.0,
      text: "កម្មវិធីនេះជួយលោកអ្នកបកប្រែ និងបញ្ចូលសម្លេងស្វ័យប្រវត្តិតាមរយៈ Google Gemini និង Edge-TTS។",
      gender: "Male",
      speed: 1.0,
      audioStatus: "idle",
      audioUrl: null,
      audioDuration: 0
    }
  ],

  // Gemini Settings
  geminiKeys: JSON.parse(localStorage.getItem('dabbing_pro_gemini_keys') || '[]'),
  currentKeyIndex: 0,
  geminiModel: localStorage.getItem('dabbing_pro_gemini_model') || 'gemini-2.0-flash',

  // Active audio elements for dub playback
  audioPlayers: {},

  // Active playing subtitle
  activeSubtitleId: null
};

// ---------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function parseTime(timeStr) {
  if (typeof timeStr === 'number') return timeStr;
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m) * 60 + parseFloat(s);
  }
  return parseFloat(timeStr) || 0;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ---------------------------------------------------------
// Initialization
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupVideoPlayer();
  setupEventListeners();
  renderSubtitlesList();
  renderTimeline();
  checkBackendStatus();
});

// ---------------------------------------------------------
// Video Player & Audio Synchronization
// ---------------------------------------------------------
const video = document.getElementById('mainVideo');

function setupVideoPlayer() {
  const emptyState = document.getElementById('videoEmptyState');
  const videoInput = document.getElementById('videoFileInput');

  emptyState.addEventListener('click', () => videoInput.click());
  videoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      loadVideoFile(e.target.files[0]);
    }
  });

  // Drag and drop video
  const playerContainer = document.getElementById('videoPlayerContainer');
  playerContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    playerContainer.style.borderColor = 'var(--primary)';
  });
  playerContainer.addEventListener('dragleave', () => {
    playerContainer.style.borderColor = 'transparent';
  });
  playerContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    playerContainer.style.borderColor = 'transparent';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadVideoFile(e.dataTransfer.files[0]);
    }
  });

  video.addEventListener('loadedmetadata', () => {
    state.duration = video.duration || 10;
    emptyState.style.display = 'none';
    video.style.display = 'block';
    document.getElementById('durationDisplay').textContent = formatTime(state.duration);
    renderTimeline();
    showToast(`Video loaded: ${state.videoFile.name} (${state.duration.toFixed(1)}s)`, 'success');
  });

  video.addEventListener('timeupdate', () => {
    state.currentTime = video.currentTime;
    document.getElementById('timecodeDisplay').textContent = formatTime(state.currentTime);
    updatePlayheadPosition();
    syncDubAudioAndSubtitles();
  });

  video.addEventListener('play', () => {
    state.isPlaying = true;
    updatePlayButton();
    if (state.bgmUrl && !state.isBgmMuted) {
      state.bgmAudio.currentTime = video.currentTime;
      state.bgmAudio.play().catch(() => {});
    }
  });

  video.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayButton();
    stopAllDubAudio();
    state.bgmAudio.pause();
  });

  video.addEventListener('seeked', () => {
    stopAllDubAudio();
    if (state.bgmUrl) {
      state.bgmAudio.currentTime = video.currentTime;
    }
    syncDubAudioAndSubtitles();
  });
}

function loadVideoFile(file) {
  state.videoFile = file;
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(file);
  video.src = state.videoUrl;
  video.load();
}

function togglePlay() {
  if (!video.src) {
    showToast('Please load a video first!', 'info');
    return;
  }
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}

function updatePlayButton() {
  const icon = document.getElementById('playIcon');
  if (icon) {
    icon.innerHTML = state.isPlaying 
      ? '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>'
      : '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>';
  }
}

// ---------------------------------------------------------
// Dubbing Audio Synchronization Engine
// ---------------------------------------------------------
function syncDubAudioAndSubtitles() {
  const t = state.currentTime;
  let currentSub = null;

  for (const sub of state.subtitles) {
    if (t >= sub.start && t <= sub.end) {
      currentSub = sub;
      break;
    }
  }

  // Subtitle Overlay
  const overlay = document.getElementById('subtitleOverlay');
  const overlayText = document.getElementById('subtitleText');
  if (currentSub && currentSub.text) {
    overlayText.textContent = currentSub.text;
    overlay.style.display = 'block';
  } else {
    overlay.style.display = 'none';
  }

  // Active Highlight in Editor
  if (currentSub && currentSub.id !== state.activeSubtitleId) {
    state.activeSubtitleId = currentSub.id;
    highlightActiveCard(currentSub.id);
  } else if (!currentSub && state.activeSubtitleId !== null) {
    state.activeSubtitleId = null;
    clearActiveCards();
  }

  // Dub Voice Playback
  if (!state.isDubMuted && currentSub && currentSub.audioUrl && currentSub.audioStatus === 'ready') {
    let player = state.audioPlayers[currentSub.id];
    if (!player) {
      player = new Audio(currentSub.audioUrl);
      state.audioPlayers[currentSub.id] = player;
    }

    if (player.paused && state.isPlaying) {
      const offset = t - currentSub.start;
      if (offset >= 0 && offset < (currentSub.end - currentSub.start)) {
        player.currentTime = offset;
        player.playbackRate = currentSub.speed || 1.0;
        player.play().catch(() => {});
        
        // Auto duck original video audio when dubbed voice speaks
        if (!state.isOriginalAudioMuted) {
          video.volume = 0.15;
        }
      }
    }
  } else {
    // Restore normal video volume when no dub voice is playing
    if (!state.isOriginalAudioMuted) {
      video.volume = state.originalVolume;
    }
  }
}

function stopAllDubAudio() {
  Object.values(state.audioPlayers).forEach(p => {
    p.pause();
    p.currentTime = 0;
  });
}

function highlightActiveCard(id) {
  document.querySelectorAll('.sub-card').forEach(c => {
    if (parseInt(c.dataset.id) === id) {
      c.classList.add('playing');
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      c.classList.remove('playing');
    }
  });

  document.querySelectorAll('.timeline-block').forEach(b => {
    if (parseInt(b.dataset.id) === id) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function clearActiveCards() {
  document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('playing'));
  document.querySelectorAll('.timeline-block').forEach(b => b.classList.remove('active'));
}

// ---------------------------------------------------------
// Subtitle & Script Editor
// ---------------------------------------------------------
function renderSubtitlesList() {
  const container = document.getElementById('subtitlesList');
  if (!container) return;
  container.innerHTML = '';

  document.getElementById('subCountBadge').textContent = state.subtitles.length;

  state.subtitles.forEach((sub, index) => {
    const card = document.createElement('div');
    card.className = `sub-card ${state.activeSubtitleId === sub.id ? 'active' : ''}`;
    card.dataset.id = sub.id;

    card.innerHTML = `
      <div class="sub-card-top">
        <span class="sub-id-pill">#${index + 1}</span>
        <div class="time-inputs-group">
          <input type="text" class="time-input" value="${formatTime(sub.start)}" onchange="updateSubTime(${sub.id}, 'start', this.value)" title="Start Time"/>
          <span class="time-arrow">➜</span>
          <input type="text" class="time-input" value="${formatTime(sub.end)}" onchange="updateSubTime(${sub.id}, 'end', this.value)" title="End Time"/>
        </div>
        <select class="gender-select ${sub.gender}" onchange="updateSubGender(${sub.id}, this.value)">
          <option value="Female" ${sub.gender === 'Female' ? 'selected' : ''}>👩 ស្រី (Sreymom)</option>
          <option value="Male" ${sub.gender === 'Male' ? 'selected' : ''}>👨 ប្រុស (Piseth)</option>
        </select>
      </div>

      <textarea class="sub-textarea" oninput="updateSubText(${sub.id}, this.value)" placeholder="បញ្ចូលអត្ថបទជាភាសាខ្មែរនៅទីនេះ...">${sub.text}</textarea>

      <div class="sub-card-footer">
        <div class="audio-status-pill ${sub.audioStatus}">
          <span>${sub.audioStatus === 'ready' ? '✓ សម្លេងរួចរាល់' : sub.audioStatus === 'generating' ? '⏳ កំពុងបង្កើត...' : '• មិនទាន់បង្កើត'}</span>
          ${sub.audioDuration ? `<span style="font-family: var(--font-mono)">(${sub.audioDuration.toFixed(1)}s)</span>` : ''}
        </div>

        <div class="sub-item-actions">
          <button class="sub-mini-btn play" onclick="previewSubAudio(${sub.id})" title="ស្តាប់សម្លេង">
            <span>▶ ស្តាប់</span>
          </button>
          <button class="sub-mini-btn" onclick="recordSubAudio(${sub.id})" style="background: rgba(239,68,68,0.15); color: #ef4444;" title="ថតសំឡេងខ្លួនឯងផ្ទាល់សម្រាប់ឃ្លានេះ">
            <span>🎤 ថត</span>
          </button>
          <button class="sub-mini-btn" onclick="generateSingleAudio(${sub.id})" title="បង្កើតសម្លេងតាម Edge-TTS">
            <span>🎙 បង្កើត</span>
          </button>
          <button class="sub-mini-btn delete" onclick="deleteSubtitle(${sub.id})" title="លុបបន្ទាត់នេះ">
            <span>🗑</span>
          </button>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      video.currentTime = sub.start;
    });

    container.appendChild(card);
  });
}

function updateSubTime(id, field, value) {
  const sub = state.subtitles.find(s => s.id === id);
  if (sub) {
    sub[field] = parseTime(value);
    renderTimeline();
  }
}

function updateSubGender(id, value) {
  const sub = state.subtitles.find(s => s.id === id);
  if (sub) {
    sub.gender = value;
    sub.audioStatus = 'idle';
    sub.audioUrl = null;
    renderSubtitlesList();
    renderTimeline();
  }
}

function updateSubText(id, value) {
  const sub = state.subtitles.find(s => s.id === id);
  if (sub) {
    sub.text = value;
    sub.audioStatus = 'idle';
    sub.audioUrl = null;
  }
}

function addSubtitleLine() {
  const lastSub = state.subtitles[state.subtitles.length - 1];
  const newStart = lastSub ? lastSub.end + 0.3 : (video.currentTime || 0);
  const newEnd = newStart + 3.0;

  const newSub = {
    id: Date.now(),
    start: parseFloat(newStart.toFixed(2)),
    end: parseFloat(newEnd.toFixed(2)),
    text: "កែប្រែអត្ថបទនៅទីនេះ...",
    gender: "Female",
    speed: 1.0,
    audioStatus: "idle",
    audioUrl: null,
    audioDuration: 0
  };

  state.subtitles.push(newSub);
  renderSubtitlesList();
  renderTimeline();
  showToast('Added new subtitle line', 'info');
}

function deleteSubtitle(id) {
  state.subtitles = state.subtitles.filter(s => s.id !== id);
  renderSubtitlesList();
  renderTimeline();
}

// ---------------------------------------------------------
// TTS Voice Generation (Edge-TTS via Backend)
// ---------------------------------------------------------
async function generateSingleAudio(id) {
  const sub = state.subtitles.find(s => s.id === id);
  if (!sub || !sub.text.trim()) {
    showToast('Subtitle text is empty!', 'error');
    return;
  }

  sub.audioStatus = 'generating';
  renderSubtitlesList();

  try {
    const res = await fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sub.text,
        gender: sub.gender,
        speed: sub.speed || 1.0,
        index: sub.id
      })
    });

    const data = await res.json();
    if (data.success && data.url) {
      sub.audioStatus = 'ready';
      sub.audioUrl = `${data.url}?t=${Date.now()}`;
      
      // Load audio to measure exact duration
      const audioProbe = new Audio(sub.audioUrl);
      audioProbe.onloadedmetadata = () => {
        sub.audioDuration = audioProbe.duration;
        // Optionally auto-adjust end time to match audio duration
        if (sub.start + sub.audioDuration > sub.end) {
          sub.end = parseFloat((sub.start + sub.audioDuration).toFixed(2));
        }
        renderSubtitlesList();
        renderTimeline();
      };
      
      showToast(`Audio generated for line #${state.subtitles.indexOf(sub) + 1}`, 'success');
    } else {
      throw new Error(data.error || 'Failed to generate audio');
    }
  } catch (err) {
    sub.audioStatus = 'error';
    renderSubtitlesList();
    showToast(`TTS Error: ${err.message}`, 'error');
  }
}

let legacyMediaRecorder = null;
let legacyRecordingChunks = [];
let legacyRecordingId = null;

async function recordSubAudio(id) {
  const sub = state.subtitles.find(s => s.id === id);
  if (!sub) return;

  if (legacyRecordingId === id && legacyMediaRecorder && legacyMediaRecorder.state === 'recording') {
    legacyMediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    legacyRecordingChunks = [];
    legacyRecordingId = id;
    legacyMediaRecorder = new MediaRecorder(stream);
    
    sub.audioStatus = 'generating';
    renderSubtitlesList();
    showToast(`🔴 កំពុងថតសំឡេងសម្រាប់បន្ទាត់ #${state.subtitles.indexOf(sub) + 1}... ចុច '🎤 ថត' ម្តងទៀតដើម្បីចប់`, 'info');

    legacyMediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) legacyRecordingChunks.push(e.data);
    };

    legacyMediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(legacyRecordingChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('phraseAudio', blob, `phrase_${id}.webm`);
      formData.append('subId', id);

      try {
        const res = await fetch('/api/upload-phrase-audio', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
          sub.audioUrl = `${data.url}?t=${Date.now()}`;
          sub.audioStatus = 'ready';
          const p = new Audio(sub.audioUrl);
          p.onloadedmetadata = () => {
            sub.audioDuration = p.duration;
            renderSubtitlesList();
            renderTimeline();
          };
          showToast(`✅ បានថតសំឡេងបន្ទាត់ #${state.subtitles.indexOf(sub) + 1} រួចរាល់!`, 'success');
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (err) {
        sub.audioStatus = 'error';
        showToast(`Recording upload error: ${err.message}`, 'error');
      }
      legacyRecordingId = null;
      legacyMediaRecorder = null;
      renderSubtitlesList();
    };

    legacyMediaRecorder.start();
  } catch (err) {
    showToast(`Cannot access microphone: ${err.message}`, 'error');
  }
}

async function generateAllAudios() {
  if (state.subtitles.length === 0) {
    showToast('No subtitles to generate!', 'info');
    return;
  }

  showToast(`Generating audio for ${state.subtitles.length} lines...`, 'info');
  for (let i = 0; i < state.subtitles.length; i++) {
    const sub = state.subtitles[i];
    await generateSingleAudio(sub.id);
  }
  showToast('All audio clips generated successfully!', 'success');
}

function previewSubAudio(id) {
  const sub = state.subtitles.find(s => s.id === id);
  if (!sub) return;

  if (sub.audioUrl) {
    const a = new Audio(sub.audioUrl);
    a.play();
  } else {
    // If not generated, preview with speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(sub.text);
      u.pitch = sub.gender === 'Male' ? 0.85 : 1.15;
      window.speechSynthesis.speak(u);
    } else {
      showToast('Please generate audio first!', 'info');
    }
  }
}

// ---------------------------------------------------------
// Multi-Track Studio Timeline
// ---------------------------------------------------------
function renderTimeline() {
  const tracksWrapper = document.getElementById('timelineTracksWrapper');
  const ruler = document.getElementById('timelineRuler');
  if (!tracksWrapper || !ruler) return;

  const totalDuration = Math.max(state.duration || 10, ...state.subtitles.map(s => s.end), 30);
  const totalWidth = Math.max(window.innerWidth - 40, totalDuration * state.zoomLevel);

  ruler.style.width = `${totalWidth}px`;
  tracksWrapper.style.width = `${totalWidth}px`;

  // Draw ruler ticks every 5 seconds
  ruler.innerHTML = '';
  const step = state.zoomLevel >= 40 ? 2 : 5;
  for (let sec = 0; sec <= totalDuration; sec += step) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${sec * state.zoomLevel}px`;
    tick.textContent = formatTime(sec).slice(3, 8);
    ruler.appendChild(tick);
  }

  // Draw Subtitle / Dubbing Blocks
  const voiceTrack = document.getElementById('timelineVoiceTrack');
  voiceTrack.innerHTML = '<span class="track-row-label">🎙️ Voice A1</span>';

  state.subtitles.forEach(sub => {
    const block = document.createElement('div');
    block.className = `timeline-block ${sub.gender} ${state.activeSubtitleId === sub.id ? 'active' : ''}`;
    block.dataset.id = sub.id;

    const left = sub.start * state.zoomLevel;
    const width = Math.max(30, (sub.end - sub.start) * state.zoomLevel);

    block.style.left = `${left}px`;
    block.style.width = `${width}px`;
    block.innerHTML = `<span>#${sub.id} ${sub.text.substring(0, 15)}...</span>`;

    block.addEventListener('click', (e) => {
      e.stopPropagation();
      video.currentTime = sub.start;
    });

    voiceTrack.appendChild(block);
  });
}

function updatePlayheadPosition() {
  const playhead = document.getElementById('timelinePlayhead');
  if (playhead) {
    playhead.style.left = `${state.currentTime * state.zoomLevel}px`;
  }
}

// Click on timeline to seek
document.getElementById('timelineScrollArea')?.addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
  const seekTime = clickX / state.zoomLevel;
  if (seekTime >= 0 && seekTime <= state.duration) {
    video.currentTime = seekTime;
  }
});

// ---------------------------------------------------------
// AI Auto-Transcription (Google Gemini Integration)
// ---------------------------------------------------------
async function openAiModal() {
  document.getElementById('aiModal').classList.add('open');
}

async function startAiTranscription() {
  if (!state.videoFile) {
    showToast('Please load a video first!', 'error');
    return;
  }

  if (state.geminiKeys.length === 0) {
    showToast('Please add at least one Gemini API Key in Settings!', 'error');
    openSettingsModal();
    return;
  }

  const aiStatus = document.getElementById('aiProgressStatus');
  aiStatus.textContent = '🚀 Preparing video for Gemini AI analysis...';
  document.getElementById('aiProgressBar').style.width = '25%';

  try {
    let key = state.geminiKeys[state.currentKeyIndex % state.geminiKeys.length];
    log(`Using Gemini Key #${(state.currentKeyIndex % state.geminiKeys.length) + 1}`);

    // Step 1: Upload to Gemini File API
    aiStatus.textContent = '📤 Uploading video to Gemini File API...';
    document.getElementById('aiProgressBar').style.width = '45%';

    const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Header-Content-Type': state.videoFile.type || 'video/mp4'
      },
      body: state.videoFile
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file.uri;
    const fileName = uploadData.file.name;

    // Step 2: Poll file processing status
    aiStatus.textContent = '⏳ Gemini is processing video frames...';
    document.getElementById('aiProgressBar').style.width = '65%';

    let isReady = false;
    for (let attempts = 0; attempts < 30; attempts++) {
      await new Promise(r => setTimeout(r, 3000));
      const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`);
      const checkData = await checkRes.json();
      if (checkData.state === 'ACTIVE') {
        isReady = true;
        break;
      }
      if (checkData.state === 'FAILED') throw new Error('Gemini failed to process video.');
    }

    if (!isReady) throw new Error('File processing timed out.');

    // Step 3: Prompt Gemini for structured transcription
    aiStatus.textContent = '🤖 Generating Khmer transcription & emotions...';
    document.getElementById('aiProgressBar').style.width = '85%';

    const promptText = `
      You are an expert audio transcription and Khmer dubbing artist.
      Watch and listen to the video carefully.
      Transcribe all spoken dialogue into natural, fluent Khmer language.
      Provide the start and end timestamp of each spoken line.
      Return ONLY a JSON array of objects with keys:
      - 'start' (formatted strictly as HH:MM:SS.sss)
      - 'end' (formatted strictly as HH:MM:SS.sss)
      - 'text' (natural Khmer translation or dialogue)
      - 'gender' ('Male' or 'Female')
      - 'emotion' (e.g. 'happy', 'serious', 'dramatic')
      Do NOT include any markdown code blocks, just raw JSON array.
    `;

    const model = state.geminiModel || 'gemini-2.0-flash';
    const genRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { fileData: { mimeType: state.videoFile.type || 'video/mp4', fileUri: fileUri } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!genRes.ok) throw new Error(`Gemini generateContent error: ${await genRes.text()}`);

    const genData = await genRes.json();
    const candidateText = genData.candidates[0].content.parts[0].text;
    const parsedSubtitles = JSON.parse(candidateText);

    // Populate state with new subtitles
    state.subtitles = parsedSubtitles.map((item, idx) => ({
      id: Date.now() + idx,
      start: parseTime(item.start),
      end: parseTime(item.end),
      text: item.text,
      gender: item.gender === 'Male' ? 'Male' : 'Female',
      speed: 1.0,
      audioStatus: 'idle',
      audioUrl: null,
      audioDuration: 0
    }));

    document.getElementById('aiProgressBar').style.width = '100%';
    aiStatus.textContent = `✓ Generated ${state.subtitles.length} lines of subtitles!`;
    
    renderSubtitlesList();
    renderTimeline();
    showToast(`AI Transcription completed: ${state.subtitles.length} lines!`, 'success');

    setTimeout(() => {
      closeModal('aiModal');
    }, 1200);

  } catch (err) {
    aiStatus.textContent = `✕ Error: ${err.message}`;
    showToast(`AI Error: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------
// Final Video Render & Export (FFmpeg)
// ---------------------------------------------------------
function openRenderModal() {
  if (!state.videoFile) {
    showToast('Please load a video first!', 'error');
    return;
  }
  document.getElementById('renderOutputName').value = state.videoFile.name.replace(/\.[^/.]+$/, "") + "_dubbed.mp4";
  document.getElementById('renderModal').classList.add('open');
}

async function startRenderProcess() {
  const outputFileName = document.getElementById('renderOutputName').value || 'final_dubbed_video.mp4';
  const dubVolume = parseFloat(document.getElementById('renderDubVolume').value) || 1.8;
  const origVolume = parseFloat(document.getElementById('renderOrigVolume').value) || 0.25;

  const renderStatus = document.getElementById('renderStatusText');
  const progressBar = document.getElementById('renderProgressBar');

  renderStatus.textContent = '📦 Packaging tracks and preparing FFmpeg render...';
  progressBar.style.width = '30%';

  const renderData = {
    audioTracks: state.subtitles
      .filter(s => s.audioStatus === 'ready' && s.audioUrl)
      .map(s => ({
        file: s.audioUrl.split('?')[0],
        start: s.start,
        speed: s.speed || 1.0,
        duration: s.end - s.start
      })),
    bgmTrack: state.bgmFile ? {
      name: state.bgmFile.name,
      volume: state.bgmVolume,
      isMuted: state.isBgmMuted,
      start: 0
    } : null,
    isOriginalAudioMuted: state.isOriginalAudioMuted,
    outputFileName: outputFileName,
    dubVolume: dubVolume,
    origVolume: origVolume
  };

  const formData = new FormData();
  formData.append('videoFile', state.videoFile);
  if (state.bgmFile) {
    formData.append('bgmFile', state.bgmFile);
  }
  formData.append('data', JSON.stringify(renderData));

  progressBar.style.width = '60%';
  renderStatus.textContent = '⚡ FFmpeg is mixing audio and producing final MP4...';

  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }

    const data = await res.json();
    progressBar.style.width = '100%';
    renderStatus.textContent = '🎉 Video Rendered Successfully!';

    document.getElementById('renderActionsGroup').innerHTML = `
      <a href="${data.downloadUrl}" download="${data.fileName}" class="header-btn primary">
        <span>💾 ទាញយកវីដេអូ (Download MP4)</span>
      </a>
      <button class="header-btn" onclick="openRenderFolder()">
        <span>📁 បើកថតវីដេអូ (Open Folder)</span>
      </button>
    `;

    showToast('Video rendered successfully!', 'success');
  } catch (err) {
    renderStatus.textContent = `✕ Render Failed: ${err.message}`;
    showToast(`Render Error: ${err.message}`, 'error');
  }
}

async function openRenderFolder() {
  try {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    showToast('Opened folder in Windows Explorer', 'success');
  } catch (err) {
    showToast('Could not open folder', 'error');
  }
}

// ---------------------------------------------------------
// Settings & Subtitle Export/Import
// ---------------------------------------------------------
function openSettingsModal() {
  document.getElementById('geminiKeysInput').value = state.geminiKeys.join('\n');
  document.getElementById('geminiModelSelect').value = state.geminiModel;
  document.getElementById('settingsModal').classList.add('open');
}

function saveSettings() {
  const rawKeys = document.getElementById('geminiKeysInput').value;
  state.geminiKeys = rawKeys.split('\n').map(k => k.trim()).filter(Boolean);
  state.geminiModel = document.getElementById('geminiModelSelect').value;

  localStorage.setItem('dabbing_pro_gemini_keys', JSON.stringify(state.geminiKeys));
  localStorage.setItem('dabbing_pro_gemini_model', state.geminiModel);

  closeModal('settingsModal');
  showToast('Settings saved successfully!', 'success');
}

function exportSrtFile() {
  if (state.subtitles.length === 0) {
    showToast('No subtitles to export!', 'error');
    return;
  }

  function srtTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(sec % 60)).padStart(2, '0');
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  }

  let srt = '';
  state.subtitles.forEach((s, idx) => {
    srt += `${idx + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n\n`;
  });

  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.videoFile ? state.videoFile.name.replace(/\.[^/.]+$/, "") : "dabbing_pro") + ".srt";
  a.click();
  showToast('Subtitles exported (.SRT)', 'success');
}

function importSrtFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.srt,.txt';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      parseSrtText(event.target.result);
    };
    reader.readAsText(file);
  };
  input.click();
}

function parseSrtText(content) {
  const blocks = content.replace(/\r\n/g, '\n').split('\n\n').filter(Boolean);
  const newSubs = [];

  blocks.forEach((block, idx) => {
    const lines = block.split('\n');
    if (lines.length >= 2) {
      const timeLine = lines[1].includes('-->') ? lines[1] : lines[0];
      const textLines = lines.slice(lines[1].includes('-->') ? 2 : 1).join(' ');
      const match = timeLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
      if (match) {
        newSubs.push({
          id: Date.now() + idx,
          start: parseTime(match[1].replace(',', '.')),
          end: parseTime(match[2].replace(',', '.')),
          text: textLines.trim(),
          gender: 'Female',
          speed: 1.0,
          audioStatus: 'idle',
          audioUrl: null,
          audioDuration: 0
        });
      }
    }
  });

  if (newSubs.length > 0) {
    state.subtitles = newSubs;
    renderSubtitlesList();
    renderTimeline();
    showToast(`Imported ${newSubs.length} subtitle lines!`, 'success');
  } else {
    showToast('Failed to parse SRT file', 'error');
  }
}

// ---------------------------------------------------------
// Event Listeners & Modals
// ---------------------------------------------------------
function setupEventListeners() {
  // Spacebar play/pause
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft') {
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      video.currentTime = Math.min(state.duration, video.currentTime + 5);
    }
  });

  // Track Mute Toggles
  document.getElementById('toggleOrigAudio')?.addEventListener('click', function() {
    state.isOriginalAudioMuted = !state.isOriginalAudioMuted;
    this.classList.toggle('muted', state.isOriginalAudioMuted);
    video.muted = state.isOriginalAudioMuted;
    showToast(state.isOriginalAudioMuted ? 'Original video audio muted' : 'Original video audio unmuted', 'info');
  });

  document.getElementById('toggleDubAudio')?.addEventListener('click', function() {
    state.isDubMuted = !state.isDubMuted;
    this.classList.toggle('muted', state.isDubMuted);
    if (state.isDubMuted) stopAllDubAudio();
    showToast(state.isDubMuted ? 'Dubbed audio muted' : 'Dubbed audio active', 'info');
  });
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('open');
}

async function checkBackendStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('backendStatusPill').innerHTML = `
      <div class="status-dot"></div>
      <span>Backend Online (v${data.version})</span>
    `;
  } catch (e) {
    document.getElementById('backendStatusPill').innerHTML = `
      <div class="status-dot" style="background: #f43f5e; box-shadow: 0 0 8px #f43f5e"></div>
      <span style="color: #fda4af">Backend Offline</span>
    `;
  }
}
