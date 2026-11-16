/**
 * Audio Processor - Cinema-Grade Audio Processing
 * Noise reduction, normalization, EQ, compression, and mastering
 */

class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.sampleRate = 48000; // Professional audio sample rate
    
    this.config = {
      targetLUFS: -16,           // Target loudness (broadcast standard)
      noiseThreshold: -50,        // Noise gate threshold (dB)
      compressionRatio: 3,        // Dynamic range compression ratio
      compressionThreshold: -20,  // Compression threshold (dB)
      eqPreset: 'voice',         // EQ preset
      deEsserFreq: 6000,         // De-esser frequency (Hz)
      reverbAmount: 0.15         // Reverb amount (0-1)
    };
  }

  /**
   * Initialize Web Audio API context
   */
  async initialize() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: this.sampleRate
        });
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      logInfo('Audio processor initialized', { 
        sampleRate: this.audioContext.sampleRate 
      });

      return { success: true };
    } catch (error) {
      logError('Failed to initialize audio processor', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Load audio file and decode
   */
  async loadAudio(file) {
    try {
      await this.initialize();

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      logInfo('Audio loaded', {
        duration: audioBuffer.duration.toFixed(2),
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });

      return {
        success: true,
        audioBuffer,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      };
    } catch (error) {
      logError('Failed to load audio', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove background noise (noise gate)
   */
  async removeNoise(audioBuffer, threshold = null) {
    threshold = threshold || this.config.noiseThreshold;
    
    logInfo('Applying noise reduction', { threshold });

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      const thresholdLinear = this.dbToLinear(threshold);

      for (let i = 0; i < inputData.length; i++) {
        const sample = inputData[i];
        const amplitude = Math.abs(sample);

        // Noise gate: silence below threshold
        if (amplitude < thresholdLinear) {
          outputData[i] = 0;
        } else {
          // Smooth gate transition
          const gateAmount = Math.min(1, (amplitude - thresholdLinear) / thresholdLinear);
          outputData[i] = sample * gateAmount;
        }
      }
    }

    logInfo('Noise reduction complete');
    return processedBuffer;
  }

  /**
   * Normalize audio to target loudness (LUFS)
   */
  async normalize(audioBuffer, targetLUFS = null) {
    targetLUFS = targetLUFS || this.config.targetLUFS;
    
    logInfo('Normalizing audio', { targetLUFS });

    // Calculate current RMS (Root Mean Square) as proxy for loudness
    let sumSquares = 0;
    let sampleCount = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
        sampleCount++;
      }
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    const currentDB = this.linearToDb(rms);
    
    // Calculate gain needed
    const gainDB = targetLUFS - currentDB;
    const gain = this.dbToLinear(gainDB);

    logInfo('Normalization calculated', {
      currentDB: currentDB.toFixed(2),
      targetDB: targetLUFS,
      gainDB: gainDB.toFixed(2),
      gain: gain.toFixed(3)
    });

    // Apply gain with limiting to prevent clipping
    const normalizedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);

      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i] * gain;
        
        // Soft clipping to prevent distortion
        if (Math.abs(sample) > 0.95) {
          sample = Math.sign(sample) * (0.95 + 0.05 * Math.tanh((Math.abs(sample) - 0.95) * 10));
        }
        
        outputData[i] = sample;
      }
    }

    logInfo('Normalization complete');
    return normalizedBuffer;
  }

  /**
   * Enhance voice frequencies
   */
  async enhanceVoice(audioBuffer, preset = 'voice') {
    logInfo('Enhancing voice', { preset });

    await this.initialize();

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // EQ filters for voice enhancement
    const eqFilters = this.createVoiceEQ(offlineContext, preset);

    // Connect chain: source -> EQ filters -> destination
    let currentNode = source;
    eqFilters.forEach(filter => {
      currentNode.connect(filter);
      currentNode = filter;
    });
    currentNode.connect(offlineContext.destination);

    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    
    logInfo('Voice enhancement complete');
    return renderedBuffer;
  }

  /**
   * Create voice EQ filter chain
   */
  createVoiceEQ(context, preset) {
    const filters = [];

    if (preset === 'voice' || preset === 'broadcast') {
      // High-pass filter: Remove rumble below 80Hz
      const highPass = context.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 80;
      highPass.Q.value = 0.7;
      filters.push(highPass);

      // Presence boost: 2-4kHz for clarity
      const presence = context.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3000;
      presence.Q.value = 1.0;
      presence.gain.value = 4; // +4dB
      filters.push(presence);

      // De-muddy: Reduce 200-400Hz
      const deMuddy = context.createBiquadFilter();
      deMuddy.type = 'peaking';
      deMuddy.frequency.value = 300;
      deMuddy.Q.value = 1.2;
      deMuddy.gain.value = -3; // -3dB
      filters.push(deMuddy);

      // Warmth: Slight boost at 150Hz
      const warmth = context.createBiquadFilter();
      warmth.type = 'peaking';
      warmth.frequency.value = 150;
      warmth.Q.value = 0.8;
      warmth.gain.value = 2; // +2dB
      filters.push(warmth);

      // Low-pass filter: Remove harsh highs above 12kHz
      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 12000;
      lowPass.Q.value = 0.7;
      filters.push(lowPass);
    }

    return filters;
  }

  /**
   * Apply dynamic range compression
   */
  async compress(audioBuffer, ratio = null, threshold = null) {
    ratio = ratio || this.config.compressionRatio;
    threshold = threshold || this.config.compressionThreshold;
    
    logInfo('Applying compression', { ratio, threshold });

    await this.initialize();

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create compressor
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = threshold;
    compressor.knee.value = 10; // Soft knee
    compressor.ratio.value = ratio;
    compressor.attack.value = 0.003; // 3ms
    compressor.release.value = 0.250; // 250ms

    // Connect: source -> compressor -> destination
    source.connect(compressor);
    compressor.connect(offlineContext.destination);

    source.start(0);

    const compressedBuffer = await offlineContext.startRendering();
    
    logInfo('Compression complete');
    return compressedBuffer;
  }

  /**
   * Add subtle reverb for ambience
   */
  async addReverb(audioBuffer, amount = null) {
    amount = amount || this.config.reverbAmount;
    
    logInfo('Adding reverb', { amount });

    await this.initialize();

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create reverb (using convolver with impulse response)
    const convolver = offlineContext.createConvolver();
    convolver.buffer = this.createReverbImpulse(offlineContext, 1.5); // 1.5s reverb

    // Dry/wet mix
    const dryGain = offlineContext.createGain();
    const wetGain = offlineContext.createGain();
    dryGain.gain.value = 1 - amount;
    wetGain.gain.value = amount;

    // Connect: source -> dry/wet -> destination
    source.connect(dryGain);
    source.connect(convolver);
    convolver.connect(wetGain);
    
    dryGain.connect(offlineContext.destination);
    wetGain.connect(offlineContext.destination);

    source.start(0);

    const reverbedBuffer = await offlineContext.startRendering();
    
    logInfo('Reverb complete');
    return reverbedBuffer;
  }

  /**
   * Create reverb impulse response
   */
  createReverbImpulse(context, duration) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay
        const decay = Math.exp(-i / (sampleRate * 0.5));
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    return impulse;
  }

  /**
   * De-ess (reduce harsh 's' sounds)
   */
  async deEss(audioBuffer, frequency = null) {
    frequency = frequency || this.config.deEsserFreq;
    
    logInfo('Applying de-esser', { frequency });

    await this.initialize();

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // High-shelf filter to reduce harsh highs
    const deEsser = offlineContext.createBiquadFilter();
    deEsser.type = 'highshelf';
    deEsser.frequency.value = frequency;
    deEsser.gain.value = -6; // Reduce by 6dB

    source.connect(deEsser);
    deEsser.connect(offlineContext.destination);

    source.start(0);

    const deEssedBuffer = await offlineContext.startRendering();
    
    logInfo('De-essing complete');
    return deEssedBuffer;
  }

  /**
   * Full mastering chain
   */
  async master(audioBuffer, options = {}) {
    logInfo('🎬 Starting full mastering chain');

    let processed = audioBuffer;

    // 1. Noise reduction
    if (options.removeNoise !== false) {
      processed = await this.removeNoise(processed);
    }

    // 2. Voice enhancement (EQ)
    if (options.enhanceVoice !== false) {
      processed = await this.enhanceVoice(processed);
    }

    // 3. De-esser
    if (options.deEss !== false) {
      processed = await this.deEss(processed);
    }

    // 4. Compression
    if (options.compress !== false) {
      processed = await this.compress(processed);
    }

    // 5. Normalization
    if (options.normalize !== false) {
      processed = await this.normalize(processed);
    }

    // 6. Reverb (optional)
    if (options.addReverb === true) {
      processed = await this.addReverb(processed);
    }

    logInfo('✅ Mastering chain complete');
    return processed;
  }

  /**
   * Export audio buffer to WAV blob
   */
  exportToWAV(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2;
    const sampleRate = audioBuffer.sampleRate;
    
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const value = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Helper: Write string to DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Helper: Convert dB to linear
   */
  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  /**
   * Helper: Convert linear to dB
   */
  linearToDb(linear) {
    return 20 * Math.log10(Math.max(linear, 0.00001));
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioProcessor;
}
