import re

HTML_PATH = r"d:\ALL PROJECT\Cheatz Dubbing Studio Pro Next\dist\index.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# 1. REMOVE FAKE CSS AUTO-ANIMATIONS FOR TIMELINE & SCRUBBER
# Remove animation: scr and animation: run from css
html = re.sub(r'animation:\s*scr\s+[^;]+;', 'width: 0%;', html)
html = re.sub(r'animation:\s*run\s+[^;]+;', '/* Real timeline sync */', html)
html = re.sub(r'@keyframes\s+scr\s*\{[^}]*\}', '', html)
html = re.sub(r'@keyframes\s+run\s*\{[^}]*\}', '', html)

# Ensure playhead line and scrub bar don't auto animate
html = html.replace(
    '.scrub i{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--g);animation:scr 16s linear infinite}',
    '.scrub i{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--primary);width:0%;transition:width 0.05s linear;}'
)
html = html.replace(
    '.paused .ph,.paused .scrub i,.paused .wv{animation-play-state:paused}',
    '/* Paused state */'
)

# 2. ADD DRAG & DROP OVERLAY AND STAGE TOOLBAR BUTTONS
# Find stage container
old_stage_header = '''<div class="lb p" id="stageBadgeAspect" onclick="toggleAspectRatio()" style="z-index:10 !important;cursor:pointer !important;left:8px;top:8px;">16:9 · WIDE</div>
<div class="lb r" style="z-index:10 !important;right:8px;top:8px;">1080p</div>'''

new_stage_header = '''<!-- Top Overlay Badges & Controls -->
<div class="lb p" id="stageBadgeAspect" onclick="cycleAspectRatio()" style="z-index:15 !important;cursor:pointer !important;left:8px;top:8px;" title="ចុចដើម្បីប្តូរ Aspect Ratio (16:9, 9:16, 1:1, 4:5, 21:9)">16:9 · WIDE</div>
<div class="lb" id="stageBadgeFit" onclick="toggleVideoFit()" style="z-index:15 !important;cursor:pointer !important;left:95px;top:8px;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);" title="ចុចដើម្បីប្តូរ Fit (Contain) ឬ Fill (Cover)">FIT</div>
<div class="lb r" style="z-index:15 !important;right:38px;top:8px;">1080p</div>
<button class="lb r" id="btnCloseVideo" onclick="unloadActiveVideo()" title="បិទ/លុបវីដេអូចេញ (Close & Unload Video)" style="cursor:pointer;background:rgba(229,54,94,0.85);color:#fff;border:0;font-size:13px;font-weight:700;z-index:20;width:24px;height:24px;border-radius:6px;display:none;align-items:center;justify-content:center;right:8px;top:8px;">×</button>'''

if old_stage_header in html:
    html = html.replace(old_stage_header, new_stage_header)
else:
    print("Warning: old_stage_header not found, trying regex replace")
    html = re.sub(
        r'<div class="lb p" id="stageBadgeAspect"[^>]*>.*?</div>\s*<div class="lb r"[^>]*>1080p</div>',
        new_stage_header,
        html
    )

# 3. UPGRADE VIDEO TOOLS UNDER PREVIEW
old_tools = '<div class="tools"><span class="ic"><svg class="i"><use href="#crop"/></svg></span><span class="ic"><svg class="i"><use href="#type"/></svg></span><span class="ic"><svg class="i"><use href="#film"/></svg></span><span class="ic"><svg class="i"><use href="#music"/></svg></span><span class="ic"><svg class="i"><use href="#mic"/></svg></span><span class="ic"><svg class="i"><use href="#gear"/></svg></span></div>'

