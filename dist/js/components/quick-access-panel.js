/**
 * Quick Access Panel - Floating Navigation to All Tools
 * Sync button that appears on all pages
 */

(function() {
  'use strict';

  const panelHTML = `
    <style>
      .quick-access-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #F59E0B 0%, #F5B544 50%, #FBBF24 100%);
        box-shadow: 0 4px 20px rgba(245, 181, 68, 0.5);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .quick-access-fab:hover {
        transform: translateY(-4px) scale(1.05);
        box-shadow: 0 8px 32px rgba(245, 181, 68, 0.7);
      }

      .quick-access-fab:active {
        transform: translateY(0) scale(0.95);
      }

      .quick-access-fab .icon {
        width: 28px;
        height: 28px;
        stroke: white;
        stroke-width: 2.5px;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.3s ease;
      }

      .quick-access-fab.open .icon {
        transform: rotate(45deg);
      }

      .quick-access-menu {
        position: fixed;
        bottom: 92px;
        right: 24px;
        width: 280px;
        background: var(--panel, #ffffff);
        border: 1px solid var(--line, #e6e8f2);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        padding: 16px;
        z-index: 998;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .quick-access-menu.show {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      .quick-access-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text, #1e2235);
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--line, #e6e8f2);
      }

      .quick-access-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .quick-access-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--soft, #eef0f8);
        border: 1px solid var(--line, #e6e8f2);
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        color: var(--text, #1e2235);
      }

      .quick-access-item:hover {
        background: var(--primary, #F5B544);
        color: white;
        border-color: var(--primary, #F5B544);
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(245, 181, 68, 0.3);
      }

      .quick-access-item .icon {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        stroke-width: 2px;
        fill: none;
        flex-shrink: 0;
      }

      .quick-access-item-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .quick-access-item-title {
        font-size: 13px;
        font-weight: 600;
      }

      .quick-access-item-desc {
        font-size: 10px;
        opacity: 0.7;
      }

      .quick-access-badge {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 99px;
        background: #10b981;
        color: white;
        text-transform: uppercase;
      }

      .quick-access-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(2px);
        z-index: 997;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .quick-access-overlay.show {
        opacity: 1;
        pointer-events: all;
      }

      @media (max-width: 768px) {
        .quick-access-fab {
          bottom: 16px;
          right: 16px;
          width: 48px;
          height: 48px;
        }

        .quick-access-menu {
          bottom: 72px;
          right: 16px;
          left: 16px;
          width: auto;
        }
      }
    </style>

    <div class="quick-access-overlay" id="quickAccessOverlay" onclick="window.quickAccessPanel.close()"></div>

    <button class="quick-access-fab" id="quickAccessFab" onclick="window.quickAccessPanel.toggle()">
      <svg class="icon" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <div class="quick-access-menu" id="quickAccessMenu">
      <div class="quick-access-title">🚀 Quick Access</div>
      <div class="quick-access-items">
        <a href="/" class="quick-access-item">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <div class="quick-access-item-text">
            <div class="quick-access-item-title">Main Studio</div>
            <div class="quick-access-item-desc">AI Dubbing Workspace</div>
          </div>
        </a>

        <a href="/batch_progress_dashboard.html" class="quick-access-item">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
            <path d="m7 11 4-4 4 4 4-4"/>
          </svg>
          <div class="quick-access-item-text">
            <div class="quick-access-item-title">Batch Dashboard</div>
            <div class="quick-access-item-desc">Real-time Progress Monitor</div>
          </div>
          <span class="quick-access-badge" id="batchBadge" style="display: none;">Active</span>
        </a>

        <a href="/system-diagnostic.html" class="quick-access-item">
          <svg class="icon" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6"/>
            <path d="m21 12h-6m-6 0H3"/>
          </svg>
          <div class="quick-access-item-text">
            <div class="quick-access-item-title">System Diagnostic</div>
            <div class="quick-access-item-desc">Check Dependencies</div>
          </div>
        </a>

        <a href="/test-premium-ui.html" class="quick-access-item">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
            <path d="M8.5 8.5v.01"/>
            <path d="M16 15.5v.01"/>
            <path d="M12 12v.01"/>
          </svg>
          <div class="quick-access-item-text">
            <div class="quick-access-item-title">UI Components</div>
            <div class="quick-access-item-desc">Test Premium Design</div>
          </div>
        </a>
      </div>
    </div>
  `;

  window.quickAccessPanel = {
    isOpen: false,

    toggle: function() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    open: function() {
      this.isOpen = true;
      document.getElementById('quickAccessFab')?.classList.add('open');
      document.getElementById('quickAccessMenu')?.classList.add('show');
      document.getElementById('quickAccessOverlay')?.classList.add('show');
    },

    close: function() {
      this.isOpen = false;
      document.getElementById('quickAccessFab')?.classList.remove('open');
      document.getElementById('quickAccessMenu')?.classList.remove('show');
      document.getElementById('quickAccessOverlay')?.classList.remove('show');
    },

    checkActiveBatches: function() {
      fetch('/api/batch/list')
        .then(r => r.json())
        .then(data => {
          const badge = document.getElementById('batchBadge');
          if (badge && data.success && data.batches && data.batches.length > 0) {
            badge.style.display = 'block';
          } else if (badge) {
            badge.style.display = 'none';
          }
        })
        .catch(() => {});
    },

    init: function() {
      if (document.body && !document.getElementById('quickAccessFab')) {
        document.body.insertAdjacentHTML('beforeend', panelHTML);
      }

      // Check for active batches
      this.checkActiveBatches();
      setInterval(() => this.checkActiveBatches(), 5000);

      // Close on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }
  };

  // Auto-initialize — but SKIP on main Studio page to avoid inspector overlap
  const _path = window.location.pathname;
  const _isMainStudio = _path === '/' || _path === '/index.html' || _path.endsWith('/dist/') || _path === '';
  if (!_isMainStudio) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.quickAccessPanel.init();
      });
    } else {
      window.quickAccessPanel.init();
    }
  }

})();
