/**
 * Audio Mixer - Multi-track audio mixing
 * Mix voice, music, and sound effects with professional controls
 */

class AudioMixer {
  constructor() {
    this.audioContext = null;
    this.tracks = [];
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
   * Add track to mixer
   */
  addTrack(audioBuffer, options = {}) {
    const track = {
      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buffer: audioBuffer,
      name: options.name || `Track ${this.tracks.length + 1}`,
      type: options.type || 'audio', // 'voice', 'music', 'sfx', 'audio'
      volume: options.volume !== undefined ? options.volume : 1.0,
      pan: options.pan !== undefined ? options.pan : 0, // -1 (left) to 1 (right)
      muted: false,
      solo: false,
      effects: [],
      fadeIn: options.fadeIn || 0,
      fadeOut: options.fadeOut || 0,
      offset: options.offset || 0 // Start time offset in seconds
    };

    this.tracks.push(track);
    
    logInfo('Track added to mixer', { 
      id: track.id, 
      name: track.name,
      type: track.type,
      duration: audioBuffer.duration.toFixed(2)
    });

    return track.id;
  }

  /**
   * Remove track from mixer
   */
  removeTrack(trackId) {
    const index = this.tracks.findIndex(t => t.id === trackId);
    if (index !== -1) {
      this.tracks.splice(index, 1);
      logInfo('Track removed', { trackId });
      return true;
    }
    return false;
  }

  /**
   * Update track settings
   */
  updateTrack(trackId, updates) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      Object.assign(track, updates);
      logInfo('Track updated', { trackId, updates });
      return true;
    }
    return false;
  }

  /**
   * Mix all tracks into single audio buffer
   */
  async mix() {
    if (this.tracks.length === 0) {
      throw new Error('No tracks to mix');
    }

    await this.initialize();

    logInfo('🎵 Mixing tracks', { count: this.tracks.length });

    // Calculate total duration (longest track + offset)
    const totalDuration = Math.max(...this.tracks.map(t => 
      t.buffer.duration + t.offset
    ));

    // Determine sample rate and channels
    const sampleRate = this.audioContext.sampleRate;
    const channels = Math.max(...this.tracks.map(t => t.buffer.numberOfChannels));

    logInfo('Mix parameters', {
      duration: totalDuration.toFixed(2),
      sampleRate,
      channels
    });

    // Create offline context for mixing
    const offlineContext = new OfflineAudioContext(
      channels,
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    // Process each track
    const activeTracks = this.tracks.filter(t => !t.muted);
    const soloTracks = activeTracks.filter(t => t.solo);
    const tracksToMix = soloTracks.length > 0 ? soloTracks : activeTracks;

    logInfo('Active tracks', { 
      total: this.tracks.length,
      active: activeTracks.length,
      solo: soloTracks.length 
    });

    tracksToMix.forEach((track, idx) => {
      // Create source
      const source = offlineContext.createBufferSource();
      source.buffer = track.buffer;

      // Create gain node for volume
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = track.volume;

      // Apply fade in
      if (track.fadeIn > 0) {
        gainNode.gain.setValueAtTime(0, track.offset);
        gainNode.gain.linearRampToValueAtTime(track.volume, track.offset + track.fadeIn);
      }

      // Apply fade out
      if (track.fadeOut > 0) {
        const fadeOutStart = track.offset + track.buffer.duration - track.fadeOut;
        gainNode.gain.setValueAtTime(track.volume, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, track.offset + track.buffer.duration);
      }

      // Create pan node (stereo positioning)
      let currentNode = source;
      
      if (channels >= 2 && track.pan !== 0) {
        const panNode = offlineContext.createStereoPanner();
        panNode.pan.value = track.pan;
        currentNode.connect(panNode);
        currentNode = panNode;
      }

      // Connect to gain and destination
      currentNode.connect(gainNode);
      gainNode.connect(offlineContext.destination);

      // Start playback at offset
      source.start(track.offset);
    });

    // Render the mix
    const mixedBuffer = await offlineContext.startRendering();

    logInfo('✅ Mix complete', { 
      duration: mixedBuffer.duration.toFixed(2),
      tracks: tracksToMix.length 
    });

    return mixedBuffer;
  }

  /**
   * Mix voice with background music (with ducking)
   */
  async mixVoiceWithMusic(voiceBuffer, musicBuffer, options = {}) {
    const {
      voiceVolume = 1.0,
      musicVolume = 0.3,
      duckingAmount = 0.5, // How much to reduce music when voice is present
      duckingThreshold = 0.1, // Voice amplitude threshold to trigger ducking
      crossfadeDuration = 0.5 // Crossfade duration in seconds
    } = options;

    await this.initialize();

    logInfo('Mixing voice with music', { 
      voiceDuration: voiceBuffer.duration.toFixed(2),
      musicDuration: musicBuffer.duration.toFixed(2)
    });

    // Use the longer duration
    const totalDuration = Math.max(voiceBuffer.duration, musicBuffer.duration);
    const sampleRate = this.audioContext.sampleRate;

    const offlineContext = new OfflineAudioContext(
      2, // Stereo
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    // Voice track
    const voiceSource = offlineContext.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    const voiceGain = offlineContext.createGain();
    voiceGain.gain.value = voiceVolume;

    // Music track
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    const musicGain = offlineContext.createGain();
    
    // Apply ducking: analyze voice to reduce music volume
    const voiceData = voiceBuffer.getChannelData(0);
    const blockSize = Math.floor(sampleRate * 0.1); // 100ms blocks
    
    for (let i = 0; i < voiceData.length; i += blockSize) {
      const block = voiceData.slice(i, i + blockSize);
      const rms = Math.sqrt(block.reduce((sum, s) => sum + s * s, 0) / block.length);
      
      const time = i / sampleRate;
      const targetVolume = rms > duckingThreshold ? 
        musicVolume * duckingAmount : 
        musicVolume;
      
      musicGain.gain.linearRampToValueAtTime(targetVolume, time);
    }

    // Connect everything
    voiceSource.connect(voiceGain);
    musicSource.connect(musicGain);
    voiceGain.connect(offlineContext.destination);
    musicGain.connect(offlineContext.destination);

    voiceSource.start(0);
    musicSource.start(0);

    const mixedBuffer = await offlineContext.startRendering();

    logInfo('Voice+Music mix complete');
    return mixedBuffer;
  }

  /**
   * Apply crossfade between two audio buffers
   */
  async crossfade(buffer1, buffer2, duration = 1.0) {
    await this.initialize();

    const totalDuration = buffer1.duration + buffer2.duration - duration;
    const sampleRate = this.audioContext.sampleRate;

    const offlineContext = new OfflineAudioContext(
      Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels),
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    // First buffer (fade out)
    const source1 = offlineContext.createBufferSource();
    source1.buffer = buffer1;
    const gain1 = offlineContext.createGain();
    gain1.gain.value = 1.0;
    
    const fadeStart = buffer1.duration - duration;
    gain1.gain.setValueAtTime(1.0, fadeStart);
    gain1.gain.linearRampToValueAtTime(0, buffer1.duration);

    // Second buffer (fade in)
    const source2 = offlineContext.createBufferSource();
    source2.buffer = buffer2;
    const gain2 = offlineContext.createGain();
    gain2.gain.setValueAtTime(0, fadeStart);
    gain2.gain.linearRampToValueAtTime(1.0, fadeStart + duration);

    source1.connect(gain1);
    gain1.connect(offlineContext.destination);
    
    source2.connect(gain2);
    gain2.connect(offlineContext.destination);

    source1.start(0);
    source2.start(fadeStart);

    const result = await offlineContext.startRendering();

    logInfo('Crossfade complete', { 
      duration: duration,
      totalDuration: result.duration.toFixed(2)
    });

    return result;
  }

  /**
   * Concatenate audio buffers with optional gap
   */
  async concatenate(buffers, gap = 0) {
    await this.initialize();

    const totalDuration = buffers.reduce((sum, b) => sum + b.duration, 0) + (gap * (buffers.length - 1));
    const sampleRate = this.audioContext.sampleRate;
    const channels = Math.max(...buffers.map(b => b.numberOfChannels));

    const offlineContext = new OfflineAudioContext(
      channels,
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    let currentTime = 0;

    buffers.forEach((buffer, idx) => {
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineContext.destination);
      source.start(currentTime);
      
      currentTime += buffer.duration + gap;
    });

    const result = await offlineContext.startRendering();

    logInfo('Concatenation complete', { 
      parts: buffers.length,
      duration: result.duration.toFixed(2)
    });

    return result;
  }

  /**
   * Get mixer state
   */
  getState() {
    return {
      trackCount: this.tracks.length,
      tracks: this.tracks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        duration: t.buffer.duration,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        solo: t.solo,
        offset: t.offset
      }))
    };
  }

  /**
   * Clear all tracks
   */
  clear() {
    this.tracks = [];
    logInfo('Mixer cleared');
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioMixer;
}