new_tools = '''<div class="tools">
  <span class="ic" onclick="cycleAspectRatio()" title="ប្តូរ Aspect Ratio / Crop (16:9, 9:16, 1:1, 4:5, 21:9)"><svg class="i"><use href="#crop"/></svg></span>
  <span class="ic" onclick="toggleVideoFit()" title="ប្តូរទម្រង់ Fit / Crop Fill"><svg class="i"><use href="#crop"/></svg></span>
  <span class="ic" onclick="openProModal('modalSubtitleStudio')" title="រចនា Subtitle"><svg class="i"><use href="#type"/></svg></span>
  <span class="ic" onclick="openProModal('modalIntroSponsor')" title="Intro / Sponsor"><svg class="i"><use href="#film"/></svg></span>
  <span class="ic" onclick="openProModal('modalBgm')" title="BGM & Ducking"><svg class="i"><use href="#music"/></svg></span>
  <span class="ic" onclick="switchNavTab(null, 'modalVoiceClone')" title="Voice Clone (VoxCPM2)"><svg class="i"><use href="#mic"/></svg></span>
  <span class="ic" onclick="openProModal('modalSettings')" title="Settings"><svg class="i"><use href="#gear"/></svg></span>
</div>'''

if old_tools in html:
    html = html.replace(old_tools, new_tools)

# 4. UPGRADE TRANSPORT BAR WITH REAL TIMECODES & INTERACTIVE SCRUBBER
old_tp = '<div class="tp"><button class="play" aria-label="លេង"><svg class="i"><use href="#play"/></svg></button><span class="mono">00:50.6</span><div class="scrub"><i></i></div><span class="mono" style="color:var(--ink2)">02:37.8</span></div>'

new_tp = '''<div class="tp">
  <button class="play" id="btnTransportPlay" onclick="togglePlay()" aria-label="លេង/ផ្អាក"><svg class="i"><use href="#play"/></svg></button>
  <span class="mono" id="tpCurrentTime">00:00.0</span>
  <div class="scrub" id="tpScrubBar" onclick="seekVideoScrub(event)" style="cursor:pointer;" title="Click or Drag to Scrub Video">
    <i id="tpScrubProgress" style="width:0%;"></i>
  </div>
  <span class="mono" id="tpTotalTime" style="color:var(--ink2)">00:00.0</span>
</div>'''

if old_tp in html:
    html = html.replace(old_tp, new_tp)

# 5. ADD DRAG & DROP OVERLAY IN BODY
drag_overlay_html = '''<!-- Apple Frosted Glass Drag & Drop Overlay -->
<div id="dragDropOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,113,227,0.12);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);z-index:99999;pointer-events:none;align-items:center;justify-content:center;flex-direction:column;border:3px dashed var(--primary);border-radius:20px;margin:16px;">
  <div style="background:#fff;border-radius:24px;padding:32px 48px;box-shadow:0 20px 60px rgba(0,0,0,0.15);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:18px;background:rgba(0,113,227,0.1);display:grid;place-items:center;color:var(--primary);">
      <svg class="i" style="width:32px;height:32px;stroke-width:2;"><use href="#film"/></svg>
    </div>
    <b style="font-size:16px;color:#1D1D1F;">ទម្លាក់វីដេអូ ឬ SRT ទីនេះដើម្បីបញ្ចូលក្នុង Tool</b>
    <span style="font-size:12.5px;color:#86868B;">គាំទ្រ MP4, MKV, MOV, TS, WEBM និងឯកសារ Subtitle SRT, VTT</span>
  </div>
</div>
'''

if 'id="dragDropOverlay"' not in html:
    html = html.replace('<body>', '<body>\n' + drag_overlay_html)

