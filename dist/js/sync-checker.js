/**
 * UI Synchronization Checker
 * Ensures all pages have consistent navigation and features
 */

(function() {
  'use strict';

  const syncStatus = {
    hasHeader: false,
    hasQuickAccess: false,
    hasBatchDashboard: false,
    hasThemeSupport: false,
    pageTitle: document.title
  };

  // Check for Universal Header
  function checkHeader() {
    syncStatus.hasHeader = !!document.querySelector('.universal-header');
    return syncStatus.hasHeader;
  }

  // Check for Quick Access Panel
  function checkQuickAccess() {
    syncStatus.hasQuickAccess = !!document.getElementById('quickAccessFab');
    return syncStatus.hasQuickAccess;
  }

  // Check for Batch Dashboard access
  function checkBatchDashboard() {
    syncStatus.hasBatchDashboard = !!document.getElementById('btnBatchDashboard');
    return syncStatus.hasBatchDashboard;
  }

  // Check for Theme Support
  function checkThemeSupport() {
    const html = document.documentElement;
    syncStatus.hasThemeSupport = html.hasAttribute('data-theme');
    return syncStatus.hasThemeSupport;
  }

  // Initialize theme if not set
  function initializeTheme() {
    const html = document.documentElement;
    if (!html.hasAttribute('data-theme')) {
      const savedTheme = localStorage.getItem('app_theme') || 'light';
      html.setAttribute('data-theme', savedTheme);
    }
  }

  // Display sync status in console
  function displaySyncStatus() {
    console.log('%c🔄 UI Sync Status', 'font-size: 16px; font-weight: bold; color: #F5B544;');
    console.log('%c📄 Page:', 'font-weight: bold;', syncStatus.pageTitle);
    console.table({
      'Universal Header': syncStatus.hasHeader ? '✅' : '❌',
      'Quick Access Panel': syncStatus.hasQuickAccess ? '✅' : '❌',
      'Batch Dashboard': syncStatus.hasBatchDashboard ? '✅' : '❌',
      'Theme Support': syncStatus.hasThemeSupport ? '✅' : '❌'
    });

    if (syncStatus.hasHeader && syncStatus.hasQuickAccess && syncStatus.hasBatchDashboard && syncStatus.hasThemeSupport) {
      console.log('%c✅ All UI components synchronized!', 'color: #10b981; font-weight: bold;');
    } else {
      console.log('%c⚠️ Some UI components missing', 'color: #f59e0b; font-weight: bold;');
    }
  }

  // Run checks after page load
  function runSyncCheck() {
    setTimeout(() => {
      checkHeader();
      checkQuickAccess();
      checkBatchDashboard();
      checkThemeSupport();
      displaySyncStatus();
    }, 1000);
  }

  // Initialize
  initializeTheme();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSyncCheck);
  } else {
    runSyncCheck();
  }

  // Expose status globally for debugging
  window.uiSyncStatus = syncStatus;

})();
