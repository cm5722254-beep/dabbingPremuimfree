/**
 * ═══════════════════════════════════════════════════════════════════
 * AUDIO ENHANCEMENT API ENDPOINTS
 * Backend processing for voice & BGM enhancement
 * ═══════════════════════════════════════════════════════════════════
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

// ═══════════════════════════════════════════════════════════════════
// 1. VOICE ENHANCEMENT API
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/audio/enhance-voice
 * Enhance voice quality with FFmpeg filters
 */
function setupVoiceEnhancementAPI(app, BASE_DIR) {
  app.post('/api/audio/enhance-voice', async (req, res) => {
    try {
      const { input, output, filters, config } = req.body;
      
      if (!input || !output || !filters) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: input, output, filters'
        });
      }
      
      console.log('[Audio Enhancement API] Enhancing voice:', input);
      
      // Build FFmpeg command
      const ffmpegPath = path.join(BASE_DIR, 'tools', 'ffmpeg', 'ffmpeg.exe');
      
      const command = `"${ffmpegPath}" -y -i "${input}" -af "${filters}" -ar 48000 -ac 2 -b:a 192k "${output}"`;
      
      console.log('[FFmpeg] Command:', command);
      
      // Execute FFmpeg
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024  // 10MB buffer
      });
      
      // Check if output exists
      if (fs.existsSync(output)) {
        console.log('[Audio Enhancement API] Voice enhancement completed');
        res.json({
          success: true,
          output: output,
          message: 'Voice enhanced successfully'
        });
      } else {
        throw new Error('Output file not created');
      }
    } catch (e) {
      console.error('[Audio Enhancement API] Voice enhancement failed:', e);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 2. BGM ENHANCEMENT API
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/audio/enhance-bgm
 * Enhance BGM quality with EQ and stereo processing
 */
function setupBGMEnhancementAPI(app, BASE_DIR) {
  app.post('/api/audio/enhance-bgm', async (req, res) => {
    try {
      const { input, output, filters, config } = req.body;
      
      if (!input || !output || !filters) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: input, output, filters'
        });
      }
      
      console.log('[Audio Enhancement API] Enhancing BGM:', input);
      
      // Build FFmpeg command
      const ffmpegPath = path.join(BASE_DIR, 'tools', 'ffmpeg', 'ffmpeg.exe');
      
      const command = `"${ffmpegPath}" -y -i "${input}" -af "${filters}" -ar 48000 -ac 2 -b:a 192k "${output}"`;
      
      console.log('[FFmpeg] Command:', command);
      
      // Execute FFmpeg
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      // Check if output exists
      if (fs.existsSync(output)) {
        console.log('[Audio Enhancement API] BGM enhancement completed');
        res.json({
          success: true,
          output: output,
          message: 'BGM enhanced successfully'
        });
      } else {
        throw new Error('Output file not created');
      }
    } catch (e) {
      console.error('[Audio Enhancement API] BGM enhancement failed:', e);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. AUDIO MIXING API
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/audio/mix
 * Mix voice with BGM with auto-ducking
 */
function setupAudioMixingAPI(app, BASE_DIR) {
  app.post('/api/audio/mix', async (req, res) => {
    try {
      const { voice, bgm, timeline, output } = req.body;
      
      if (!voice || !bgm || !output) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: voice, bgm, output'
        });
      }
      
      console.log('[Audio Enhancement API] Mixing voice with BGM');
      
      const ffmpegPath = path.join(BASE_DIR, 'tools', 'ffmpeg', 'ffmpeg.exe');
      
      // Build complex filter for mixing with ducking
      let filterComplex = '';
      
      if (bgm.ducking && bgm.ducking.enabled) {
        // Auto-ducking: reduce BGM when voice plays
        const duckAmount = bgm.ducking.duckAmount || -12;  // dB
        const attackTime = bgm.ducking.attackTime || 0.05;  // seconds
        const releaseTime = bgm.ducking.releaseTime || 0.3;  // seconds
        
        filterComplex = `
          [1:a]volume=${bgm.volumeNoDub}[bgm];
          [0:a]volume=${voice.volume}[voice];
          [bgm][voice]sidechaincompress=threshold=${duckAmount}dB:ratio=4:attack=${attackTime * 1000}:release=${releaseTime * 1000}[mixed];
          [mixed]alimiter=limit=${output.limiter.ceiling}[final]
        `.replace(/\s+/g, '');
      } else {
        // Simple mixing without ducking
        filterComplex = `
          [0:a]volume=${voice.volume}[voice];
          [1:a]volume=${bgm.volumeDuringDialogue}[bgm];
          [voice][bgm]amix=inputs=2:duration=longest[mixed];
          [mixed]alimiter=limit=${output.limiter.ceiling}[final]
        `.replace(/\s+/g, '');
      }
      
      // Normalize if requested
      if (output.normalize) {
        filterComplex = filterComplex.replace('[final]', '[premix];[premix]loudnorm=I=-16:TP=-1.5:LRA=11[final]');
      }
      
      const command = `"${ffmpegPath}" -y -i "${voice.path}" -i "${bgm.path}" -filter_complex "${filterComplex}" -map "[final]" -ar ${output.format.sampleRate} -ac ${output.format.channels} -b:a ${output.format.bitrate} "${output.path}"`;
      
      console.log('[FFmpeg] Mixing command:', command);
      
      // Execute FFmpeg
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 20 * 1024 * 1024,  // 20MB buffer for long files
        timeout: 300000  // 5 minutes timeout
      });
      
      // Check if output exists
      if (fs.existsSync(output.path)) {
        console.log('[Audio Enhancement API] Mixing completed successfully');
        res.json({
          success: true,
          output: output.path,
          message: 'Audio mixed successfully'
        });
      } else {
        throw new Error('Output file not created');
      }
    } catch (e) {
      console.error('[Audio Enhancement API] Mixing failed:', e);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 4. BATCH ENHANCEMENT API
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/audio/enhance-batch
 * Enhance multiple audio files in batch
 */
function setupBatchEnhancementAPI(app, BASE_DIR) {
  app.post('/api/audio/enhance-batch', async (req, res) => {
    try {
      const { files, config } = req.body;
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid files array'
        });
      }
      
      console.log(`[Audio Enhancement API] Batch enhancing ${files.length} files`);
      
      const results = [];
      
      // Process each file
      for (const file of files) {
        try {
          const { input, output, type } = file;  // type: 'voice' or 'bgm'
          
          let filters = '';
          
          if (type === 'voice') {
            // Voice enhancement filters
            filters = buildVoiceFilters(config.voiceClarity);
          } else if (type === 'bgm') {
            // BGM enhancement filters
            filters = buildBGMFilters(config.bgmBoost);
          }
          
          const ffmpegPath = path.join(BASE_DIR, 'tools', 'ffmpeg', 'ffmpeg.exe');
          const command = `"${ffmpegPath}" -y -i "${input}" -af "${filters}" -ar 48000 -ac 2 -b:a 192k "${output}"`;
          
          await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
          
          results.push({
            input: input,
            output: output,
            success: true
          });
          
          console.log(`[Batch Enhancement] Completed: ${path.basename(input)}`);
        } catch (e) {
          results.push({
            input: file.input,
            output: file.output,
            success: false,
            error: e.message
          });
          
          console.error(`[Batch Enhancement] Failed: ${path.basename(file.input)}`, e);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      console.log(`[Audio Enhancement API] Batch completed: ${successCount}/${files.length} successful`);
      
      res.json({
        success: true,
        results: results,
        summary: {
          total: files.length,
          successful: successCount,
          failed: files.length - successCount
        }
      });
    } catch (e) {
      console.error('[Audio Enhancement API] Batch enhancement failed:', e);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 5. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function buildVoiceFilters(config) {
  const filters = [];
  
  if (config.noiseReduction > 0) {
    filters.push(`highpass=f=80`);
    filters.push(`lowpass=f=15000`);
    filters.push(`afftdn=nf=${config.noiseReduction * 50}`);
  }
  
  if (config.deEsser > 0) {
    filters.push(`deesser=i=${config.deEsser * 20}:m=0.5:f=0.5:s=o`);
  }
  
  if (config.compression > 0) {
    const ratio = 2 + (config.compression * 4);
    filters.push(`acompressor=threshold=-20dB:ratio=${ratio}:attack=5:release=50`);
  }
  
  filters.push(`equalizer=f=3000:width_type=h:width=1000:g=3`);
  filters.push(`equalizer=f=200:width_type=h:width=100:g=-2`);
  
  if (config.normalize) {
    filters.push(`loudnorm=I=-16:TP=-1.5:LRA=11`);
  }
  
  return filters.join(',');
}

function buildBGMFilters(config) {
  const filters = [];
  
  if (config.volumeBoost !== 1.0) {
    const volumeDb = 20 * Math.log10(config.volumeBoost);
    filters.push(`volume=${volumeDb}dB`);
  }
  
  if (config.bassBoost > 1.0) {
    const bassDb = 20 * Math.log10(config.bassBoost);
    filters.push(`equalizer=f=80:width_type=h:width=50:g=${bassDb}`);
    filters.push(`equalizer=f=150:width_type=h:width=80:g=${bassDb * 0.7}`);
  }
  
  if (config.trebleBoost > 1.0) {
    const trebleDb = 20 * Math.log10(config.trebleBoost);
    filters.push(`equalizer=f=8000:width_type=h:width=4000:g=${trebleDb}`);
    filters.push(`equalizer=f=12000:width_type=h:width=4000:g=${trebleDb * 0.8}`);
  }
  
  if (config.stereoWidth > 1.0) {
    filters.push(`stereotools=mlev=1:mwid=${config.stereoWidth}`);
  }
  
  filters.push(`acompressor=threshold=-24dB:ratio=3:attack=20:release=200`);
  
  return filters.join(',');
}

// ═══════════════════════════════════════════════════════════════════
// 6. EXPORT MODULE
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  setupVoiceEnhancementAPI,
  setupBGMEnhancementAPI,
  setupAudioMixingAPI,
  setupBatchEnhancementAPI
};