# 6. INJECT REAL VIDEO ENGINE, PERSISTENCE, & REAL TIMELINE CODE
real_engine_js = '''
// =========================================================================
// REAL VIDEO UPLOAD, DRAG-AND-DROP, TIMELINE SYNC & PERSISTENCE ENGINE
// =========================================================================

// Global State
window.appState = window.appState || {};
window.appState.videoFile = null;
window.appState.videoUrl = '';
window.appState.videoFileName = 'No Video Loaded';
window.appState.duration = 0;
window.appState.currentTime = 0;
window.appState.isPlaying = false;
window.appState.cachedBlobs = window.appState.cachedBlobs || [];

// 1. Aspect Ratio & Crop Modes
const ASPECT_MODES = [
  { id: '16:9', label: '16:9 · WIDE', ratio: '16/9' },
  { id: '9:16', label: '9:16 · REEL', ratio: '9/16' },
  { id: '1:1',  label: '1:1 · SQUARE', ratio: '1/1' },
  { id: '4:5',  label: '4:5 · FEED', ratio: '4/5' },
  { id: '21:9', label: '21:9 · CINEMA', ratio: '21/9' }
];
let currentAspectIdx = 0;

window.cycleAspectRatio = function() {
  currentAspectIdx = (currentAspectIdx + 1) % ASPECT_MODES.length;
  const mode = ASPECT_MODES[currentAspectIdx];
  applyAspectRatio(mode.id);
  localStorage.setItem('genz_active_video_aspect', mode.id);
  showToast('បានប្តូរ Aspect Ratio: ' + mode.label);
};

function applyAspectRatio(aspectId) {
  const mode = ASPECT_MODES.find(m => m.id === aspectId) || ASPECT_MODES[0];
  currentAspectIdx = ASPECT_MODES.indexOf(mode);
  const stage = document.getElementById('stage');
  const badge = document.getElementById('stageBadgeAspect');
  if (stage) stage.style.aspectRatio = mode.ratio;
  if (badge) badge.textContent = mode.label;
}

window.toggleVideoFit = function() {
  const vp = document.getElementById('mainVideoPlayer');
  const badge = document.getElementById('stageBadgeFit');
  if (!vp) return;
  const currentFit = vp.style.objectFit === 'cover' ? 'cover' : 'contain';
  const newFit = currentFit === 'cover' ? 'contain' : 'cover';
  vp.style.objectFit = newFit;
  if (badge) badge.textContent = newFit === 'cover' ? 'CROP/FILL' : 'FIT';
  localStorage.setItem('genz_active_video_fit', newFit);
  showToast(newFit === 'cover' ? 'ទម្រង់ Crop / Fill (ពេញ Frame)' : 'ទម្រង់ Fit (រក្សាទំហំដើម)');
};

function applyVideoFit(fitMode) {
  const vp = document.getElementById('mainVideoPlayer');
  const badge = document.getElementById('stageBadgeFit');
  if (vp) vp.style.objectFit = fitMode;
  if (badge) badge.textContent = fitMode === 'cover' ? 'CROP/FILL' : 'FIT';
}

// 2. Real Video Upload & Instant Local Playback
window.uploadAndLoadVideo = async function(file) {
  if (!file) return;
  window.appState.videoFile = file;
  window.appState.videoFileName = file.name;

  // 1) Instant local object URL playback
  const localUrl = URL.createObjectURL(file);
  window.appState.videoUrl = localUrl;
  window.appState.cachedBlobs.push(localUrl);

  const vp = document.getElementById('mainVideoPlayer');
  const dropPlaceholder = document.getElementById('videoDropPlaceholder');
  const closeBtn = document.getElementById('btnCloseVideo');

  if (vp) {
    vp.src = localUrl;
    vp.style.display = 'block';
    if (dropPlaceholder) dropPlaceholder.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'flex';

    vp.onloadedmetadata = () => {
      window.appState.duration = vp.duration;
      initVideoTimelineInfo();
      showToast('បានបញ្ចូលវីដេអូ: ' + file.name + ' (' + formatTime(vp.duration) + ')');
    };
  }

  // 2) Persist local metadata immediately
  localStorage.setItem('genz_active_video_name', file.name);
  localStorage.setItem('genz_active_video_url', localUrl);

  // 3) Background upload to server for permanent persistence across sessions
  try {
    const formData = new FormData();
    formData.append('videoFile', file);
    const res = await fetch('/api/upload-video', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.url || data.path)) {
        const serverUrl = data.url || data.path;
        localStorage.setItem('genz_active_video_url', serverUrl);
        window.appState.videoUrl = serverUrl;
      }
    }
  } catch(e) {
    console.warn('Background video upload note:', e.message);
  }
};

window.openVideoPicker = function() {
  const input = document.getElementById('videoFileInput');
  if (input) {
    input.value = '';
    input.click();
  }
};

window.handleVideoFile = function(e) {
  const file = e.target.files && e.target.files[0];
  if (file) window.uploadAndLoadVideo(file);
};

// 3. Unload / Close Video (ចុចខ្វែង ឬលុប)
window.unloadActiveVideo = function() {
  if (!confirm('តើអ្នកពិតជាចង់បិទវីដេអូនេះមែនទេ? (Close and unload active video?)')) return;

  const vp = document.getElementById('mainVideoPlayer');
  const dropPlaceholder = document.getElementById('videoDropPlaceholder');
  const closeBtn = document.getElementById('btnCloseVideo');

  if (vp) {
    vp.pause();
    vp.src = '';
    vp.style.display = 'none';
  }
  if (dropPlaceholder) dropPlaceholder.style.display = 'flex';
  if (closeBtn) closeBtn.style.display = 'none';

  localStorage.removeItem('genz_active_video_url');
  localStorage.removeItem('genz_active_video_name');
  localStorage.removeItem('genz_video_time');

  window.appState.videoFile = null;
  window.appState.videoUrl = '';
  window.appState.videoFileName = 'No Video Loaded';
  window.appState.duration = 0;
  window.appState.currentTime = 0;

  const tpCur = document.getElementById('tpCurrentTime');
  const tpTot = document.getElementById('tpTotalTime');
  const tpProg = document.getElementById('tpScrubProgress');
  const ccTcTot = document.getElementById('ccTcTotal');
  const ccTcCur = document.getElementById('ccTcCurrent');
  const ccClipTitle = document.getElementById('ccVideoClipTitle');

  if (tpCur) tpCur.textContent = '00:00.0';
  if (tpTot) tpTot.textContent = '00:00.0';
  if (tpProg) tpProg.style.width = '0%';
  if (ccTcTot) ccTcTot.textContent = '00:00:00:00';
  if (ccTcCur) ccTcCur.textContent = '00:00:00:00';
  if (ccClipTitle) ccClipTitle.textContent = 'No Video Loaded';

  showToast('បានបិទ និងសម្អាតវីដេអូចេញរួចរាល់');
};

// 4. Real Timeline Synchronization (NO FAKE AUTO ANIMATIONS)
window.initVideoTimelineInfo = function() {
  const vp = document.getElementById('mainVideoPlayer');
  if (!vp || !vp.duration) return;
  const dur = vp.duration;

  const tpTot = document.getElementById('tpTotalTime');
  const ccTcTot = document.getElementById('ccTcTotal');
  const ccClipTitle = document.getElementById('ccVideoClipTitle');

  if (tpTot) tpTot.textContent = formatTime(dur);
  if (ccTcTot) ccTcTot.textContent = formatTimecode(dur);
  if (ccClipTitle) {
    ccClipTitle.textContent = (window.appState.videoFileName || 'VIDEO.mp4') + ' · ' + formatTime(dur);
  }

  // Populate dynamic timeline ruler markers
  renderDynamicTimelineRuler(dur);
};

window.updateRealTimelinePosition = function() {
  const vp = document.getElementById('mainVideoPlayer');
  if (!vp) return;
  const cur = vp.currentTime || 0;
  const dur = vp.duration || 1;
  const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

  window.appState.currentTime = cur;

  // Preview transport bar
  const tpCur = document.getElementById('tpCurrentTime');
  const tpProg = document.getElementById('tpScrubProgress');
  if (tpCur) tpCur.textContent = formatTime(cur);
  if (tpProg) tpProg.style.width = pct + '%';

  // Bottom Timeline Playhead
  const lanes = document.getElementById('ccLanesContent');
  const playhead = document.getElementById('ccPlayhead');
  const tcCurrent = document.getElementById('ccTcCurrent');
  const phBadge = document.getElementById('ccPhTimeBadge');

  if (tcCurrent) tcCurrent.textContent = formatTimecode(cur);
  if (phBadge) phBadge.textContent = formatTime(cur);

  if (lanes && playhead) {
    const totalW = lanes.clientWidth || 1000;
    playhead.style.left = (cur / dur * totalW) + 'px';
  }

  // Auto-persist current playback position
  localStorage.setItem('genz_video_time', cur.toString());

  // Subtitle highlighting
  if (typeof highlightActiveSubtitle === 'function') {
    highlightActiveSubtitle(cur);
  }
};

window.seekVideoScrub = function(e) {
  const vp = document.getElementById('mainVideoPlayer');
  const bar = document.getElementById('tpScrubBar');
  if (!vp || !vp.duration || !bar) return;
  const rect = bar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.min(1, Math.max(0, clickX / rect.width));
  vp.currentTime = pct * vp.duration;
  updateRealTimelinePosition();
};

window.seekTimelineRuler = function(e) {
  const vp = document.getElementById('mainVideoPlayer');
  const lanes = document.getElementById('ccLanesContent');
  if (!vp || !vp.duration || !lanes) return;
  const rect = lanes.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.min(1, Math.max(0, clickX / rect.width));
  vp.currentTime = pct * vp.duration;
  updateRealTimelinePosition();
};

function renderDynamicTimelineRuler(totalDuration) {
  const ruler = document.getElementById('ccRuler');
  if (!ruler) return;
  ruler.innerHTML = '';
  ruler.onclick = seekTimelineRuler;

  const stepSeconds = totalDuration > 300 ? 30 : totalDuration > 60 ? 10 : 5;
  const totalSteps = Math.ceil(totalDuration / stepSeconds);

  for (let i = 0; i <= totalSteps; i++) {
    const sec = i * stepSeconds;
    if (sec > totalDuration) break;
    const pct = (sec / totalDuration) * 100;
    const mark = document.createElement('span');
    mark.style.position = 'absolute';
    mark.style.left = pct + '%';
    mark.style.top = '0';
    mark.style.height = '100%';
    mark.style.paddingLeft = '4px';
    mark.style.borderLeft = '1px solid var(--line)';
    mark.style.fontSize = '9px';
    mark.style.color = 'var(--ink2)';
    mark.style.pointerEvents = 'none';
    mark.textContent = formatTime(sec);
    ruler.appendChild(mark);
  }
}

// 5. Global Drag & Drop Listeners
window.addEventListener('dragover', function(e) {
  e.preventDefault();
  e.stopPropagation();
  const overlay = document.getElementById('dragDropOverlay');
  if (overlay) overlay.style.display = 'flex';
});

window.addEventListener('dragleave', function(e) {
  if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    const overlay = document.getElementById('dragDropOverlay');
    if (overlay) overlay.style.display = 'none';
  }
});

window.addEventListener('drop', function(e) {
  e.preventDefault();
  e.stopPropagation();
  const overlay = document.getElementById('dragDropOverlay');
  if (overlay) overlay.style.display = 'none';

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    if (['mp4', 'mkv', 'mov', 'ts', 'webm', 'avi', 'm4v'].includes(ext)) {
      window.uploadAndLoadVideo(file);
    } else if (['srt', 'vtt', 'txt'].includes(ext)) {
      if (typeof handleSrtFile === 'function') {
        handleSrtFile({ target: { files: [file] } });
      }
    } else {
      showToast('ទម្រង់ File មិនគាំទ្រ: ' + ext);
    }
  }
});

// 6. Project Persistence across Refresh (F5)
window.restoreSavedProjectSession = function() {
  const savedUrl = localStorage.getItem('genz_active_video_url');
  const savedName = localStorage.getItem('genz_active_video_name');
  const savedAspect = localStorage.getItem('genz_active_video_aspect') || '16:9';
  const savedFit = localStorage.getItem('genz_active_video_fit') || 'contain';
  const savedTime = parseFloat(localStorage.getItem('genz_video_time') || '0');

  applyAspectRatio(savedAspect);

  if (savedUrl) {
    const vp = document.getElementById('mainVideoPlayer');
    const dropPlaceholder = document.getElementById('videoDropPlaceholder');
    const closeBtn = document.getElementById('btnCloseVideo');

    if (vp) {
      window.appState.videoFileName = savedName || 'RESTORED_PROJECT.mp4';
      vp.src = savedUrl;
      vp.style.display = 'block';
      if (dropPlaceholder) dropPlaceholder.style.display = 'none';
      if (closeBtn) closeBtn.style.display = 'flex';

      applyVideoFit(savedFit);

      vp.addEventListener('loadedmetadata', function() {
        if (savedTime > 0 && savedTime < vp.duration) {
          vp.currentTime = savedTime;
        }
        initVideoTimelineInfo();
        updateRealTimelinePosition();
      }, { once: true });
    }
  }

  // Restore Subtitle Rows
  try {
    const savedCues = localStorage.getItem('genz_project_cues');
    if (savedCues) {
      const cues = JSON.parse(savedCues);
      if (Array.isArray(cues) && cues.length > 0) {
        const tbl = document.querySelector('.tbl');
        if (tbl) {
          tbl.querySelectorAll('.tr').forEach(r => r.remove());
          cues.forEach((cue, idx) => {
            const row = createRowElement(idx + 1, cue.start || cue.startTc, cue.end || cue.endTc, cue.text || cue.khmerText, cue.speaker || cue.voiceLabel);
            tbl.appendChild(row);
          });
          renum();
          const emp = document.getElementById('tableEmptyState');
          if (emp) emp.style.display = 'none';
        }
      }
    }
  } catch(e) {
    console.warn('Cues restore note:', e.message);
  }
};

// Auto-save cues whenever modified
window.saveCurrentCuesToStorage = function() {
  const rows = document.querySelectorAll('.tbl .tr');
  const cues = [];
  rows.forEach(r => {
    const num = r.querySelector('.n')?.textContent || '';
    const start = r.children[2]?.textContent?.trim() || '';
    const end = r.children[3]?.textContent?.trim() || '';
    const text = r.children[4]?.textContent?.trim() || '';
    const spk = r.querySelector('.vc')?.textContent?.trim() || '';
    if (text) {
      cues.push({ num, start, end, text, speaker: spk });
    }
  });
  if (cues.length > 0) {
    localStorage.setItem('genz_project_cues', JSON.stringify(cues));
  }
};

// Wire project clear (សម្អាត Demo / សម្អាតទិន្នន័យ)
window.clearAllProjectData = function() {
  if (!confirm('តើអ្នកចង់សម្អាតទិន្នន័យទាំងអស់មែនទេ? (Clear all project subtitles and timeline?)')) return;
  localStorage.removeItem('genz_project_cues');
  const tbl = document.querySelector('.tbl');
  if (tbl) tbl.querySelectorAll('.tr').forEach(r => r.remove());
  const emp = document.getElementById('tableEmptyState');
  if (emp) emp.style.display = 'block';
  renum();
  showToast('បានសម្អាតទិន្នន័យ Subtitle រួចរាល់');
};

// Real Timecode Formatter Helper
function formatTimecode(sec) {
  if (isNaN(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 30);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + ':' + String(f).padStart(2,'0');
}
'''

