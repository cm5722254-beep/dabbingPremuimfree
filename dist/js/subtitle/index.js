/**
 * Subtitle System - Main Entry Point
 * Professional subtitle processing for cinema-grade dubbing
 */

// Import all subtitle modules (browser will use script tags)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  const SubtitleParser = require('./parser.js');
  const SubtitleTimingEngine = require('./timing-engine.js');
  const SubtitleValidator = require('./validator.js');
  const SubtitleConverter = require('./converter.js');
  
  module.exports = {
    SubtitleParser,
    SubtitleTimingEngine,
    SubtitleValidator,
    SubtitleConverter
  };
}

/**
 * Initialize the subtitle system
 */
function initializeSubtitleSystem() {
  if (typeof window === 'undefined') return;

  // Create global instances
  window.subtitleParser = new SubtitleParser();
  window.subtitleTimingEngine = new SubtitleTimingEngine();
  window.subtitleValidator = new SubtitleValidator();
  window.subtitleConverter = new SubtitleConverter();

  logInfo('✅ Subtitle system initialized');
}

/**
 * Parse subtitle file (auto-detect format)
 */
async function parseSubtitleFile(file) {
  try {
    const content = await file.text();
    const format = file.name.split('.').pop().toLowerCase();
    
    const result = await window.subtitleParser.parse(content, format);
    
    if (result.success) {
      logInfo('Subtitle file parsed', {
        format: result.format,
        count: result.count,
        file: file.name
      });
    }

    return result;

  } catch (error) {
    logError('Failed to parse subtitle file', { error: error.message });
    return {
      success: false,
      error: error.message,
      subtitles: []
    };
  }
}

/**
 * Process subtitles (parse, validate, optimize)
 */
async function processSubtitles(content, format = 'auto') {
  try {
    // Parse
    const parseResult = await window.subtitleParser.parse(content, format);
    if (!parseResult.success) {
      return parseResult;
    }

    let subtitles = parseResult.subtitles;

    // Validate
    const validation = window.subtitleValidator.validate(subtitles);

    // Auto-fix common issues
    if (!validation.valid) {
      logInfo('Auto-fixing subtitle issues');
      
      // Fix overlaps
      subtitles = window.subtitleTimingEngine.fixOverlaps(subtitles);
      
      // Adjust timing
      subtitles = window.subtitleTimingEngine.autoAdjustTiming(subtitles);
    }

    // Get statistics
    const stats = window.subtitleTimingEngine.getStatistics(subtitles);

    return {
      success: true,
      subtitles,
      validation,
      stats,
      format: parseResult.format,
      autoFixed: !validation.valid
    };

  } catch (error) {
    logError('Failed to process subtitles', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export subtitles to file
 */
function exportSubtitles(subtitles, format, filename = 'subtitles') {
  try {
    window.subtitleConverter.downloadAs(subtitles, format, filename);
    return { success: true };
  } catch (error) {
    logError('Failed to export subtitles', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Get subtitle at specific time (for video sync)
 */
function getSubtitleAtTime(subtitles, timeMs) {
  return window.subtitleParser.getSubtitleAtTime(subtitles, timeMs);
}

/**
 * Sync subtitles to video timestamps
 */
function syncSubtitlesToVideo(subtitles, referencePoints) {
  return window.subtitleTimingEngine.syncToTimestamps(subtitles, referencePoints);
}

/**
 * Validate subtitle quality
 */
function validateSubtitleQuality(subtitles) {
  return window.subtitleValidator.validate(subtitles);
}

/**
 * Get subtitle statistics
 */
function getSubtitleStats(subtitles) {
  return window.subtitleTimingEngine.getStatistics(subtitles);
}

/**
 * Convert subtitle format
 */
function convertSubtitleFormat(subtitles, targetFormat) {
  return window.subtitleConverter.convert(subtitles, targetFormat);
}

// Export global functions for browser
if (typeof window !== 'undefined') {
  window.initializeSubtitleSystem = initializeSubtitleSystem;
  window.parseSubtitleFile = parseSubtitleFile;
  window.processSubtitles = processSubtitles;
  window.exportSubtitles = exportSubtitles;
  window.getSubtitleAtTime = getSubtitleAtTime;
  window.syncSubtitlesToVideo = syncSubtitlesToVideo;
  window.validateSubtitleQuality = validateSubtitleQuality;
  window.getSubtitleStats = getSubtitleStats;
  window.convertSubtitleFormat = convertSubtitleFormat;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSubtitleSystem);
  } else {
    initializeSubtitleSystem();
  }
}
