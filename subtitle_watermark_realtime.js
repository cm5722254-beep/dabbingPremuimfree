/**
 * ═══════════════════════════════════════════════════════════════════
 * REAL-TIME SUBTITLE OVERLAY & WATERMARK SYSTEM
 * Add this code to dist/index.html in a <script> tag before </body>
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. CREATE SUBTITLE OVERLAY ELEMENT (if not exists)
  // ═══════════════════════════════════════════════════════════════════
  
  function initSubtitleOverlay() {
    const videoEl = document.getElementById('mainVideoPlayer');
    if (!videoEl) return;

    const videoContainer = videoEl.parentElement;
    if (!videoContainer) return;

    // Check if subtitle overlay already exists
    let subtitleOverlay = document.getElementById('stageSubKh');
    
    if (!subtitleOverlay) {
      // Create subtitle overlay element
      subtitleOverlay = document.createElement('div');
      subtitleOverlay.id = 'stageSubKh';
      subtitleOverlay.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        font-family: 'Battambang', 'Khmer UI', sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
        text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 4px rgba(0,0,0,0.95);
        padding: 6px 14px;
        background: rgba(0,0,0,0.4);
        border-radius: 6px;
        line-height: 1.4;
        white-space: nowrap;
        max-width: 90%;
        text-align: center;
        display: none;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `;
      
      // Ensure parent container is positioned
      if (videoContainer.style.position !== 'absolute' && videoContainer.style.position !== 'relative') {
        videoContainer.style.position = 'relative';
      }
      
      videoContainer.appendChild(subtitleOverlay);
      console.log('[Subtitle Overlay] Created subtitle overlay element');
    }
    
    return subtitleOverlay;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. REAL-TIME SUBTITLE SYNC FUNCTION
  // ═══════════════════════════════════════════════════════════════════
  
  function parseTimeToSeconds(timeStr) {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;
    
    // Handle formats: "00:01:23.456" or "01:23.456" or just seconds
    const parts = String(timeStr).split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
      // HH:MM:SS.mmm
      seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS.mmm
      seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      // Just seconds
      seconds = parseFloat(timeStr);
    }
    
    return seconds;
  }

  window.syncSubtitleOverlay = function(currentTime) {
    const subtitleOverlay = document.getElementById('stageSubKh');
    if (!subtitleOverlay) return;

    // Get subtitles from appState
    const subtitles = window.appState?.subtitles || [];
    if (!subtitles.length) {
      subtitleOverlay.style.display = 'none';
      return;
    }

    // Check subtitle config
    const config = window.subtitlesConfig || {};
    if (config.burnSubtitles === false) {
      subtitleOverlay.style.display = 'none';
      return;
    }

    // Find current subtitle
    const currentSub = subtitles.find(sub => {
      const startTime = parseTimeToSeconds(sub.start);
      const endTime = parseTimeToSeconds(sub.end);
      return currentTime >= startTime && currentTime <= endTime;
    });

    if (currentSub && currentSub.text) {
      // Update subtitle text
      subtitleOverlay.textContent = currentSub.text;
      
      // Apply current config
      subtitleOverlay.style.fontSize = (config.fontSize || 16) + 'px';
      subtitleOverlay.style.fontFamily = (config.font || 'Battambang') + ', "Khmer UI", sans-serif';
      subtitleOverlay.style.color = config.color || '#ffffff';
      
      // Handle line mode
      if (config.lineMode === 'double') {
        subtitleOverlay.style.whiteSpace = 'normal';
        subtitleOverlay.style.maxWidth = '80%';
      } else {
        subtitleOverlay.style.whiteSpace = 'nowrap';
        subtitleOverlay.style.maxWidth = '90%';
      }
      
      // Show subtitle
      subtitleOverlay.style.display = 'block';
      subtitleOverlay.style.opacity = '1';
    } else {
      // Hide subtitle
      subtitleOverlay.style.opacity = '0';
      setTimeout(() => {
        if (subtitleOverlay.style.opacity === '0') {
          subtitleOverlay.style.display = 'none';
        }
      }, 200);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. HOOK INTO VIDEO TIMEUPDATE EVENT
  // ═══════════════════════════════════════════════════════════════════
  
  function setupSubtitleSync() {
    const videoEl = document.getElementById('mainVideoPlayer');
    if (!videoEl) {
      console.warn('[Subtitle Overlay] Video element not found, will retry...');
      setTimeout(setupSubtitleSync, 1000);
      return;
    }

    // Initialize overlay
    initSubtitleOverlay();

    // Save original ontimeupdate if exists
    const originalTimeUpdate = videoEl.ontimeupdate;

    // Enhanced timeupdate handler
    videoEl.ontimeupdate = function() {
      // Call original handler if exists
      if (originalTimeUpdate && typeof originalTimeUpdate === 'function') {
        originalTimeUpdate.call(this);
      }

      // Sync subtitle overlay
      window.syncSubtitleOverlay(videoEl.currentTime);
    };

    console.log('[Subtitle Overlay] Real-time subtitle sync activated!');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. WATERMARK DRAG & RESIZE SYSTEM
  // ═══════════════════════════════════════════════════════════════════
  
  function initWatermarkOverlay() {
    const videoEl = document.getElementById('mainVideoPlayer');
    if (!videoEl) return;

    const videoContainer = videoEl.parentElement;
    if (!videoContainer) return;

    let watermarkOverlay = document.getElementById('stageWatermark');
    
    if (!watermarkOverlay) {
      watermarkOverlay = document.createElement('div');
      watermarkOverlay.id = 'stageWatermark';
      watermarkOverlay.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 999;
        cursor: move;
        user-select: none;
        display: none;
      `;
      
      videoContainer.appendChild(watermarkOverlay);
      console.log('[Watermark] Created watermark overlay element');
    }
    
    return watermarkOverlay;
  }

  window.updateWatermarkLive = function() {
    const watermarkEl = document.getElementById('stageWatermark');
    if (!watermarkEl) return;

    const config = window.watermarkConfig || {};
    
    if (!config.enabled || !config.imageUrl) {
      watermarkEl.style.display = 'none';
      return;
    }

    // Create or update image
    let img = watermarkEl.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      watermarkEl.appendChild(img);
    }

    img.src = config.imageUrl;
    img.style.width = (config.width || 100) + 'px';
    img.style.height = (config.height || 100) + 'px';
    img.style.opacity = (config.opacity || 100) / 100;
    
    // Update position
    watermarkEl.style.top = (config.top || 20) + 'px';
    watermarkEl.style.right = (config.right || 20) + 'px';
    watermarkEl.style.display = 'block';
  };

  window.startWatermarkDrag = function() {
    const watermarkEl = document.getElementById('stageWatermark');
    if (!watermarkEl) return;

    let isDragging = false;
    let startX, startY, startTop, startRight;

    watermarkEl.addEventListener('mousedown', function(e) {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = watermarkEl.getBoundingClientRect();
      const parentRect = watermarkEl.parentElement.getBoundingClientRect();
      
      startTop = rect.top - parentRect.top;
      startRight = parentRect.right - rect.right;
      
      watermarkEl.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newTop = startTop + deltaY;
      const newRight = startRight - deltaX;

      watermarkEl.style.top = Math.max(0, newTop) + 'px';
      watermarkEl.style.right = Math.max(0, newRight) + 'px';

      // Update config
      if (window.watermarkConfig) {
        window.watermarkConfig.top = Math.max(0, newTop);
        window.watermarkConfig.right = Math.max(0, newRight);
      }
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        watermarkEl.style.cursor = 'move';
      }
    });

    console.log('[Watermark] Drag functionality enabled');
  };

  window.enableWatermarkResize = function() {
    const watermarkEl = document.getElementById('stageWatermark');
    if (!watermarkEl) return;

    // Add resize handle
    let resizeHandle = watermarkEl.querySelector('.resize-handle');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 15px;
        height: 15px;
        background: rgba(255,255,255,0.5);
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: nwse-resize;
        z-index: 10;
      `;
      watermarkEl.appendChild(resizeHandle);
    }

    let isResizing = false;
    let startWidth, startHeight, startX, startY;

    resizeHandle.addEventListener('mousedown', function(e) {
      isResizing = true;
      const img = watermarkEl.querySelector('img');
      if (img) {
        startWidth = img.offsetWidth;
        startHeight = img.offsetHeight;
      }
      startX = e.clientX;
      startY = e.clientY;
      e.stopPropagation();
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;

      const img = watermarkEl.querySelector('img');
      if (!img) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      const newHeight = Math.max(50, startHeight + deltaX); // Maintain aspect ratio

      img.style.width = newWidth + 'px';
      img.style.height = newHeight + 'px';

      // Update config
      if (window.watermarkConfig) {
        window.watermarkConfig.width = newWidth;
        window.watermarkConfig.height = newHeight;
      }
    });

    document.addEventListener('mouseup', function() {
      isResizing = false;
    });

    console.log('[Watermark] Resize functionality enabled');
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. INITIALIZE EVERYTHING
  // ═══════════════════════════════════════════════════════════════════
  
  function initializeRealtimeFeatures() {
    console.log('[Real-time Features] Initializing subtitle overlay and watermark system...');
    
    // Setup subtitle sync
    setupSubtitleSync();
    
    // Setup watermark
    setTimeout(() => {
      initWatermarkOverlay();
      window.startWatermarkDrag();
      window.enableWatermarkResize();
      window.updateWatermarkLive();
    }, 500);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRealtimeFeatures);
  } else {
    initializeRealtimeFeatures();
  }

  // Also try to initialize after a delay (in case DOM is already loaded)
  setTimeout(initializeRealtimeFeatures, 1000);

  console.log('[Real-time Features] Script loaded successfully!');
})();

/**
 * ═══════════════════════════════════════════════════════════════════
 * MANUAL TESTING COMMANDS (Open browser console and try these)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * // Test subtitle display
 * window.syncSubtitleOverlay(5.5);
 * 
 * // Toggle subtitle config
 * window.subtitlesConfig.burnSubtitles = true;
 * window.subtitlesConfig.fontSize = 20;
 * window.subtitlesConfig.color = '#ffff00';
 * 
 * // Test watermark
 * window.watermarkConfig = {
 *   enabled: true,
 *   imageUrl: '/path/to/logo.png',
 *   width: 100,
 *   height: 100,
 *   opacity: 80,
 *   top: 20,
 *   right: 20
 * };
 * window.updateWatermarkLive();
 * 
 * ═══════════════════════════════════════════════════════════════════
 */