# Replace startup logic and connect video player
old_startup = '''    // Connect video player events with UI
    var vp = document.getElementById('mainVideoPlayer');
    if (vp) {
      vp.addEventListener('timeupdate', function() {
        var cur = vp.currentTime;
        window.appState.currentTime = cur;
        highlightActiveSubtitle(cur);
      });
      vp.addEventListener('play', function() {
        document.body.classList.remove('paused');
      });
      vp.addEventListener('pause', function() {
        document.body.classList.add('paused');
      });
    }'''

new_startup = '''    // Connect real video player events with UI & Timeline
    var vp = document.getElementById('mainVideoPlayer');
    if (vp) {
      vp.addEventListener('timeupdate', function() {
        updateRealTimelinePosition();
      });
      vp.addEventListener('play', function() {
        document.body.classList.remove('paused');
        const playBtn = document.getElementById('btnTransportPlay');
        if (playBtn) playBtn.classList.add('playing');
      });
      vp.addEventListener('pause', function() {
        document.body.classList.add('paused');
        const playBtn = document.getElementById('btnTransportPlay');
        if (playBtn) playBtn.classList.remove('playing');
      });
    }

    // Restore saved project state automatically (persistence across refresh)
    restoreSavedProjectSession();'''

if old_startup in html:
    html = html.replace(old_startup, new_startup)

# Insert real_engine_js before </script>
script_close_idx = html.rfind('</script>')
if script_close_idx != -1:
    html = html[:script_close_idx] + "\n\n" + real_engine_js + "\n\n" + html[script_close_idx:]

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("Updated dist/index.html with real video engine, drag-drop, timeline sync, and persistence!")

