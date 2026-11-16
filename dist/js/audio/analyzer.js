/**
 * Audio Analyzer - Professional Audio Analysis Tools
 * Peak detection, silence detection, spectrum analysis, quality metrics
 */

class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  /**
   * Initialize audio context
   */
  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return { success: true };
  }

  /**
   * Analyze audio buffer comprehensively
   */
  async analyze(audioBuffer) {
    logInfo('Analyzing audio', {
      duration: audioBuffer.duration.toFixed(2),
      channels: audioBuffer.numberOfChannels
    });

    const analysis = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      peaks: this.detectPeaks(audioBuffer),
      silences: this.detectSilences(audioBuffer),
      loudness: this.analyzeLoudness(audioBuffer),
      dynamics: this.analyzeDynamics(audioBuffer),
      clipping: this.detectClipping(audioBuffer),
      spectrum: await this.analyzeSpectrum(audioBuffer),
      quality: null
    };

    // Calculate overall quality score
    analysis.quality = this.calculateQualityScore(analysis);

    logInfo('Audio analysis complete', { quality: analysis.quality });

    return analysis;
  }

  /**
   * Detect peaks in audio
   */
  detectPeaks(audioBuffer, threshold = 0.8) {
    const peaks = [];

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      
      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        
        if (amplitude > threshold) {
          const timeMs = (i / audioBuffer.sampleRate) * 1000;
          peaks.push({
            channel,
            time: timeMs,
            amplitude,
            sample: i
          });
        }
      }
    }

    logInfo('Peak detection', { count: peaks.length, threshold });

    return {
      count: peaks.length,
      peaks: peaks.slice(0, 100), // Limit to first 100
      maxAmplitude: peaks.length > 0 ? Math.max(...peaks.map(p => p.amplitude)) : 0
    };
  }

  /**
   * Detect silent regions
   */
  detectSilences(audioBuffer, threshold = 0.01, minDuration = 0.5) {
    const silences = [];
    const minSamples = minDuration * audioBuffer.sampleRate;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      
      let silentStart = null;
      let silentLength = 0;

      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        
        if (amplitude < threshold) {
          if (silentStart === null) {
            silentStart = i;
          }
          silentLength++;
        } else {
          if (silentStart !== null && silentLength >= minSamples) {
            const startTime = (silentStart / audioBuffer.sampleRate) * 1000;
            const duration = (silentLength / audioBuffer.sampleRate) * 1000;
            
            silences.push({
              channel,
              startTime,
              duration,
              startSample: silentStart,
              endSample: i
            });
          }
          silentStart = null;
          silentLength = 0;
        }
      }
    }

    logInfo('Silence detection', { count: silences.length });

    return {
      count: silences.length,
      silences,
      totalSilenceDuration: silences.reduce((sum, s) => sum + s.duration, 0)
    };
  }

  /**
   * Analyze loudness (RMS, LUFS approximation)
   */
  analyzeLoudness(audioBuffer) {
    let sumSquares = 0;
    let sampleCount = 0;
    let maxAmplitude = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        const amplitude = Math.abs(sample);
        
        sumSquares += sample * sample;
        sampleCount++;
        maxAmplitude = Math.max(maxAmplitude, amplitude);
      }
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    const rmsDB = 20 * Math.log10(Math.max(rms, 0.00001));
    const peakDB = 20 * Math.log10(Math.max(maxAmplitude, 0.00001));

    // Approximate LUFS (simplified)
    const lufs = rmsDB - 0.691; // K-weighting approximation

    return {
      rms,
      rmsDB: parseFloat(rmsDB.toFixed(2)),
      peak: maxAmplitude,
      peakDB: parseFloat(peakDB.toFixed(2)),
      lufs: parseFloat(lufs.toFixed(2)),
      crestFactor: parseFloat((maxAmplitude / rms).toFixed(2))
    };
  }

  /**
   * Analyze dynamic range
   */
  analyzeDynamics(audioBuffer) {
    const channelDynamics = [];

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      
      let min = Infinity;
      let max = -Infinity;

      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }

      const dynamicRange = max - min;
      const dynamicRangeDB = 20 * Math.log10(dynamicRange);

      channelDynamics.push({
        channel,
        min,
        max,
        dynamicRange,
        dynamicRangeDB: parseFloat(dynamicRangeDB.toFixed(2))
      });
    }

    const avgDynamicRangeDB = channelDynamics.reduce((sum, d) => sum + d.dynamicRangeDB, 0) / channelDynamics.length;

    return {
      channels: channelDynamics,
      averageDynamicRangeDB: parseFloat(avgDynamicRangeDB.toFixed(2))
    };
  }

  /**
   * Detect clipping (distortion)
   */
  detectClipping(audioBuffer, threshold = 0.99) {
    const clippedSamples = [];
    let clippingCount = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      
      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        
        if (amplitude >= threshold) {
          clippingCount++;
          
          if (clippedSamples.length < 100) {
            const timeMs = (i / audioBuffer.sampleRate) * 1000;
            clippedSamples.push({
              channel,
              time: timeMs,
              amplitude: channelData[i],
              sample: i
            });
          }
        }
      }
    }

    const clippingPercentage = (clippingCount / (audioBuffer.length * audioBuffer.numberOfChannels)) * 100;

    logInfo('Clipping detection', { 
      count: clippingCount, 
      percentage: clippingPercentage.toFixed(4) 
    });

    return {
      hasClipping: clippingCount > 0,
      count: clippingCount,
      percentage: parseFloat(clippingPercentage.toFixed(4)),
      samples: clippedSamples
    };
  }

  /**
   * Analyze frequency spectrum
   */
  async analyzeSpectrum(audioBuffer, fftSize = 2048) {
    await this.initialize();

    const offlineContext = new OfflineAudioContext(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = fftSize;

    source.connect(analyser);
    analyser.connect(offlineContext.destination);

    source.start(0);

    // Get frequency data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Sample at middle of audio
    await offlineContext.startRendering();
    analyser.getByteFrequencyData(dataArray);

    // Analyze frequency bands
    const bands = {
      subBass: { range: '20-60Hz', start: 0, end: 3 },
      bass: { range: '60-250Hz', start: 3, end: 12 },
      lowMid: { range: '250Hz-2kHz', start: 12, end: 100 },
      mid: { range: '2kHz-4kHz', start: 100, end: 200 },
      highMid: { range: '4kHz-6kHz', start: 200, end: 300 },
      presence: { range: '6kHz-8kHz', start: 300, end: 400 },
      brilliance: { range: '8kHz+', start: 400, end: bufferLength }
    };

    const spectrum = {};

    for (const [band, info] of Object.entries(bands)) {
      let sum = 0;
      let count = 0;

      for (let i = info.start; i < Math.min(info.end, bufferLength); i++) {
        sum += dataArray[i];
        count++;
      }

      spectrum[band] = {
        range: info.range,
        average: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0,
        normalized: count > 0 ? parseFloat(((sum / count) / 255).toFixed(2)) : 0
      };
    }

    return spectrum;
  }

  /**
   * Calculate overall quality score (0-100)
   */
  calculateQualityScore(analysis) {
    let score = 100;

    // Penalty for clipping (severe)
    if (analysis.clipping.percentage > 0) {
      score -= Math.min(50, analysis.clipping.percentage * 100);
    }

    // Penalty for poor loudness
    const targetLUFS = -16;
    const lufsDiff = Math.abs(analysis.loudness.lufs - targetLUFS);
    if (lufsDiff > 5) {
      score -= Math.min(20, lufsDiff * 2);
    }

    // Penalty for excessive peaks
    if (analysis.peaks.count > 1000) {
      score -= Math.min(15, (analysis.peaks.count - 1000) / 100);
    }

    // Penalty for too much silence
    const silenceRatio = analysis.silences.totalSilenceDuration / (analysis.duration * 1000);
    if (silenceRatio > 0.3) {
      score -= Math.min(10, (silenceRatio - 0.3) * 50);
    }

    // Penalty for low dynamic range (over-compressed)
    if (analysis.dynamics.averageDynamicRangeDB < 10) {
      score -= 10;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Get waveform data for visualization
   */
  getWaveformData(audioBuffer, samples = 1000) {
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const blockSize = Math.floor(channelData.length / samples);
    const waveform = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      
      let sum = 0;
      let max = 0;

      for (let j = start; j < end && j < channelData.length; j++) {
        const amplitude = Math.abs(channelData[j]);
        sum += amplitude;
        max = Math.max(max, amplitude);
      }

      waveform.push({
        index: i,
        average: sum / blockSize,
        peak: max,
        time: (start / audioBuffer.sampleRate) * 1000
      });
    }

    return waveform;
  }

  /**
   * Detect tempo/BPM (simplified)
   */
  detectTempo(audioBuffer) {
    // Simplified beat detection using peak analysis
    const peaks = this.detectPeaks(audioBuffer, 0.7);
    
    if (peaks.count < 2) {
      return { bpm: 0, confidence: 0 };
    }

    // Calculate average interval between peaks
    const intervals = [];
    for (let i = 1; i < peaks.peaks.length; i++) {
      intervals.push(peaks.peaks[i].time - peaks.peaks[i - 1].time);
    }

    if (intervals.length === 0) {
      return { bpm: 0, confidence: 0 };
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval); // Convert ms to BPM

    // Calculate confidence based on interval consistency
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;

    const confidence = Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / avgInterval)));

    return {
      bpm: bpm,
      confidence: parseFloat(confidence.toFixed(2)),
      avgInterval: parseFloat(avgInterval.toFixed(2))
    };
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioAnalyzer;
}
