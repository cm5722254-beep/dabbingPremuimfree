/**
 * Progress Tracker - Real-time progress monitoring
 * Track individual jobs and overall queue progress
 */

class ProgressTracker {
  constructor() {
    this.progressData = new Map();
    this.startTime = null;
    this.subscribers = new Set();
  }

  /**
   * Start tracking
   */
  start() {
    this.startTime = Date.now();
    this.progressData.clear();
    logInfo('Progress tracking started');
  }

  /**
   * Update job progress
   */
  update(jobId, progress, metadata = {}) {
    const now = Date.now();
    
    const progressEntry = {
      jobId,
      progress: Math.min(100, Math.max(0, progress)),
      timestamp: now,
      ...metadata
    };

    this.progressData.set(jobId, progressEntry);

    // Notify subscribers
    this.notifySubscribers({
      type: 'progress',
      jobId,
      progress: progressEntry.progress,
      metadata
    });

    return progressEntry;
  }

  /**
   * Mark job as complete
   */
  complete(jobId, result = {}) {
    const entry = this.progressData.get(jobId);
    if (entry) {
      entry.progress = 100;
      entry.completed = true;
      entry.completedAt = Date.now();
      entry.result = result;

      this.notifySubscribers({
        type: 'complete',
        jobId,
        result
      });
    }
  }

  /**
   * Mark job as failed
   */
  fail(jobId, error) {
    const entry = this.progressData.get(jobId);
    if (entry) {
      entry.failed = true;
      entry.error = error;
      entry.completedAt = Date.now();

      this.notifySubscribers({
        type: 'failed',
        jobId,
        error
      });
    }
  }

  /**
   * Get progress for specific job
   */
  getProgress(jobId) {
    return this.progressData.get(jobId) || null;
  }

  /**
   * Get overall progress
   */
  getOverallProgress() {
    if (this.progressData.size === 0) {
      return {
        progress: 0,
        completed: 0,
        total: 0,
        failed: 0
      };
    }

    const entries = Array.from(this.progressData.values());
    const totalProgress = entries.reduce((sum, e) => sum + e.progress, 0);
    const completed = entries.filter(e => e.completed).length;
    const failed = entries.filter(e => e.failed).length;

    return {
      progress: totalProgress / entries.length,
      completed,
      failed,
      total: entries.length,
      active: entries.length - completed - failed
    };
  }

  /**
   * Calculate ETA
   */
  calculateETA() {
    if (!this.startTime || this.progressData.size === 0) {
      return null;
    }

    const overall = this.getOverallProgress();
    if (overall.progress === 0) {
      return null;
    }

    const elapsed = Date.now() - this.startTime;
    const estimatedTotal = (elapsed / overall.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    return {
      elapsed,
      remaining: Math.max(0, remaining),
      estimatedTotal,
      formattedElapsed: this.formatTime(elapsed),
      formattedRemaining: this.formatTime(remaining),
      formattedTotal: this.formatTime(estimatedTotal)
    };
  }

  /**
   * Get speed metrics
   */
  getSpeedMetrics() {
    if (!this.startTime) {
      return null;
    }

    const elapsed = (Date.now() - this.startTime) / 1000; // seconds
    const overall = this.getOverallProgress();

    return {
      jobsPerSecond: overall.completed / elapsed,
      jobsPerMinute: (overall.completed / elapsed) * 60,
      averageJobTime: overall.completed > 0 ? elapsed / overall.completed : 0
    };
  }

  /**
   * Get detailed statistics
   */
  getStatistics() {
    const overall = this.getOverallProgress();
    const eta = this.calculateETA();
    const speed = this.getSpeedMetrics();

    const entries = Array.from(this.progressData.values());
    
    return {
      overall,
      eta,
      speed,
      jobs: {
        total: entries.length,
        completed: overall.completed,
        failed: overall.failed,
        active: overall.active,
        pending: entries.length - overall.completed - overall.failed - overall.active
      },
      timing: {
        startTime: this.startTime,
        elapsed: eta ? eta.elapsed : 0,
        remaining: eta ? eta.remaining : null
      }
    };
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logError('Subscriber notification error', { error: error.message });
      }
    });
  }

  /**
   * Format time in milliseconds
   */
  formatTime(ms) {
    if (ms < 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Export progress data
   */
  export() {
    return {
      startTime: this.startTime,
      progress: Array.from(this.progressData.entries()),
      statistics: this.getStatistics()
    };
  }

  /**
   * Import progress data
   */
  import(data) {
    if (data.startTime) {
      this.startTime = data.startTime;
    }
    if (data.progress) {
      this.progressData = new Map(data.progress);
    }
    logInfo('Progress data imported');
  }

  /**
   * Reset tracker
   */
  reset() {
    this.progressData.clear();
    this.startTime = null;
    logInfo('Progress tracker reset');
  }

  /**
   * Get progress percentage formatted
   */
  getFormattedProgress(jobId) {
    const entry = this.getProgress(jobId);
    if (!entry) {
      return '0%';
    }
    return `${entry.progress.toFixed(1)}%`;
  }

  /**
   * Create progress bar string
   */
  createProgressBar(progress, width = 20) {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get color for progress
   */
  getProgressColor(progress) {
    if (progress >= 100) return '#12985a'; // Green
    if (progress >= 75) return '#3b62d9';  // Blue
    if (progress >= 50) return '#F5B544';  // Amber
    if (progress >= 25) return '#e07b00';  // Orange
    return '#d6306a'; // Red
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTracker;
}
