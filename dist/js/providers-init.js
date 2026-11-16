/**
 * Provider System Initialization Script
 * Include this in your HTML after all provider scripts
 */

(function() {
  'use strict';

  console.log('🚀 Initializing Multi-Provider AI System...');

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProviderSystem);
  } else {
    initProviderSystem();
  }

  async function initProviderSystem() {
    try {
      // Check if providers are loaded
      if (typeof BaseProvider === 'undefined') {
        console.error('❌ Provider classes not loaded. Include provider scripts first.');
        return;
      }

      // Initialize the provider system
      const result = await initializeProviders();

      if (result.success) {
        console.log('✅ Provider system ready!', {
          providers: result.providers.length,
          available: result.providers.map(p => p.name)
        });

        // Update UI status indicators if they exist
        updateProviderStatusUI(result);
      } else {
        console.warn('⚠️ Provider system initialized with warnings:', result.error);
      }

    } catch (error) {
      console.error('❌ Failed to initialize provider system:', error);
    }
  }

  function updateProviderStatusUI(result) {
    // Add status dots to header if container exists
    const header = document.querySelector('header') || document.querySelector('.app-header');
    if (!header) return;

    // Check if status container already exists
    let statusContainer = document.getElementById('provider-status-dots');
    if (!statusContainer) {
      statusContainer = document.createElement('div');
      statusContainer.id = 'provider-status-dots';
      statusContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--soft);
        border-radius: 99px;
        margin-left: auto;
      `;
      header.appendChild(statusContainer);
    }

    // Clear existing dots
    statusContainer.innerHTML = '';

    // Get provider status
    const status = getProviderStatus();
    if (!status.initialized) return;

    const providers = status.factory.providers;

    providers.forEach(provider => {
      const dot = document.createElement('div');
      dot.className = 'provider-status-dot';
      dot.title = `${provider.displayName}: ${provider.status}`;
      
      const statusColor = {
        online: '#12985a',
        offline: '#9aa2cc',
        error: '#d6306a',
        limited: '#e07b00'
      }[provider.status] || '#9aa2cc';

      dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${statusColor};
        transition: all 0.3s ease;
        cursor: help;
      `;

      // Add pulse animation for online providers
      if (provider.status === 'online') {
        dot.style.boxShadow = `0 0 0 0 ${statusColor}`;
        dot.style.animation = 'provider-pulse 2s infinite';
      }

      statusContainer.appendChild(dot);
    });

    // Add pulse animation if not already defined
    if (!document.getElementById('provider-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'provider-pulse-style';
      style.textContent = `
        @keyframes provider-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(18, 152, 90, 0.7); }
          50% { box-shadow: 0 0 0 4px rgba(18, 152, 90, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Periodically update status (every 30 seconds)
  setInterval(() => {
    const result = getProviderStatus();
    if (result.initialized) {
      updateProviderStatusUI(result);
    }
  }, 30000);

})();
