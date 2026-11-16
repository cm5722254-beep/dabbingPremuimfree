/**
 * Batch Processing System - Main Entry Point
 * Job queue, progress tracking, and crash-proof checkpoints
 */

// Import all batch modules (browser will use script tags)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  const JobQueue = require('./job-queue.js');
  const ProgressTracker = require('./progress-tracker.js');
  const CheckpointManager = require('./checkpoint.js');
  
  module.exports = {
    JobQueue,
    ProgressTracker,
    CheckpointManager
  };
}

/**
 * Global batch system instance
 */
let batchSystem = null;

/**
 * Initialize the batch processing system
 */
function initializeBatchSystem(options = {}) {
  if (typeof window === 'undefined') return;

  batchSystem = {
    queue: new JobQueue({
      maxParallel: options.maxParallel || 3,
      autoStart: options.autoStart !== false,
      retryAttempts: options.retryAttempts || 2
    }),
    progress: new ProgressTracker(),
    checkpoint: new CheckpointManager({
      autoSave: options.autoSave !== false,
      autoSaveInterval: options.autoSaveInterval || 10000
    })
  };

  // Connect queue events to progress tracker
  batchSystem.queue.on('job:started', ({ jobId }) => {
    batchSystem.progress.update(jobId, 0, { status: 'running' });
  });

  batchSystem.queue.on('job:progress', ({ jobId, progress }) => {
    batchSystem.progress.update(jobId, progress);
  });

  batchSystem.queue.on('job:completed', ({ jobId, result }) => {
    batchSystem.progress.complete(jobId, result);
  });

  batchSystem.queue.on('job:failed', ({ jobId, error }) => {
    batchSystem.progress.fail(jobId, error);
  });

  // Start auto-save when queue starts
  batchSystem.queue.on('queue:started', () => {
    batchSystem.progress.start();
    batchSystem.checkpoint.startAutoSave(batchSystem.queue, batchSystem.progress);
  });

  // Stop auto-save when queue completes
  batchSystem.queue.on('queue:complete', () => {
    batchSystem.checkpoint.stopAutoSave();
    batchSystem.checkpoint.delete(); // Clean up checkpoint
  });

  // Expose globally
  window.batchSystem = batchSystem;

  logInfo('✅ Batch system initialized', {
    maxParallel: batchSystem.queue.config.maxParallel
  });

  // Check for existing checkpoint
  checkForCheckpoint();

  return batchSystem;
}

/**
 * Check for existing checkpoint and prompt user
 */
async function checkForCheckpoint() {
  const info = await batchSystem.checkpoint.getInfo();
  
  if (info.exists) {
    const age = Math.floor(info.age / 1000);
    logInfo('💾 Found checkpoint', {
      age: `${age}s ago`,
      jobs: info.jobs
    });

    // Prompt user to restore (in UI)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('batch:checkpoint-found', {
        detail: info
      }));
    }
  }
}

/**
 * Add dubbing job to queue
 */
function addDubbingJob(videoPath, options = {}) {
  if (!batchSystem) {
    throw new Error('Batch system not initialized');
  }

  const jobId = batchSystem.queue.addJob({
    type: 'dubbing',
    videoPath,
    options,
    data: {
      videoPath,
      outputPath: options.outputPath || videoPath.replace(/\.[^.]+$/, '_dubbed$&')
    },
    executor: async (job, progressCallback) => {
      // Execute dubbing process
      return await executeDubbingJob(job, progressCallback);
    }
  });

  return jobId;
}

/**
 * Add multiple dubbing jobs
 */
function addDubbingJobs(videoPaths, options = {}) {
  const jobIds = [];
  
  videoPaths.forEach(videoPath => {
    jobIds.push(addDubbingJob(videoPath, options));
  });

  logInfo('Multiple dubbing jobs added', { count: jobIds.length });
  return jobIds;
}

/**
 * Execute dubbing job (placeholder - integrate with existing dubbing logic)
 */
