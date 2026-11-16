/**
 * Audio System - Main Entry Point
 * Professional audio processing for cinema-grade dubbing
 */

// Import all audio modules (browser will use script tags)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  const AudioProcessor = require('./processor.js');
  const AudioAnalyzer = require('./analyzer.js');
  const AudioMixer = require('./mixer.js');
  
  module.exports = {
    AudioProcessor,
    AudioAnalyzer,
    AudioMixer
  };
}

/**
 * Initialize the audio system
 */
function initializeAudioSystem() {
  if (typeof window === 'undefined') return;

  // Create global instances
  window.audioProcessor = new AudioProcessor();
  window.audioAnalyzer = new AudioAnalyzer();
  window.audioMixer = new AudioMixer();

  logInfo('✅ Audio system initialized');
}

/**
 * Process audio file with full mastering chain
 */
async function processAudioFile(file, options = {}) {
  try {
    logInfo('Processing audio file', { name: file.name, size: file.size });

    // Load audio
    const loadResult = await window.audioProcessor.loadAudio(file);
    if (!loadResult.success) {
      return loadResult;
    }

    let processed = loadResult.audioBuffer;

    // Apply full mastering chain
    processed = await window.audioProcessor.master(processed, options);

    // Analyze the result
    const analysis = await window.audioAnalyzer.analyze(processed);

    return {
      success: true,
      audioBuffer: processed,
      analysis,
      duration: processed.duration,
      sampleRate: processed.sampleRate
    };

  } catch (error) {
    logError('Failed to process audio file', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze audio file without processing
 */
async function analyzeAudioFile(file) {
  try {
    const loadResult = await window.audioProcessor.loadAudio(file);
    if (!loadResult.success) {
      return loadResult;
    }

    const analysis = await window.audioAnalyzer.analyze(loadResult.audioBuffer);

    return {
      success: true,
      analysis,
      duration: loadResult.audioBuffer.duration
    };

  } catch (error) {
    logError('Failed to analyze audio file', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export audio buffer to file
 */
function exportAudio(audioBuffer, filename = 'audio') {
  try {
    const wavBlob = window.audioProcessor.exportToWAV(audioBuffer);
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `${filename}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logInfo('Audio exported', { filename });
    return { success: true };

  } catch (error) {
    logError('Failed to export audio', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Mix multiple audio files
 */
async function mixAudioFiles(files, options = {}) {
  try {
    window.audioMixer.clear();

    // Load all files
    for (const file of files) {
      const loadResult = await window.audioProcessor.loadAudio(file);
      if (loadResult.success) {
        window.audioMixer.addTrack(loadResult.audioBuffer, {
          name: file.name,
          ...options
        });
      }
    }

    // Mix all tracks
    const mixedBuffer = await window.audioMixer.mix();

    return {
      success: true,
      audioBuffer: mixedBuffer,
      duration: mixedBuffer.duration
    };

  } catch (error) {
    logError('Failed to mix audio files', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply noise reduction to audio
 */
async function removeNoiseFromAudio(audioBuffer, threshold = -50) {
  try {
    const processed = await window.audioProcessor.removeNoise(audioBuffer, threshold);
    return { success: true, audioBuffer: processed };
  } catch (error) {
    logError('Failed to remove noise', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Normalize audio loudness
 */
async function normalizeAudio(audioBuffer, targetLUFS = -16) {
  try {
    const processed = await window.audioProcessor.normalize(audioBuffer, targetLUFS);
    return { success: true, audioBuffer: processed };
  } catch (error) {
    logError('Failed to normalize audio', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Enhance voice quality
 */
async function enhanceVoice(audioBuffer) {
  try {
    const processed = await window.audioProcessor.enhanceVoice(audioBuffer);
    return { success: true, audioBuffer: processed };
  } catch (error) {
    logError('Failed to enhance voice', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Get audio waveform for visualization
 */
function getAudioWaveform(audioBuffer, samples = 1000) {
  try {
    const waveform = window.audioAnalyzer.getWaveformData(audioBuffer, samples);
    return { success: true, waveform };
  } catch (error) {
    logError('Failed to get waveform', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Detect audio quality issues
 */
async function detectAudioIssues(audioBuffer) {
  try {
    const analysis = await window.audioAnalyzer.analyze(audioBuffer);
    
    const issues = [];

    // Check for clipping
    if (analysis.clipping.hasClipping) {
      issues.push({
        type: 'clipping',
        severity: 'error',
        message: `Audio clipping detected (${analysis.clipping.percentage}%)`,
        fix: 'Reduce input gain or apply normalization'
      });
    }

    // Check loudness
    const lufsDiff = Math.abs(analysis.loudness.lufs - (-16));
    if (lufsDiff > 5) {
      issues.push({
        type: 'loudness',
        severity: 'warning',
        message: `Loudness ${analysis.loudness.lufs} LUFS (target: -16 LUFS)`,
        fix: 'Apply normalization'
      });
    }

    // Check dynamic range
    if (analysis.dynamics.averageDynamicRangeDB < 6) {
      issues.push({
        type: 'dynamics',
        severity: 'warning',
        message: 'Audio is over-compressed',
        fix: 'Reduce compression or use original source'
      });
    }

    return {
      success: true,
      issues,
      quality: analysis.quality
    };

  } catch (error) {
    logError('Failed to detect audio issues', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Export global functions for browser
if (typeof window !== 'undefined') {
  window.initializeAudioSystem = initializeAudioSystem;
  window.processAudioFile = processAudioFile;
  window.analyzeAudioFile = analyzeAudioFile;
  window.exportAudio = exportAudio;
  window.mixAudioFiles = mixAudioFiles;
  window.removeNoiseFromAudio = removeNoiseFromAudio;
  window.normalizeAudio = normalizeAudio;
  window.enhanceVoice = enhanceVoice;
  window.getAudioWaveform = getAudioWaveform;
  window.detectAudioIssues = detectAudioIssues;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAudioSystem);
  } else {
    initializeAudioSystem();
  }
}
