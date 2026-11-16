/**
 * Job Queue - Professional batch processing queue
 * Parallel execution, priority management, pause/resume
 */

class JobQueue {
  constructor(options = {}) {
    this.jobs = new Map();
    this.activeJobs = new Set();
    this.completedJobs = new Set();
    this.failedJobs = new Set();
    
    this.config = {
      maxParallel: options.maxParallel || 3,
      autoStart: options.autoStart !== false,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 5000
    };

    this.state = 'idle'; // idle, running, paused, stopped
    this.processingPromise = null;
  }

  /**
   * Add job to queue
   */
  addJob(jobData) {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...jobData,
      status: 'pending',
      progress: 0,
      priority: jobData.priority || 5,
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null
    };

    this.jobs.set(job.id, job);

    logInfo('Job added to queue', {
      id: job.id,
      type: job.type,
      priority: job.priority,
      queueSize: this.jobs.size
    });

    // Auto-start if enabled and queue is idle
    if (this.config.autoStart && this.state === 'idle') {
      this.start();
    }

    return job.id;
  }

  /**
   * Add multiple jobs
   */
  addJobs(jobsData) {
    const jobIds = [];
    jobsData.forEach(jobData => {
      jobIds.push(this.addJob(jobData));
    });
    return jobIds;
  }

  /**
   * Get job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId, progress, data = {}) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      Object.assign(job, data);
      
      // Emit progress event
      this.emitEvent('job:progress', { jobId, progress, ...data });
    }
  }

  /**
   * Set job priority
   */
  setPriority(jobId, priority) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.priority = priority;
      logInfo('Job priority updated', { jobId, priority });
      return true;
    }
    return false;
  }

  /**
   * Start processing queue
   */
  async start() {
    if (this.state === 'running') {
      logWarning('Queue already running');
      return;
    }

    this.state = 'running';
    logInfo('🚀 Queue started', { maxParallel: this.config.maxParallel });

    this.emitEvent('queue:started');

    // Start processing
    this.processingPromise = this.processQueue();
    await this.processingPromise;
  }

  /**
   * Pause queue
   */
  pause() {
    if (this.state !== 'running') {
      return false;
    }

    this.state = 'paused';
    logInfo('⏸️ Queue paused');
    this.emitEvent('queue:paused');
    return true;
  }

  /**
   * Resume queue
   */
  resume() {
    if (this.state !== 'paused') {
      return false;
    }

    this.state = 'running';
    logInfo('▶️ Queue resumed');
    this.emitEvent('queue:resumed');

    // Continue processing
    this.processQueue();
    return true;
  }

  /**
   * Stop queue (cancel all pending jobs)
   */
  stop() {
    this.state = 'stopped';
    logInfo('⏹️ Queue stopped');
    this.emitEvent('queue:stopped');
    return true;
  }

  /**
   * Cancel specific job
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      // Mark for cancellation
      job.cancelled = true;
      job.status = 'cancelled';
      logInfo('Job cancelled', { jobId });
      this.emitEvent('job:cancelled', { jobId });
      return true;
    } else if (job.status === 'pending') {
      job.status = 'cancelled';
      logInfo('Job cancelled', { jobId });
      this.emitEvent('job:cancelled', { jobId });
      return true;
    }

    return false;
  }

  /**
   * Main queue processing loop
   */
  async processQueue() {
    while (this.state === 'running' || this.state === 'paused') {
      // Wait if paused
      if (this.state === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Check if we can process more jobs
      if (this.activeJobs.size >= this.config.maxParallel) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Get next job
      const nextJob = this.getNextJob();
      if (!nextJob) {
        // No more pending jobs
        if (this.activeJobs.size === 0) {
          // All jobs complete
          this.state = 'idle';
          logInfo('✅ Queue complete', {
            total: this.jobs.size,
            completed: this.completedJobs.size,
            failed: this.failedJobs.size
          });
          this.emitEvent('queue:complete', this.getStats());
          break;
        }
        // Wait for active jobs
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Process job
      this.processJob(nextJob);
    }

    if (this.state === 'stopped') {
      logInfo('Queue stopped by user');
    }
  }

  /**
   * Get next job to process (by priority)
   */
  getNextJob() {
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        // Sort by priority (higher first), then by creation time
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      });

    return pendingJobs[0] || null;
  }

  /**
   * Process individual job
   */
  async processJob(job) {
    this.activeJobs.add(job.id);
    job.status = 'running';
    job.startedAt = Date.now();
    job.attempts++;

    logInfo('🎬 Processing job', {
      id: job.id,
      type: job.type,
      attempt: job.attempts
    });

    this.emitEvent('job:started', { jobId: job.id, job });

    try {
      // Execute job
      const result = await this.executeJob(job);

      // Check if cancelled during execution
      if (job.cancelled) {
        throw new Error('Job cancelled by user');
      }

      // Job succeeded
      job.status = 'completed';
      job.completedAt = Date.now();
      job.progress = 100;
      job.result = result;
      
      this.completedJobs.add(job.id);
      this.activeJobs.delete(job.id);

      const duration = ((job.completedAt - job.startedAt) / 1000).toFixed(2);

      logInfo('✅ Job completed', {
        id: job.id,
        duration: `${duration}s`
      });

      this.emitEvent('job:completed', { jobId: job.id, result, duration });

    } catch (error) {
      logError('Job failed', {
        id: job.id,
        error: error.message,
        attempt: job.attempts
      });

      // Retry logic
      if (job.attempts < this.config.retryAttempts && !job.cancelled) {
        // Retry job
        job.status = 'pending';
        job.error = error.message;
        this.activeJobs.delete(job.id);

        logInfo('Retrying job', {
          id: job.id,
          attempt: job.attempts + 1,
          delay: this.config.retryDelay
        });

        this.emitEvent('job:retry', { jobId: job.id, attempt: job.attempts });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      } else {
        // Job failed permanently
        job.status = 'failed';
        job.completedAt = Date.now();
        job.error = error.message;
        
        this.failedJobs.add(job.id);
        this.activeJobs.delete(job.id);

        this.emitEvent('job:failed', { jobId: job.id, error: error.message });
      }
    }
  }

  /**
   * Execute job (override this or provide executor)
   */
  async executeJob(job) {
    if (job.executor && typeof job.executor === 'function') {
      return await job.executor(job, (progress) => {
        this.updateJobProgress(job.id, progress);
      });
    }

    throw new Error('No executor provided for job');
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const pending = Array.from(this.jobs.values()).filter(j => j.status === 'pending').length;
    const running = this.activeJobs.size;
    const completed = this.completedJobs.size;
    const failed = this.failedJobs.size;
    const total = this.jobs.size;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      progress: total > 0 ? ((completed + failed) / total) * 100 : 0,
      state: this.state
    };
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed jobs
   */
  clearCompleted() {
    this.completedJobs.forEach(jobId => {
      this.jobs.delete(jobId);
    });
    this.completedJobs.clear();
    logInfo('Completed jobs cleared');
  }

  /**
   * Clear all jobs
   */
  clearAll() {
    this.jobs.clear();
    this.activeJobs.clear();
    this.completedJobs.clear();
    this.failedJobs.clear();
    this.state = 'idle';
    logInfo('Queue cleared');
  }

  /**
   * Event emitter (simple implementation)
   */
  emitEvent(event, data) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(`jobqueue:${event}`, { detail: data }));
    }
  }

  /**
   * Subscribe to events
   */
  on(event, callback) {
    if (typeof window !== 'undefined') {
      window.addEventListener(`jobqueue:${event}`, (e) => callback(e.detail));
    }
  }

  /**
   * Get estimated time remaining
   */
  getETA() {
    if (this.completedJobs.size === 0) {
      return null; // Not enough data
    }

    // Calculate average job duration
    const completedJobsList = Array.from(this.completedJobs)
      .map(id => this.jobs.get(id))
      .filter(job => job && job.completedAt && job.startedAt);

    if (completedJobsList.length === 0) {
      return null;
    }

    const totalDuration = completedJobsList.reduce((sum, job) => {
      return sum + (job.completedAt - job.startedAt);
    }, 0);

    const avgDuration = totalDuration / completedJobsList.length;

    // Calculate remaining jobs
    const remaining = Array.from(this.jobs.values())
      .filter(j => j.status === 'pending' || j.status === 'running').length;

    // Account for parallel processing
    const effectiveDuration = avgDuration / this.config.maxParallel;

    return {
      eta: remaining * effectiveDuration,
      etaFormatted: this.formatDuration(remaining * effectiveDuration),
      avgJobDuration: avgDuration,
      remainingJobs: remaining
    };
  }

  /**
   * Format duration in ms to readable string
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobQueue;
}