async function executeDubbingJob(job, progressCallback) {
  // This should integrate with existing triggerOneClickDubbing or similar
  // For now, simulate the process
  
  logInfo('Executing dubbing job', {
    id: job.id,
    videoPath: job.videoPath
  });

  try {
    // Progress: 0-10% - Loading video
    progressCallback(5);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Progress: 10-30% - Extracting audio
    progressCallback(15);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Progress: 30-60% - Translating
    progressCallback(40);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Progress: 60-80% - Generating voice
    progressCallback(70);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Progress: 80-100% - Merging
    progressCallback(90);
    await new Promise(resolve => setTimeout(resolve, 1000));

    progressCallback(100);

    return {
      success: true,
      outputPath: job.data.outputPath,
      duration: 9 // seconds
    };

  } catch (error) {
    throw new Error(`Dubbing failed: ${error.message}`);
  }
}

/**
 * Start processing queue
 */
function startBatchProcessing() {
  if (!batchSystem) {
    throw new Error('Batch system not initialized');
  }

  return batchSystem.queue.start();
}

/**
 * Pause queue
 */
function pauseBatchProcessing() {
  if (!batchSystem) return false;
  return batchSystem.queue.pause();
}

/**
 * Resume queue
 */
function resumeBatchProcessing() {
  if (!batchSystem) return false;
  return batchSystem.queue.resume();
}

/**
 * Stop queue
 */
function stopBatchProcessing() {
  if (!batchSystem) return false;
  return batchSystem.queue.stop();
}

/**
 * Cancel specific job
 */
function cancelJob(jobId) {
  if (!batchSystem) return false;
  return batchSystem.queue.cancelJob(jobId);
}

/**
 * Get queue statistics
 */
function getBatchStats() {
  if (!batchSystem) return null;
  
  return {
    queue: batchSystem.queue.getStats(),
    progress: batchSystem.progress.getStatistics(),
    eta: batchSystem.queue.getETA()
  };
}

/**
 * Get all jobs
 */
function getAllJobs() {
  if (!batchSystem) return [];
  return batchSystem.queue.getAllJobs();
}

/**
 * Save checkpoint manually
 */
async function saveCheckpoint() {
  if (!batchSystem) return { success: false, error: 'Not initialized' };
  return await batchSystem.checkpoint.save(batchSystem.queue, batchSystem.progress);
}

/**
 * Restore from checkpoint
 */
async function restoreFromCheckpoint() {
  if (!batchSystem) return { success: false, error: 'Not initialized' };
  return await batchSystem.checkpoint.restore(batchSystem.queue, batchSystem.progress);
}

/**
 * Subscribe to progress updates
 */
function onProgressUpdate(callback) {
  if (!batchSystem) return () => {};
  return batchSystem.progress.subscribe(callback);
}

/**
 * Subscribe to queue events
 */
function onQueueEvent(event, callback) {
  if (!batchSystem) return;
  batchSystem.queue.on(event, callback);
}

/**
 * Get job by ID
 */
function getJob(jobId) {
  if (!batchSystem) return null;
  return batchSystem.queue.getJob(jobId);
}

/**
 * Clear completed jobs
 */
function clearCompleted() {
  if (!batchSystem) return;
  batchSystem.queue.clearCompleted();
}

/**
 * Clear all jobs
 */
function clearAll() {
  if (!batchSystem) return;
  batchSystem.queue.clearAll();
  batchSystem.progress.reset();
}

// Export global functions for browser
if (typeof window !== 'undefined') {
  window.initializeBatchSystem = initializeBatchSystem;
  window.addDubbingJob = addDubbingJob;
  window.addDubbingJobs = addDubbingJobs;
  window.startBatchProcessing = startBatchProcessing;
  window.pauseBatchProcessing = pauseBatchProcessing;
  window.resumeBatchProcessing = resumeBatchProcessing;
  window.stopBatchProcessing = stopBatchProcessing;
  window.cancelJob = cancelJob;
  window.getBatchStats = getBatchStats;
  window.getAllJobs = getAllJobs;
  window.saveCheckpoint = saveCheckpoint;
  window.restoreFromCheckpoint = restoreFromCheckpoint;
  window.onProgressUpdate = onProgressUpdate;
  window.onQueueEvent = onQueueEvent;
  window.getJob = getJob;
  window.clearCompletedJobs = clearCompleted;
  window.clearAllJobs = clearAll;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeBatchSystem());
  } else {
    initializeBatchSystem();
  }
}
