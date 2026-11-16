/**
 * Universal Header Component - Sync Across All UI Pages
 * Includes: Logo, Title, Dashboard Button, Language, Theme, Settings
 */

(function() {
  'use strict';

  // Header HTML Template
  const headerHTML = `
    <style>
      .universal-header {
        background: var(--panel, #ffffff);
        border-bottom: 1px solid var(--line, #e6e8f2);
        padding: 12px 20px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 100;
        transition: all 150ms ease;
        box-shadow: 0 1px 3px rgba(30, 34, 80, 0.08);
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand-logo-box {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6, #f59e0b);
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);
        flex-shrink: 0;
        overflow: hidden;
      }

      .brand-logo-box img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }

      .brand-text-col {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .brand-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--primary, #F5B544);
        letter-spacing: -0.01em;
        line-height: 1.25;
      }

      .brand-subtitle {
        font-size: 11.5px;
        font-weight: 500;
        color: var(--muted, #73788F);
        line-height: 1.35;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-icon-btn {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        border: 1px solid var(--line, #e6e8f2);
        background: var(--panel, #ffffff);
        color: var(--text, #1e2235);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(30, 34, 80, 0.08);
        position: relative;
        overflow: hidden;
      }

      .header-icon-btn::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: var(--primary, #F5B544);
        opacity: 0.2;
        transform: translate(-50%, -50%);
        transition: width 0.4s ease, height 0.4s ease;
      }

      .header-icon-btn:active::after {
        width: 100px;
        height: 100px;
      }

      .header-icon-btn:hover {
        background: var(--soft, #eef0f8);
        border-color: var(--primary, #F5B544);
        color: var(--primary, #F5B544);
        transform: translateY(-2px) rotate(5deg);
        box-shadow: 0 4px 12px rgba(245, 181, 68, 0.3);
      }

      .header-icon-btn:active {
        transform: translateY(0) scale(0.95);
      }

      .header-icon-btn .icon {
        width: 18px;
        height: 18px;
        stroke-width: 1.8px;
        stroke: currentColor;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .batch-active-indicator {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 6px #10b981;
        display: none;
        animation: pulse 2s infinite;
      }

      .batch-active-indicator.active {
        display: block;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }

      @keyframes iconPulseBreathe {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }

      .icon-pulse {
        animation: iconPulseBreathe 2s ease-in-out infinite;
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .universal-header {
          padding: 10px 12px;
          height: 56px;
        }

        .brand-logo-box {
          width: 36px;
          height: 36px;
        }

        .brand-title {
          font-size: 14px;
        }

        .brand-subtitle {
          font-size: 10px;
        }

        .header-icon-btn {
          width: 34px;
          height: 34px;
        }

        .header-right {
          gap: 6px;
        }
      }
    </style>

    <header class="universal-header">
      <div class="header-left">
        <div class="brand-logo-box">
          <img src="/ch_dabbing_logo.png" alt="Dabbing Premium Logo" onerror="this.style.display='none'">
        </div>
        <div class="brand-text-col">
          <div class="brand-title">DABBING PREMIUM</div>
          <div class="brand-subtitle">AI Cinema Dubbing Studio</div>
        </div>
      </div>

      <div class="header-right">
        <!-- Batch Dashboard Button -->
        <button class="header-icon-btn" id="btnBatchDashboard" onclick="window.universalHeaderActions.openBatchDashboard()" title="មើលដំណើរការ Batch Dubbing">
          <svg class="icon icon-pulse" viewBox="0 0 24 24">
            <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
            <path d="m7 11 4-4 4 4 4-4"/>
          </svg>
          <span class="batch-active-indicator" id="batchActiveIndicator"></span>
        </button>

        <!-- Language Switcher -->
        <button class="header-icon-btn" id="btnLanguage" onclick="window.universalHeaderActions.toggleLanguage()" title="Switch Language / ប្តូរភាសា">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
        </button>

        <!-- Dark Mode -->
        <button class="header-icon-btn" id="btnDarkMode" onclick="window.universalHeaderActions.setTheme('dark')" title="Dark Mode">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        </button>

        <!-- Light Mode -->
        <button class="header-icon-btn" id="btnLightMode" onclick="window.universalHeaderActions.setTheme('light')" title="Light Mode">
          <svg class="icon" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
          </svg>
        </button>

        <!-- Settings -->
        <button class="header-icon-btn" id="btnSettings" onclick="window.universalHeaderActions.openSettings()" title="Settings">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        <!-- Back to Main -->
        <button class="header-icon-btn" onclick="window.location.href='/'" title="Back to Main">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
      </div>
    </header>
  `;

  // Universal Header Actions
  window.universalHeaderActions = {
    openBatchDashboard: function() {
      window.open('/batch_progress_dashboard.html', 'BatchDashboard', 'width=1200,height=800');
    },

    toggleLanguage: function() {
      const currentLang = localStorage.getItem('app_language') || 'km';
      const newLang = currentLang === 'km' ? 'en' : 'km';
      localStorage.setItem('app_language', newLang);
      location.reload();
    },

    setTheme: function(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('app_theme', theme);
      this.updateThemeButtons();
    },

    updateThemeButtons: function() {
      const theme = document.documentElement.getAttribute('data-theme');
      const darkBtn = document.getElementById('btnDarkMode');
      const lightBtn = document.getElementById('btnLightMode');
      
      if (theme === 'dark') {
        if (darkBtn) darkBtn.style.display = 'none';
        if (lightBtn) lightBtn.style.display = 'flex';
      } else {
        if (darkBtn) darkBtn.style.display = 'flex';
        if (lightBtn) lightBtn.style.display = 'none';
      }
    },

    openSettings: function() {
      // Try to call main page settings if available
      if (typeof openSettingsModal === 'function') {
        openSettingsModal();
      } else {
        window.location.href = '/#settings';
      }
    },

    checkActiveBatchSessions: function() {
      fetch('/api/batch/list')
        .then(r => r.json())
        .then(data => {
          const indicator = document.getElementById('batchActiveIndicator');
          if (indicator && data.success && data.batches && data.batches.length > 0) {
            indicator.classList.add('active');
          } else if (indicator) {
            indicator.classList.remove('active');
          }
        })
        .catch(() => {});
    },

    init: function() {
      // Insert header at the beginning of body
      if (document.body && !document.querySelector('.universal-header')) {
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
      }

      // Apply saved theme
      const savedTheme = localStorage.getItem('app_theme') || 'light';
      this.setTheme(savedTheme);

      // Check for active batch sessions
      this.checkActiveBatchSessions();
      setInterval(() => this.checkActiveBatchSessions(), 5000);
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.universalHeaderActions.init();
    });
  } else {
    window.universalHeaderActions.init();
  }

})();
