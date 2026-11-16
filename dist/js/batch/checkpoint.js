/**
 * Checkpoint System - Crash-proof state persistence
 * Save and restore queue state for resume capability
 */

class CheckpointManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'dabbing_queue_checkpoint';
    this.autoSave = options.autoSave !== false;
    this.autoSaveInterval = options.autoSaveInterval || 10000; // 10 seconds
    this.autoSaveTimer = null;
  }

  /**
   * Save checkpoint
   */
  async save(queue, progressTracker = null) {
    try {
      const checkpoint = {
        version: '1.0',
        timestamp: Date.now(),
        queue: this.serializeQueue(queue),
        progress: progressTracker ? progressTracker.export() : null
      };

      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(checkpoint));
      }

      // Save to file (server-side via API)
      await this.saveToFile(checkpoint);

      logInfo('💾 Checkpoint saved', {
        jobs: checkpoint.queue.jobs.length,
        timestamp: new Date(checkpoint.timestamp).toISOString()
      });

      return { success: true, checkpoint };

    } catch (error) {
      logError('Failed to save checkpoint', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Load checkpoint
   */
  async load() {
    try {
      let checkpoint = null;

      // Try localStorage first
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          checkpoint = JSON.parse(stored);
        }
      }

      // Try file if localStorage failed
      if (!checkpoint) {
        checkpoint = await this.loadFromFile();
      }

      if (!checkpoint) {
        return { success: false, error: 'No checkpoint found' };
      }

      logInfo('📂 Checkpoint loaded', {
        jobs: checkpoint.queue.jobs.length,
        timestamp: new Date(checkpoint.timestamp).toISOString(),
        age: ((Date.now() - checkpoint.timestamp) / 1000).toFixed(0) + 's'
      });

      return { success: true, checkpoint };

    } catch (error) {
      logError('Failed to load checkpoint', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore queue from checkpoint
   */
  async restore(queue, progressTracker = null) {
    const loadResult = await this.load();
    
    if (!loadResult.success) {
      return loadResult;
    }

    const checkpoint = loadResult.checkpoint;

    try {
      // Clear current queue
      queue.clearAll();

      // Restore jobs
      checkpoint.queue.jobs.forEach(jobData => {
        const job = this.deserializeJob(jobData);
        
        // Reset running jobs to pending
        if (job.status === 'running') {
          job.status = 'pending';
          job.progress = 0;
        }

        queue.jobs.set(job.id, job);

        // Update sets
        if (job.status === 'completed') {
          queue.completedJobs.add(job.id);
        } else if (job.status === 'failed') {
          queue.failedJobs.add(job.id);
        }
      });

      // Restore queue state
      queue.state = checkpoint.queue.state === 'running' ? 'idle' : checkpoint.queue.state;
      queue.config = { ...queue.config, ...checkpoint.queue.config };

      // Restore progress tracker
      if (progressTracker && checkpoint.progress) {
        progressTracker.import(checkpoint.progress);
      }

      logInfo('✅ Queue restored from checkpoint', {
        totalJobs: queue.jobs.size,
        pending: Array.from(queue.jobs.values()).filter(j => j.status === 'pending').length,
        completed: queue.completedJobs.size
      });

      return { 
        success: true, 
        jobs: queue.jobs.size,
        pending: Array.from(queue.jobs.values()).filter(j => j.status === 'pending').length
      };

    } catch (error) {
      logError('Failed to restore checkpoint', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Serialize queue state
   */
  serializeQueue(queue) {
    return {
      jobs: Array.from(queue.jobs.values()).map(job => this.serializeJob(job)),
      state: queue.state,
      config: queue.config,
      stats: queue.getStats()
    };
  }

  /**
   * Serialize individual job
   */
  serializeJob(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      priority: job.priority,
      attempts: job.attempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      // Store job data but not executor function
      data: job.data,
      videoPath: job.videoPath,
      options: job.options
    };
  }

  /**
   * Deserialize job
   */
  deserializeJob(jobData) {
    return {
      ...jobData,
      // Executor will need to be re-attached
      executor: null
    };
  }

  /**
   * Save checkpoint to file via API
   */
  async saveToFile(checkpoint) {
    try {
      const response = await fetch('/api/checkpoint/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkpoint)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      // Silent fail for file save (localStorage is primary)
      logWarning('File checkpoint save failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Load checkpoint from file via API
   */
  async loadFromFile() {
    try {
      const response = await fetch('/api/checkpoint/load');
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete checkpoint
   */
  async delete() {
    try {
      // Delete from localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }

      // Delete from file
      await fetch('/api/checkpoint/delete', { method: 'DELETE' });

      logInfo('Checkpoint deleted');
      return { success: true };
    } catch (error) {
      logError('Failed to delete checkpoint', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if checkpoint exists
   */
  async exists() {
    // Check localStorage
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.storageKey) !== null;
    }

    // Check file
    try {
      const response = await fetch('/api/checkpoint/exists');
      if (response.ok) {
        const data = await response.json();
        return data.exists === true;
      }
    } catch (error) {
      // Ignore
    }

    return false;
  }

  /**
   * Start auto-save
   */
  startAutoSave(queue, progressTracker = null) {
    if (!this.autoSave) {
      return;
    }

    this.stopAutoSave();

    this.autoSaveTimer = setInterval(() => {
      if (queue.state === 'running') {
        this.save(queue, progressTracker);
      }
    }, this.autoSaveInterval);

    logInfo('Auto-save started', { interval: this.autoSaveInterval });
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      logInfo('Auto-save stopped');
    }
  }

  /**
   * Get checkpoint info without loading
   */
  async getInfo() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const checkpoint = JSON.parse(stored);
          return {
            exists: true,
            timestamp: checkpoint.timestamp,
            age: Date.now() - checkpoint.timestamp,
            jobs: checkpoint.queue.jobs.length,
            state: checkpoint.queue.state
          };
        }
      }

      return { exists: false };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckpointManager;
}
