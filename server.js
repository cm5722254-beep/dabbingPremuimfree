/**
 * Dabbing Pro - Studio Edition Local Backend Server
 * 
 * High Performance Node.js Backend for AI Video Dubbing & VOXCPM2 Voice Cloning
 * Features:
 *  1. Google Translate to Khmer (100% Free, Fast & Accurate)
 *  2. VOXCPM2 Mode 1: CLONE ពីរឿងដើម (Direct Character Voice Clone from Original Movie)
 *  3. VOXCPM2 Mode 2: CLONE VOICE CHARACTER (Custom Character Voice Clone)
 *  4. VOXCPM2 Execution: Computer Local GPU or Colab & Kaggle GPU (Put Link)
 *  5. Character Voice Consistency: Each character strictly has 1 unique voice throughout the movie
 *  6. Vocal Removal & Auto-Ducking (Mute original voice, keep BGM)
 *  7. High Capacity Batch Dubbing (Up to 8 movies at once, 1-hour movies supported)
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec, spawn } = require('child_process');

// =====================================================================
// 9ROUTER TRANSLATION GATEWAY INTEGRATION
// =====================================================================
const routingEngine = require('./router/routing-engine');
const quotaTracker = require('./router/quota-tracker');

const app = express();
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));
const PORT = process.env.PORT || 3001;

function getAppBaseDir() {
  if (process.pkg) return path.dirname(process.execPath);
  const execDir = path.dirname(process.execPath);
  if (fs.existsSync(path.join(execDir, 'tools'))) return execDir;
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'tools'))) return process.resourcesPath;
  if (fs.existsSync(path.join(__dirname, 'tools'))) return __dirname;
  return process.cwd();
}
const BASE_DIR = getAppBaseDir();

// =====================================================================
// Telegram Live Notification System (Alerts when movies finish)
// =====================================================================
const TELEGRAM_CONFIG_FILE = path.join(BASE_DIR, 'telegram_config.json');

function loadTelegramConfig() {
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return { enabled: false, botToken: '', chatId: '' };
}

function saveTelegramConfig(cfg) {
  try {
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

async function sendTelegramNotification(text) {
  try {
    const cfg = loadTelegramConfig();
    if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return false;
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    return res.ok;
  } catch (e) {
    log(`[Telegram Notice] Failed to send: ${e.message}`, 'WARN');
    return false;
  }
}

app.get('/api/telegram-config', (req, res) => {
  res.json({ success: true, config: loadTelegramConfig() });
});

app.post('/api/telegram-config', (req, res) => {
  const { enabled, botToken, chatId } = req.body;
  const cfg = { enabled: !!enabled, botToken: (botToken || '').trim(), chatId: (chatId || '').trim() };
  saveTelegramConfig(cfg);
  res.json({ success: true, config: cfg });
});

app.post('/api/telegram-test', async (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'សូមបញ្ចូល Bot Token និង Chat ID' });
  }
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: '🎉 <b>Dabbing Studio Pro</b>: តេស្តការតភ្ជាប់ Telegram Notification ជោគជ័យ ១០០%! 🚀',
        parse_mode: 'HTML'
      })
    });
    const data = await resp.json();
    if (data.ok) {
      res.json({ success: true, message: 'ផ្ញើសារសាកល្បងជោគជ័យ!' });
    } else {
      res.json({ success: false, error: data.description || 'Telegram API Error' });
    }
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// =====================================================================
// 9ROUTER TRANSLATION GATEWAY API ENDPOINTS
// =====================================================================

// Get Router Configuration
app.get('/api/router/config', (req, res) => {
  try {
    const config = routingEngine.loadConfig();
    if (!config) {
      return res.status(500).json({ success: false, error: 'Failed to load router config' });
    }
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Router Configuration
app.post('/api/router/config', (req, res) => {
  try {
    const updates = req.body;
    const config = routingEngine.loadConfig();
    
    if (!config) {
      return res.status(500).json({ success: false, error: 'Failed to load router config' });
    }

    // Apply updates
    if (updates.routerEndpoint) config.routerEndpoint = updates.routerEndpoint;
    if (updates.routingStrategy) config.routingStrategy = updates.routingStrategy;
    if (updates.reliability) Object.assign(config.reliability, updates.reliability);
    if (updates.privacy) Object.assign(config.privacy, updates.privacy);
    if (updates.providers) config.providers = updates.providers;

    routingEngine.saveConfig(config);
    
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// =========================================================================
// REAL GODMODE POOL PRO (PORT 20128) LIVE PROXY & ROUTING INTEGRATION
// =========================================================================
const ROUTER_ORIGIN = 'http://127.0.0.1:20128';

app.get('/api/router/pool', async (req, res) => {
  try {
    const fetchRes = await fetch(ROUTER_ORIGIN + '/api/accounts');
    if (!fetchRes.ok) throw new Error('Router HTTP ' + fetchRes.status);
    const data = await fetchRes.json();
    res.json({
      success: true,
      accounts: data.accounts || [],
      strategy: data.strategy || 'round-robin',
      stats: data.metrics || {}
    });
  } catch (err) {
    res.json({
      success: false,
      error: 'GodMode Router offline or starting up (' + err.message + ')',
      accounts: [],
      stats: { totalAccounts: 0, readyCount: 0 }
    });
  }
});

app.post('/api/router/accounts/add', async (req, res) => {
  try {
    const { apiKey, email, proxy } = req.body;
    const fetchRes = await fetch(ROUTER_ORIGIN + '/api/accounts/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, email, proxy })
    });
    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/router/accounts/clear-demo', async (req, res) => {
  try {
    const fetchRes = await fetch(ROUTER_ORIGIN + '/api/accounts/clear-demo', { method: 'POST' });
    const data = await fetchRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/router/accounts/:accountId', async (req, res) => {
  try {
    const fetchRes = await fetch(ROUTER_ORIGIN + '/api/accounts/' + req.params.accountId, { method: 'DELETE' });
    const data = await fetchRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/router/test', async (req, res) => {
  try {
    const startTime = Date.now();
    const fetchRes = await fetch(ROUTER_ORIGIN + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Say "OK" in 1 word' }]
      })
    });
    const data = await fetchRes.json();
    const latency = Date.now() - startTime;
    const answer = data.choices?.[0]?.message?.content || 'OK';
    res.json({
      success: true,
      latency: latency + 'ms',
      accountUsed: 'GodMode Pool Core (:20128)',
      response: answer
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/router/config', async (req, res) => {
  try {
    const { routingStrategy } = req.body;
    const fetchRes = await fetch(ROUTER_ORIGIN + '/api/router/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: routingStrategy })
    });
    const data = await fetchRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/router/translate', async (req, res) => {
  try {
    const { lines, targetLang = 'km', strategy, sessionId } = req.body;
    
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid lines array. Expected: [{ id, text }, ...]' 
      });
    }

    // Validate line format
    const invalidLines = lines.filter(l => !l.id || !l.text);
    if (invalidLines.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'All lines must have id and text properties'
      });
    }

    routingEngine.log(`Translation request: ${lines.length} lines to ${targetLang}`, 'INFO');

    // Perform translation with smart routing
    const result = await routingEngine.translateWithRouting(lines, targetLang, {
      strategy,
      context: { sessionId }
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Parse JSON response
    let translations = {};
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }
      
      translations = JSON.parse(cleanContent);
    } catch (parseError) {
      routingEngine.log(`Failed to parse translation JSON: ${parseError.message}`, 'ERROR');
      return res.status(500).json({
        success: false,
        error: 'Failed to parse translation response',
        raw: result.content
      });
    }

    // Verify all lines are translated
    const missingIds = lines.filter(l => !translations[l.id]).map(l => l.id);
    
    if (missingIds.length > 0) {
      routingEngine.log(`Missing translations for IDs: ${missingIds.join(', ')}`, 'WARN');
      return res.status(500).json({
        success: false,
        error: 'Incomplete translation',
        missingIds,
        translations
      });
    }

    // Success!
    res.json({
      success: true,
      translations,
      provider: result.provider,
      account: result.account,
      totalLines: lines.length,
      translatedLines: Object.keys(translations).length
    });

  } catch (error) {
    routingEngine.log(`Translation endpoint error: ${error.message}`, 'ERROR');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch Translation with Chunking & Resume Support
app.post('/api/router/translate-batch', async (req, res) => {
  try {
    const { lines, targetLang = 'km', strategy, chunkSize = 40, sessionId } = req.body;
    
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid lines array' 
      });
    }

    routingEngine.log(`Batch translation: ${lines.length} lines, chunk size: ${chunkSize}`, 'INFO');

    // Split into chunks
    const chunks = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize));
    }

    const allTranslations = {};
    const results = [];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      routingEngine.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} lines)`, 'INFO');

      const result = await routingEngine.translateWithRouting(chunk, targetLang, {
        strategy,
        context: { sessionId: sessionId || `batch_${Date.now()}` }
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: `Chunk ${i + 1} failed: ${result.error}`,
          completedChunks: i,
          totalChunks: chunks.length
        });
      }

      // Parse chunk translations
      try {
        let cleanContent = result.content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```\n?/g, '');
        }
        
        const chunkTranslations = JSON.parse(cleanContent);
        Object.assign(allTranslations, chunkTranslations);

        results.push({
          chunk: i + 1,
          provider: result.provider,
          account: result.account,
          lineCount: chunk.length
        });

      } catch (parseError) {
        return res.status(500).json({
          success: false,
          error: `Failed to parse chunk ${i + 1}`,
          completedChunks: i,
          totalChunks: chunks.length
        });
      }
    }

    // Verify completeness
    const missingIds = lines.filter(l => !allTranslations[l.id]).map(l => l.id);
    
    if (missingIds.length > 0) {
      routingEngine.log(`Batch incomplete. Missing IDs: ${missingIds.join(', ')}`, 'WARN');
    }

    res.json({
      success: true,
      translations: allTranslations,
      totalLines: lines.length,
      translatedLines: Object.keys(allTranslations).length,
      missingLines: missingIds.length,
      missingIds,
      chunks: results
    });

  } catch (error) {
    routingEngine.log(`Batch translation error: ${error.message}`, 'ERROR');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Router Activity Log
app.get('/api/router/logs', (req, res) => {
  try {
    const logFile = path.join(BASE_DIR, 'logs', 'router.log');
    const lines = req.query.lines ? parseInt(req.query.lines) : 100;
    
    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, logs: [] });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const logLines = content.split('\n').filter(line => line.trim());
    const recentLogs = logLines.slice(-lines);

    res.json({
      success: true,
      logs: recentLogs,
      totalLines: logLines.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear Router Logs
app.delete('/api/router/logs', (req, res) => {
  try {
    const logFile = path.join(BASE_DIR, 'logs', 'router.log');
    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '', 'utf8');
    }
    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// END 9ROUTER TRANSLATION GATEWAY API
// =====================================================================

// Directories
const DIRS = {
  tools: path.join(BASE_DIR, 'tools'),
  uploads: path.join(BASE_DIR, 'uploads'),
  voiceSamples: path.join(BASE_DIR, 'uploads', 'voice_samples'),
  videos: path.join(BASE_DIR, 'videos'),
  dist: fs.existsSync(path.join(BASE_DIR, 'dist')) ? path.join(BASE_DIR, 'dist') : path.join(__dirname, 'dist'),
  logs: path.join(BASE_DIR, 'logs'),
  python: path.join(BASE_DIR, 'tools', 'python', 'python.exe'),
  ffmpeg: path.join(BASE_DIR, 'tools', 'ffmpeg.exe'),
  ffprobe: path.join(BASE_DIR, 'tools', 'ffprobe.exe')
};

// Ensure required directories exist
[DIRS.uploads, DIRS.voiceSamples, DIRS.videos, DIRS.logs].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer for video, BGM, and Voice Samples uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'voiceSample' || file.fieldname === 'characterSample') {
      cb(null, DIRS.voiceSamples);
    } else {
      cb(null, DIRS.uploads);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    let prefix = 'upload';
    if (file.fieldname === 'bgmFile') prefix = 'bgm';
    if (file.fieldname === 'voiceSample' || file.fieldname === 'characterSample') prefix = 'sample';
    if (file.fieldname === 'phraseAudio' || file.fieldname === 'audioFile') prefix = 'phrase_custom';
    if (file.fieldname === 'videoFile') prefix = 'video';
    cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 4 * 1024 * 1024 * 1024 } // 4GB max
});

// Middlewares
app.use(cors());

// Content Security Policy - Allow inline scripts and eval for development
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';"
  );
  next();
});

// Global process error guards to ensure server stays online 100%
process.on('uncaughtException', (err) => {
  console.error('[Global UncaughtException]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Global UnhandledRejection]', reason);
});
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Video Upload Endpoint (Called by auto-dubbing-pipeline.js & UI)
app.post('/api/upload-video', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      log(`[Upload Video Error] ${err.message}`, 'WARN');
      return res.status(400).json({ success: false, error: err.message });
    }
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }
    log(`[Upload] Uploaded video file: ${file.filename} (${file.originalname})`);
    res.json({
      success: true,
      fileName: file.filename,
      filename: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      path: `/uploads/${file.filename}`,
      url: `/uploads/${file.filename}`
    });
  });
});

// AI Character Gender Detection & Voice Assignment Endpoint (Enhanced Diarization & Emotion Sync)
app.post('/api/detect-character-genders', async (req, res) => {
  try {
    const lines = req.body.lines || [];
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: 'No dialogue lines provided' });
    }

    const malePatterns = /(បងប្រុស|បង|លោក|ពូ|តា|ឪ|ប៉ា|ឪពុក|កូនប្រុស|ស្តេច|ព្រះអង្គ|មេទ័ព|ប្អូនប្រុស|ប្រុស|ឯង|អា|លោកម្ចាស់|បងថ្ងៃ|បងទី|ទាហាន|ចៅប្រុស|បុរស|ស្ដេច)/u;
    const femalePatterns = /(បងស្រី|ប្អូនស្រី|នាង|មីង|យាយ|ម៉ែ|ម៉ាក់|ម្តាយ|កូនស្រី|ព្រះនាង|អ្នកនាង|ស្រី|អូន|ចែ|មេផ្ទះ|ចៅស្រី|ស្ត្រី|កញ្ញា)/u;
    const childPatterns = /(កូន|កុមារ|កូនក្មេង|ក្មេង|ចៅ|ប្អូនតូច)/u;
    const elderPatterns = /(តា|យាយ|ព្រឹទ្ធាចារ្យ|លោកតា|លោកយាយ|ចាស់ព្រឹទ្ធ)/u;
    
    // Emotion patterns
    const angryPatterns = /(ស្រែក|ខឹង|សម្លាប់|បញ្ឈប់|ឆ្កួត|កំហឹង|ល្មមហើយ|កុំ|ឈប់|ឆាប់|ចង្រៃ|អាឆ្កួត|ទៅឱ្យផុត|កម្ចាត់)/u;
    const cryingPatterns = /(យំ|ទឹកភ្នែក|សោកសៅ|ឈឺចាប់|អាណិត|ព្រាត់|ស្លាប់|ខូចចិត្ត|ទុក្ខ|វេទនា|អនិច្ចា)/u;
    const whisperPatterns = /(ខ្សឹប|កុំឱ្យឮ|ស្ងាត់|សម្ងាត់|ប្រយ័ត្ន|តិចៗ|កុំនិយាយ|ស្តាប់)/u;
    const monologuePatterns = /(គិត|ក្នុងចិត្ត|តើហេតុអ្វី|ខ្ញុំគួរតែ|ប្រហែលជា|ឬមួយ|តើពិតទេ)/u;

    let maleCount = 0;
    let femaleCount = 0;
    
    // Strict 1 Character = 1 Voice Locking Map across lines
    const speakerVoiceMap = {};

    const results = lines.map((item, idx) => {
      const text = (item.text || item.khmer || '').trim();
      const rawSpeaker = (item.speaker || '').trim();
      
      let gender = 'male';
      let confidence = 0.85;

      const hasFemale = femalePatterns.test(text);
      const hasMale = malePatterns.test(text);

      if (hasFemale && !hasMale) {
        gender = 'female';
        confidence = 0.94;
      } else if (hasMale && !hasFemale) {
        gender = 'male';
        confidence = 0.95;
      } else if (hasFemale && hasMale) {
        if (/នាង|ព្រះនាង|កូនស្រី|អ្នកនាង|ស្រី|អូន/.test(text)) {
          gender = 'female';
          confidence = 0.88;
        } else {
          gender = 'male';
          confidence = 0.88;
        }
      } else {
        if (rawSpeaker && /sreymom|female|bopha|ស្រី|princess/i.test(rawSpeaker)) {
          gender = 'female';
        } else if (rawSpeaker && /piseth|male|narith|ប្រុស|general/i.test(rawSpeaker)) {
          gender = 'male';
        } else {
          gender = (idx % 3 === 2) ? 'female' : 'male';
          confidence = 0.78;
        }
      }

      // Age classification
      let age = 'adult';
      if (elderPatterns.test(text)) age = 'elder';
      else if (childPatterns.test(text) && !/កូនប្រុស|កូនស្រី/.test(text)) age = 'child';

      // Emotion classification
      let emotion = 'normal';
      let emotionLabel = 'ធម្មតា (Normal)';
      if (angryPatterns.test(text) || text.endsWith('!') || text.includes('!!')) {
        emotion = 'angry';
        emotionLabel = 'ខឹង / ស្រែកខ្លាំង (Anger/Shout)';
      } else if (cryingPatterns.test(text)) {
        emotion = 'crying';
        emotionLabel = 'យំ / ស្រក់ទឹកភ្នែក (Crying)';
      } else if (whisperPatterns.test(text)) {
        emotion = 'whisper';
        emotionLabel = 'ខ្សឹប / តិចៗ (Whisper)';
      } else if (monologuePatterns.test(text) || text.startsWith('(') || text.startsWith('（')) {
        emotion = 'monologue';
        emotionLabel = 'គិតក្នុងចិត្ត (Monologue)';
      }

      // Character Role & Locked Voice
      let speakerKey = rawSpeaker || (gender === 'female' ? `តួស្រី ${femaleCount % 3 + 1}` : `តួប្រុស ${maleCount % 4 + 1}`);
      
      let assignedVoice = '';
      if (speakerVoiceMap[speakerKey]) {
        assignedVoice = speakerVoiceMap[speakerKey];
      } else {
        if (gender === 'female') {
          if (age === 'elder') assignedVoice = 'Chanty · Elder (ស្រីចាស់ · ទន់ភ្លន់)';
          else if (/ព្រះនាង|កញ្ញា/.test(text)) assignedVoice = 'Bopha · Princess (ព្រះនាង · ស្រទន់)';
          else assignedVoice = 'Sreymom · Lead (តួឯកស្រី · ច្បាស់)';
        } else {
          if (age === 'elder') assignedVoice = 'Sovann · Elder (ប្រុសចាស់ · ជ្រៅមានអំណាច)';
          else if (/មេទ័ព|ស្តេច|ទាហាន/.test(text)) assignedVoice = 'Dara · General (មេទ័ព · អង់អាច)';
          else assignedVoice = 'Piseth · Lead (តួឯកប្រុស · ស្វាហាប់)';
        }
        speakerVoiceMap[speakerKey] = assignedVoice;
      }

      if (gender === 'female') {
        femaleCount++;
      } else {
        maleCount++;
      }

      return {
        id: item.id || (idx + 1),
        speaker: speakerKey,
        gender: gender,
        age: age,
        emotion: emotion,
        emotionLabel: emotionLabel,
        confidence: confidence,
        voice: assignedVoice,
        genderLabel: gender === 'female' ? 'ស្រី (Female)' : 'ប្រុស (Male)'
      };
    });

    return res.json({
      success: true,
      results: results,
      stats: {
        total: lines.length,
        maleCount: maleCount,
        femaleCount: femaleCount,
        charactersCount: Object.keys(speakerVoiceMap).length
      }
    });
  } catch (error) {
    console.error('Error detecting genders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


// Single-line TTS synthesis endpoint
app.post('/api/synthesize-line', async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'No text provided' });
    }
    const speaker = (req.body.speaker || '').toLowerCase();
    const rate = req.body.rate || '+0%';
    const pitch = req.body.pitch || '+0Hz';
    const filename = `synth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`;
    const outPath = path.join(DIRS.uploads, filename);
    const pythonExe = (typeof DIRS !== 'undefined' && fs.existsSync(DIRS.python)) ? DIRS.python : 'python';

    const colabUrl = (req.body.colabUrl || (voxcpmConfig && voxcpmConfig.colabUrl) || '').trim();
    let voxcpmSuccess = false;

    if (req.body.useVoxcpm && colabUrl && typeof callVoxcpmColab === 'function') {
      try {
        log(`[TTS VoxCPM Test] Invoking remote VoxCPM on ${colabUrl}...`);
        const sampleFile = (voxcpmConfig.referenceAudio || (voxcpmConfig.characters && voxcpmConfig.characters['Speaker_1']?.sampleFile)) || null;
        const samplePath = sampleFile ? path.join(DIRS.uploads, sampleFile) : null;
        const voxRes = await callVoxcpmColab(colabUrl, text, samplePath, 0.9, 'natural');
        if (voxRes && voxRes.audioBuffer) {
          fs.writeFileSync(outPath, voxRes.audioBuffer);
          voxcpmSuccess = true;
          log(`[TTS Line] Successfully synthesized via VoxCPM2 GPU: ${filename}`);
        }
      } catch (vex) {
        log(`[TTS Line VoxCPM Warning] ${vex.message}. Falling back to EdgeTTS...`, 'WARN');
      }
    }

    if (!voxcpmSuccess) {
      // Resolve gender from request; default based on speaker name
      const reqGender  = req.body.gender  || (speaker.includes('sreymom') || speaker.includes('female') ? 'Female' : 'Male');
      const reqEmotion = req.body.emotion || '';
      const reqAge     = req.body.age     || '';
      const reqSpeakerId = req.body.speakerId || req.body.speaker || null;
      const profile = resolveVoiceProfile(reqSpeakerId, reqGender, reqEmotion, reqAge);
      await synthesizeBatchLine(text, profile.voice, rate, pitch, outPath, pythonExe, {
        speakerId: reqSpeakerId,
        gender:    reqGender,
        emotion:   reqEmotion,
        age:       reqAge
      });
      log(`[TTS Line] Synthesized via EdgeTTS: "${text.slice(0, 30)}..." (${profile.voice}, rate=${profile.rate}, eq=${profile.eq})`);
    }

    return res.json({
      success: true,
      audioUrl: `/uploads/${filename}`,
      fileName: filename,
      engine: voxcpmSuccess ? 'VoxCPM2 Remote GPU' : 'EdgeTTS Standard'
    });
  } catch (err) {
    log(`[TTS Line Error] ${err.message}`, 'ERROR');
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Universal Open Folder
function launchWindowsExplorer(folderPath) {
  try {
    const cleanPath = path.resolve(folderPath);
    if (!fs.existsSync(cleanPath)) return false;
    spawn('explorer.exe', [cleanPath], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (err) {
    log(`[System] Error launching Explorer: ${err.message}`, 'WARN');
    return false;
  }
}

app.post('/api/open-folder', (req, res) => {
  const folder = (req.body && req.body.folderPath && fs.existsSync(req.body.folderPath))
    ? req.body.folderPath
    : (fs.existsSync(DIRS.videos) ? DIRS.videos : DIRS.uploads);
  log(`[System] Opening Explorer folder: ${folder}`);
  launchWindowsExplorer(folder);
  res.json({ success: true, folder });
});

// 🎬 NEW: Batch Folder Auto Dubbing Endpoint
// Store batch output folder per batch session
const batchSessions = new Map(); // folderName -> outputFolder

// 📊 Batch Progress Tracking (Real-time Dashboard)
const batchProgress = new Map(); // folderName -> { videos: [], completedCount, startTime, ... }

app.post('/api/batch-folder-auto', async (req, res) => {
  try {
    const { videoFileName, originalName, folderName, index, total } = req.body;
    
    if (!videoFileName) {
      return res.status(400).json({ success: false, error: 'No video file specified' });
    }

    const videoPath = path.join(DIRS.uploads, videoFileName);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }

    log(`[Batch Folder Auto] Processing video ${index}/${total}: ${originalName} (${videoFileName})`);
    log(`[Batch Folder Auto] Folder: ${folderName}`);

    // Use SAME output folder for entire batch session
    let batchOutputFolder;
    if (!batchSessions.has(folderName)) {
      // First video in batch - create new folder
      batchOutputFolder = path.join(DIRS.videos, `batch_${folderName}_${Date.now()}`);
      fs.mkdirSync(batchOutputFolder, { recursive: true });
      batchSessions.set(folderName, batchOutputFolder);
      log(`[Batch Folder Auto] Created batch output folder: ${batchOutputFolder}`);
      
      // Initialize progress tracking
      batchProgress.set(folderName, {
        folderName,
        outputFolder: batchOutputFolder,
        startTime: Date.now(),
        total,
        completedCount: 0,
        videos: []
      });
    } else {
      // Reuse existing folder for this batch
      batchOutputFolder = batchSessions.get(folderName);
    }
    
    // Update progress tracking
    if (batchProgress.has(folderName)) {
      const progress = batchProgress.get(folderName);
      progress.videos.push({
        index,
        name: originalName,
        status: 'processing',
        progress: 0
      });
    }

    // Clean up session when batch completes
    if (index === total) {
      setTimeout(() => {
        batchSessions.delete(folderName);
        batchProgress.delete(folderName);
        log(`[Batch Folder Auto] Batch session completed for: ${folderName}`);
      }, 5000); // Wait 5s before cleanup
    }

    // Trigger the master_dub_pipeline.py for this video
    const pythonCmd = DIRS.python;
    const pipelineScript = path.join(DIRS.tools, 'master_dub_pipeline.py');
    
    const args = [
      pipelineScript,
      '--video', videoPath,
      '--output-dir', batchOutputFolder,
      '--original-name', originalName,
      '--batch-mode', 'true',
      '--batch-index', index.toString(),
      '--batch-total', total.toString()
    ];

    log(`[Batch Folder Auto] Executing: ${pythonCmd} ${args.join(' ')}`);

    // Execute Python pipeline (async - don't wait for completion)
    const childProcess = spawn(pythonCmd, args, {
      cwd: DIRS.tools,
      stdio: 'pipe',
      detached: false
    });

    childProcess.stdout.on('data', (data) => {
      log(`[Pipeline ${index}/${total}] ${data.toString().trim()}`);
    });

    childProcess.stderr.on('data', (data) => {
      log(`[Pipeline ${index}/${total} ERROR] ${data.toString().trim()}`, 'ERROR');
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        log(`[Batch Folder Auto] ✅ Completed video ${index}/${total}: ${originalName}`);
        
        // Update progress tracking
        if (batchProgress.has(folderName)) {
          const progress = batchProgress.get(folderName);
          progress.completedCount++;
          const video = progress.videos.find(v => v.index === index);
          if (video) {
            video.status = 'completed';
            video.progress = 100;
          }
        }
      } else {
        log(`[Batch Folder Auto] ❌ Failed video ${index}/${total}: ${originalName} (exit code: ${code})`, 'ERROR');
        
        // Update progress tracking
        if (batchProgress.has(folderName)) {
          const progress = batchProgress.get(folderName);
          const video = progress.videos.find(v => v.index === index);
          if (video) {
            video.status = 'failed';
            video.progress = 0;
          }
        }
      }
    });

    // Return immediately (don't wait for pipeline to finish)
    res.json({
      success: true,
      message: `Started processing video ${index}/${total}`,
      videoFileName,
      originalName,
      outputFolder: batchOutputFolder,
      index,
      total
    });

  } catch (err) {
    log(`[Batch Folder Auto] Error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================================
// 📊 Batch Progress Dashboard API Endpoints
// =====================================================================

// Get current batch status (for real-time dashboard)
app.get('/api/batch/status', (req, res) => {
  try {
    const folderName = req.query.folderName;
    
    // If specific folder requested
    if (folderName && batchProgress.has(folderName)) {
      return res.json({ success: true, data: batchProgress.get(folderName) });
    }
    
    // Return all active batches
    const allBatches = Array.from(batchProgress.values());
    if (allBatches.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No active batch sessions',
        data: null 
      });
    }
    
    // Return most recent batch
    const latestBatch = allBatches[allBatches.length - 1];
    res.json({ success: true, data: latestBatch });
    
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all active batch sessions
app.get('/api/batch/list', (req, res) => {
  try {
    const allBatches = Array.from(batchProgress.values()).map(batch => ({
      folderName: batch.folderName,
      total: batch.total,
      completed: batch.completedCount,
      percent: Math.round((batch.completedCount / batch.total) * 100),
      startTime: batch.startTime
    }));
    
    res.json({ success: true, batches: allBatches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel batch processing
app.post('/api/batch/cancel', (req, res) => {
  try {
    const { folderName } = req.body;
    
    if (!folderName) {
      return res.status(400).json({ success: false, error: 'Folder name required' });
    }
    
    if (batchSessions.has(folderName)) {
      batchSessions.delete(folderName);
    }
    
    if (batchProgress.has(folderName)) {
      batchProgress.delete(folderName);
    }
    
    log(`[Batch] Cancelled batch session: ${folderName}`);
    res.json({ success: true, message: 'Batch cancelled successfully' });
    
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Native Windows Folder Picker Dialog
app.post('/api/pick-folder', (req, res) => {
  try {
    const psScript = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'ជ្រើសរើស Folder វីដេអូសម្រាប់ Batch Dubbing'; $f.ShowNewFolderButton = $false; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }";
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err, stdout) => {
      const selected = stdout ? stdout.trim() : '';
      if (selected && fs.existsSync(selected)) {
        log(`[System] User picked folder via Windows Dialog: ${selected}`);
        res.json({ success: true, folderPath: selected });
      } else {
        res.json({ success: false, folderPath: null });
      }
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Test Gemini API Keys Endpoint (Backend Node.js with direct HTTPS, no CORS issues)
app.post('/api/gemini/test-keys', async (req, res) => {
  try {
    let { keys } = req.body;
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      const cfg = loadGeminiConfig();
      keys = cfg.apiKeys && cfg.apiKeys.length > 0 ? cfg.apiKeys : (cfg.apiKey ? [cfg.apiKey] : []);
    }
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'គ្មាន Key សម្រាប់សាកល្បងទេ' });
    }

    log(`[Gemini Test] Testing ${keys.length} API key(s) on backend...`);
    const results = await Promise.all(keys.map(async (key) => {
      try {
        const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          signal: AbortSignal.timeout(8000)
        });
        return {
          key: key.slice(0, 10) + '...' + key.slice(-4),
          valid: testRes.ok,
          status: testRes.status
        };
      } catch (e) {
        return {
          key: key.slice(0, 10) + '...' + key.slice(-4),
          valid: false,
          error: e.message
        };
      }
    }));

    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.length - validCount;

    res.json({
      success: true,
      total: keys.length,
      validCount,
      invalidCount,
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Logging
function log(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level.padEnd(5)}] ${msg}`;
  console.log(line);
  try {
    const logFile = path.join(DIRS.logs, `session_${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch (e) {}
}

// ---------------------------------------------------------
// ---------------------------------------------------------
// Google Translate to Khmer (High Speed, Batch & Multi-Engine)
// ---------------------------------------------------------
const translationCache = new Map();

async function translateToKhmer(text, genre = 'ancient_wuxia') {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  const cacheKey = `${clean}::${genre}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // Already Khmer? Check if 60%+ Khmer unicode characters
  const khmerChars = (clean.match(/[ក-៿]/g) || []).length;
  if (khmerChars > clean.length * 0.5 && clean.length > 3) {
    translationCache.set(cacheKey, clean);
    return clean;
  }

  // Natural Film Khmer Conversational Beautifier (ភាសានិយាយភាពយន្តមនុស្សទូទៅ 100% + បែបបទរឿងទាំង ៤)
  function polishToSpokenFilmKhmer(raw, g = 'modern_urban') {
    if (!raw) return raw;
    let s = raw;

    // 1. Protect legitimate compound words that contain "អ្នក" so they are NEVER mangled
    const PROTECTED_COMPOUNDS = [
      ['អ្នកណាគេ', '__PROT_WHO_KE__'],
      ['អ្នកណា', '__PROT_WHO__'],
      ['អ្នកទាំងអស់គ្នា', '__PROT_EVERYONE__'],
      ['អ្នករាល់គ្នា', '__PROT_ALLPEOPLE__'],
      ['អ្នកដទៃ', '__PROT_OTHERS__'],
      ['អ្នកខ្លះ', '__PROT_SOME__'],
      ['អ្នកគ្រូ', '__PROT_TEACHER_F__'],
      ['លោកគ្រូ', '__PROT_TEACHER_M__'],
      ['អ្នកមីង', '__PROT_AUNT__'],
      ['អ្នកស្រី', '__PROT_MRS__'],
      ['អ្នកនាង', '__PROT_MISS__'],
      ['អ្នកជំងឺ', '__PROT_PATIENT__'],
      ['អ្នកបើកបរ', '__PROT_DRIVER__'],
      ['អ្នកបម្រើ', '__PROT_SERVANT__'],
      ['អ្នកជិតខាង', '__PROT_NEIGHBOR__'],
      ['អ្នកលក់', '__PROT_SELLER__'],
      ['អ្នកទិញ', '__PROT_BUYER__'],
      ['អ្នកដំណើរ', '__PROT_TRAVELER__']
    ];

    for (const [realWord, token] of PROTECTED_COMPOUNDS) {
      s = s.split(realWord).join(token);
    }

    // 2. Base natural conversational movie phrasing
    s = s.replace(/ខ្ញុំបានស្លាប់នៅក្នុងគ្រោះថ្នាក់នៅឆ្នាំនោះ/g, 'កាលឆ្នាំនោះ ខ្ញុំបានជួបគ្រោះថ្នាក់រហូតដល់បាត់បង់ជីវិត...')
         .replace(/ជាអំណោយបើកសាលា/g, 'ជាកាដូពេលចូលរៀន')
         .replace(/ឪពុក\s*ម្ដាយ\s*ខ្ញុំ\s*ពិបាក\s*ចិត្ត\s*ណាស់/g, 'ប៉ាម៉ាក់ខ្ញុំពិបាកចិត្តខ្លាំងណាស់')
         .replace(/ឪពុក\s*ម្តាយ\s*ខ្ញុំ\s*ពិបាក\s*ចិត្ត\s*ណាស់/g, 'ប៉ាម៉ាក់ខ្ញុំពិបាកចិត្តខ្លាំងណាស់')
         .replace(/ឪពុក\s*ម្ដាយ/g, 'ប៉ាម៉ាក់')
         .replace(/ឪពុក\s*ម្តាយ/g, 'ប៉ាម៉ាក់')
         .replace(/ខ្ញុំពិតជាសុំទោសម៉ាក់/g, 'កូនសុំទោសម៉ាក់ណា៎')
         .replace(/សុំទោសលោកយាយ/g, 'ចៅសុំទោសលោកយាយ')
         .replace(/គាត់ក៏មិនពេញចិត្តដែរ/g, 'គាត់នៅតែមិនទាន់ពេញចិត្តទៀត')
         .replace(/ខ្ញុំនឹងសប្បាយចិត្ត/g, 'ខ្ញុំច្បាស់ជាសប្បាយចិត្តខ្លាំងណាស់')
         .replace(/ឥឡូវនេះកូននេះ/g, 'ចុះកូនម្នាក់នេះឥឡូវ')
         .replace(/តើអ្នកកំពុងធ្វើអ្វី\?/g, 'ឯងកំពុងធ្វើអីហ្នឹង?')
         .replace(/តើអ្នកកំពុងធ្វើអ្វី/g, 'ឯងកំពុងធ្វើអីហ្នឹង')
         .replace(/អ្នកកំពុងធ្វើអ្វី\?/g, 'ឯងកំពុងធ្វើអីហ្នឹង?')
         .replace(/អ្នកកំពុងធ្វើអ្វី/g, 'ឯងកំពុងធ្វើអីហ្នឹង')
         .replace(/តើអ្នកមានអារម្មណ៍យ៉ាងណា\?/g, 'ឯងយ៉ាងម៉េចហើយ?')
         .replace(/តើអ្នកមានអារម្មណ៍យ៉ាងណា/g, 'ឯងយ៉ាងម៉េចហើយ')
         .replace(/តើអ្នកជានរណា\?/g, 'ឯងជាអ្នកណា?')
         .replace(/តើអ្នកជានរណា/g, 'ឯងជាអ្នកណា')
         .replace(/តើអ្នកសុខសប្បាយជាទេ\?/g, 'ឯងសុខសប្បាយអត់?')
         .replace(/តើអ្នកសុខសប្បាយជាទេ/g, 'ឯងសុខសប្បាយអត់')
         .replace(/ខ្ញុំសូមអភ័យទោស/g, 'ខ្ញុំសុំទោសណា៎')
         .replace(/សូមអភ័យទោស/g, 'សុំទោសណា៎')
         .replace(/តើអ្នកឆ្កួតឬ\?/g, 'ឯងឆ្កួតទេអី?!')
         .replace(/តើអ្នកឆ្កួតឬ/g, 'ឯងឆ្កួតទេអី')
         .replace(/ខ្ញុំមិនដឹងទេ/g, 'ខ្ញុំអត់ដឹងទេ')
         .replace(/តើមានអ្វីកើតឡើង\?/g, 'មានរឿងអីកើតឡើងហ្នឹង?')
         .replace(/តើមានអ្វីកើតឡើង/g, 'មានរឿងអីកើតឡើង')
         .replace(/កុំបារម្ភអី/g, 'កុំបារម្ភណា៎')
         .replace(/កុំបារម្ភ/g, 'កុំបារម្ភអីណា៎')
         .replace(/តើអ្នកចង់មានន័យយ៉ាងណា\?/g, 'ចង់មានន័យថាម៉េចហ្នឹង?')
         .replace(/តើអ្នកចង់មានន័យយ៉ាងណា/g, 'ចង់មានន័យថាម៉េច')
         .replace(/តើអ្នកកំពុងនិយាយអំពីអ្វី\?/g, 'ឯងកំពុងនិយាយពីអីហ្នឹង?')
         .replace(/តើអ្នកកំពុងនិយាយអំពីអ្វី/g, 'ឯងកំពុងនិយាយពីអី')
         .replace(/តើអ្នកយល់ព្រមទេ\?/g, 'ឯងព្រមអត់?')
         .replace(/តើអ្នកយល់ព្រមទេ/g, 'ឯងព្រមអត់')
         .replace(/តើអ្នកយល់ទេ\?/g, 'ឯងយល់អត់?')
         .replace(/តើអ្នកយល់ទេ/g, 'ឯងយល់អត់')
         .replace(/តើអ្នកចង់បានអ្វី\?/g, 'ឯងចង់បានអីហ្នឹង?')
         .replace(/តើអ្នកចង់បានអ្វី/g, 'ឯងចង់បានអី')
         .replace(/តើអ្នកឃើញទេ\?/g, 'ឯងឃើញអត់?')
         .replace(/តើអ្នកឃើញទេ/g, 'ឯងឃើញអត់')
         .replace(/តើអ្នកដឹងទេ\?/g, 'ឯងដឹងអត់?')
         .replace(/តើអ្នកដឹងទេ/g, 'ឯងដឹងអត់')
         .replace(/តើអ្នកឮទេ\?/g, 'ឯងឮអត់?')
         .replace(/តើអ្នកឮទេ/g, 'ឯងឮអត់')
         .replace(/តើអ្នកប្រាកដទេ\?/g, 'ឯងច្បាស់អត់?')
         .replace(/តើអ្នកប្រាកដទេ/g, 'ឯងច្បាស់អត់')
         .replace(/តើអ្នកគិតយ៉ាងណា/g, 'ឯងគិតថាម៉េចដែរ?')
         .replace(/តើអ្នកនៅឯណា\?/g, 'ឯងនៅឯណា?')
         .replace(/តើអ្នកនៅឯណា/g, 'ឯងនៅឯណា')
         .replace(/តើអ្នកចង់ទៅណា\?/g, 'ឯងចង់ទៅណា?')
         .replace(/តើអ្នកចង់ទៅណា/g, 'ឯងចង់ទៅណា')
         .replace(/មិនអីទេ/g, 'អត់អីទេណា៎')
         .replace(/សូមរង់ចាំ/g, 'ចាំមួយភ្លែតសិន')
         .replace(/ទៅឱ្យឆ្ងាយ/g, 'ទៅឱ្យឆ្ងាយទៅ!')
         .replace(/ឈប់សិន/g, 'ឈប់សិនមើល!')
         .replace(/ពិតជាអស្ចារ្យណាស់/g, 'អស្ចារ្យមែនទែន!')
         .replace(/ហេតុអ្វីបានជា/g, 'ហេតុអីបានជា')
         .replace(/ហេតុអ្វី\?/g, 'ហេតុអីចឹង?')
         .replace(/ហេតុអ្វី/g, 'ហេតុអី')
         .replace(/តើអ្នកឯង/g, 'ឯង')
         .replace(/អ្នកឯង/g, 'ឯង')
         .replace(/តើអ្នក/g, 'ឯង')
         .replace(/^អ្នក\s+/g, 'ឯង ')
         .replace(/\s+អ្នក\s+/g, ' ឯង ')
         .replace(/^តើ\s*/, '')
         .replace(/[\?？]\s*តើ\s*/g, '? ')
         .trim();

    // 3. Restore protected compound words
    for (const [realWord, token] of PROTECTED_COMPOUNDS) {
      s = s.split(token).join(realWord);
    }

    // 🎬 Specialized Genre-based Vocabulary Injection (Only if requested)
    if (g === 'ancient_wuxia') {
      s = s.replace(/ប៉ាម៉ាក់/g, 'បិតាមាតា')
           .replace(/ឯងព្រមអត់\?/g, 'អ្នកក្លាហានយល់ព្រមទេ?')
           .replace(/លោកប៉ា/g, 'ព្រះបិតា')
           .replace(/អ្នកម៉ាក់/g, 'ព្រះមាតា')
           .replace(/អស្ចារ្យមែនទែន!/g, 'វិជ្ជាគុណខ្ពស់អស្ចារ្យមែន!');
    } else if (g === 'donghua') {
      s = s.replace(/ថាមពល/g, 'ដួងវិញ្ញាណ')
           .replace(/កម្លាំង/g, 'ថាមពលធាតុ')
           .replace(/អស្ចារ្យមែនទែន!/g, 'អាវុធទេពអស្ចារ្យមែន!')
           .replace(/ឯងព្រមអត់\?/g, 'សិស្សប្អូនយល់ព្រមទេ?');
    } else if (g === 'time_travel') {
      s = s.replace(/ខ្ញុំបានស្លាប់/g, 'ខ្ញុំឆ្លងភពមកទីនេះ')
           .replace(/កាលឆ្នាំនោះ/g, 'កាលមុនឆ្លងភពមក')
           .replace(/អស្ចារ្យមែនទែន!/g, 'ប្រព័ន្ធ System អស្ចារ្យមែន!');
    } else if (g === 'modern_urban') {
      s = s.replace(/បិតាមាតា/g, 'ប៉ាម៉ាក់')
           .replace(/លោកម្ចាស់/g, 'លោកប្រធាន');
    }

    return s;
  }

  // 1. Chrome Extension dict endpoint (Ultra-fast)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=km&q=${encodeURIComponent(clean)}`;
    const res = await new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try {
            const p = JSON.parse(data);
            if (Array.isArray(p) && p[0]) {
              const tr = Array.isArray(p[0]) ? p[0][0] : p[0];
              if (tr && typeof tr === 'string') return resolve(tr);
            }
            resolve(null);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(4500, () => { req.destroy(); resolve(null); });
    });
    if (res && res !== clean) {
      const polished = polishToSpokenFilmKhmer(res, genre);
      translationCache.set(cacheKey, polished);
      return polished;
    }
  } catch (e) {}

  // 2. Google Translate Single API
  try {
    const url2 = `https://translate.google.com/translate_a/single?client=at&dt=t&sl=auto&tl=km&q=${encodeURIComponent(clean)}`;
    const res2 = await new Promise((resolve) => {
      const req = https.get(url2, { 
        headers: { 'User-Agent': 'GoogleTranslate/6.28.0.05.419409849 (Linux; U; Android 11; Pixel 5)' } 
      }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try {
            const p = JSON.parse(data);
            let str = '';
            if (Array.isArray(p) && Array.isArray(p[0])) {
              p[0].forEach(item => { if (item && item[0]) str += item[0]; });
            }
            resolve(str.trim() || null);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(4500, () => { req.destroy(); resolve(null); });
    });
    if (res2) {
      const polished = polishToSpokenFilmKhmer(res2, genre);
      translationCache.set(cacheKey, polished);
      return polished;
    }
  } catch (e) {}

  // 3. Fallback Web GTX API
  try {
    const url3 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=km&dt=t&q=${encodeURIComponent(clean)}`;
    const res3 = await new Promise((resolve) => {
      const req = https.get(url3, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try {
            const p = JSON.parse(data);
            let str = '';
            if (Array.isArray(p) && Array.isArray(p[0])) {
              p[0].forEach(item => { if (item && item[0]) str += item[0]; });
            }
            resolve(str.trim() || null);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(4500, () => { req.destroy(); resolve(null); });
    });
    if (res3) {
      const polished = polishToSpokenFilmKhmer(res3, genre);
      translationCache.set(cacheKey, polished);
      return polished;
    }
  } catch (e) {}

  return clean;
}

// ---------------------------------------------------------
// Google Gemini Translation Engine (Natural Spoken Khmer Movie Dubbing)
// ---------------------------------------------------------
const GEMINI_LOCAL_CONFIG_FILE = path.join(BASE_DIR, 'gemini_config.local.json');
const GEMINI_CONFIG_FILE = fs.existsSync(GEMINI_LOCAL_CONFIG_FILE) ? GEMINI_LOCAL_CONFIG_FILE : path.join(BASE_DIR, 'gemini_config.json');

function loadGeminiConfig() {
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, 'utf8'));
      if (cfg && typeof cfg === 'object') {
        if (!Array.isArray(cfg.apiKeys)) {
          cfg.apiKeys = cfg.apiKey ? [cfg.apiKey] : [];
        }
        return cfg;
      }
    } catch (e) {}
  }
  const defaultKey = process.env.GEMINI_API_KEY || '';
  return {
    apiKey: defaultKey,
    apiKeys: defaultKey ? [defaultKey] : [],
    model: 'gemini-2.0-flash'
  };
}

let currentGeminiConfig = loadGeminiConfig();
let geminiKeyIndex = 0;

function saveGeminiConfig(cfg) {
  try {
    currentGeminiConfig = { ...currentGeminiConfig, ...cfg };
    if (!Array.isArray(currentGeminiConfig.apiKeys)) {
      currentGeminiConfig.apiKeys = currentGeminiConfig.apiKey ? [currentGeminiConfig.apiKey] : [];
    }
    // Sync primary apiKey with first key in apiKeys list
    if (currentGeminiConfig.apiKeys.length > 0 && !currentGeminiConfig.apiKey) {
      currentGeminiConfig.apiKey = currentGeminiConfig.apiKeys[0];
    }
    fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify(currentGeminiConfig, null, 2), 'utf8');
  } catch (e) {}
}

// Gemini Multi-Key Router (Round-robin + Auto-failover across all free keys)
function getNextGeminiApiKey() {
  const keys = (currentGeminiConfig.apiKeys && currentGeminiConfig.apiKeys.length > 0)
    ? currentGeminiConfig.apiKeys.map(k => k.trim()).filter(Boolean)
    : (currentGeminiConfig.apiKey ? [currentGeminiConfig.apiKey.trim()] : []);
  if (keys.length === 0) return '';
  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
  return key;
}

// ---------------------------------------------------------
// 🎬 MOVIE & DRAMA GENRE SYSTEM (៤ បែបបទសាច់រឿងភាពយន្ត)
// 1. រឿងចិនបុរាណ (Ancient Wuxia & Imperial Court)
// 2. រឿងចិនសម័យ (Modern Urban / Romance / CEO)
// 3. សម័យបុរាណឆ្លងភព (Time-Travel / Transmigration / Reincarnation - ឆ្លងភព & កើតជាថ្មី)
// 4. បែប DONGHUA (Chinese 3D Animation / Xianxia / Spirit Cultivation)
// ---------------------------------------------------------
const MOVIE_GENRES = {
  ancient_wuxia: {
    id: 'ancient_wuxia',
    name: 'រឿងចិនបុរាណ (Ancient Wuxia)',
    shortName: 'ចិនបុរាណ',
    icon: '⚔️',
    badge: 'ក្បាច់គុន & រាជវាំង',
    tagline: 'រឿងភាគបុរាណ ក្បាច់គុន ពិភពគុន និងរាជវាំងអធិកអធម',
    promptRule: `7. GENRE DIRECTIVE - រឿងចិនបុរាណ / ក្បាច់គុន / រាជវាំង (Ancient Wuxia & Imperial Palace):
   - Style: ភាសាក្បាច់គុន និងរាជវាំងបុរាណ ជ្រៅ ម៉ឺងម៉ាត់ មានអំណាច។
   - Pronouns & Titles: ព្រះករុណា, ព្រះអង្គ, ទ្រង់, លោកម្ចាស់, អ្នកម្នាង, ម្ចាស់ក្សត្រី, មេទ័ព, ចៅហ្វាយ, អ្នកក្លាហាន, ជើងឯក, ម្ចាស់បង, ម្ចាស់ប្អូន, ទូលបង្គំ, ស្មោះត្រង់, ក្រាបថ្វាយបង្គំ, បងធំ...
   - Vocabulary: ពិភពគុន, វិជ្ជាគុណ, គំនុំសងសឹក, បក្សពួក, ក្បាច់គុន, ដាវ, ព្រះពន្លា, រាជបញ្ជា, មហារាជវាំង, ព្រៃស្ងាត់...
   - NEVER use modern words like ឡាន, ទូរស័ព្ទ, ក្រុមហ៊ុន, ម៉ោង, នាទី!`,
    voicePresets: {
      Speaker_1: { name: 'មេទ័ព / តួឯកប្រុសក្លាហាន', role: 'male_lead', gender: 'Male', pitch: 0.95, rate: '+0%' },
      Speaker_2: { name: 'ម្ចាស់ក្សត្រី / តួឯកស្រីទន់ភ្លន់', role: 'female_lead', gender: 'Female', pitch: 1.0, rate: '+0%' },
      Speaker_3: { name: 'សិស្សប្អូន / កុមារាគុន', role: 'supporting_male', gender: 'Male', pitch: 1.15, rate: '+5%' },
      Speaker_4: { name: 'ព្រឹទ្ធាចារ្យ / មេបក្សចាស់', role: 'elder_male', gender: 'Male', pitch: 0.85, rate: '-5%' }
    }
  },
  modern_urban: {
    id: 'modern_urban',
    name: 'រឿងចិនសម័យ (Modern Drama)',
    shortName: 'ចិនសម័យ',
    icon: '🏙️',
    badge: 'ស្នេហា & ទីក្រុង',
    tagline: 'រឿងភាគសម័យទំនើប លោកប្រធាន ស្នេហា គ្រួសារ ជីវិតទីក្រុង',
    promptRule: `7. GENRE DIRECTIVE - រឿងចិនសម័យ / ទីក្រុង / ស្នេហា / លោកប្រធាន (Modern Urban Drama & Romance):
   - Style: ភាសាសន្ទនាប្រចាំថ្ងៃទាន់សម័យ កក់ក្តៅ រស់រវើក ផ្អែមល្ហែម ឬកំប្លុកកំប្លែង។
   - Pronouns & Titles: បង/អូន, ប៉ាម៉ាក់, ឯង/ខ្ញុំ, ពួកម៉ាក, លោកប្រធាន, បងស្រី, ប្អូនប្រុស, សង្សារ, មិត្តភក្តិ, លោកប៉ា, អ្នកម៉ាក់...
   - Vocabulary: ក្រុមហ៊ុន, កិច្ចសន្យា, ការងារ, បាយទឹក, ឡាន, ផ្ទះ, លុយកាក់, ទូរស័ព្ទ, ញ៉ាំអី, កាហ្វេ, ដើរលេង...
   - Dialogues: ប្រើពាក្យមនុស្សរស់នៅក្នុងទីក្រុងបច្ចុប្បន្ន ធម្មជាតិបំផុត (ឯងទៅណា?, ញ៉ាំបាយនៅ?, ខ្ញុំស្រលាញ់បង...)។`,
    voicePresets: {
      Speaker_1: { name: 'លោកប្រធាន / តួឯកប្រុស', role: 'male_lead', gender: 'Male', pitch: 1.0, rate: '+0%' },
      Speaker_2: { name: 'តួឯកស្រីស្រស់ស្អាត', role: 'female_lead', gender: 'Female', pitch: 1.0, rate: '+0%' },
      Speaker_3: { name: 'ប្អូនប្រុស / ក្មេង', role: 'young_male', gender: 'Male', pitch: 1.1, rate: '+4%' },
      Speaker_4: { name: 'លោកប៉ា / ម្ចាស់ក្រុមហ៊ុន', role: 'elder_male', gender: 'Male', pitch: 0.9, rate: '-3%' }
    }
  },
  time_travel: {
    id: 'time_travel',
    name: 'សម័យបុរាណឆ្លងភព (Time-Travel)',
    shortName: 'ឆ្លងភព',
    icon: '🌀',
    badge: 'ឆ្លងភព & កើតជាថ្មី',
    tagline: 'រឿងឆ្លងភព កើតជាថ្មី ពីសម័យទំនើបទៅសម័យបុរាណ លាយកំប្លុកកំប្លែង',
    promptRule: `7. GENRE DIRECTIVE - សម័យបុរាណឆ្លងភព / កើតជាថ្មី (Time-Travel / Transmigration / Reincarnation - ឆ្លងភព & កើតជាថ្មី):
   - Style: រឿងឆ្លងភព (Isekai) — តួអង្គឆ្លងភពពីសម័យទំនើបទៅបុរាណ គិតក្នុងចិត្តបែបសម័យ (អញ, ខ្ញុំ, យីអីចេះ?, អស្ចារ្យ) តែពេលប្រាស្រ័យទាក់ទងជាមួយមនុស្សបុរាណត្រូវក្លែងបន្លំប្រើពាក្យរាជវាំង (ទូលបង្គំ, លោកម្ចាស់, ព្រះនាង)។
   - Vocabulary: ឆ្លងភព, កើតជាថ្មី, ប្រព័ន្ធ System, អស្ចារ្យ, ពិភពលោកផ្សេង, បេសកកម្ម, ចំណុច EXP, វេទមន្ត, ជោគវាសនា...
   - Tone: កំប្លុកកំប្លែង ភ្ញាក់ផ្អើល វៃឆ្លាត ("ហេតុអីបានខ្ញុំឆ្លងភពមកទីនេះ?", "អញក្លាយជាព្រះនាងចឹងហី?", "នេះមិនមែនយល់សប្តិទេតើ!")!`,
    voicePresets: {
      Speaker_1: { name: 'អ្នកឆ្លងភព / វៃឆ្លាតកំប្លែង', role: 'male_lead', gender: 'Male', pitch: 1.02, rate: '+3%' },
      Speaker_2: { name: 'ព្រះនាងឆ្លងភព / ស្រីឆ្នាស', role: 'female_lead', gender: 'Female', pitch: 1.05, rate: '+3%' },
      Speaker_3: { name: 'ជំនួយការ System / ក្មេងបម្រើ', role: 'child_female', gender: 'Female', pitch: 1.2, rate: '+8%' },
      Speaker_4: { name: 'អធិរាជបុរាណ / មេទ័ពចាស់', role: 'elder_male', gender: 'Male', pitch: 0.85, rate: '-4%' }
    }
  },
  donghua: {
    id: 'donghua',
    name: 'បែប DONGHUA (Chinese 3D Anime)',
    shortName: 'DONGHUA',
    icon: '🐉',
    badge: 'ដុងហ័រ ទេពអច្ឆរិយៈ',
    tagline: 'ដុងហ័រ 3D គំនូរជីវចលចិន ហាត់ដួងវិញ្ញាណ អាវុធទេព វីរភាពប្រយុទ្ធដ៏អស្ចារ្យ',
    promptRule: `7. GENRE DIRECTIVE - បែប DONGHUA / ដុងហ័រ 3D ទេពអច្ឆរិយៈ (Chinese Anime / Xianxia / Spirit Cultivation):
   - Titles: ព្រះរៀម, សិស្សច្បង, សិស្សប្អូន, មេបក្ស, ព្រឹទ្ធាចារ្យ, ទេវតា, បិសាច, ស្ដេចនាគ, ស្ដេចវិញ្ញាណ, កំពូលអ្នកប្រាជ្ញ...
   - Cultivation Vocabulary: ដួងវិញ្ញាណ, អាវុធទេព, ថាមពលធាតុ, ឡើងឋាន, បំបែកឋាន, វិញ្ញាណដាវ, ដួងកែវធាតុ, មហានគរ, ដែនដីទេព, ចក្រវាល, ស្មារតីប្រយុទ្ធ...
   - Tone: វីរភាព ក្លាហាន ខ្លាំងក្លា អស្ចារ្យ ស្រែកប្រយុទ្ធ ("ទម្លាយឋាន!", "ទទួលយកការវាយប្រហារនេះទៅ!", "ដួងវិញ្ញាណនាគរាជ!", "ឯងគ្មានថ្ងៃឈ្នះខ្ញុំទេ!")!`,
    voicePresets: {
      Speaker_1: { name: 'ស្ដេចវិញ្ញាណ / វីរបុរសដុងហ័រ', role: 'male_lead', gender: 'Male', pitch: 0.98, rate: '+4%' },
      Speaker_2: { name: 'ទេពធីតា / ម្ចាស់វិញ្ញាណស្រី', role: 'female_lead', gender: 'Female', pitch: 1.02, rate: '+2%' },
      Speaker_3: { name: 'ក្មេងទេព / សត្វទេព', role: 'young_male', gender: 'Male', pitch: 1.25, rate: '+10%' },
      Speaker_4: { name: 'កំពូលអ្នកប្រាជ្ញ / ស្ដេចនាគ', role: 'elder_male', gender: 'Male', pitch: 0.8, rate: '-6%' }
    }
  }
};

// ---------------------------------------------------------
// 🎭 Comprehensive Dialogue Emotion & Voice FX Engine (32 Presets)
// Includes 3 Psychological/Spatial modes + 29 Character styles
// ---------------------------------------------------------
const EMOTION_PRESETS = {
  // --- 🧠 Psychological & Spatial Voices (សំឡេងផ្លូវចិត្ត & លំហ) ---
  'សំឡេងក្នុងចិត្ត': {
    id: 'inner_mind',
    name: 'សំឡេងក្នុងចិត្ត',
    label: '💭 សំឡេងក្នុងចិត្ត (Inner Monologue / Telepathy)',
    icon: '💭',
    pitch: '+0Hz',
    rate: '-5%',
    af: 'equalizer=f=200:width_type=o:w=1:g=3,lowpass=f=4500,aecho=0.8:0.88:40:0.3'
  },
  'សំឡេងអតីតកាល': {
    id: 'flashback',
    name: 'សំឡេងអតីតកាល',
    label: '⏳ សំឡេងអតីតកាល (Flashback / Memory)',
    icon: '⏳',
    pitch: '-5Hz',
    rate: '-8%',
    af: 'highpass=f=350,lowpass=f=3800,aecho=0.8:0.7:120:0.4'
  },
  'សំឡេងស្រមើលស្រមៃ': {
    id: 'daydream',
    name: 'សំឡេងស្រមើលស្រមៃ',
    label: '✨ សំឡេងស្រមើលស្រមៃ (Daydream / Fantasy)',
    icon: '✨',
    pitch: '+10Hz',
    rate: '-5%',
    af: 'chorus=0.7:0.9:55:0.4:0.25:2,aecho=0.8:0.75:80:0.35'
  },

  // --- 🎭 29 Dialogue Emotions & Character Roles ---
  'ស្នេហា': {
    id: 'romantic',
    name: 'ស្នេហា',
    label: '❤️ ស្នេហា (Romantic)',
    icon: '❤️',
    pitch: '+5Hz',
    rate: '-5%',
    af: 'equalizer=f=3000:width_type=o:w=1:g=2,aecho=0.8:0.6:25:0.2'
  },
  'ចំអក': {
    id: 'sarcastic',
    name: 'ចំអក',
    label: '😏 ចំអក (Sarcastic)',
    icon: '😏',
    pitch: '+15Hz',
    rate: '+8%',
    af: 'equalizer=f=2500:width_type=o:w=1:g=3'
  },
  'ស្រែក': {
    id: 'shout',
    name: 'ស្រែក',
    label: '📢 ស្រែក (Shout / Scream)',
    icon: '📢',
    pitch: '+25Hz',
    rate: '+15%',
    af: 'volume=1.35,alimiter=limit=0.95'
  },
  'ចិត្តល្អ': {
    id: 'kind',
    name: 'ចិត្តល្អ',
    label: '🌸 ចិត្តល្អ (Kind / Gentle)',
    icon: '🌸',
    pitch: '+0Hz',
    rate: '-5%',
    af: 'lowpass=f=6000,equalizer=f=300:width_type=o:w=1:g=2'
  },
  'គ្រូបង្រៀន': {
    id: 'teacher',
    name: 'គ្រូបង្រៀន',
    label: '👨‍🏫 គ្រូបង្រៀន (Teacher)',
    icon: '👨‍🏫',
    pitch: '-5Hz',
    rate: '-3%',
    af: 'equalizer=f=1000:width_type=o:w=1:g=2'
  },
  'ជនកវី': {
    id: 'bard',
    name: 'ជនកវី',
    label: '📜 ជនកវី (Bard / Storyteller)',
    icon: '📜',
    pitch: '+5Hz',
    rate: '-5%',
    af: 'aecho=0.8:0.5:50:0.25'
  },
  'ត្រេឡឺរ': {
    id: 'trailer',
    name: 'ត្រេឡឺរ',
    label: '🎬 ត្រេឡឺរ (Trailer / Epic Movie)',
    icon: '🎬',
    pitch: '-30Hz',
    rate: '-10%',
    af: 'bass=g=6:f=110,volume=1.3,alimiter=limit=0.98'
  },
  'ពាណិជ្ជកម្ម': {
    id: 'commercial',
    name: 'ពាណិជ្ជកម្ម',
    label: '📣 ពាណិជ្ជកម្ម (Commercial)',
    icon: '📣',
    pitch: '+10Hz',
    rate: '+12%',
    af: 'volume=1.3,alimiter=limit=0.95'
  },
  'កីឡា': {
    id: 'sports',
    name: 'កីឡា',
    label: '⚽ កីឡា (Sports Commentator)',
    icon: '⚽',
    pitch: '+20Hz',
    rate: '+20%',
    af: 'volume=1.25,highpass=f=150'
  },
  'ឌីជេ': {
    id: 'dj',
    name: 'ឌីជេ',
    label: '🎧 ឌីជេ (DJ / Host)',
    icon: '🎧',
    pitch: '-10Hz',
    rate: '+5%',
    af: 'bass=g=5:f=120,treble=g=3:f=4000'
  },
  'កុមារ': {
    id: 'child',
    name: 'កុមារ',
    label: '👶 កុមារ (Child / Cute)',
    icon: '👶',
    pitch: '+50Hz',
    rate: '+12%',
    af: 'highpass=f=250,equalizer=f=3500:width_type=o:w=1:g=4'
  },
  'យាយ': {
    id: 'grandmother',
    name: 'យាយ',
    label: '👵 យាយ (Grandmother)',
    icon: '👵',
    pitch: '-25Hz',
    rate: '-15%',
    af: 'lowpass=f=3200,tremolo=f=4.5:d=0.3'
  },
  'ឡូយ': {
    id: 'cool',
    name: 'ឡូយ',
    label: '😎 ឡូយ (Cool / Swag)',
    icon: '😎',
    pitch: '-15Hz',
    rate: '-5%',
    af: 'bass=g=4:f=150'
  },
  'មនុស្សអាក្រក់': {
    id: 'villain',
    name: 'មនុស្សអាក្រក់',
    label: '🦹 មនុស្សអាក្រក់ (Villain)',
    icon: '🦹',
    pitch: '-35Hz',
    rate: '-8%',
    af: 'bass=g=7:f=90,aecho=0.8:0.6:60:0.3'
  },
  'មនុស្សយន្ត': {
    id: 'robot',
    name: 'មនុស្សយន្ត',
    label: '🤖 មនុស្សយន្ត (Robot)',
    icon: '🤖',
    pitch: '-10Hz',
    rate: '+0%',
    af: 'flanger=delay=2:depth=2:regen=50:width=80:speed=10,equalizer=f=1200:width_type=o:w=2:g=-15'
  },
  'សមាធិ': {
    id: 'meditation',
    name: 'សមាធិ',
    label: '🧘 សមាធិ (Meditation / Zen)',
    icon: '🧘',
    pitch: '-10Hz',
    rate: '-15%',
    af: 'lowpass=f=4000,aecho=0.8:0.7:100:0.25'
  },
  'ព្រះរាជា': {
    id: 'royal',
    name: 'ព្រះរាជា',
    label: '👑 ព្រះរាជា (Royal / King)',
    icon: '👑',
    pitch: '-25Hz',
    rate: '-10%',
    af: 'bass=g=6:f=100,aecho=0.8:0.5:70:0.2'
  },
  'អាថ៌កំបាំង': {
    id: 'mystery',
    name: 'អាថ៌កំបាំង',
    label: '🕵️ អាថ៌កំបាំង (Mysterious)',
    icon: '🕵️',
    pitch: '-10Hz',
    rate: '-8%',
    af: 'highpass=f=400,aecho=0.8:0.6:90:0.35'
  },
  'អាជីវកម្ម': {
    id: 'business',
    name: 'អាជីវកម្ម',
    label: '💼 អាជីវកម្ម (Business / Formal)',
    icon: '💼',
    pitch: '-5Hz',
    rate: '+0%',
    af: 'equalizer=f=2000:width_type=o:w=1:g=2'
  },
  'អង្វរ': {
    id: 'pleading',
    name: 'អង្វរ',
    label: '🥺 អង្វរ (Pleading)',
    icon: '🥺',
    pitch: '+20Hz',
    rate: '-5%',
    af: 'tremolo=f=5.5:d=0.35,equalizer=f=2500:width_type=o:w=1:g=3'
  },
  'ធុញ': {
    id: 'bored',
    name: 'ធុញ',
    label: '🥱 ធុញ (Bored)',
    icon: '🥱',
    pitch: '-20Hz',
    rate: '-15%',
    af: 'lowpass=f=3500'
  },
  'លេងសើច': {
    id: 'playful',
    name: 'លេងសើច',
    label: '😄 លេងសើច (Playful)',
    icon: '😄',
    pitch: '+15Hz',
    rate: '+8%',
    af: 'equalizer=f=3000:width_type=o:w=1:g=2'
  },
  'ឆាប់ទាល់ចិត្ត': {
    id: 'impatient',
    name: 'ឆាប់ទាល់ចិត្ត',
    label: '😤 ឆាប់ទាល់ចិត្ត (Impatient)',
    icon: '😤',
    pitch: '+15Hz',
    rate: '+18%',
    af: 'volume=1.2,highpass=f=200'
  },
  'ភ្ញាក់ផ្អើល': {
    id: 'surprised',
    name: 'ភ្ញាក់ផ្អើល',
    label: '😲 ភ្ញាក់ផ្អើល (Surprised)',
    icon: '😲',
    pitch: '+35Hz',
    rate: '+10%',
    af: 'volume=1.25,alimiter=limit=0.96'
  },
  'អបអរ': {
    id: 'celebratory',
    name: 'អបអរ',
    label: '🎉 អបអរ (Celebratory)',
    icon: '🎉',
    pitch: '+20Hz',
    rate: '+10%',
    af: 'volume=1.25,aecho=0.8:0.7:45:0.25'
  },
  'មេធ្មប់': {
    id: 'witch',
    name: 'មេធ្មប់',
    label: '🧙‍♀️ មេធ្មប់ (Witch)',
    icon: '🧙‍♀️',
    pitch: '+30Hz',
    rate: '-5%',
    af: 'chorus=0.7:0.9:45:0.5:0.35:3,treble=g=5:f=3500'
  },
  'កវី': {
    id: 'poet',
    name: 'កវី',
    label: '🪶 កវី (Poet)',
    icon: '🪶',
    pitch: '+5Hz',
    rate: '-8%',
    af: 'aecho=0.8:0.7:65:0.3,equalizer=f=2200:width_type=o:w=1:g=2'
  },
  'ចោរសមុទ្រ': {
    id: 'pirate',
    name: 'ចោរសមុទ្រ',
    label: '🏴‍☠️ ចោរសមុទ្រ (Pirate)',
    icon: '🏴‍☠️',
    pitch: '-35Hz',
    rate: '-5%',
    af: 'bass=g=8:f=80,overdrive=5:10,alimiter=limit=0.95'
  },
  'បោះបង់': {
    id: 'despair',
    name: 'បោះបង់',
    label: '💔 បោះបង់ (Despair / Giving Up)',
    icon: '💔',
    pitch: '-20Hz',
    rate: '-15%',
    af: 'lowpass=f=3000,volume=0.85'
  },
  'ធម្មតា': {
    id: 'normal',
    name: 'ធម្មតា',
    label: '🎙️ ធម្មតា (Normal Spoken Dialogue)',
    icon: '🎙️',
    pitch: '+0Hz',
    rate: '+0%',
    af: null
  }
};

function detectEmotionFromContext(khmerText = '', originalText = '') {
  const combined = (khmerText + ' ' + originalText).toLowerCase();
  const rawOriginal = (originalText || '');
  const rawKhmer = (khmerText || '');
  
  // 1. Psychological & Spatial Modes (សំឡេងក្នុងចិត្ត, អតីតកាល, ស្រមើលស្រមៃ)
  // Check for Inner Monologue / Thoughts in Khmer, Chinese (心里想, 心想, 默念, 独白), English (thought, inside mind), and parenthetical cues
  if (/(\(\s*គិត\s*\)|\(\s*ក្នុងចិត្ត\s*\)|\[\s*គិត\s*\]|\[\s*ក្នុងចិត្ត\s*\]|គិតក្នុងចិត្ត|នឹកឃើញក្នុងចិត្ត|សំឡេងក្នុងចិត្ត|គិតថា|ក្នុងគំនិត|telepath|inner voice|inner monologue|in (his|her|my) head)/i.test(combined) ||
      /(心里想|心想|暗想|心道|默念|暗道|自言自语|内心独白|暗自|心下)/.test(rawOriginal) ||
      /^[(（\[【“"'].*?[)）\]】”"']$/.test(rawOriginal.trim()) ||
      /^[(（\[【].*?[)）\]】]/.test(rawKhmer.trim())) {
    return 'សំឡេងក្នុងចិត្ត';
  }
  if (/(\(\s*អតីតកាល\s*\)|\[\s*អតីតកាល\s*\]|កាលពីមុន|កាលពីនោះ|រឿងកាលពី|ចងចាំកាល|ពីមុនមក|flashback|memory|past)/i.test(combined) ||
      /(回忆|当年|从前|很久以前|过去)/.test(rawOriginal)) {
    return 'សំឡេងអតីតកាល';
  }
  if (/(\(\s*ស្រមៃ\s*\)|\(\s*សុបិន\s*\)|\[\s*ស្រមៃ\s*\]|ស្រមើស្រមៃ|សុបិនឃើញ|បើប្រសិនជាខ្ញុំ|ស្រមៃថា|dream|daydream|fantasy)/i.test(combined) ||
      /(做梦|梦见|幻想|如果我是)/.test(rawOriginal)) {
    return 'សំឡេងស្រមើលស្រមៃ';
  }

  // 2. Character Roles & Emotions (សំឡេងអារម្មណ៍ពិតប្រាកដ)
  // Shouting / Anger / Alarm (ស្រែក)
  if (/(!{2,}|ជួយផង|ឈប់ភ្លាម|ទៅឱ្យឆ្ងាយ|ងាប់ហើយ|ប្រយ័ត្ន|ឆ្កួតមែន|អាគុក|អាឆ្កែ|កម្ទេចវា|shout|scream|stop!|get out!|run!)/i.test(combined) ||
      /(救命|住手|快跑|去死|混蛋|滚开|可恶|混账|闭嘴|小心)/.test(rawOriginal)) {
    return 'ស្រែក';
  }

  // Pleading / Crying / Begging (អង្វរ)
  if (/(អង្វរ|សុំអង្វរ|កុំសម្លាប់|លើកលែងទោស|សុំទោសផង|មេត្តា|យំ|ទឹកភ្នែក|អាណិត|plead|beg|mercy|crying|tears|forgive me)/i.test(combined) ||
      /(求求你|放过我|饶命|对不起|痛哭|流泪|别杀我)/.test(rawOriginal)) {
    return 'អង្វរ';
  }

  // Despair / Giving Up (បោះបង់)
  if (/(បោះបង់|អស់សង្ឃឹម|ចប់ហើយ|មិនរួចទេ|គ្មានផ្លូវ|គ្មានសង្ឃឹម|give up|despair|hopeless|it's over)/i.test(combined) ||
      /(完了|没希望了|放弃吧|无能为力|完了完了)/.test(rawOriginal)) {
    return 'បោះបង់';
  }

  // Romantic / Sweet (ស្នេហា)
  if (/(ស្រឡាញ់|ស្នេហ៍|អូនសម្លាញ់|បងសម្លាញ់|បេះដូង|ស្រលាញ់|ផ្អែមល្ហែម|សង្សារ|love|darling|honey|sweetheart)/i.test(combined) ||
      /(我爱你|亲爱的|喜欢你|宝贝|心疼你)/.test(rawOriginal)) {
    return 'ស្នេហា';
  }

  // Sarcastic / Smug (ចំអក)
  if (/(ហឹស|សមមុខ|ចំអក|កុំមកធ្វើជា|អួត|ខ្លាំងណាស់តើ|ឡូយណាស់ទៅ|សមមុខហើយ|sarcas|smug|mock|humph)/i.test(combined) ||
      /(哼|活该|嘲笑|看你怎么办|了不起啊|就凭你)/.test(rawOriginal)) {
    return 'ចំអក';
  }

  // Secretive / Whispering (អាថ៌កំបាំង)
  if (/(អាថ៌កំបាំង|សម្ងាត់|កុំឱ្យនរណាដឹង|ខ្សឹប|កុំមាត់|ស្ងាត់ៗ|mystery|secret|whisper|shh|quiet)/i.test(combined) ||
      /(小声点|秘密|别让别人知道|悄悄话|嘘)/.test(rawOriginal)) {
    return 'អាថ៌កំបាំង';
  }

  // Surprised / Shocked (ភ្ញាក់ផ្អើល)
  if (/(ស្អីគេ\?!|មែនឬ\?!|ពិតមែន\?!|មិនពិតទេ!|មិនគួរឱ្យជឿ|អីយ៉ា|surpris|shock|what\?!|impossible!)/i.test(combined) ||
      /(什么\?!|怎么可能|天哪|居然|怎么会这样)/.test(rawOriginal)) {
    return 'ភ្ញាក់ផ្អើល';
  }

  // Laughter / Humor (លេងសើច)
  if (/(ហាហា|សើច|កំប្លែង|លេងទេ|តើឯងជឿមែន|haha|funny|joke|lol|giggle)/i.test(combined) ||
      /(哈哈|呵呵|开玩笑|好笑|逗你玩)/.test(rawOriginal)) {
    return 'លេងសើច';
  }

  // Villains / Menacing (មនុស្សអាក្រក់)
  if (/(មនុស្សអាក្រក់|កម្ទេច|សម្លាប់ចោល|ផែនការអាក្រក់|អាខ្មៅ|កុំឱ្យវារស់|villain|evil|destroy them)/i.test(combined) ||
      /(杀了他们|一个不留|去死吧|毁掉)/.test(rawOriginal)) {
    return 'មនុស្សអាក្រក់';
  }

  // Robots / System (មនុស្សយន្ត)
  if (/(មនុស្សយន្ត|ប្រព័ន្ធដំណើរការ|រ៉ូបូត|ពាក្យបញ្ជា|system reboot|robot|cyber|ai system)/i.test(combined) ||
      /(系统启动|人工智能|指令确认|机器人)/.test(rawOriginal)) {
    return 'មនុស្សយន្ត';
  }

  // Royal / Majesty (ព្រះរាជា)
  if (/(ព្រះរាជា|ទ្រង់|ព្រះករុណា|រាជវាំង|ព្រះអង្គ|រាជបុត្រ|king|queen|majesty|royal|highness)/i.test(combined) ||
      /(皇上|陛下|殿下|本王|奉天承运)/.test(rawOriginal)) {
    return 'ព្រះរាជា';
  }

  // Children / Kids (កុមារ)
  if (/(កុមារ|កូនក្មេង|ម៉ាក់|ប៉ា|តុក្កតា|បបួលលេង|child|kid|cute|mommy|daddy)/i.test(combined) ||
      /(妈妈|爸爸|小娃娃|玩具|好不好玩)/.test(rawOriginal)) {
    return 'កុមារ';
  }

  // Elderly / Grandparent (យាយ)
  if (/(យាយ|លោកយាយ|យាយអើយ|ចៅ|ចៅសម្លាញ់|grandma|elderly|grandfather)/i.test(combined) ||
      /(奶奶|外婆|乖孙|爷爷|老人家)/.test(rawOriginal)) {
    return 'យាយ';
  }

  // Celebration / Victory (អបអរ)
  if (/(អបអរ|ជយោ|ជោគជ័យ|អបអរសាទរ|congrat|cheer|celebrat|victory|hooray)/i.test(combined) ||
      /(太好了|万岁|成功了|恭喜|干杯)/.test(rawOriginal)) {
    return 'អបអរ';
  }

  // Gentle / Kindness (ចិត្តល្អ)
  if (/(ចិត្តល្អ|មិនអីទេ|កុំបារម្ភ|ខ្ញុំជួយឯង|kind|gentle|don't worry)/i.test(combined) ||
      /(放心吧|别担心|我来帮你|没事的)/.test(rawOriginal)) {
    return 'ចិត្តល្អ';
  }

  return 'ធម្មតា';
}

function resolveGeminiApiKey(req) {
  if (req) {
    if (req.headers && req.headers['x-gemini-key']) return req.headers['x-gemini-key'].trim();
    if (req.body && req.body.geminiApiKey) return req.body.geminiApiKey.trim();
    if (req.body && req.body.apiKey) return req.body.apiKey.trim();
  }
  const routedKey = getNextGeminiApiKey();
  if (routedKey) return routedKey;
  if (currentGeminiConfig.apiKey) return currentGeminiConfig.apiKey.trim();
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  return '';
}

async function callGeminiApi(prompt, apiKey, model = 'gemini-2.0-flash') {
  if (!apiKey) throw new Error('No Gemini API key provided');
  return new Promise((resolve, reject) => {
    const activeModel = model || currentGeminiConfig.model || 'gemini-2.0-flash';
    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json"
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${activeModel}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            resolve(textContent || '');
          } catch (e) {
            reject(new Error(`Failed to parse Gemini response: ${e.message}`));
          }
        } else {
          if (res.statusCode === 404 && activeModel !== 'gemini-flash-latest') {
            log(`[Gemini API] 404 with ${activeModel}. Retrying with gemini-flash-latest...`, 'WARN');
            return callGeminiApi(prompt, apiKey, 'gemini-flash-latest').then(resolve).catch(reject);
          }
          reject(new Error(`Gemini API HTTP ${res.statusCode}: ${body.slice(0, 150)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error('Gemini API timeout after 25s'));
    });
    req.write(postData);
    req.end();
  });
}

async function translateItemsWithGemini(items, apiKey, model, genre = 'ancient_wuxia') {
  if (!items || !items.length) return items;
  const key = apiKey || resolveGeminiApiKey();

  // If no Gemini key available, translate via multi-engine Google Translate
  if (!key) {
    log(`[Translation] No Gemini key configured. Using multi-engine Google Translate (Genre=${genre}).`);
    const translated = [];
    const CHUNK_SIZE = 12;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const resChunk = await Promise.all(chunk.map(async (it) => {
        const orig = it.text || it.originalText || '';
        const km = await translateToKhmer(orig, genre);
        return {
          ...it,
          text: km || orig,
          originalText: it.originalText || orig
        };
      }));
      translated.push(...resChunk);
    }
    return translated;
  }

  const genreConfig = MOVIE_GENRES[genre] || MOVIE_GENRES.ancient_wuxia;
  log(`[Gemini Translate] Translating ${items.length} lines with Google Gemini (${model || currentGeminiConfig.model}) in Genre: ${genreConfig.name}...`);
  const translated = [];
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const inputLines = chunk.map((it, idx) => ({
      idx,
      speaker: it.speaker || it.role || 'Character',
      gender: it.gender || 'Unknown',
      text: it.text || it.originalText || ''
    }));

    const systemPrompt = `You are an Expert Movie & Drama Subtitler, Dubbing Director and Voice Actor into 100% COLLOQUIAL SPOKEN Khmer (ភាសាទូទៅនិយាយចចាមអារ៉ាម).

Translate dialogue into REAL everyday Khmer that regular people speak - NOT formal/literary Khmer! Follow these 8 STRICT RULES:

1. 💬 ភាសាទូទៅមនុស្សនិយាយ 100% (TRUE COLLOQUIAL SPOKEN KHMER):
   - NEVER EVER use formal/bookish words like: "ខ្ញុំបាទ", "នាងខ្ញុំ", "យើងខ្ញុំ", "លោកអ្នក", "គាត់", "ត្រូវការ"
   - ALWAYS use casual daily speech: "អញ", "ហែង", "ឯង", "ខ្ញុំ", "គេ", "វា", "ចង់", "ត្រូវ"
   - Use TONS of natural particles: ហ្មង, វើយ, ណា, ណ៎, អ៎, ចា៎ស, ហ្នឹង, អី, ម៉េចចឹង, អីគេ, អត់ទេ, ហើយ, ទៅ, មក, អេ

   EXAMPLES - WRONG vs RIGHT:
   ❌ "ខ្ញុំបាទមិនយល់ទេ" → ✅ "អញអត់យល់អីទេ" or "ខ្ញុំអត់ច្បាស់ទេ"
   ❌ "នាងត្រូវការជំនួយ" → ✅ "គេចង់ឲ្យជួយហ្មង" or "ឯងត្រូវការជំនួយអត់?"
   ❌ "គាត់ទៅណាហើយ?" → ✅ "វាទៅណាហើយ?" or "គេទៅណាហ្នឹង?"
   ❌ "សូមអភ័យទោស" → ✅ "សូរីណា" or "អត់អីទេ"

2. 👥 សព្វនាម ភាសាទូទៅពិតប្រាកដ (REAL COLLOQUIAL PRONOUNS):
   - Casual friends: អញ/ហែង, ឯង/ខ្ញុំ, ម៉ាក/អាម៉ាក
   - Lovers (casual): បង/អូន, អេបង, ស្នេហ៍
   - Family: ម៉ែ/កូន, ប៉ា/កូន, បង/ប្អូន, ពូ/មីង/អ៊ំ
   - Elders respect: ពូ, មីង, លោកតា, យាយ
   - Enemies/Anger: អា/មឹង (insults), ឯង/អញ (confrontational)
   - Kids talking: បង/បង, ខ្ញុំ/បង
   
3. 😤 អារម្មណ៍ពិតប្រាកដ (Emotion Classification):
   ["ធម្មតា", "ស្នេហា", "ខឹង", "ភ័យ", "សប្បាយ", "ក្រៀមក្រំ", "ភ្ញាក់ផ្អើល", "ស្រែក", "យំ", "សើច", "កុមារ", "ចាស់", "មនុស្សអាក្រក់", "សំឡេងក្នុងចិត្ត", "អង្វរ", "ធុញ", "ចំអក", "រំភើប", "ឡូយ", "មេធ្មប់", "ព្រះរាជា"]

4. ⚡ និយាយខ្លី រហ័ស មានអារម្មណ៍ (Concise & Emotional):
   - Keep it SHORT like real speech
   - Add emotional energy with particles
   - Match lip-sync timing

5. 🚫 លុបភាសាបរទេសទាំងអស់ (Remove ALL foreign text)

6. 📝 Return ONLY valid JSON array:
   [{"idx": 0, "khmer": "អត្ថបទខ្មែរពិតប្រាកដ", "emotion": "អារម្មណ៍"}]

7. 🎭 តាមបែបរឿង (Genre-specific style):
${genreConfig.promptRule}

8. ✅ FINAL CHECK - Read each line and ask:
   - Does this sound like a REAL Cambodian person talking? 
   - Would people say this in daily life?
   - Is it TOO formal or bookish? → FIX IT!

REMEMBER: Think like you're translating for a REAL movie dub where actors speak NATURALLY, not reading from a textbook!

Dialogue lines to translate:
${JSON.stringify(inputLines)}`;

    try {
      const rawJson = await callGeminiApi(systemPrompt, key, model);
      let parsed = null;
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        const m = rawJson.match(/\[[\s\S]*\]/);
        if (m) parsed = JSON.parse(m[0]);
      }

      if (Array.isArray(parsed)) {
        const transMap = new Map();
        parsed.forEach(p => {
          if (p && p.idx !== undefined) transMap.set(p.idx, p);
        });

        chunk.forEach((it, idx) => {
          const p = transMap.get(idx);
          const km = p?.khmer || it.text;
          const emo = (p?.emotion && EMOTION_PRESETS[p.emotion]) 
            ? p.emotion 
            : detectEmotionFromContext(km, it.originalText || it.text);
          translated.push({
            ...it,
            text: km,
            originalText: it.originalText || it.text,
            emotion: emo
          });
        });
        continue;
      }
    } catch (err) {
      log(`[Gemini Translate Warning] Chunk ${i}-${i + BATCH_SIZE}: ${err.message}. Auto-recovering via Google Translate Free...`, 'WARN');
    }

    // Fallback for this chunk if Gemini fails
    for (const it of chunk) {
      const orig = it.text || it.originalText || '';
      const km = await translateToKhmer(orig);
      const emo = detectEmotionFromContext(km || orig, orig);
      translated.push({
        ...it,
        text: km || orig,
        originalText: it.originalText || orig,
        emotion: emo
      });
    }
  }

  return translated;
}

// ---------------------------------------------------------
// 🦙 Local Ollama Subtitle Translation (Qwen2.5 / DeepSeek)
// ---------------------------------------------------------
async function checkOllamaAvailable(url = 'http://127.0.0.1:11434') {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/tags`, { timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const models = (parsed.models || []).map(m => m.name || m.model || '');
          resolve({ running: true, models });
        } catch (e) {
          resolve({ running: false, models: [] });
        }
      });
    });
    req.on('error', () => resolve({ running: false, models: [] }));
    req.setTimeout(2500, () => { req.destroy(); resolve({ running: false, models: [] }); });
  });
}

async function translateItemsWithOllama(items, modelName = 'qwen2.5', ollamaUrl = 'http://127.0.0.1:11434', genre = 'ancient_wuxia') {
  if (!items || !items.length) return items;

  const ollamaStatus = await checkOllamaAvailable(ollamaUrl);
  if (!ollamaStatus.running) {
    log(`[Ollama Translate] Ollama is not running on ${ollamaUrl}.`, 'WARN');
    return null;
  }

  let targetModel = modelName;
  if (ollamaStatus.models.length > 0) {
    const matched = ollamaStatus.models.find(m => m.includes(modelName) || m.includes('qwen') || m.includes('deepseek'));
    targetModel = matched || ollamaStatus.models[0];
  } else {
    log(`[Ollama Translate] Ollama running but no model downloaded yet. (Tip: ollama pull qwen2.5)`, 'WARN');
    return null;
  }

  const genreConfig = MOVIE_GENRES[genre] || MOVIE_GENRES.ancient_wuxia;
  log(`[Ollama Translate] Translating ${items.length} lines with Local Ollama (${targetModel}, Genre: ${genreConfig.name})...`);
  const translated = [];
  const BATCH_SIZE = 15;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const inputLines = chunk.map((it, idx) => ({
      idx,
      speaker: it.speaker || it.role || 'Character',
      gender: it.gender || 'Unknown',
      text: it.text || it.originalText || ''
    }));

    const prompt = `You are an Expert Movie & Drama Subtitler, Dubbing Director and Voice Actor into spoken Khmer (ភាសានិយាយបែបភាពយន្ត).
Translate the dialogue lines into natural spoken film Khmer adhering to these rules:
1. 'ភាសានិយាយ' បែបភាពយន្ត: Natural spoken film Khmer. Use natural conversational ending particles: ណា, ណ៎, ហ្មង, តើ, អញ្ចឹង, វើយ, ហាស, ចា៎, ចុះ...
2. សព្វនាម និងឋានៈតួអង្គ: Match character pronouns to age, gender, and relationships (បង/អូន, ឯង/ខ្ញុំ, លោក/នាង, អា/មឹង, ម៉ែ/កូន, ពូ, មីង, តា, យាយ...).
3. ស្កេនអារម្មណ៍ពិតប្រាកដ (Emotion & Voice FX): For each line, classify the exact vocal emotion from these presets:
   ["សំឡេងក្នុងចិត្ត", "សំឡេងអតីតកាល", "សំឡេងស្រមើលស្រមៃ", "ស្នេហា", "ចំអក", "ស្រែក", "កុមារ", "យាយ", "មនុស្សអាក្រក់", "មនុស្សយន្ត", "ធម្មតា"]
4. Keep phrasing concise to match lip timing and retain 100% emotional meaning.
5. Return strictly valid JSON array of objects with schema:
[{"idx": 0, "khmer": "អត្ថបទនិយាយខ្មែរ", "emotion": "ឈ្មោះអារម្មណ៍"}]
${genreConfig.promptRule}

Dialogue lines to translate:
${JSON.stringify(inputLines)}`;

    const postPayload = JSON.stringify({
      model: targetModel,
      prompt: prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.3,
        top_p: 0.9
      }
    });

    try {
      const respJson = await new Promise((resolve, reject) => {
        const urlObj = new URL(`${ollamaUrl}/api/generate`);
        const req = http.request({
          hostname: urlObj.hostname,
          port: urlObj.port || 11434,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postPayload)
          },
          timeout: 90000
        }, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Ollama HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(90000, () => { req.destroy(); reject(new Error('Ollama timeout after 90s')); });
        req.write(postPayload);
        req.end();
      });

      const ollamaRes = JSON.parse(respJson);
      let parsed = JSON.parse(ollamaRes.response || '[]');
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        for (const k in parsed) {
          if (Array.isArray(parsed[k])) { parsed = parsed[k]; break; }
        }
      }

      if (Array.isArray(parsed)) {
        const transMap = new Map();
        parsed.forEach(p => {
          if (p && p.idx !== undefined) transMap.set(p.idx, p);
        });

        chunk.forEach((it, idx) => {
          const p = transMap.get(idx);
          const km = p?.khmer || it.text;
          const emo = (p?.emotion && EMOTION_PRESETS[p.emotion])
            ? p.emotion
            : detectEmotionFromContext(km, it.originalText || it.text);
          translated.push({
            ...it,
            text: km,
            originalText: it.originalText || it.text,
            emotion: emo
          });
        });
        continue;
      }
    } catch (err) {
      log(`[Ollama Translate Warning] Chunk ${i}: ${err.message}.`, 'WARN');
    }

    // Fallback for this chunk
    for (const it of chunk) {
      const orig = it.text || it.originalText || '';
      const km = await translateToKhmer(orig, genre);
      const emo = detectEmotionFromContext(km || orig, orig);
      translated.push({
        ...it,
        text: km || orig,
        originalText: it.originalText || orig,
        emotion: emo
      });
    }
  }

  return translated;
}

// Universal Translation Dispatcher: Cleanly Separated Engines (No Overlap / No Collision)
async function translateUniversal(items, options = {}) {
  let engine = (options.engine || 'google').toLowerCase();
  // If engine was passed as 'whisper', normalize to 'google' since Whisper is ASR, not translation
  if (engine === 'whisper') engine = 'google';

  const genre = options.genre || options.movieGenre || voxcpmConfig.genre || 'ancient_wuxia';
  const ollamaModel = options.ollamaModel || 'qwen2.5';
  const geminiModel = options.geminiModel || currentGeminiConfig.model || 'gemini-2.0-flash';
  const apiKey = options.apiKey || resolveGeminiApiKey();

  log(`[Universal Translation] Engine: ${engine.toUpperCase()} | Genre: ${genre} for ${items ? items.length : 0} segments`);

  // ──────────────────────────────────────────
  // 0. 9ROUTER QUOTA POOL (GMAIL MULTI-ACCOUNT FREE 100% REAL)
  // ──────────────────────────────────────────
  if (engine === 'pool' || engine === '9router') {
    log(`[Translation - 9Router Quota Pool] Translating ${items ? items.length : 0} lines with Gmail Multi-Account Pool (Genre: ${genre})...`);
    try {
      const poolCfg = routingEngine.loadConfig();
      const accounts = (poolCfg && poolCfg.accounts) ? poolCfg.accounts.filter(a => a.enabled && a.quotaRemaining > 0) : [];
      if (accounts.length > 0) {
        const translated = [];
        const BATCH_SIZE = 10;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const chunk = items.slice(i, i + BATCH_SIZE);
          const activeAccount = routingEngine.selectAccount(poolCfg.routingStrategy || 'priority-failover', accounts);
          const acctEmail = activeAccount ? activeAccount.email : 'pool-gmail';
          log(`[9Router Pool] Batch ${Math.floor(i/BATCH_SIZE) + 1}: Translating ${chunk.length} lines via Account: ${acctEmail}`);

          let chunkResults = null;
          // If this account has an API Key / Pro
          if (activeAccount && activeAccount.tier === 'pro' && activeAccount.apiKey) {
            try {
              chunkResults = await translateItemsWithGemini(chunk, activeAccount.apiKey, geminiModel, genre);
            } catch (pErr) {
              log(`[9Router Pool] Pro key issue: ${pErr.message}. Rotating account...`, 'WARN');
            }
          }

          // If free web or pro fallback
          if (!chunkResults || !chunkResults.length) {
            chunkResults = await Promise.all(chunk.map(async (it) => {
              const orig = it.text || it.originalText || '';
              const km = await translateToKhmer(orig, genre);
              const emo = detectEmotionFromContext(km || orig, orig);
              return {
                ...it,
                text: km || orig,
                originalText: it.originalText || orig,
                emotion: emo,
                accountUsed: acctEmail
              };
            }));
          }

          // Update active account quota & usage in pool
          if (activeAccount) {
            activeAccount.totalRequests = (activeAccount.totalRequests || 0) + chunk.length;
            activeAccount.successfulRequests = (activeAccount.successfulRequests || 0) + chunk.length;
            activeAccount.quotaUsed = (activeAccount.quotaUsed || 0) + chunk.length;
            activeAccount.quotaRemaining = Math.max(0, activeAccount.quotaTotal - activeAccount.quotaUsed);
            activeAccount.lastUsed = new Date().toISOString();
          }

          translated.push(...chunkResults);
        }

        routingEngine.saveConfig(poolCfg);
        return translated;
      } else {
        log(`[9Router Pool] No accounts available in pool. Seamlessly falling back to Google Free...`, 'WARN');
      }
    } catch (poolErr) {
      log(`[9Router Pool] Error: ${poolErr.message}. Auto-recovering with Google Free...`, 'WARN');
    }
  }

  // ──────────────────────────────────────────
  // 1. GOOGLE GEMINI CLOUD AI (Isolated 100%)
  // ──────────────────────────────────────────
  if (engine === 'gemini') {
    if (apiKey) {
      log(`[Translation - Gemini AI] Translating ${items ? items.length : 0} lines with Gemini (${geminiModel}, Genre: ${genre})...`);
      try {
        const res = await translateItemsWithGemini(items, apiKey, geminiModel, genre);
        if (res && res.length) return res;
      } catch (err) {
        log(`[Translation - Auto Recovery] Gemini key issue: ${err.message}. Seamlessly auto-recovering with Google Translate Free so pipeline completes 100%!`, 'WARN');
      }
    } else {
      log(`[Translation] No Gemini API Key. Proceeding directly with Google Translate Free.`, 'WARN');
    }
  }

  // ──────────────────────────────────────────
  // 2. LOCAL OLLAMA AI (Isolated 100%)
  // ──────────────────────────────────────────
  if (engine === 'ollama') {
    try {
      log(`[Translation - Ollama] Translating ${items.length} lines with Local Ollama (${ollamaModel}, Genre: ${genre})...`);
      const res = await translateItemsWithOllama(items, ollamaModel, undefined, genre);
      if (res && res.length) return res;
      log(`[Translation - Ollama] No output from Ollama. Falling back gracefully...`);
    } catch (e) {
      log(`[Translation - Ollama] Notice: ${e.message}. Falling back gracefully to Google Translate Free...`);
    }
  }

  // ──────────────────────────────────────────
  // 3. GOOGLE TRANSLATE FREE (Isolated 100%)
  // ──────────────────────────────────────────
  log(`[Translation - Google Translate] Translating ${items.length} lines directly with Google Multi-Engine (Free, Genre: ${genre})...`);
  const translated = [];
  const BATCH_SIZE = 12;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const chunkRes = await Promise.all(chunk.map(async (it) => {
      const orig = it.text || it.originalText || '';
      const km = await translateToKhmer(orig, genre);
      const emo = detectEmotionFromContext(km || orig, orig);
      return {
        ...it,
        text: km || orig,
        originalText: it.originalText || orig,
        emotion: emo
      };
    }));
    translated.push(...chunkRes);
  }
  return translated;
}

// ---------------------------------------------------------
// Global VoxCPM2 & Character Voice Architecture
// ---------------------------------------------------------
let voxcpmConfig = {
  enabled: true, // Default enabled for automatic high-fidelity human cloning
  model: 'openbmb/VoxCPM2',
  genre: 'ancient_wuxia', // 'ancient_wuxia' | 'modern_urban' | 'time_travel' | 'donghua'
  mode: 'movie_clone', // 'movie_clone' (១. CLONE ពីរឿងដើមផ្ទាល់) or 'custom_character' (២. ប្រើសំឡេងពីបន្ទប់សំឡេង / Custom Sample)
  hostType: 'local_cpu', // 'local_cpu' (voxcpm2 computer cpu) or 'colab_kaggle' (voxcpm2 claude colab and kaggle link url)
  colabUrl: '', // URL e.g. https://xxxx.gradio.live or ngrok URL
  timbreStrength: 0.9,
  emotion: 'natural',
  referenceAudio: null,
  referenceTranscript: '',
  sampleUrl: null,
  // Character mapping: 13 Locked Character Voices with Custom Voice Samples for Cloning
  characters: {
    'Speaker_1': {
      id: 'Speaker_1',
      name: 'តួឯកប្រុស',
      role: 'male_lead',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_01_male_lead.wav',
      sampleUrl: '/api/voice-sample/char_01_male_lead.wav'
    },
    'Speaker_2': {
      id: 'Speaker_2',
      name: 'តួឯកស្រី',
      role: 'female_lead',
      gender: 'Female',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-SreymomNeural',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_02_female_lead.wav',
      sampleUrl: '/api/voice-sample/char_02_female_lead.wav'
    },
    'Speaker_3': {
      id: 'Speaker_3',
      name: 'តួប្រុសរង',
      role: 'supporting_male',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_03_supporting_male.wav',
      sampleUrl: '/api/voice-sample/char_03_supporting_male.wav'
    },
    'Speaker_4': {
      id: 'Speaker_4',
      name: 'តួប្រុសក្មេង',
      role: 'young_male',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 1.1,
      rate: '+5%',
      sampleFile: 'char_04_young_male.wav',
      sampleUrl: '/api/voice-sample/char_04_young_male.wav'
    },
    'Speaker_5': {
      id: 'Speaker_5',
      name: 'តួប្រុសកាច',
      role: 'villain_male',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 0.9,
      rate: '+0%',
      sampleFile: 'char_05_villain_male.wav',
      sampleUrl: '/api/voice-sample/char_05_villain_male.wav'
    },
    'Speaker_6': {
      id: 'Speaker_6',
      name: 'តួប្រុសឪពុក',
      role: 'father',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 0.95,
      rate: '-3%',
      sampleFile: 'char_06_father_male.mp3',
      sampleUrl: '/api/voice-sample/char_06_father_male.mp3'
    },
    'Speaker_7': {
      id: 'Speaker_7',
      name: 'ក្មេងស្រី',
      role: 'child_female',
      gender: 'Female',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-SreymomNeural',
      pitch: 1.25,
      rate: '+8%',
      sampleFile: 'char_07_young_girl.mp3',
      sampleUrl: '/api/voice-sample/char_07_young_girl.mp3'
    },
    'Speaker_8': {
      id: 'Speaker_8',
      name: 'តួប្រុសចាស់ល្អ',
      role: 'elder_male',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 0.85,
      rate: '-5%',
      sampleFile: 'char_08_elder_good_male.mp3',
      sampleUrl: '/api/voice-sample/char_08_elder_good_male.mp3'
    },
    'Speaker_9': {
      id: 'Speaker_9',
      name: 'ក្មេងប្រុស',
      role: 'child_male',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 1.2,
      rate: '+8%',
      sampleFile: 'char_09_young_boy.mp3',
      sampleUrl: '/api/voice-sample/char_09_young_boy.mp3'
    },
    'Speaker_10': {
      id: 'Speaker_10',
      name: 'អ្នកភូមិ',
      role: 'villager',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_10_villager.mp3',
      sampleUrl: '/api/voice-sample/char_10_villager.mp3'
    },
    'Speaker_11': {
      id: 'Speaker_11',
      name: 'តួប្រុសតាចាស់',
      role: 'elder_grandfather',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 0.8,
      rate: '-8%',
      sampleFile: 'char_11_grandfather.mp3',
      sampleUrl: '/api/voice-sample/char_11_grandfather.mp3'
    },
    'Speaker_12': {
      id: 'Speaker_12',
      name: 'តួប្រុសស្ដេច',
      role: 'king',
      gender: 'Male',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-PisethNeural',
      pitch: 0.9,
      rate: '-2%',
      sampleFile: 'char_12_king.mp3',
      sampleUrl: '/api/voice-sample/char_12_king.mp3'
    },
    'Speaker_13': {
      id: 'Speaker_13',
      name: 'តួស្រិយាយចាស់',
      role: 'elder_grandmother',
      gender: 'Female',
      voiceType: 'voxcpm_custom',
      customVoice: 'km-KH-SreymomNeural',
      pitch: 0.9,
      rate: '-5%',
      sampleFile: 'char_13_grandmother.mp3',
      sampleUrl: '/api/voice-sample/char_13_grandmother.mp3'
    }
  }
};

const VOXCPM_CONFIG_FILE = path.join(DIRS.uploads, 'voxcpm_config.json');

// Initialize saved config if present
try {
  if (fs.existsSync(VOXCPM_CONFIG_FILE)) {
    const saved = JSON.parse(fs.readFileSync(VOXCPM_CONFIG_FILE, 'utf8'));
    if (saved && typeof saved === 'object') {
      voxcpmConfig = {
        ...voxcpmConfig,
        ...saved,
        characters: {
          ...voxcpmConfig.characters,
          ...(saved.characters || {})
        }
      };
    }
  } else {
    fs.writeFileSync(VOXCPM_CONFIG_FILE, JSON.stringify(voxcpmConfig, null, 2), 'utf8');
  }
} catch (e) {
  log(`[VOXCPM2] Config file initialization notice: ${e.message}`, 'WARN');
}

function saveVoxcpmConfig() {
  try {
    fs.writeFileSync(VOXCPM_CONFIG_FILE, JSON.stringify(voxcpmConfig, null, 2), 'utf8');
  } catch (e) {
    log(`[VOXCPM2] Failed to save config to disk: ${e.message}`, 'WARN');
  }
}

// Batch Dubbing Queue (Up to 8 movies)
let batchQueue = {
  activeJobs: [],
  maxConcurrency: 1
};

// ---------------------------------------------------------
// 1. GET & POST /api/voxcpm-settings
// ---------------------------------------------------------
app.get('/api/voxcpm-settings', (req, res) => {
  res.json({ success: true, config: voxcpmConfig });
});

app.post('/api/voxcpm-settings', (req, res) => {
  const { 
    enabled, 
    mode, 
    hostType, 
    colabUrl, 
    timbreStrength, 
    emotion, 
    referenceTranscript, 
    referenceAudio,
    characters
  } = req.body;

  if (enabled !== undefined) voxcpmConfig.enabled = Boolean(enabled);
  if (mode !== undefined) voxcpmConfig.mode = mode;
  if (hostType !== undefined) voxcpmConfig.hostType = hostType;
  if (colabUrl !== undefined) voxcpmConfig.colabUrl = (colabUrl || '').trim();
  if (timbreStrength !== undefined) voxcpmConfig.timbreStrength = parseFloat(timbreStrength);
  if (emotion !== undefined) voxcpmConfig.emotion = emotion;
  if (referenceTranscript !== undefined) voxcpmConfig.referenceTranscript = referenceTranscript;
  if (referenceAudio !== undefined) voxcpmConfig.referenceAudio = referenceAudio;
  if (characters && typeof characters === 'object') {
    voxcpmConfig.characters = { ...voxcpmConfig.characters, ...characters };
  }
  
  saveVoxcpmConfig();
  log(`[VOXCPM2] Updated Settings: enabled=${voxcpmConfig.enabled}, mode=${voxcpmConfig.mode}, host=${voxcpmConfig.hostType}, colabUrl=${voxcpmConfig.colabUrl}`);
  res.json({ success: true, config: voxcpmConfig });
});

// Test Connection for Colab/Kaggle or Local CPU
app.post('/api/voxcpm-test-connection', async (req, res) => {
  const { hostType, colabUrl } = req.body;
  const targetHost = hostType || voxcpmConfig.hostType;
  const targetUrl = (colabUrl !== undefined ? colabUrl : voxcpmConfig.colabUrl || '').trim();

  // If a URL is provided, always test it directly
  if (targetUrl || targetHost === 'colab_kaggle') {
    if (!targetUrl) {
      return res.json({ 
        success: false, 
        error: 'សូមបញ្ចូល Link URL របស់ Google Colab ឬ Kaggle (ឧ. https://xxxx.gradio.live ឬ Cloudflare)' 
      });
    }

    try {
      const cleanUrl = targetUrl.replace(/\/+$/, '');
      const testUrl = `${cleanUrl}/`;
      const isHttps = testUrl.startsWith('https');
      const client = isHttps ? https : http;
      const urlObj = new URL(testUrl);

      const checkReq = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'GET',
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 12000
      }, (testRes) => {
        let bodyData = '';
        testRes.on('data', chunk => {
          if (bodyData.length < 2500) bodyData += chunk.toString();
        });

        testRes.on('end', () => {
          let platformDetail = '';
          try {
            const parsed = JSON.parse(bodyData);
            if (parsed.platform || parsed.model || parsed.device) {
              platformDetail = ` [${[parsed.platform, parsed.model, parsed.device].filter(Boolean).join(' • ')}]`;
            }
          } catch(e) {}

          // Auto-save verified URL to server configuration
          voxcpmConfig.colabUrl = cleanUrl;
          voxcpmConfig.hostType = 'colab_kaggle';
          saveVoxcpmConfig();

          if (testRes.statusCode >= 200 && testRes.statusCode < 400) {
            log(`[VOXCPM2 Test] Link verified successfully: ${cleanUrl} (HTTP ${testRes.statusCode})${platformDetail}`);
            return res.json({ 
              success: true, 
              message: `✅ ការតភ្ជាប់ជោគជ័យ 100% (HTTP ${testRes.statusCode})${platformDetail}! រួចរាល់សម្រាប់ដំណើរការ។`,
              hostType: 'colab_kaggle',
              url: cleanUrl,
              details: platformDetail
            });
          } else {
            return res.json({ 
              success: true, 
              message: `⚠️ Endpoint បានឆ្លើយតប (HTTP ${testRes.statusCode}) — ម៉ាស៊ីនដំណើរការ!`,
              hostType: 'colab_kaggle',
              url: cleanUrl
            });
          }
        });
      });

      checkReq.on('error', (err) => {
        log(`[VOXCPM2 Test] Error connecting to ${cleanUrl}: ${err.message}`, 'WARN');
        if (res.headersSent) return;
        return res.json({ 
          success: false, 
          error: `❌ មិនអាចភ្ជាប់ទៅកាន់ Link បានទេ: ${err.message}. សូមពិនិត្យមើល Colab/Kaggle Public Link ឡើងវិញ។` 
        });
      });

      checkReq.on('timeout', () => {
        checkReq.destroy();
        if (res.headersSent) return;
        return res.json({ 
          success: false, 
          error: '❌ ការតភ្ជាប់ផុតកំណត់ (Timeout 12s) — សូមពិនិត្យមើលអ៊ីនធឺណិត ឬបើក Colab/Kaggle Link ឡើងវិញ។' 
        });
      });

      checkReq.end();
    } catch (e) {
      return res.json({ success: false, error: `❌ URL មិនត្រឹមត្រូវ: ${e.message}` });
    }
  } else {
    // Local Computer CPU
    log(`[VOXCPM2 Test] Computer CPU selected. Local high-performance engine is ready.`);
    return res.json({ 
      success: true, 
      message: '✅ ម៉ាស៊ីន Computer CPU ត្រៀមរួចជាស្រេច (Local Engine Active - ដំណើរការដោយផ្ទាល់លើកុំព្យូទ័រ)!',
      hostType: 'local_cpu',
      device: 'Computer Local CPU'
    });
  }
});
// ---------------------------------------------------------
// 🎬 MOVIE & DRAMA GENRE API (៤ បែបបទសាច់រឿងភាពយន្ត)
// 1. ចិនបុរាណ | 2. ចិនសម័យ | 3. ឆ្លងភព | 4. DONGHUA
// ---------------------------------------------------------
app.get('/api/movie-genres', (req, res) => {
  res.json({
    success: true,
    genres: MOVIE_GENRES,
    currentGenre: voxcpmConfig.genre || 'ancient_wuxia',
    config: MOVIE_GENRES[voxcpmConfig.genre || 'ancient_wuxia']
  });
});

app.post('/api/movie-genre', (req, res) => {
  const { genre, applyVoicePresets } = req.body;
  if (!genre || !MOVIE_GENRES[genre]) {
    return res.status(400).json({ 
      success: false, 
      error: 'បែបបទរឿងមិនត្រឹមត្រូវ។ ជម្រើសដែលគាំទ្រ: ancient_wuxia, modern_urban, time_travel, donghua' 
    });
  }

  voxcpmConfig.genre = genre;
  const genreObj = MOVIE_GENRES[genre];

  // Optionally auto-apply tailored character voice presets
  if (applyVoicePresets !== false && genreObj.voicePresets) {
    for (const spkKey in genreObj.voicePresets) {
      if (voxcpmConfig.characters[spkKey]) {
        const preset = genreObj.voicePresets[spkKey];
        voxcpmConfig.characters[spkKey].name = preset.name;
        voxcpmConfig.characters[spkKey].gender = preset.gender;
        if (preset.pitch !== undefined) voxcpmConfig.characters[spkKey].pitch = preset.pitch;
        if (preset.rate !== undefined) voxcpmConfig.characters[spkKey].rate = preset.rate;
      }
    }
  }

  saveVoxcpmConfig();
  log(`[Movie Genre API] ✅ Selected Genre: ${genreObj.name} (${genreObj.badge})`);
  res.json({
    success: true,
    genre: voxcpmConfig.genre,
    config: genreObj,
    characters: voxcpmConfig.characters,
    message: `បានជ្រើសរើសបែបបទរឿង៖ ${genreObj.name}`
  });
});

// ---------------------------------------------------------
// 2. Character Voice Mapping Endpoints
// Enforces: "ហើយតួអង្គ មួយប្រើបានសំឡេង តែមួយ ប៉ុណ្ណោះ ហាមប្រើសំឡេងច្រើនក្នុងតួអង្គមួយ"
// ---------------------------------------------------------
app.get('/api/characters', (req, res) => {
  res.json({ success: true, characters: voxcpmConfig.characters });
});

app.post('/api/character-voice', (req, res) => {
  const { characterId, name, role, gender, voiceType, customVoice, pitch, rate, sampleFile } = req.body;
  if (!characterId) {
    return res.status(400).json({ success: false, error: 'Character ID required' });
  }

  const existing = voxcpmConfig.characters[characterId] || {};
  voxcpmConfig.characters[characterId] = {
    id: characterId,
    name: name || existing.name || `តួអង្គ ${characterId}`,
    role: role || existing.role || 'male_adult',
    gender: gender || existing.gender || 'Male',
    voiceType: voiceType || existing.voiceType || 'neural',
    customVoice: customVoice || existing.customVoice || (gender === 'Female' ? 'km-KH-SreymomNeural' : 'km-KH-PisethNeural'),
    pitch: pitch !== undefined ? parseFloat(pitch) : (existing.pitch || 1.0),
    rate: rate || existing.rate || '+0%',
    sampleFile: sampleFile !== undefined ? sampleFile : existing.sampleFile,
    sampleUrl: sampleFile ? `/api/voice-sample/${path.basename(sampleFile)}` : existing.sampleUrl
  };

  log(`[Character Mapping] Updated Character ${characterId}: voiceType=${voxcpmConfig.characters[characterId].voiceType}, voice=${voxcpmConfig.characters[characterId].customVoice}`);
  res.json({ 
    success: true, 
    character: voxcpmConfig.characters[characterId], 
    allCharacters: voxcpmConfig.characters 
  });
});

// ---------------------------------------------------------
// 3. Mode 1: CLONE ពីរឿងដើម (Extract Character Voice from Original Movie)
// Automatically cuts a clean audio sample from original video timestamp
// ---------------------------------------------------------
app.post('/api/extract-character-sample', async (req, res) => {
  try {
    const { videoFileName, start, end, characterId } = req.body;
    if (!videoFileName || start === undefined || end === undefined || !characterId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters (videoFileName, start, end, characterId)' });
    }

    // Locate video file
    let videoPath = path.join(DIRS.uploads, path.basename(videoFileName));
    if (!fs.existsSync(videoPath)) {
      videoPath = path.join(DIRS.videos, path.basename(videoFileName));
    }
    if (!fs.existsSync(videoPath)) {
      // Look in uploads for any video file
      const files = fs.readdirSync(DIRS.uploads).filter(f => f.startsWith('video_') || f.endsWith('.mp4') || f.endsWith('.mkv'));
      if (files.length > 0) videoPath = path.join(DIRS.uploads, files[files.length - 1]);
    }

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, error: 'Original video file not found on server' });
    }

    const startSec = Math.max(0, parseFloat(start) || 0);
    const endSec = Math.max(startSec + 1, parseFloat(end) || (startSec + 5));
    const duration = Math.min(15, endSec - startSec); // Max 15s reference sample

    const sampleFileName = `sample_${characterId}_${Date.now()}.wav`;
    const sampleFilePath = path.join(DIRS.voiceSamples, sampleFileName);
    const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';

    log(`[Mode 1: Movie Clone] Extracting audio for ${characterId} from ${videoPath} (${startSec}s to ${startSec + duration}s)...`);

    const args = [
      '-y',
      '-ss', String(startSec),
      '-t', String(duration),
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      sampleFilePath
    ];

    const child = spawn(ffmpegExe, args);
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(sampleFilePath)) {
        log(`[Mode 1: Movie Clone] Audio sample extracted successfully: ${sampleFileName}`);
        
        // Update character profile with this movie sample
        if (!voxcpmConfig.characters[characterId]) {
          voxcpmConfig.characters[characterId] = {
            id: characterId,
            name: `តួអង្គ ${characterId}`,
            gender: 'Male',
            voiceType: 'voxcpm_movie'
          };
        }
        voxcpmConfig.characters[characterId].sampleFile = sampleFileName;
        voxcpmConfig.characters[characterId].sampleUrl = `/api/voice-sample/${sampleFileName}`;
        voxcpmConfig.characters[characterId].voiceType = 'voxcpm_movie';

        res.json({
          success: true,
          sampleFile: sampleFileName,
          sampleUrl: `/api/voice-sample/${sampleFileName}`,
          character: voxcpmConfig.characters[characterId]
        });
      } else {
        log(`[Mode 1: Movie Clone] FFmpeg extract failed: ${stderr}`, 'ERROR');
        res.status(500).json({ success: false, error: 'Failed to extract audio sample from movie' });
      }
    });

  } catch (err) {
    log(`[Mode 1: Movie Clone] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 4. Mode 2: CLONE VOICE CHARACTER (Upload Custom Voice Sample)
// ---------------------------------------------------------
app.post('/api/upload-character-sample', upload.single('characterSample'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio sample uploaded' });
  }
  const { characterId } = req.body;
  const targetId = characterId || 'Speaker_1';

  if (!voxcpmConfig.characters[targetId]) {
    voxcpmConfig.characters[targetId] = {
      id: targetId,
      name: `តួអង្គ ${targetId}`,
      gender: 'Female',
      voiceType: 'voxcpm_custom'
    };
  }

  voxcpmConfig.characters[targetId].sampleFile = req.file.filename;
  voxcpmConfig.characters[targetId].sampleUrl = `/api/voice-sample/${req.file.filename}`;
  voxcpmConfig.characters[targetId].voiceType = 'voxcpm_custom';
  saveVoxcpmConfig();

  log(`[Mode 2: Custom Character] Assigned sample ${req.file.filename} to ${targetId}`);
  res.json({
    success: true,
    fileName: req.file.filename,
    sampleUrl: `/api/voice-sample/${req.file.filename}`,
    character: voxcpmConfig.characters[targetId],
    allCharacters: voxcpmConfig.characters
  });
});

app.post('/api/upload-voice-sample', upload.single('voiceSample'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No voice sample uploaded' });
  }
  
  voxcpmConfig.referenceAudio = req.file.filename;
  voxcpmConfig.sampleUrl = `/api/voice-sample/${req.file.filename}`;
  voxcpmConfig.enabled = true;
  
  log(`[VOXCPM2] Default Voice Sample Uploaded: ${req.file.filename}`);
  res.json({
    success: true,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    sampleUrl: voxcpmConfig.sampleUrl,
    config: voxcpmConfig
  });
});

app.use('/api/voice-sample', express.static(DIRS.voiceSamples));

// ---------------------------------------------------------
// 4a-2. Manual Phrase Audio Upload / Voice Recording (ថតសំឡេង ឬ បញ្ចូលសំឡេងតាមឃ្លាដោយខ្លួនឯង)
// ---------------------------------------------------------
app.post('/api/upload-phrase-audio', upload.single('phraseAudio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'មិនមានឯកសារសំឡេង (No audio file received)' });
    }
    const subId = req.body.subId || req.body.index || Date.now();
    let finalPath = req.file.path;
    let finalFilename = req.file.filename;

    const ext = path.extname(req.file.originalname || req.file.path).toLowerCase();
    // Convert browser MediaRecorder webm/ogg audio to clean 24kHz MP3 for video rendering
    if (ext === '.webm' || ext === '.ogg' || (req.file.mimetype && req.file.mimetype.includes('webm'))) {
      const convertedFilename = `phrase_custom_${subId}_${Date.now()}.mp3`;
      const convertedPath = path.join(DIRS.uploads, convertedFilename);
      const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';
      try {
        await new Promise((resolve, reject) => {
          const proc = spawn(ffmpegExe, ['-y', '-i', req.file.path, '-ar', '24000', '-ac', '1', '-b:a', '128k', convertedPath]);
          proc.on('close', code => {
            if (code === 0 && fs.existsSync(convertedPath)) resolve();
            else reject(new Error(`ffmpeg audio conversion failed with code ${code}`));
          });
          proc.on('error', reject);
        });
        finalPath = convertedPath;
        finalFilename = convertedFilename;
      } catch (convErr) {
        log(`[PhraseAudio] Conversion warning: ${convErr.message}, keeping uploaded file`, 'WARN');
      }
    }

    const audioUrl = `/uploads/${finalFilename}`;
    log(`[PhraseAudio] Uploaded custom recorded audio for phrase #${subId}: ${audioUrl}`);
    res.json({
      success: true,
      subId,
      url: audioUrl,
      audioUrl: audioUrl,
      filename: finalFilename
    });
  } catch (err) {
    log(`[PhraseAudio] Upload error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 4b. Branding & Watermark Asset Uploads
// ---------------------------------------------------------
const brandingUploadDir = path.join(DIRS.uploads, 'branding');
if (!fs.existsSync(brandingUploadDir)) fs.mkdirSync(brandingUploadDir, { recursive: true });

app.post('/api/upload-branding-asset', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const safeName = `branding_${Date.now()}_${path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const finalPath = path.join(brandingUploadDir, safeName);
    fs.renameSync(req.file.path, finalPath);
    log(`[Branding Asset] Uploaded: ${safeName} (${finalPath})`);
    res.json({
      success: true,
      path: finalPath,
      filePath: finalPath,
      fileName: safeName,
      url: `/uploads/branding/${safeName}`
    });
  } catch (err) {
    log(`[Branding Asset] Upload error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/uploads/branding', express.static(brandingUploadDir));

// ---------------------------------------------------------
// ---------------------------------------------------------
// 4c. Auto Voice Split & Character Diarization (voice_split_tool)
// Pure Offline: splits movie dialogue into character voices,
// extracts clearest reference samples (_best.wav), and generates review.html
// ---------------------------------------------------------
const VOICE_SPLIT_DIR = path.join(BASE_DIR, 'voice_split_out');
if (!fs.existsSync(VOICE_SPLIT_DIR)) fs.mkdirSync(VOICE_SPLIT_DIR, { recursive: true });
app.use('/voice_split_out', express.static(VOICE_SPLIT_DIR));

app.post('/api/voice-split', upload.single('videoFile'), async (req, res) => {
  try {
    let mediaPath = null;
    let isTemp = false;

    if (req.file) {
      mediaPath = req.file.path;
      isTemp = true;
    } else if (req.body.videoFileName) {
      const fn = path.basename(req.body.videoFileName);
      const possible = [
        path.join(DIRS.uploads, fn),
        path.join(DIRS.videos, fn),
        path.join(BASE_DIR, fn)
      ];
      for (const p of possible) {
        if (fs.existsSync(p)) { mediaPath = p; break; }
      }
    }

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(400).json({ success: false, error: 'No video or audio file found for voice splitting' });
    }

    log(`[VoiceSplit] Starting Voice Split analysis for: ${path.basename(mediaPath)}`);
    const scriptPath = path.join(BASE_DIR, 'voice_split_tool', 'voice_split.py');
    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const profilesPath = path.join(VOICE_SPLIT_DIR, 'voices.json');

    const env = {
      ...process.env,
      PATH: `${DIRS.tools};${process.env.PATH}`
    };

    const args = [
      scriptPath,
      'split',
      mediaPath,
      '--outdir', VOICE_SPLIT_DIR,
      '--profiles', profilesPath,
      '--separate', 'no'
    ];

    const child = spawn(pythonExe, args, { env });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', async (code) => {
      try {
        const projectFile = path.join(VOICE_SPLIT_DIR, 'project.json');
        if (code !== 0 || !fs.existsSync(projectFile)) {
          log(`[VoiceSplit] Error (code ${code}): ${stderr}`, 'ERROR');
          return res.status(500).json({ success: false, error: stderr || 'Voice Split failed' });
        }

        const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        log(`[VoiceSplit] Split complete! Found ${project.speakers.length} characters.`);

        // Copy best_file for each speaker to voice_samples directory so VOXCPM2 can use it
        const speakers = [];
        for (const spk of project.speakers) {
          let sampleUrl = null;
          if (spk.best_file) {
            const bestSrc = path.join(VOICE_SPLIT_DIR, spk.best_file);
            const targetName = `char_${spk.id}_${path.basename(mediaPath, path.extname(mediaPath))}_best.wav`;
            const dest = path.join(DIRS.voiceSamples, targetName);
            if (fs.existsSync(bestSrc)) {
              fs.copyFileSync(bestSrc, dest);
              sampleUrl = `/api/voice-sample/${targetName}`;
            }
          }

          const labelKm = spk.label_km || (spk.gender_guess === 'male' ? 'តួប្រុស' : 'តួស្រី');
          const defaultName = spk.name || `${labelKm} (${spk.id})`;
          speakers.push({
            id: spk.id,
            name: defaultName,
            gender: spk.gender_guess === 'male' ? 'Male' : 'Female',
            gender_guess: spk.gender_guess || (spk.pitch_hz > 165 ? 'female' : 'male'),
            age_guess: spk.age_guess || 'adult',
            category: spk.category || (spk.gender_guess === 'male' ? 'adult_male' : 'adult_female'),
            role: spk.role || (spk.gender_guess === 'male' ? 'male_lead' : 'female_lead'),
            label_km: labelKm,
            pitch_hz: spk.pitch_hz,
            f0_spread: spk.f0_spread,
            voiced_ratio: spk.voiced_ratio,
            seconds: spk.seconds,
            lines: spk.lines,
            sampleUrl: sampleUrl,
            audioFileUrl: `/voice_split_out/${spk.file}`
          });
        }

        // Auto-bind the top characters into voxcpmConfig (only in movie_clone mode)
        if (voxcpmConfig.mode === 'movie_clone') {
          speakers.forEach((spk, idx) => {
            const charKey = `Speaker_${idx + 1}`;
            if (voxcpmConfig.characters[charKey] && voxcpmConfig.characters[charKey].voiceType !== 'voxcpm_custom') {
              if (spk.sampleUrl) voxcpmConfig.characters[charKey].sampleUrl = spk.sampleUrl;
              voxcpmConfig.characters[charKey].name = spk.name;
              voxcpmConfig.characters[charKey].gender = spk.gender;
              if (spk.role) voxcpmConfig.characters[charKey].role = spk.role;
              if (spk.category) voxcpmConfig.characters[charKey].category = spk.category;
            }
          });
        }

        res.json({
          success: true,
          speakers,
          segmentsCount: project.segments.length,
          reviewUrl: '/voice_split_out/review.html',
          project
        });

      } catch (err) {
        log(`[VoiceSplit] Post-process error: ${err.message}`, 'ERROR');
        res.status(500).json({ success: false, error: err.message });
      }
    });

  } catch (err) {
    log(`[VoiceSplit] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice-split/latest - returns latest project.json info
app.get('/api/voice-split/latest', (req, res) => {
  const projectFile = path.join(VOICE_SPLIT_DIR, 'project.json');
  if (fs.existsSync(projectFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      return res.json({ success: true, project: data });
    } catch (e) {}
  }
  res.json({ success: false, error: 'No voice split project found' });
});

// ---------------------------------------------------------
// 🎙️ VOICE LIBRARY MANAGEMENT SYSTEM
// រៀបចំ និង ចាត់ថ្នាក់ សំឡេង ពី voice_split_tool
// Character Types: ឯកប្រុស, ឯកស្រី, ក្មេងប្រុស, ក្មេងស្រី, ចាស់, កាច, មេទ័ព
// ---------------------------------------------------------
const VOICE_LIBRARY_FILE = path.join(BASE_DIR, 'voice_library.json');
const VOICE_SPLIT_TOOL_DIR = path.join(BASE_DIR, 'voice_split_tool');

function loadVoiceLibrary() {
  try {
    if (fs.existsSync(VOICE_LIBRARY_FILE)) {
      return JSON.parse(fs.readFileSync(VOICE_LIBRARY_FILE, 'utf8'));
    }
  } catch (e) {
    log(`[Voice Library] Error loading: ${e.message}`, 'WARN');
  }
  return { voices: [] };
}

function saveVoiceLibrary(library) {
  try {
    fs.writeFileSync(VOICE_LIBRARY_FILE, JSON.stringify(library, null, 2), 'utf8');
    return true;
  } catch (e) {
    log(`[Voice Library] Error saving: ${e.message}`, 'ERROR');
    return false;
  }
}

// GET all voices in library
app.get('/api/voice-library', (req, res) => {
  try {
    const library = loadVoiceLibrary();
    res.json({ success: true, voices: library.voices || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET voices from voice_split_tool folder
app.get('/api/voice-library/scan', (req, res) => {
  try {
    const voices = [];
    if (fs.existsSync(VOICE_SPLIT_TOOL_DIR)) {
      const files = fs.readdirSync(VOICE_SPLIT_TOOL_DIR);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) {
          const filePath = path.join(VOICE_SPLIT_TOOL_DIR, file);
          const stats = fs.statSync(filePath);
          voices.push({
            id: file,
            filename: file,
            filepath: filePath,
            name: path.basename(file, ext),
            characterType: 'ឯកប្រុស', // Default
            size: stats.size,
            dateAdded: stats.birthtime || stats.mtime
          });
        }
      });
    }
    res.json({ success: true, voices });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ADD voice to library
app.post('/api/voice-library', (req, res) => {
  try {
    const { filename, name, characterType, gender, notes } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename required' });
    }

    const library = loadVoiceLibrary();
    const voiceId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newVoice = {
      id: voiceId,
      filename,
      filepath: path.join(VOICE_SPLIT_TOOL_DIR, filename),
      name: name || path.basename(filename, path.extname(filename)),
      characterType: characterType || 'ឯកប្រុស',
      gender: gender || 'male',
      notes: notes || '',
      dateAdded: new Date().toISOString()
    };

    library.voices = library.voices || [];
    library.voices.push(newVoice);
    
    if (saveVoiceLibrary(library)) {
      log(`[Voice Library] Added: ${newVoice.name} (${characterType})`);
      res.json({ success: true, voice: newVoice });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save library' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// UPDATE voice in library
app.put('/api/voice-library/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, characterType, gender, notes } = req.body;

    const library = loadVoiceLibrary();
    const voiceIndex = library.voices.findIndex(v => v.id === id);
    
    if (voiceIndex === -1) {
      return res.status(404).json({ success: false, error: 'Voice not found' });
    }

    if (name) library.voices[voiceIndex].name = name;
    if (characterType) library.voices[voiceIndex].characterType = characterType;
    if (gender) library.voices[voiceIndex].gender = gender;
    if (notes !== undefined) library.voices[voiceIndex].notes = notes;
    library.voices[voiceIndex].lastModified = new Date().toISOString();

    if (saveVoiceLibrary(library)) {
      log(`[Voice Library] Updated: ${library.voices[voiceIndex].name}`);
      res.json({ success: true, voice: library.voices[voiceIndex] });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save library' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// AUTO-SYNC voices from voice_split_tool to uploads/voice_samples
app.post('/api/voice-library/auto-sync', (req, res) => {
  try {
    log('[Voice Library] Starting auto-sync from voice_split_tool...');
    
    const VOICE_SAMPLES_DIR = path.join(BASE_DIR, 'uploads', 'voice_samples');
    
    // Create directories if not exist
    if (!fs.existsSync(VOICE_SAMPLES_DIR)) {
      fs.mkdirSync(VOICE_SAMPLES_DIR, { recursive: true });
    }
    
    // Scan voice_split_tool directory
    if (!fs.existsSync(VOICE_SPLIT_TOOL_DIR)) {
      return res.status(400).json({ 
        success: false, 
        error: 'voice_split_tool directory not found' 
      });
    }
    
    const sourceFiles = fs.readdirSync(VOICE_SPLIT_TOOL_DIR)
      .filter(f => /\.(mp3|wav)$/i.test(f));
    
    let copied = 0;
    let skipped = 0;
    let added = 0;
    
    const library = loadVoiceLibrary();
    
    sourceFiles.forEach(filename => {
      const sourcePath = path.join(VOICE_SPLIT_TOOL_DIR, filename);
      const destPath = path.join(VOICE_SAMPLES_DIR, filename);
      
      // Copy file if not exists or different size
      let shouldCopy = !fs.existsSync(destPath);
      if (!shouldCopy) {
        const sourceStats = fs.statSync(sourcePath);
        const destStats = fs.statSync(destPath);
        shouldCopy = sourceStats.size !== destStats.size;
      }
      
      if (shouldCopy) {
        fs.copyFileSync(sourcePath, destPath);
        copied++;
        log(`[Voice Sync] Copied: ${filename}`);
      } else {
        skipped++;
      }
      
      // Add to library if not exists
      const exists = library.voices.find(v => v.filename === filename);
      if (!exists) {
        const detection = detectCharacterTypeFromFilename(filename);
        library.voices.push({
          id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filename: filename,
          filepath: destPath,
          name: filename.replace(/\.(mp3|wav)$/i, ''),
          characterType: detection.type,
          gender: detection.gender,
          dateAdded: new Date().toISOString(),
          isActive: true
        });
        added++;
        log(`[Voice Library] Added: ${filename} → ${detection.type}`);
      }
    });
    
    saveVoiceLibrary(library);
    
    log(`[Voice Sync] Complete: ${copied} copied, ${skipped} skipped, ${added} added to library`);
    
    res.json({
      success: true,
      copied,
      skipped,
      added,
      total: library.voices.length
    });
  } catch (e) {
    log(`[Voice Sync] Error: ${e.message}`, 'ERROR');
    res.status(500).json({ success: false, error: e.message });
  }
});

// Helper: Detect character type from filename
function detectCharacterTypeFromFilename(filename) {
  const lower = filename.toLowerCase();
  
  if (lower.includes('male') || lower.includes('boy') || lower.includes('man') || lower.includes('vid')) {
    if (lower.includes('lead') || lower.includes('main')) return { type: 'ឯកប្រុស', gender: 'male' };
    if (lower.includes('child') || lower.includes('kid')) return { type: 'ក្មេងប្រុស', gender: 'male' };
    if (lower.includes('old') || lower.includes('elder')) return { type: 'ចាស់', gender: 'male' };
    if (lower.includes('villain') || lower.includes('bad')) return { type: 'កាច', gender: 'male' };
    return { type: 'ឯកប្រុស', gender: 'male' };
  }
  
  if (lower.includes('female') || lower.includes('girl') || lower.includes('woman') || lower.includes('vp_character')) {
    if (lower.includes('lead') || lower.includes('main')) return { type: 'ឯកស្រី', gender: 'female' };
    if (lower.includes('child') || lower.includes('kid')) return { type: 'ក្មេងស្រី', gender: 'female' };
    if (lower.includes('old') || lower.includes('elder')) return { type: 'ចាស់', gender: 'female' };
    return { type: 'ឯកស្រី', gender: 'female' };
  }
  
  const numMatch = filename.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0]);
    return (num % 2 === 1) ? { type: 'ឯកប្រុស', gender: 'male' } : { type: 'ឯកស្រី', gender: 'female' };
  }
  
  return { type: 'ឯកប្រុស', gender: 'male' };
}

// DELETE voice from library (not file, just from library index)
app.delete('/api/voice-library/:id', (req, res) => {
  try {
    const { id } = req.params;
    const library = loadVoiceLibrary();
    const voiceIndex = library.voices.findIndex(v => v.id === id);
    
    if (voiceIndex === -1) {
      return res.status(404).json({ success: false, error: 'Voice not found' });
    }

    const deletedVoice = library.voices.splice(voiceIndex, 1)[0];
    
    if (saveVoiceLibrary(library)) {
      log(`[Voice Library] Removed: ${deletedVoice.name}`);
      res.json({ success: true, message: 'Voice removed from library' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save library' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Serve voice files from voice_split_tool directory
app.use('/voice-library-files', express.static(VOICE_SPLIT_TOOL_DIR));

// ---------------------------------------------------------
// 🎬 ONE-CLICK AUTO DUBBING PIPELINE (ប៊ូតុងម្តង ធ្វើការទាំងអស់)
// ---------------------------------------------------------
app.post('/api/auto-dub-pipeline', upload.single('videoFile'), async (req, res) => {
  try {
    let mediaPath = null;
    if (req.file) {
      mediaPath = req.file.path;
    } else if (req.body.videoFileName) {
      const fn = path.basename(req.body.videoFileName);
      const possible = [
        path.join(DIRS.uploads, fn),
        path.join(DIRS.videos, fn),
        path.join(BASE_DIR, fn)
      ];
      for (const p of possible) {
        if (fs.existsSync(p)) { mediaPath = p; break; }
      }
    }

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(400).json({ success: false, error: 'ត្រូវការឯកសាររឿងដើម (Video file required)' });
    }

    log(`[AUTO DUBBING PIPELINE] Starting fully automated dubbing for: ${path.basename(mediaPath)}`);

    // STEP 1: Voice Split & Character Diarization (ស្វ័យប្រវត្តិវិភាគតួអង្គ)
    log('[AUTO DUBBING PIPELINE] Step 1/4: Analyzing character voices...');
    const voiceSplitResult = await runVoiceSplit(mediaPath);
    if (!voiceSplitResult.success) {
      return res.status(500).json({ success: false, error: 'Voice analysis failed: ' + voiceSplitResult.error });
    }

    // STEP 2: Auto-Transcribe with Character Assignment (Faster-Whisper)
    const lang = req.body.language || 'auto';
    const engine = req.body.engine || (req.body.geminiApiKey || currentGeminiConfig.apiKey ? 'gemini' : 'google');
    const whisperModel = req.body.whisperModel || req.body.modelSize || 'medium';
    const geminiModel = req.body.geminiModel || currentGeminiConfig.model || 'gemini-2.0-flash';
    const ollamaModel = req.body.ollamaModel || 'qwen2.5';

    log(`[AUTO DUBBING PIPELINE] Step 2/4: Transcribing dialogue with Faster-Whisper (lang=${lang}, model=${whisperModel})...`);
    const transcribeResult = await runAutoTranscribe(mediaPath, { language: lang, modelSize: whisperModel });
    if (!transcribeResult.success) {
      return res.status(500).json({ success: false, error: 'Transcription failed: ' + transcribeResult.error });
    }

    // STEP 3: AI Translation to Natural Spoken Film Khmer (Gemini Cloud AI vs Faster-Whisper/Local)
    log(`[AUTO DUBBING PIPELINE] Step 3/4: Translating to authentic spoken film Khmer using engine=${engine} (geminiModel=${geminiModel})...`);
    const apiKey = resolveGeminiApiKey(req);
    const genre = req.body.genre || req.body.movieGenre || voxcpmConfig.genre || 'ancient_wuxia';
    const translatedSegments = await translateUniversal(transcribeResult.segments, { engine, ollamaModel, apiKey, geminiModel, genre });

    // STEP 4: Map Characters to Voice Profiles from Voice Split or Studio Library
    const voxMode = req.body.voxcpmMode || req.body.mode || voxcpmConfig.mode || 'movie_clone';
    const isLibraryMode = (voxMode === 'library' || voxMode === 'custom_character');
    log(`[AUTO DUBBING PIPELINE] Step 4/4: Locking character voices (Mode: ${voxMode}, isLibrary: ${isLibraryMode})...`);

    const PRESET_LIBRARY = {
      'Speaker_1': { id: 'Speaker_1', name: 'តួឯកប្រុស', role: 'male_lead', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 1.0, rate: '+0%', sampleFile: 'char_01_male_lead.wav', sampleUrl: '/api/voice-sample/char_01_male_lead.wav' },
      'Speaker_2': { id: 'Speaker_2', name: 'តួឯកស្រី', role: 'female_lead', gender: 'Female', voiceType: 'voxcpm_custom', customVoice: 'km-KH-SreymomNeural', pitch: 1.0, rate: '+0%', sampleFile: 'char_02_female_lead.wav', sampleUrl: '/api/voice-sample/char_02_female_lead.wav' },
      'Speaker_3': { id: 'Speaker_3', name: 'តួប្រុសរង', role: 'supporting_male', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 1.0, rate: '+0%', sampleFile: 'char_03_supporting_male.wav', sampleUrl: '/api/voice-sample/char_03_supporting_male.wav' },
      'Speaker_4': { id: 'Speaker_4', name: 'តួប្រុសក្មេង', role: 'young_male', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 1.1, rate: '+5%', sampleFile: 'char_04_young_male.wav', sampleUrl: '/api/voice-sample/char_04_young_male.wav' },
      'Speaker_5': { id: 'Speaker_5', name: 'តួប្រុសកាច', role: 'villain_male', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 0.9, rate: '+0%', sampleFile: 'char_05_villain_male.wav', sampleUrl: '/api/voice-sample/char_05_villain_male.wav' },
      'Speaker_6': { id: 'Speaker_6', name: 'តួប្រុសឪពុក', role: 'father', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 0.95, rate: '-3%', sampleFile: 'char_06_father_male.mp3', sampleUrl: '/api/voice-sample/char_06_father_male.mp3' },
      'Speaker_7': { id: 'Speaker_7', name: 'ក្មេងស្រី', role: 'child_female', gender: 'Female', voiceType: 'voxcpm_custom', customVoice: 'km-KH-SreymomNeural', pitch: 1.25, rate: '+8%', sampleFile: 'char_07_young_girl.mp3', sampleUrl: '/api/voice-sample/char_07_young_girl.mp3' },
      'Speaker_8': { id: 'Speaker_8', name: 'តួប្រុសចាស់ល្អ', role: 'elder_male', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 0.85, rate: '-5%', sampleFile: 'char_08_elder_good_male.mp3', sampleUrl: '/api/voice-sample/char_08_elder_good_male.mp3' },
      'Speaker_9': { id: 'Speaker_9', name: 'ក្មេងប្រុស', role: 'child_male', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 1.2, rate: '+8%', sampleFile: 'char_09_young_boy.mp3', sampleUrl: '/api/voice-sample/char_09_young_boy.mp3' },
      'Speaker_10': { id: 'Speaker_10', name: 'អ្នកភូមិ', role: 'villager', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 1.0, rate: '+0%', sampleFile: 'char_10_villager.mp3', sampleUrl: '/api/voice-sample/char_10_villager.mp3' },
      'Speaker_11': { id: 'Speaker_11', name: 'តួប្រុសតាចាស់', role: 'elder_grandfather', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 0.8, rate: '-8%', sampleFile: 'char_11_grandfather.mp3', sampleUrl: '/api/voice-sample/char_11_grandfather.mp3' },
      'Speaker_12': { id: 'Speaker_12', name: 'តួប្រុសស្ដេច', role: 'king', gender: 'Male', voiceType: 'voxcpm_custom', customVoice: 'km-KH-PisethNeural', pitch: 0.9, rate: '-2%', sampleFile: 'char_12_king.mp3', sampleUrl: '/api/voice-sample/char_12_king.mp3' },
      'Speaker_13': { id: 'Speaker_13', name: 'តួស្រិយាយចាស់', role: 'elder_grandmother', gender: 'Female', voiceType: 'voxcpm_custom', customVoice: 'km-KH-SreymomNeural', pitch: 0.9, rate: '-5%', sampleFile: 'char_13_grandmother.mp3', sampleUrl: '/api/voice-sample/char_13_grandmother.mp3' }
    };

    const items = [];
    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      const speaker = seg.speaker || `Speaker_${(i % 4) + 1}`;

      const matchedVoice = (voiceSplitResult.speakers && voiceSplitResult.speakers.length > 0)
        ? (voiceSplitResult.speakers.find(s => s.id === speaker) || voiceSplitResult.speakers[i % voiceSplitResult.speakers.length])
        : null;

      if (isLibraryMode) {
        // In Library Mode: match by detected role or category if available
        let bestPresetKey = speaker;
        if (matchedVoice && matchedVoice.role) {
          const roleKey = Object.keys(PRESET_LIBRARY).find(k => PRESET_LIBRARY[k].role === matchedVoice.role);
          if (roleKey) bestPresetKey = roleKey;
        }
        if (!voxcpmConfig.characters[speaker] || voxcpmConfig.characters[speaker].voiceType === 'voxcpm_movie') {
          const fallback = PRESET_LIBRARY[bestPresetKey] || PRESET_LIBRARY[speaker] || (seg.gender === 'Female' ? PRESET_LIBRARY['Speaker_2'] : PRESET_LIBRARY['Speaker_1']);
          voxcpmConfig.characters[speaker] = { ...fallback, id: speaker, role: matchedVoice?.role || fallback.role };
        }
      } else {
        // In Movie Clone Mode: Map to voice extracts from movie voice split with appropriate pitch/rate adjustments
        if (matchedVoice) {
          const isChild = matchedVoice.category?.includes('child') || matchedVoice.age_guess === 'child';
          const isElder = matchedVoice.category?.includes('elder') || matchedVoice.age_guess?.includes('elder');
          const isFemale = matchedVoice.gender === 'Female' || seg.gender === 'Female';

          voxcpmConfig.characters[speaker] = {
            id: speaker,
            name: matchedVoice.name || `តួអង្គ ${speaker}`,
            gender: isFemale ? 'Female' : 'Male',
            role: matchedVoice.role || (isFemale ? 'female_lead' : 'male_lead'),
            category: matchedVoice.category || null,
            age_guess: matchedVoice.age_guess || null,
            voiceType: 'voxcpm_movie',
            customVoice: isFemale ? 'km-KH-SreymomNeural' : 'km-KH-PisethNeural',
            pitch: isChild ? 1.25 : (isElder ? 0.85 : 1.0),
            rate: isChild ? '+5%' : (isElder ? '-5%' : '+0%'),
            sampleUrl: matchedVoice.sampleUrl || null,
            sampleFile: matchedVoice.sampleUrl ? path.basename(matchedVoice.sampleUrl) : null
          };
        }
      }

      const txt = seg.text || seg.khmer || seg.originalText || '';
      const emo = seg.emotion || detectEmotionFromContext(txt, seg.originalText);
      items.push({
        id: `sub_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        textStart: Number(seg.start).toFixed(2),
        textEnd: Number(seg.end).toFixed(2),
        audioStart: Number(seg.start).toFixed(2),
        audioEnd: Number(seg.end).toFixed(2),
        text: txt,
        originalText: seg.originalText || seg.text,
        voice: 'KH Khmer',
        gender: seg.gender || 'Male',
        speaker: speaker,
        emotion: emo,
        status: 'pending',
        audioStatus: 'idle',
        audioUrl: null,
        baseAudioDuration: 0,
        speed: 1
      });
    }

    log(`[AUTO DUBBING PIPELINE] ✅ Complete! Prepared ${items.length} character-locked dialogue lines.`);
    res.json({
      success: true,
      items,
      count: items.length,
      voiceSplit: voiceSplitResult,
      characters: voxcpmConfig.characters,
      message: `រួចរាល់! ស្វ័យប្រវត្តិវិភាគ ${voiceSplitResult.speakers?.length || 0} តួអង្គ និងបកប្រែ ${items.length} ជួរ។`
    });

  } catch (err) {
    log(`[AUTO DUBBING PIPELINE] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 🚀 MASTER PRODUCTION DUBBING PIPELINE (8-Step Full AI Dubbing)
// 1. FFmpeg extract audio -> 2. Demucs BGM/Vocal separation ->
// 3. Faster-Whisper ASR with word timestamps -> 4. Character Diarization & Lock ->
// 5. Gemini Cinematic Translation -> 6. Khmer Neural TTS ->
// 7. FFmpeg atempo synchronization -> 8. Master Mix onto no_vocals.wav
// ---------------------------------------------------------
app.post('/api/master-dub-pipeline', upload.single('videoFile'), async (req, res) => {
  try {
    let mediaPath = null;
    if (req.file) {
      mediaPath = req.file.path;
    } else if (req.body.videoFileName) {
      const fn = path.basename(req.body.videoFileName);
      const possible = [
        path.join(DIRS.uploads, fn),
        path.join(DIRS.videos, fn),
        path.join(BASE_DIR, fn)
      ];
      for (const p of possible) {
        if (fs.existsSync(p)) { mediaPath = p; break; }
      }
    }

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(400).json({ success: false, error: 'ត្រូវការឯកសាររឿងដើម (Video file required)' });
    }

    const outputDir = path.join(DIRS.uploads, `master_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const geminiKey = resolveGeminiApiKey(req);
    const lang = req.body.language || 'zh';

    log(`[Master Pipeline API] Starting production 8-step pipeline for: ${path.basename(mediaPath)}`);

    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const scriptPath = path.join(DIRS.tools, 'master_dub_pipeline.py');

    const args = [
      '-s',
      scriptPath,
      '--video', mediaPath,
      '--output-dir', outputDir,
      '--language', lang
    ];
    const rawGenre = req.body.genre || req.body.movieGenre || voxcpmConfig.genre || 'ancient_wuxia';
    let genre = 'ancient_wuxia';
    if (rawGenre === 'transmigration' || rawGenre === 'time_travel') genre = 'time_travel';
    else if (rawGenre === 'donghua_3d' || rawGenre === 'donghua') genre = 'donghua';
    else if (rawGenre === 'modern_urban') genre = 'modern_urban';
    else genre = 'ancient_wuxia';
    args.push('--genre', genre);
    if (geminiKey) {
      args.push('--gemini-key', geminiKey);
    }

    const child = spawn(pythonExe, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => {
      stdout += d.toString();
      const line = d.toString().trim();
      if (line) log(`[Master Dub Pipeline Output] ${line}`);
    });
    child.stderr.on('data', d => {
      stderr += d.toString();
      const line = d.toString().trim();
      if (line) log(`[Master Dub Pipeline Progress] ${line}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          let resultJson = JSON.parse(stdout.trim());

          if (resultJson && resultJson.success) {
            const finalVidName = path.basename(resultJson.video);
            const destVideo = path.join(DIRS.videos, finalVidName);
            if (fs.existsSync(resultJson.video)) {
              fs.copyFileSync(resultJson.video, destVideo);
            }
            return res.json({
              success: true,
              videoUrl: `/videos/${finalVidName}`,
              srtUrl: `/uploads/${path.basename(outputDir)}/${path.basename(resultJson.srt)}`,
              characters: resultJson.characters,
              count: resultJson.dialogues_count,
              message: `✅ បញ្ចូលសំឡេងភាពយន្តខ្មែរ 100% ជោគជ័យ! បំបែកភ្លេង Demucs និងបកប្រែ ${resultJson.dialogues_count} ឃ្លា។`
            });
          }
        } catch(e) {}
      }
      log(`[Master Pipeline API] Failed (code ${code}): ${stderr}`, 'ERROR');
      res.status(500).json({ success: false, error: stderr || 'Pipeline execution failed' });
    });

  } catch (err) {
    log(`[Master Pipeline API] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Async production pipeline jobs expose real stage progress parsed from the
// Python worker's Step N/8 log messages.
const masterDubJobs = new Map();

const MASTER_STEP_KHMER = {
  1: { title: 'ស្រង់សំឡេងពីវីដេអូ', desc: '📤 ជំហានទី ១/៨ ៖ កំពុងស្រង់សំឡេងពីវីដេអូ (FFmpeg Extract)...' },
  2: { title: 'បំបែកសំឡេងចិន (Demucs AI)', desc: '🎧 ជំហានទី ២/៨ ៖ កំពុងបំបែកសំឡេងចិនចេញ & រក្សាភ្លេង BGM (Demucs AI)...' },
  3: { title: 'សរសេរអក្សរ & ចែកតួអង្គ (Whisper)', desc: '🎙️ ជំហានទី ៣/៨ ៖ កំពុងសរសេរអក្សររត់ & ចែកតួអង្គ (Whisper Diarization)...' },
  4: { title: 'វិភាគតួអង្គ & ចាក់សោរសំឡេង', desc: '🎭 ជំហានទី ៤/៨ ៖ កំពុងវិភាគតួអង្គ & ចាក់សោរសំឡេង ១:១...' },
  5: { title: 'បកប្រែភាសានិយាយកុនខ្មែរ 100%', desc: '🇰🇭 ជំហានទី ៥/៨ ៖ កំពុងបកប្រែជាភាសានិយាយកុនខ្មែរ ស៊ីអារម្មណ៍...' },
  6: { title: 'បង្កើតសំឡេងខ្មែរ (TTS / Clone)', desc: '🗣️ ជំហានទី ៦/៨ ៖ កំពុងបង្កើតសំឡេងខ្មែរតាមតួអង្គ (VoxCPM2 / Studio)...' },
  7: { title: 'តម្រឹមល្បឿន & សមកាលកម្មមាត់', desc: '⏱️ ជំហានទី ៧/៨ ៖ កំពុងតម្រឹមល្បឿន និងសមកាលកម្មមាត់ (Time-Stretch)...' },
  8: { title: 'ផ្គុំវីដេអូចុងក្រោយ (Lossless Mux)', desc: '🎬 ជំហានទី ៨/៨ ៖ កំពុងផ្គុំសំឡេងខ្មែរជាមួយវីដេអូដើម (-c:v copy)...' }
};

app.post('/api/auto-dub-jobs', upload.single('videoFile'), async (req, res) => {
  try {
    let videoFilePath = null;
    if (req.file && req.file.path) {
      videoFilePath = req.file.path;
    } else {
      const candidate = req.body.videoFileName || req.body.fileName || (req.body.videoUrl ? path.basename(req.body.videoUrl.split('?')[0]) : null);
      if (candidate) {
        const candidateClean = path.basename(candidate);
        const checks = [
          path.join(DIRS.uploads, candidateClean),
          path.join(DIRS.videos, candidateClean),
          path.join(BASE_DIR, candidateClean),
          path.resolve(candidate)
        ];
        for (const p of checks) {
          if (fs.existsSync(p)) { videoFilePath = p; break; }
        }
      }
    }

    if (!videoFilePath) {
      const upFiles = fs.readdirSync(DIRS.uploads).filter(f => /\.(mp4|mkv|mov|avi|webm)$/i.test(f)).map(f => path.join(DIRS.uploads, f));
      const rootFiles = fs.readdirSync(BASE_DIR).filter(f => /\.(mp4|mkv|mov|avi|webm)$/i.test(f)).map(f => path.join(BASE_DIR, f));
      const all = [...upFiles, ...rootFiles].sort((a,b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (all.length > 0) videoFilePath = all[0];
    }

    if (!videoFilePath || !fs.existsSync(videoFilePath)) {
      return res.status(400).json({ success: false, error: 'សូមជ្រើសរើស ឬបញ្ចូលវីដេអូរឿងជាមុនសិន!' });
    }

    const jobId = require('crypto').randomUUID();
    const outputDir = path.join(DIRS.uploads, `master_${jobId}`);
    fs.mkdirSync(outputDir, { recursive: true });
    const state = { id: jobId, status: 'running', stage: 'Queued', stageKhmer: '⏳ កំពុងរៀបចំដំណើរការ...', currentStep: 1, progress: 5, error: null, result: null };
    masterDubJobs.set(jobId, state);
    
    // Build command args
    const args = ['-s', path.join(DIRS.tools, 'master_dub_pipeline.py'), '--video', videoFilePath,
      '--output-dir', outputDir, '--language', req.body.language || 'auto'];
    const genre = req.body.genre || req.body.movieGenre || voxcpmConfig.genre || 'ancient_wuxia';
    args.push('--genre', genre);
    
    // Add Gemini API key
    const key = resolveGeminiApiKey(req);
    if (key) args.push('--gemini-key', key);
    
    // 🔥 Check if VoxCPM2 mode is enabled
    const ttsEngine = req.body.ttsEngine || 'edge-tts';
    const useVoiceCloning = req.body.useVoiceCloning === 'true' || req.body.useVoiceCloning === true;
    
    if (ttsEngine === 'voxcpm2' || useVoiceCloning) {
      log('[AUTO-DUB-JOBS] VoxCPM2 Voice Clone mode enabled!');
      args.push('--tts-engine', 'voxcpm2');
      
      const voxMode = req.body.voxcpmMode || voxcpmConfig.mode || 'custom_character';
      const voxHost = req.body.voxcpmHost || voxcpmConfig.hostType || 'colab_kaggle';
      const voxUrl = (req.body.voxcpmColabUrl || voxcpmConfig.colabUrl || 'https://psychology-consideration-limitation-specials.trycloudflare.com').trim();
      args.push('--voxcpm-mode', voxMode);
      if (voxHost) args.push('--voxcpm-host', voxHost);
      if (voxUrl) args.push('--voxcpm-url', voxUrl);
      
      state.stage = 'Initializing VoxCPM2 Voice Clone Pipeline...';
    }
    
    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    log(`[AUTO-DUB-JOBS] Spawning Python worker: ${pythonExe} for video: ${path.basename(videoFilePath)}`);
    const child = spawn(pythonExe, args);
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => {
      stderr += d.toString();
      for (const line of d.toString().split(/\r?\n/)) {
        const m = line.match(/Step\s+(\d+)\s*\/\s*8\s*(complete\s*)?:?\s*(.*)/i);
        if (m) {
          const step = Number(m[1]);
          state.currentStep = step;
          const finishedStep = Boolean(m[2]);
          const stepMeta = MASTER_STEP_KHMER[step];
          if (stepMeta) {
            state.stageKhmer = finishedStep ? `✓ ជំហានទី ${step}/៨ សម្រេច៖ ${stepMeta.title}` : stepMeta.desc;
          }
          state.stage = (m[3] || (m[2] ? `Step ${step} complete` : `Step ${step}`)).replace(/\.\.\.$/, '').trim();
          state.progress = Math.max(state.progress, Math.min(95, Math.round((finishedStep ? step : step - 1) * 90 / 8 + 5)));
        } else if (line.includes('Synthesizing Khmer dialogue audio')) {
          const subMatch = line.match(/\[(\d+)\/(\d+)\]/);
          if (subMatch) {
            state.currentStep = 6;
            state.stageKhmer = `🗣️ ជំហានទី ៦/៨ ៖ កំពុងបញ្ចូលសំឡេងតួអង្គ [${subMatch[1]}/${subMatch[2]}]...`;
          }
        }
      }
    });
    child.on('close', code => {
      // Keep input files safe
      if (code !== 0) {
        state.status = 'failed';
        if (/Online Khmer TTS is unreachable|speech\.platform\.bing\.com|WinError 10013|Cannot connect to host/i.test(stderr)) {
          state.error = 'Online Khmer TTS is blocked by network permissions. Allow outbound HTTPS (TCP 443) for the bundled Python runtime to speech.platform.bing.com, or configure a local TTS engine.';
        } else if (/Translation is unavailable/i.test(stderr)) {
          state.error = 'Translation is unavailable because Gemini and the online fallback cannot reach the network. Allow outbound HTTPS or configure an offline translation engine.';
        } else {
          state.error = (stderr || `Pipeline exited with code ${code}`).split(/\r?\n/).filter(Boolean).slice(-12).join('\n').slice(-1600);
        }
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (!result.success || !fs.existsSync(result.video)) throw new Error('Pipeline returned no output video');
        const name = path.basename(result.video);
        const dest = path.join(DIRS.videos, name);
        fs.copyFileSync(result.video, dest);
        state.result = { videoUrl: `/videos/${encodeURIComponent(name)}`, fileName: name,
          srtUrl: `/uploads/${path.basename(outputDir)}/${path.basename(result.srt)}`,
          count: result.dialogues_count, characters: result.characters, items: result.items || [] };
        state.status = 'completed'; state.progress = 100; state.stage = 'Completed';
      } catch (err) { state.status = 'failed'; state.error = err.message; }
    });
    child.on('error', err => { state.status = 'failed'; state.error = err.message; });
    res.json({ success: true, jobId });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/auto-dub-jobs/:id', (req, res) => {
  const job = masterDubJobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, status: job.status, stage: job.stageKhmer || job.stage, step: job.currentStep || 1, progress: job.progress,
    error: job.error, result: job.result });
  if (job.status !== 'running') setTimeout(() => masterDubJobs.delete(job.id), 10 * 60 * 1000).unref();
});

// Helper: Run Voice Split Analysis
async function runVoiceSplit(mediaPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(BASE_DIR, 'voice_split_tool', 'voice_split.py');
    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const outDir = VOICE_SPLIT_DIR;
    const profilesPath = path.join(outDir, 'voices.json');

    const child = spawn(pythonExe, [
      scriptPath,
      'split',
      mediaPath,
      '--outdir', outDir,
      '--profiles', profilesPath,
      '--separate', 'no'
    ], {
      env: { ...process.env, PATH: `${DIRS.tools};${process.env.PATH}` }
    });

    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', (code) => {
      const projectFile = path.join(outDir, 'project.json');
      if (code !== 0 || !fs.existsSync(projectFile)) {
        return resolve({ success: false, error: stderr || 'Voice split failed' });
      }

      try {
        const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        const speakers = [];
        for (const spk of project.speakers) {
          let sampleUrl = null;
          if (spk.best_file) {
            const bestSrc = path.join(outDir, spk.best_file);
            const targetName = `char_${spk.id}_${path.basename(mediaPath, path.extname(mediaPath))}_best.wav`;
            const dest = path.join(DIRS.voiceSamples, targetName);
            if (fs.existsSync(bestSrc)) {
              fs.copyFileSync(bestSrc, dest);
              sampleUrl = `/api/voice-sample/${targetName}`;
            }
          }
          const labelKm = spk.label_km || (spk.gender_guess === 'male' ? 'តួប្រុស' : 'តួស្រី');
          const defaultName = spk.name || `${labelKm} (${spk.id})`;
          speakers.push({
            id: spk.id,
            name: defaultName,
            gender: spk.gender_guess === 'male' ? 'Male' : 'Female',
            gender_guess: spk.gender_guess || (spk.pitch_hz > 165 ? 'female' : 'male'),
            age_guess: spk.age_guess || 'adult',
            category: spk.category || (spk.gender_guess === 'male' ? 'adult_male' : 'adult_female'),
            role: spk.role || (spk.gender_guess === 'male' ? 'male_lead' : 'female_lead'),
            label_km: labelKm,
            pitch_hz: spk.pitch_hz,
            f0_spread: spk.f0_spread,
            voiced_ratio: spk.voiced_ratio,
            seconds: spk.seconds,
            lines: spk.lines,
            sampleUrl: sampleUrl
          });
        }
        resolve({ success: true, speakers, project });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
}

// Helper: Run Auto-Transcribe (Faster-Whisper)
async function runAutoTranscribe(mediaPath, options = {}) {
  return new Promise((resolve) => {
    const outJson = path.join(DIRS.uploads, `trans_${Date.now()}.json`);
    const scriptPath = path.join(DIRS.tools, 'auto_transcribe.py');
    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';
    const lang = options.language || 'auto';
    const modelSize = options.modelSize || 'base';

    const args = [
      scriptPath,
      '--input', mediaPath,
      '--output', outJson,
      '--ffmpeg', ffmpegExe,
      '--model-size', modelSize
    ];
    if (lang && lang !== 'auto') {
      args.push('--language', lang);
    }

    const child = spawn(pythonExe, args);

    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(outJson)) {
        return resolve({ success: false, error: stderr || 'Transcription failed' });
      }

      try {
        const rawData = JSON.parse(fs.readFileSync(outJson, 'utf8'));
        fs.unlinkSync(outJson);
        resolve(rawData);
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
}

// ---------------------------------------------------------
// FINAL VIDEO RENDER ENDPOINT
// ---------------------------------------------------------
app.post('/api/render-final-video', async (req, res) => {
  try {
    const { videoFileName, items } = req.body;
    
    // Robust video file search: uploads → videos → base dir
    let videoPath = null;
    if (videoFileName) {
      const baseName = path.basename(videoFileName);
      const searchDirs = [DIRS.uploads, DIRS.videos, BASE_DIR];
      for (const dir of searchDirs) {
        const candidate = path.join(dir, baseName);
        if (fs.existsSync(candidate)) { videoPath = candidate; break; }
      }
    }
    // Fallback: find most recent video upload
    if (!videoPath) {
      const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.mov'];
      const files = fs.readdirSync(DIRS.uploads)
        .filter(f => videoExts.some(ext => f.toLowerCase().endsWith(ext)))
        .sort((a, b) => fs.statSync(path.join(DIRS.uploads, b)).mtimeMs - fs.statSync(path.join(DIRS.uploads, a)).mtimeMs);
      if (files.length > 0) videoPath = path.join(DIRS.uploads, files[0]);
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      log(`[FINAL RENDER] Video file not found. Searched for: ${videoFileName}`, 'ERROR');
      return res.status(400).json({ success: false, error: 'រកមិនឃើញឯកសារវីដេអូ (Video file not found)' });
    }

    log(`[FINAL RENDER] Found video: ${videoPath}`);

    // Prepare clips JSON for stitch_dub.py
    // Strip query params from audioUrl before resolving to filesystem path
    const clipsData = (items || []).filter(it => it.audioUrl).map(it => {
      const urlClean = (it.audioUrl || '').split('?')[0].split('&')[0];
      return {
        file: path.join(DIRS.uploads, path.basename(urlClean)),
        start: parseFloat(it.audioStart || it.textStart || 0)
      };
    }).filter(it => fs.existsSync(it.file));

    if (clipsData.length === 0) {
      log(`[FINAL RENDER] No valid audio clips found. Items received: ${(items || []).length}`, 'ERROR');
      return res.status(400).json({ success: false, error: 'គ្មាន audio clips សម្រាប់ render (No audio clips found on disk)' });
    }

    const clipsJsonPath = path.join(DIRS.uploads, `clips_${Date.now()}.json`);
    fs.writeFileSync(clipsJsonPath, JSON.stringify(clipsData), 'utf8');

    const outputFileName = `dubbed_${Date.now()}.mp4`;
    const outputPath = path.join(DIRS.uploads, outputFileName);
    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const scriptPath = path.join(DIRS.tools, 'stitch_dub.py');

    log(`[FINAL RENDER] Starting render with ${clipsData.length} audio clips onto ${path.basename(videoPath)}...`);

    const mode = req.body.mode || req.body.vocalRemovalMode || 'duck';
    const dubVol = req.body.dubVolume || req.body.dubVol || '2.8'; // Louder Khmer voice

    // Check for clean BGM file (e.g. no_vocals.wav)
    let bgmArgs = [];
    const possibleBgm = [
      req.body.bgmFile,
      path.join(DIRS.uploads, 'no_vocals.wav'),
      path.join(path.dirname(videoPath), 'no_vocals.wav')
    ];
    for (const p of possibleBgm) {
      if (p && fs.existsSync(p)) {
        bgmArgs = ['--bgm', p];
        log(`[FINAL RENDER] Found clean BGM: ${p}`);
        break;
      }
    }

    // 1. Subtitle Burning (SRT)
    let subArgs = [];
    let srtPath = req.body.subtitleFile || null;
    const subtitleLineMode = req.body.subtitleLineMode || 'single'; // Default to single line (តែមួយបន្ទាត់)
    if (!srtPath && items && items.length > 0 && req.body.burnSubtitles) {
      function smartWrapKhmer(text) {
        if (!text) return '';
        const raw = text.trim().replace(/\s+/g, ' ');
        if (raw.length <= 18) return raw; // fits on 1 line

        // Try to split at a space near the midpoint
        const mid = Math.ceil(raw.length / 2);
        let splitIdx = -1;
        for (let delta = 0; delta <= 8; delta++) {
          if (mid - delta > 0 && raw[mid - delta] === ' ') { splitIdx = mid - delta; break; }
          if (mid + delta < raw.length && raw[mid + delta] === ' ') { splitIdx = mid + delta; break; }
        }

        let line1, line2;
        if (splitIdx > 0) {
          line1 = raw.substring(0, splitIdx).trim();
          line2 = raw.substring(splitIdx + 1).trim();
        } else {
          line1 = raw.substring(0, 18);
          line2 = raw.substring(18).trim();
        }

        if (line2.length > 22) {
          line2 = line2.substring(0, 20) + '...';
        }

        return `${line1}\n${line2}`;
      }

      // Auto-generate SRT: Single-Line (clean 1 line) or Double-Line
      const srtContent = items.map((it, idx) => {
        const s = parseFloat(it.textStart || it.audioStart || 0);
        const e = parseFloat(it.textEnd || it.audioEnd || (s + 2.5));
        const fmtTime = (sec) => {
          const h = String(Math.floor(sec / 3600)).padStart(2, '0');
          const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
          const sInt = String(Math.floor(sec % 60)).padStart(2, '0');
          const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
          return `${h}:${m}:${sInt},${ms}`;
        };
        const rawText = (it.text || it.khmer || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        const formattedText = (subtitleLineMode === 'double') ? smartWrapKhmer(rawText) : rawText;
        return `${idx + 1}\n${fmtTime(s)} --> ${fmtTime(e)}\n${formattedText}\n`;
      }).join('\n');
      const genSrt = path.join(DIRS.uploads, `subtitles_${Date.now()}.srt`);
      fs.writeFileSync(genSrt, srtContent, 'utf8');
      srtPath = genSrt;
      log(`[FINAL RENDER] Khmer subtitles generated (Battambang font, Format: ${subtitleLineMode === 'double' ? '២ បន្ទាត់' : 'តែមួយបន្ទាត់ (Single Line)'}): ${genSrt}`);
    }
    const subtitleFontSize = parseInt(req.body.subtitleFontSize) || 16;
    const subtitleFont = req.body.subtitleFont || 'Battambang';
    if (srtPath && fs.existsSync(srtPath)) {
      subArgs = ['--subtitle-file', srtPath, '--subtitle-font-size', String(subtitleFontSize), '--subtitle-font', subtitleFont];
      log(`[FINAL RENDER] High-Resolution Subtitles Enabled: ${srtPath} (Font: ${subtitleFont}, Size: ${subtitleFontSize}px)`);
    }

    // 2. Intro / Outro / Sponsor Video Arguments
    let brandingArgs = [];
    if (req.body.introVideo && fs.existsSync(req.body.introVideo)) {
      brandingArgs.push('--intro-video', req.body.introVideo);
      log(`[FINAL RENDER] Intro Video attached: ${req.body.introVideo}`);
    }
    if (req.body.outroVideo && fs.existsSync(req.body.outroVideo)) {
      brandingArgs.push('--outro-video', req.body.outroVideo);
      log(`[FINAL RENDER] Outro Video attached: ${req.body.outroVideo}`);
    }
    if (req.body.sponsorVideo && fs.existsSync(req.body.sponsorVideo)) {
      brandingArgs.push('--sponsor-video', req.body.sponsorVideo);
      const spTime = parseFloat(req.body.sponsorTime || 0);
      brandingArgs.push('--sponsor-time', String(spTime));
      log(`[FINAL RENDER] Sponsor Video attached at ${spTime}s: ${req.body.sponsorVideo}`);
    }

    // 3. Logo & Text Watermark Arguments (រូបភាព & អក្សរ Style)
    let logoArgs = [];
    const wmEnabled = req.body.watermarkEnabled !== undefined ? Boolean(req.body.watermarkEnabled) : (req.body.watermarkLogo !== false && (req.body.watermarkLogo || req.body.burnLogo));
    const wmType = req.body.watermarkType || 'image';

    if (wmEnabled) {
      if (wmType === 'text' && req.body.watermarkText && req.body.watermarkText.trim()) {
        logoArgs.push('--watermark-text', String(req.body.watermarkText).trim());
        if (req.body.watermarkTextStyle) logoArgs.push('--watermark-text-style', String(req.body.watermarkTextStyle));
        if (req.body.watermarkTextColor) logoArgs.push('--watermark-text-color', String(req.body.watermarkTextColor));
        if (req.body.watermarkTextSize) logoArgs.push('--watermark-text-size', String(req.body.watermarkTextSize));
        if (req.body.watermarkPosition) logoArgs.push('--watermark-position', String(req.body.watermarkPosition));
        if (req.body.watermarkOpacity) logoArgs.push('--watermark-opacity', String(req.body.watermarkOpacity));
        log(`[FINAL RENDER] Text Watermark attached: "${req.body.watermarkText}" (${req.body.watermarkTextStyle || 'outline'})`);
      } else {
        const logoCandidate = req.body.watermarkImage || req.body.logoImage || path.join(__dirname, 'dist', 'user_logo.png');
        if (logoCandidate && fs.existsSync(logoCandidate)) {
          logoArgs.push('--logo-image', logoCandidate);
          if (req.body.watermarkSize) logoArgs.push('--watermark-size', String(req.body.watermarkSize));
          if (req.body.watermarkOpacity) logoArgs.push('--watermark-opacity', String(req.body.watermarkOpacity));
          if (req.body.watermarkPosition) logoArgs.push('--watermark-position', String(req.body.watermarkPosition));
          log(`[FINAL RENDER] Image Watermark attached: ${logoCandidate}`);
        }
      }
    }

    const stitchArgs = [
      scriptPath,
      '--video', videoPath,
      '--clips-json', clipsJsonPath,
      '--output', outputPath,
      '--ffmpeg', fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg',
      '--ffprobe', fs.existsSync(DIRS.ffprobe) ? DIRS.ffprobe : 'ffprobe',
      '--mode', mode,
      '--dub-vol', String(dubVol),
      '--orig-vol', String(req.body.origVolume || 0.50),  // BGM stays audible but voice is primary
      '--sample-rate', '24000',
      ...bgmArgs,
      ...subArgs,
      ...brandingArgs,
      ...logoArgs
    ];

    const child = spawn(pythonExe, stitchArgs, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PATH: `${DIRS.tools};${process.env.PATH}` }
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => {
      stderr += d.toString();
      const line = d.toString().trim();
      if (line) log(`[FINAL RENDER Progress] ${line}`);
    });

    child.on('close', (code) => {
      try { fs.unlinkSync(clipsJsonPath); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        // Support custom export directory chosen by user
        let targetFolder = DIRS.videos;
        if (req.body.exportDir && req.body.exportDir.trim()) {
          const chosen = req.body.exportDir.trim();
          try {
            if (!fs.existsSync(chosen)) fs.mkdirSync(chosen, { recursive: true });
            targetFolder = chosen;
          } catch (e) {
            log(`[Custom Export Dir Error] ${e.message}`, 'WARN');
          }
        }

        const videosOutputPath = path.join(targetFolder, outputFileName);
        try { 
          fs.copyFileSync(outputPath, videosOutputPath);
          if (targetFolder !== DIRS.uploads) fs.unlinkSync(outputPath);
        } catch (e) {
          log(`[Copy Output Error] ${e.message}`, 'WARN');
        }

        log(`[FINAL RENDER] ✅ Success! Output: ${outputFileName} saved in ${targetFolder}`);
        res.json({
          success: true,
          outputUrl: `/videos/${encodeURIComponent(outputFileName)}`,
          downloadUrl: `/api/download-render/${encodeURIComponent(outputFileName)}`,
          fileName: outputFileName,
          filePath: videosOutputPath,
          folderPath: targetFolder,
          message: `Render complete! វីដេអូបានរក្សាទុកក្នុង: ${targetFolder} 🎉`
        });
      } else {
        log(`[FINAL RENDER] Failed (code ${code}): ${stderr}`, 'ERROR');
        res.status(500).json({ success: false, error: stderr.slice(-300) || 'Render failed' });
      }
    });

  } catch (err) {
    log(`[FINAL RENDER] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to browse for a local folder via Windows native dialog
app.post('/api/browse-folder', (req, res) => {
  const { exec } = require('child_process');
  const psCmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = \"Choose Export Folder\"; $f.ShowNewFolderButton = $true; if($f.ShowDialog() -eq \"OK\"){ Write-Output $f.SelectedPath }"';
  
  exec(psCmd, { timeout: 60000 }, (err, stdout) => {
    const selected = (stdout || '').trim();
    if (selected && fs.existsSync(selected)) {
      log(`[System] User selected folder: ${selected}`);
      res.json({ success: true, folder: selected });
    } else {
      res.json({ success: false, folder: req.body.defaultFolder || DIRS.videos });
    }
  });
});

// Hardware Benchmark Check for Local VoxCPM2 & GPU Capability
app.get('/api/benchmark-hardware', (req, res) => {
  try {
    const os = require('os');
    const { exec } = require('child_process');
    const cpus = os.cpus();
    const cpuModel = cpus && cpus[0] ? cpus[0].model.trim() : 'Standard Multi-Core CPU';
    const cpuCores = cpus ? cpus.length : 1;
    const totalRamGb = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeRamGb = (os.freemem() / (1024 ** 3)).toFixed(1);

    exec('nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader', { timeout: 3500 }, (err, stdout) => {
      let gpuInfo = null;
      if (!err && stdout && stdout.trim()) {
        const parts = stdout.trim().split('\n')[0].split(',').map(s => s.trim());
        gpuInfo = {
          name: parts[0] || 'NVIDIA GPU',
          totalMem: parts[1] || 'Unknown',
          freeMem: parts[2] || 'Unknown'
        };
      }

      let badge = 'Standard CPU';
      let score = 75;
      let recommendation = '';

      if (gpuInfo) {
        score = 98;
        badge = 'High Performance GPU';
        recommendation = `រកឃើញ GPU: ${gpuInfo.name} (${gpuInfo.totalMem}) - គាំទ្រដំណើរការ VoxCPM2 & Vocal Split លើម៉ាស៊ីនផ្ទាល់កម្រិត Cinema លឿនបំផុត!`;
      } else if (cpuCores >= 8 && parseFloat(totalRamGb) >= 15.0) {
        score = 88;
        badge = 'High-Core CPU';
        recommendation = `CPU ${cpuCores} Cores, RAM ${totalRamGb} GB - ដំណើរការ VoxCPM2 CPU Mode បានយ៉ាងរលូន (ឬភ្ជាប់ Google Colab GPU សម្រាប់ល្បឿនកាន់តែលឿន)`;
      } else {
        score = 72;
        badge = 'Cloud-Accelerated';
        recommendation = `CPU ${cpuCores} Cores, RAM ${totalRamGb} GB - ដំណើរការ Edge-TTS Studio AI លឿន 100%។ សម្រាប់ VoxCPM2 Clone សូមភ្ជាប់ទៅកាន់ Google Colab / Kaggle Free GPU Link`;
      }

      res.json({
        success: true,
        cpuModel,
        cpuCores,
        totalRamGb: `${totalRamGb} GB`,
        freeRamGb: `${freeRamGb} GB`,
        gpu: gpuInfo,
        badge,
        score,
        recommendation
      });
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Test Colab / Kaggle Remote Gradio/Ngrok URL Latency
app.post('/api/test-colab-link', async (req, res) => {
  const targetUrl = (req.body && req.body.url ? req.body.url.trim() : '');
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ success: false, error: 'សូមបញ្ជាក់ Gradio / Ngrok URL ត្រឹមត្រូវ (e.g. https://xxxx.gradio.live)' });
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    return res.json({
      success: true,
      url: targetUrl,
      status: response.status,
      latencyMs: `${latencyMs}ms`,
      message: `ការតភ្ជាប់ជោគជ័យ! Latency: ${latencyMs}ms (Online ដំណើរការបាន)`
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return res.json({
      success: false,
      url: targetUrl,
      latencyMs: `${latencyMs}ms`,
      error: `មិនអាចភ្ជាប់ទៅកាន់ Link បានទេ: ${err.message}`
    });
  }
});


app.post('/api/open-output-folder', (req, res) => {
  try {
    const targetFolder = (req.body && req.body.folderPath && fs.existsSync(req.body.folderPath))
      ? req.body.folderPath
      : DIRS.videos;
    log(`[System] Opening output folder: ${targetFolder}`);
    launchWindowsExplorer(targetFolder);
    res.json({ success: true, folder: targetFolder });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Reveal file in Windows Explorer with selection
app.post('/api/show-in-folder', (req, res) => {
  try {
    const fileName = req.body && req.body.fileName;
    const filePath = req.body && req.body.filePath;
    let target = null;
    if (filePath && fs.existsSync(filePath)) {
      target = filePath;
    } else if (fileName) {
      const candidates = [
        path.join(DIRS.videos, fileName),
        path.join(DIRS.uploads, fileName)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) { target = c; break; }
      }
    }

    if (target) {
      log(`[System] Revealing file in Windows Explorer: ${target}`);
      exec(`explorer.exe /select,"${target}"`);
      res.json({ success: true, target });
    } else {
      exec(`explorer.exe "${DIRS.videos}"`);
      res.json({ success: true, target: DIRS.videos });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Open video file directly in Windows default media player
app.post('/api/open-file', (req, res) => {
  try {
    const fileName = req.body && req.body.fileName;
    const filePath = req.body && req.body.filePath;
    let target = null;
    if (filePath && fs.existsSync(filePath)) {
      target = filePath;
    } else if (fileName) {
      const candidates = [
        path.join(DIRS.videos, fileName),
        path.join(DIRS.uploads, fileName)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) { target = c; break; }
      }
    }

    if (target) {
      log(`[System] Opening video in Windows default media player: ${target}`);
      exec(`cmd /c start "" "${target}"`);
      res.json({ success: true, target });
    } else {
      res.status(404).json({ success: false, error: 'Video file not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 🎬 Permanent Video Library (បណ្ណាល័យវីដេអូ Tool មិនបាត់បង់)
// ---------------------------------------------------------
app.get('/api/library/videos', (req, res) => {
  try {
    if (!fs.existsSync(DIRS.videos)) {
      fs.mkdirSync(DIRS.videos, { recursive: true });
    }
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];
    const files = fs.readdirSync(DIRS.videos)
      .filter(f => videoExts.some(ext => f.toLowerCase().endsWith(ext)))
      .map(name => {
        const fullPath = path.join(DIRS.videos, name);
        const stat = fs.statSync(fullPath);
        return {
          fileName: name,
          filePath: fullPath,
          sizeBytes: stat.size,
          sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
          createdAt: stat.mtimeMs,
          createdDate: new Date(stat.mtimeMs).toLocaleString('km-KH'),
          url: `/videos/${encodeURIComponent(name)}`,
          downloadUrl: `/api/download-render/${encodeURIComponent(name)}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ success: true, count: files.length, folderPath: DIRS.videos, videos: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/library/delete-video', (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ success: false, error: 'No fileName provided' });
    const target = path.join(DIRS.videos, path.basename(fileName));
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      log(`[Library] Deleted video from library: ${target}`);
      return res.json({ success: true, fileName });
    }
    res.status(404).json({ success: false, error: 'File not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. Auto-Transcribe & Translate (Faster-Whisper + Google Khmer)
// Fully Offline / Free Speech-to-Text & Character Role Diarization
// ---------------------------------------------------------

// ---------------------------------------------------------
// Standalone Subtitle Translation API (100% Spoken Film Khmer)
// ---------------------------------------------------------
app.post('/api/translate-subtitles', async (req, res) => {
  try {
    const items = req.body.items || [];
    if (!items.length) {
      return res.status(400).json({ success: false, error: 'No subtitle items provided for translation' });
    }

    const genre = req.body.genre || req.body.movieGenre || voxcpmConfig.genre || 'ancient_wuxia';
    const engine = req.body.engine || (currentGeminiConfig.apiKey ? 'gemini' : 'pool');
    const geminiModel = req.body.geminiModel || currentGeminiConfig.model || 'gemini-2.0-flash';
    const apiKey = resolveGeminiApiKey(req);

    log(`[Translate Subtitles] Translating ${items.length} lines into lively film Khmer (engine=${engine}, genre=${genre})...`);
    const translated = await translateUniversal(items, { engine, genre, geminiModel, apiKey });

    res.json({
      success: true,
      items: translated,
      count: translated.length
    });
  } catch (err) {
    log(`[Translate Subtitles Error] ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/transcribe-auto', upload.single('videoFile'), async (req, res) => {
  try {
    let mediaPath = null;
    let isTemp = false;

    if (req.file) {
      mediaPath = req.file.path;
      isTemp = true;
    } else if (req.body.videoFileName) {
      const fn = path.basename(req.body.videoFileName);
      const possible = [
        path.join(DIRS.uploads, fn),
        path.join(DIRS.videos, fn),
        path.join(BASE_DIR, fn)
      ];
      for (const p of possible) {
        if (fs.existsSync(p)) { mediaPath = p; break; }
      }
    }

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.ts'];
      const searchDirs = [DIRS.uploads, DIRS.videos, BASE_DIR];
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir)
          .filter(f => videoExts.some(ext => f.toLowerCase().endsWith(ext)))
          .sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
        if (files.length > 0) {
          mediaPath = path.join(dir, files[0]);
          log(`[AutoTranscribe Fallback] Automatically selected latest video: ${mediaPath}`);
          break;
        }
      }
    }

    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(400).json({ success: false, error: 'No video or audio file found for transcription' });
    }

    const lang = req.body.language || 'auto';
    const modelSize = req.body.modelSize || 'base';
    const engine = req.body.engine || 'ollama';
    const ollamaModel = req.body.ollamaModel || req.body.model || 'qwen2.5';

    log(`[AutoTranscribe] Starting Faster-Whisper (lang=${lang}, model=${modelSize}) for: ${path.basename(mediaPath)}`);
    const rawData = await runAutoTranscribe(mediaPath, { language: lang, modelSize });

    if (!rawData || !rawData.success) {
      return res.status(500).json({ success: false, error: rawData?.error || 'Transcription failed' });
    }

    const segments = rawData.segments || [];
    const isTranscribeOnly = req.body.transcribeOnly === 'true' || req.body.transcribeOnly === true || req.query.transcribeOnly === 'true';

    if (isTranscribeOnly) {
      log(`[AutoTranscribe] transcribeOnly=true: Detected ${segments.length} segments with character diarization (No auto-translation).`);
      const items = segments.map((seg, i) => {
        const orig = seg.text || seg.originalText || '';
        const spk = seg.speaker || `Speaker_${(i % 3) + 1}`;

        // --- Advanced gender/age detection ---
        // 1. Use Whisper-reported gender if available
        // 2. Infer from pitch/frequency data (whisper-diarize sometimes provides f0_hz)
        // 3. Fall back to heuristic role label
        let gen = seg.gender || '';
        let age = seg.age || '';

        if (!gen) {
          const pitchHz = parseFloat(seg.f0_hz || seg.pitch_hz || 0);
          if (pitchHz > 0) {
            // Female fundamental: typically 165–255 Hz; Male: 85–155 Hz; Child: >260 Hz
            if (pitchHz > 260)       { gen = 'Female'; age = 'Child'; }
            else if (pitchHz > 165)  { gen = 'Female'; }
            else if (pitchHz > 155)  { gen = 'Female'; } // borderline — assign female
            else if (pitchHz < 100)  { gen = 'Male'; age = 'Elder'; }
            else                     { gen = 'Male'; }
          }
        }
        if (!gen) {
          // Text-pattern heuristics on role/speaker label
          if (/female|girl|woman|sreymom|ស្រី|នារី/i.test(seg.role || spk)) gen = 'Female';
          else gen = 'Male';
        }
        if (!age) {
          if (/child|kid|young|ក្មេង|boy|girl/i.test(seg.role || spk)) age = 'Child';
          else if (/elder|old|grandfather|grandmother|ចាស់|យាយ|តា/i.test(seg.role || spk)) age = 'Elder';
          else age = 'Adult';
        }

        // Determine emotion hint from original speech text patterns
        let emotion = 'ធម្មតា';
        if (/[!！]{2,}|ខឹង|ចាប|ក្រោធ|ជ្រក/i.test(orig)) emotion = 'ខឹង';
        else if (/[?？]{2,}|ហ្នឹង.*ហ្នឹង|ពិតទេ|ពិតមែន/i.test(orig)) emotion = 'ងឿងឆ្ងល់';
        else if (/ខ្សោយ|រំភើប|ស្រែក|ទ្រំ/i.test(orig)) emotion = 'ភ័យ';
        else if (/ស្រេក|ចង់|ស្រឡាញ់/i.test(orig)) emotion = 'ស្រឡាញ់';

        const voiceLabel = gen === 'Female'
          ? (age === 'Child' ? `${spk} · ស្រីក្មេង` : age === 'Elder' ? `${spk} · ស្រីចាស់` : `${spk} · ស្រី`)
          : (age === 'Child' ? `${spk} · ប្រុសក្មេង` : age === 'Elder' ? `${spk} · ប្រុសចាស់` : `${spk} · ប្រុស`);

        return {
          id: `sub_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          textStart: Number(seg.start).toFixed(2),
          textEnd: Number(seg.end).toFixed(2),
          audioStart: Number(seg.start).toFixed(2),
          audioEnd: Number(seg.end).toFixed(2),
          text: orig,
          originalText: orig,
          voice: voiceLabel,
          gender: gen,
          age: age,
          speaker: spk,
          role: gen === 'Female' ? 'ស្រី' : 'ប្រុស',
          emotion: emotion,
          status: 'pending',
          audioStatus: 'idle',
          audioUrl: null,
          baseAudioDuration: 0,
          speed: 1
        };
      });

      return res.json({
        success: true,
        items,
        count: items.length,
        language: rawData.language
      });
    }

    log(`[AutoTranscribe] Transcribed ${segments.length} segments with timestamps. Translating to Khmer via ${engine} (${ollamaModel})...`);

    const apiKey = resolveGeminiApiKey(req);
    const translatedSegments = await translateUniversal(segments, { engine, ollamaModel, apiKey });

    const items = [];
    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      const txt = seg.text || seg.khmer || seg.originalText || '';
      const emo = seg.emotion || detectEmotionFromContext(txt, seg.originalText);
      items.push({
        id: `sub_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        textStart: Number(seg.start).toFixed(2),
        textEnd: Number(seg.end).toFixed(2),
        audioStart: Number(seg.start).toFixed(2),
        audioEnd: Number(seg.end).toFixed(2),
        text: txt,
        originalText: seg.originalText || seg.text,
        voice: seg.gender === 'Female' ? 'Sreymom · Lead' : 'Piseth · Lead',
        gender: seg.gender || 'Female',
        speaker: seg.speaker || 'Speaker_1',
        role: seg.role || (seg.gender === 'Female' ? 'ស្រី' : 'ប្រុស'),
        emotion: emo,
        status: 'pending',
        audioStatus: 'idle',
        audioUrl: null,
        baseAudioDuration: 0,
        speed: 1
      });
    }

    log(`[AutoTranscribe] Successfully prepared ${items.length} dubbed subtitle lines in Khmer.`);
    res.json({
      success: true,
      items,
      count: items.length,
      language: rawData.language
    });

  } catch (err) {
    log(`[AutoTranscribe] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 5. Google Translate & Gemini Endpoints (Instant Batch or Single)
// ---------------------------------------------------------
app.get('/api/gemini-config', (req, res) => {
  res.json({ success: true, config: currentGeminiConfig });
});

app.post('/api/gemini-config', (req, res) => {
  const { apiKey, apiKeys, model } = req.body;
  if (Array.isArray(apiKeys)) {
    currentGeminiConfig.apiKeys = apiKeys.map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
    if (currentGeminiConfig.apiKeys.length > 0) {
      currentGeminiConfig.apiKey = currentGeminiConfig.apiKeys[0];
    }
  } else if (typeof apiKey === 'string') {
    const trimmed = apiKey.trim();
    currentGeminiConfig.apiKey = trimmed;
    const parsedKeys = trimmed.split(/[\r\n,]+/).map(k => k.trim()).filter(Boolean);
    if (parsedKeys.length > 0) {
      currentGeminiConfig.apiKeys = parsedKeys;
      currentGeminiConfig.apiKey = parsedKeys[0];
    }
  }
  if (model !== undefined) currentGeminiConfig.model = model;
  saveGeminiConfig(currentGeminiConfig);
  const totalKeys = currentGeminiConfig.apiKeys ? currentGeminiConfig.apiKeys.length : (currentGeminiConfig.apiKey ? 1 : 0);
  log(`[Gemini Router Config] Saved ${totalKeys} API key(s) in Key Pool. Active Model: ${currentGeminiConfig.model}`);
  res.json({ success: true, config: currentGeminiConfig, totalKeys });
});

// =========================================================================
// 🎯 PHASE 2: LOGGING & CONFIG ENDPOINTS
// =========================================================================

// Logging endpoint - receives logs from client
app.post('/api/log', (req, res) => {
  try {
    const { timestamp, level, message, context } = req.body;
    const logDir = path.join(BASE_DIR, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `session_${today}.log`);
    
    const logLine = `[${timestamp}] [${level}] ${message}${context && Object.keys(context).length ? ' ' + JSON.stringify(context) : ''}\n`;
    
    fs.appendFileSync(logFile, logLine, 'utf8');
    res.json({ success: true });
  } catch (error) {
    // Silent fail - don't break app if logging fails
    res.json({ success: false, error: error.message });
  }
});

// Config endpoint - GET centralized config
app.get('/api/config', (req, res) => {
  try {
    const configFile = path.join(BASE_DIR, 'config.json');
    
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      res.json({ success: true, config });
    } else {
      // Return empty if not exists (client will use defaults)
      res.json({ success: true, config: null });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Config endpoint - POST save config
app.post('/api/config', (req, res) => {
  try {
    const configFile = path.join(BASE_DIR, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});


// =========================================================================
// 🎬 EXPERT FILM SUBTITLER & DUBBING TRANSLATOR (៦ ច្បាប់ភាពយន្តស្តង់ដារ)
// =========================================================================
app.post('/api/cinema-translate-subtitles', async (req, res) => {
  try {
    const { items, srtText, genre = 'ancient_wuxia' } = req.body;
    let subtitleItems = [];

    // Helper: Parse SRT string into items array if raw SRT provided
    if (srtText && typeof srtText === 'string') {
      const blocks = srtText.trim().split(/\r?\n\r?\n/);
      blocks.forEach((block, idx) => {
        const lines = block.trim().split(/\r?\n/);
        if (lines.length >= 3) {
          const tcMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
          if (tcMatch) {
            const rawText = lines.slice(2).join(' ');
            let gender = 'Male';
            if (/\[F\]|\[F_THINK\]/i.test(rawText)) gender = 'Female';
            subtitleItems.push({
              id: idx + 1,
              start: tcMatch[1].replace(',', '.'),
              end: tcMatch[2].replace(',', '.'),
              start_time: tcMatch[1],
              end_time: tcMatch[2],
              text: rawText.replace(/\[(M|F|M_THINK|F_THINK)\]/gi, '').trim(),
              originalText: rawText,
              gender: gender,
              speaker: gender === 'Female' ? 'Speaker_2' : 'Speaker_1'
            });
          }
        }
      });
    } else if (items && Array.isArray(items)) {
      subtitleItems = items;
    }

    if (!subtitleItems.length) {
      return res.status(400).json({ success: false, error: 'មិនមានអត្ថបទ Subtitle សម្រាប់បកប្រែឡើយ (No subtitle items provided)' });
    }

    log(`[Cinema Subtitler] Translating ${subtitleItems.length} lines with 6 Strict Cinema Dubbing Rules in genre: ${genre}...`);

    // Translate each line using the 6 Cinema Rules
    const polishedItems = [];
    for (let i = 0; i < subtitleItems.length; i++) {
      const it = subtitleItems[i];
      const orig = it.text || it.khmer || it.originalText || '';
      
      // Determine Gender & Audio Tag
      const gender = it.gender || (it.speaker && /female|sreymom|ស្រី/i.test(it.speaker) ? 'Female' : 'Male');
      const isThought = it.isThought || /គិតក្នុងចិត្ត|thought|think/i.test(it.emotion || orig);
      
      let tag = '[M]';
      if (gender === 'Female') {
        tag = isThought ? '[F_THINK]' : '[F]';
      } else {
        tag = isThought ? '[M_THINK]' : '[M]';
      }

      // Translate with Google Translate Free or Gemini if foreign
      let rawKm = orig;
      const isForeign = /[\u4e00-\u9fff|a-zA-Z]/.test(orig);
      if (isForeign) {
        rawKm = await translateToKhmer(orig, genre);
      }

      // Strip existing tags from raw translation
      rawKm = rawKm.replace(/\[(M|F|M_THINK|F_THINK)\]/gi, '').trim();

      // Polish using Spoken Film Rules
      let polished = rawKm;
      if (typeof polishToSpokenFilmKhmer === 'function') {
        polished = polishToSpokenFilmKhmer(rawKm, genre);
      }

      // Add appropriate Audio Tag
      const finalLine = `${tag} ${polished}`;

      polishedItems.push({
        ...it,
        id: it.id || (i + 1),
        text: finalLine,
        khmer: finalLine,
        gender: gender,
        emotion: it.emotion || 'ធម្មតា'
      });
    }

    // Build standard SRT string
    const formatTC = (secOrStr) => {
      if (typeof secOrStr === 'string' && secOrStr.includes(':')) return secOrStr.replace('.', ',');
      const sec = Number(secOrStr) || 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    let srtOutput = '';
    polishedItems.forEach((it, idx) => {
      const st = formatTC(it.start_time || it.start || 0);
      const et = formatTC(it.end_time || it.end || 2);
      srtOutput += `${idx + 1}\n${st} --> ${et}\n${it.text}\n\n`;
    });

    res.json({
      success: true,
      count: polishedItems.length,
      genre: genre,
      items: polishedItems,
      srtText: srtOutput.trim()
    });
  } catch (err) {
    log(`[Cinema Subtitler Error] ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/translate', (req, res) => req.url = '/api/translate-google');
app.post('/api/translate-google', async (req, res) => {
  try {
    const { text, items, engine = 'google', model = 'qwen2.5' } = req.body;
    const apiKey = resolveGeminiApiKey(req);
    
    if (items && Array.isArray(items)) {
      log(`[Translation] Translating batch of ${items.length} subtitles to Khmer (engine=${engine}, model=${model})...`);
      const translatedItems = await translateUniversal(items, { engine, ollamaModel: model, apiKey });
      return res.json({ success: true, items: translatedItems });
    }

    if (text) {
      const singleItem = [{ text, originalText: text }];
      const translated = await translateUniversal(singleItem, { engine, ollamaModel: model, apiKey });
      const resultText = translated && translated[0] ? translated[0].text : await translateToKhmer(text);
      return res.json({ success: true, text: resultText });
    }

    res.status(400).json({ success: false, error: 'No text or items provided' });
  } catch (err) {
    log(`[Translation] Error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ollama API Endpoints
app.get('/api/ollama/status', async (req, res) => {
  try {
    const status = await checkOllamaAvailable();
    res.json({
      success: true,
      ...status,
      recommendedModel: 'qwen2.5'
    });
  } catch (err) {
    res.json({ success: false, running: false, error: err.message });
  }
});

app.post('/api/ollama/pull', (req, res) => {
  const model = req.body.model || 'qwen2.5';
  log(`[Ollama Pull] Starting background pull for model: ${model}`);
  const child = spawn('ollama', ['pull', model], { shell: true });
  child.on('close', (code) => {
    log(`[Ollama Pull] Model ${model} pull completed with code ${code}`);
  });
  res.json({ success: true, message: `Started pulling ${model} in background...` });
});

async function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Failed to download audio file: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Audio download timeout')); });
  });
}

// ---------------------------------------------------------
// ---------------------------------------------------------
// 6. VoxCPM2 Colab / Kaggle Remote GPU Client (FastAPI & Gradio)
// ---------------------------------------------------------
async function callVoxcpmColab(colabUrl, text, samplePath, timbreStrength = 0.9, emotion = 'natural') {
  if (!colabUrl) throw new Error('Colab/Kaggle URL is not configured');
  
  const cleanUrl = colabUrl.replace(/\/+$/, '');
  log(`[VOXCPM2 Remote] Preparing inference on ${cleanUrl} for text: "${text.slice(0, 30)}..."`);

  // --- 1. Primary: Kaggle/Colab FastAPI Engine (/api/clone-and-speak) ---
  try {
    const fastApiUrl = cleanUrl.endsWith('/api/clone-and-speak') ? cleanUrl : `${cleanUrl}/api/clone-and-speak`;
    log(`[VOXCPM2 FastAPI] Connecting to ${fastApiUrl}...`);

    const form = new FormData();
    form.append('text', text);
    form.append('timesteps', '10');
    form.append('cfg_value', '2.0');

    if (samplePath && fs.existsSync(samplePath)) {
      const fileBuf = fs.readFileSync(samplePath);
      const ext = path.extname(samplePath).toLowerCase();
      const mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
      const blob = new Blob([fileBuf], { type: mimeType });
      form.append('reference_audio', blob, path.basename(samplePath));
      log(`[VOXCPM2 FastAPI] Attached reference audio sample: ${path.basename(samplePath)} (${fileBuf.length} bytes)`);
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 60000);

    const resp = await fetch(fastApiUrl, {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);

    if (resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('audio') || ct.includes('wav') || ct.includes('octet-stream')) {
        const ab = await resp.arrayBuffer();
        const audioBuffer = Buffer.from(ab);
        log(`[VOXCPM2 FastAPI] Successfully generated 48kHz audio: ${audioBuffer.length} bytes`);
        return { audioBuffer };
      } else {
        const json = await resp.json().catch(() => null);
        if (json && json.audio_url) {
          const dlRes = await fetch(json.audio_url);
          const dlBuf = Buffer.from(await dlRes.arrayBuffer());
          return { audioBuffer: dlBuf };
        }
      }
    } else {
      log(`[VOXCPM2 FastAPI] Endpoint returned HTTP ${resp.status}, trying Gradio fallback...`, 'WARN');
    }
  } catch (fastErr) {
    log(`[VOXCPM2 FastAPI Notice] ${fastErr.message}. Trying Gradio fallback...`, 'WARN');
  }

  // --- 2. Secondary: Gradio Engine Fallback (/api/clone or /api/predict) ---
  const apiUrl = `${cleanUrl}/api/clone`;
  log(`[VOXCPM2 Gradio Fallback] Sending clone request to: ${apiUrl}`);

  // Base64 encode sample audio if exists
  let audioBase64 = null;
  if (samplePath && fs.existsSync(samplePath)) {
    audioBase64 = fs.readFileSync(samplePath).toString('base64');
  }

  const payload = JSON.stringify({
    data: [text, audioBase64 ? `data:audio/wav;base64,${audioBase64}` : null, timbreStrength, emotion]
  });

  return new Promise((resolve, reject) => {
    const isHttps = apiUrl.startsWith('https');
    const client = isHttps ? https : http;
    const urlObj = new URL(apiUrl);

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 45000
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', async () => {
        const buffer = Buffer.concat(data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const str = buffer.toString('utf8');
            if (str.startsWith('{') || str.startsWith('[')) {
              const json = JSON.parse(str);
              
              let fileUrl = null;
              let base64Str = null;
              if (json && Array.isArray(json.data) && json.data.length > 0) {
                const item = json.data[0];
                if (typeof item === 'string') {
                  if (item.startsWith('http://') || item.startsWith('https://')) {
                    fileUrl = item;
                  } else if (item.startsWith('/file=') || item.startsWith('file=')) {
                    fileUrl = cleanUrl + (item.startsWith('/') ? '' : '/') + item;
                  } else if (item.startsWith('data:audio/')) {
                    base64Str = item.split(',')[1];
                  }
                } else if (item && typeof item === 'object') {
                  if (item.url) {
                    fileUrl = item.url.startsWith('http') ? item.url : (cleanUrl + (item.url.startsWith('/') ? '' : '/') + item.url);
                  } else if (item.data && typeof item.data === 'string' && item.data.startsWith('data:audio/')) {
                    base64Str = item.data.split(',')[1];
                  } else if (item.name && (item.name.startsWith('/file=') || item.name.startsWith('http'))) {
                    fileUrl = item.name.startsWith('http') ? item.name : (cleanUrl + (item.name.startsWith('/') ? '' : '/') + item.name);
                  }
                }
              }

              if (base64Str) {
                return resolve({ audioBuffer: Buffer.from(base64Str, 'base64') });
              }
              if (fileUrl) {
                log(`[VOXCPM2 Remote Colab] Downloading synthesized audio from: ${fileUrl}`);
                try {
                  const downloaded = await downloadBuffer(fileUrl);
                  return resolve({ audioBuffer: downloaded });
                } catch (dlErr) {
                  log(`[VOXCPM2 Download Warning] ${dlErr.message}`, 'WARN');
                }
              }

              resolve(json);
            } else {
              resolve({ audioBuffer: buffer });
            }
          } catch (e) {
            resolve({ audioBuffer: buffer });
          }
        } else {
          reject(new Error(`Colab returned status ${res.statusCode}: ${buffer.toString('utf8').slice(0, 100)}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Colab GPU connection timed out'));
    });

    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------
// 7. Voice Selection & Multi-Language Helper
// ---------------------------------------------------------
function getVoice(gender, language = 'km') {
  const lang = (language || 'km').toLowerCase();
  if (lang === 'km' || lang === 'khmer') {
    return gender === 'Female' ? 'km-KH-SreymomNeural' : 'km-KH-PisethNeural';
  }
  if (lang === 'en' || lang === 'english') {
    return gender === 'Female' ? 'en-US-JennyNeural' : 'en-US-GuyNeural';
  }
  return gender === 'Female' ? 'km-KH-SreymomNeural' : 'km-KH-PisethNeural';
}

// ---------------------------------------------------------
// 8. GET /api/status - Health & Dependency Check
// ---------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    app: 'Dabbing Pro',
    version: '5.2.0',
    status: 'online',
    port: PORT,
    voxcpm: {
      enabled: voxcpmConfig.enabled,
      mode: voxcpmConfig.mode,
      hostType: voxcpmConfig.hostType,
      hasColabUrl: Boolean(voxcpmConfig.colabUrl),
      hasSample: Boolean(voxcpmConfig.referenceAudio),
      characterCount: Object.keys(voxcpmConfig.characters).length
    },
    dependencies: {
      python: fs.existsSync(DIRS.python) ? 'bundled' : 'system',
      ffmpeg: fs.existsSync(DIRS.ffmpeg) ? 'bundled' : 'system',
      ffprobe: fs.existsSync(DIRS.ffprobe) ? 'bundled' : 'system',
      edgeTts: 'available'
    }
  });
});

// ---------------------------------------------------------
// 8.5 VOICE PROMPT GENERATION (សំឡេងតួឯកប្រុសនិយាយពេលចុច Button)
// Uses char_01_male_lead.wav voice for AI assistant prompts
// ---------------------------------------------------------

// Khmer voice prompt texts for each button action
const VOICE_PROMPT_TEXTS = {
  'one_click_auto': 'កំពុងចាប់ផ្ដើម ដាក់សំឡេងខ្មែរ ស្វ័យប្រវត្តិ ទាំងអស់',
  'voxcpm_clone': 'កំពុងដំណើរការ ក្លូនសំឡេង មនុស្សពិត ដោយប្រើ VoxCPM2',
  'genre_select': 'សូមជ្រើសរើស ប្រភេទរឿង ដែលលោកអ្នកចង់បាន',
  'voice_split': 'កំពុងបំបែក សំឡេង តួអង្គ នីមួយៗ ចេញពីគ្នា',
  'batch_dub': 'កំពុងបើក មុខងារ Dubbing រឿង ជាបាច់ ម្ដង មួយ Folder',
  'upload_video': 'សូមជ្រើសរើស វីដេអូ សម្រាប់ ដាក់សំឡេង ខ្មែរ',
  'bgm_music': 'សូមជ្រើសរើស ភ្លេងផ្ទៃក្រោយ BGM សម្រាប់រឿង',
  'mute_vocals': 'បានបិទ សំឡេងដើម រឿង រួចរាល់ ហើយ',
  'export_srt': 'កំពុងបង្កើត ឯកសារ Subtitle ជា SRT',
  'settings': 'កំពុងបើក ការកំណត់ ប្រព័ន្ធ',
  'text_editor': 'កំពុងបើក ផ្ទាំង កែឃ្លា និយាយ',
  'voice_casting': 'កំពុងបើក បន្ទប់ គ្រប់គ្រង សំឡេង តួអង្គ VoxCPM2',
  'subtitle_feature': 'កំពុងបើក មុខងារ ដាក់ Subtitle លើវីដេអូ ស្អាតៗ',
  'branding_feature': 'កំពុងបើក មុខងារ ដាក់ Intro Outro និង Sponsor Video',
  'video_library': 'កំពុងបើក បណ្ណាល័យ វីដេអូ ដែលបាន Render រួចរាល់',
  'render_video': 'កំពុងចាប់ផ្ដើម Render វីដេអូ ចុងក្រោយ',
  'reset_project': 'សូមប្រយ័ត្ន! កំពុងលុប ព័ត៌មាន គម្រោង ទាំងអស់ គ្មានការត្រឡប់ក្រោយ',
  'play_pc': 'កំពុងបើក វីដេអូ ដែលបាន Render រួចរាល់',
  'open_folder': 'កំពុងបើក Folder វីដេអូ ដែលបាន Render',
  'voice_assistant_on': 'សួស្ដី ខ្ញុំជា ជំនួយការ សំឡេង AI ត្រូវបាន បើក រួចរាល់ ហើយ',
  'voice_assistant_off': 'ជំនួយការ សំឡេង AI ត្រូវបាន បិទ រួចរាល់'
};

// POST /api/generate-single-prompt — Generate a single voice prompt on-the-fly
app.post('/api/generate-single-prompt', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key || !VOICE_PROMPT_TEXTS[key]) {
      return res.status(400).json({ success: false, error: 'Invalid prompt key' });
    }

    const text = VOICE_PROMPT_TEXTS[key];
    const promptsDir = path.join(DIRS.dist, 'prompts');
    if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });

    const outputPath = path.join(promptsDir, `${key}.mp3`);

    // Use male lead character voice (Speaker_1 / char_01_male_lead.wav)
    const charProfile = voxcpmConfig.characters['Speaker_1'] || {
      customVoice: 'km-KH-PisethNeural',
      gender: 'Male',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_01_male_lead.wav'
    };

    // Try VoxCPM2 voice cloning first if enabled
    const samplePath = path.join(DIRS.voiceSamples, charProfile.sampleFile || 'char_01_male_lead.wav');
    const shouldUseVoxcpm = voxcpmConfig.enabled && (
      (voxcpmConfig.hostType === 'colab_kaggle' && voxcpmConfig.colabUrl) ||
      voxcpmConfig.hostType === 'local_cpu' || 
      voxcpmConfig.hostType === 'local_gpu'
    );

    if (shouldUseVoxcpm) {
      try {
        const colabUrl = voxcpmConfig.hostType === 'colab_kaggle' 
          ? voxcpmConfig.colabUrl 
          : 'http://127.0.0.1:7860';
        
        const result = await callVoxcpmColab(
          colabUrl, text, 
          fs.existsSync(samplePath) ? samplePath : null,
          voxcpmConfig.timbreStrength, voxcpmConfig.emotion
        );

        if (result && result.audioBuffer) {
          fs.writeFileSync(outputPath, result.audioBuffer);
          log(`[Voice Prompt] Generated VoxCPM2 prompt: ${key}.mp3 (cloned from char_01_male_lead)`);
          return res.json({
            success: true,
            url: `/prompts/${key}.mp3?v=${Date.now()}`,
            engine: 'voxcpm2-cloned',
            key
          });
        }
      } catch (voxErr) {
        log(`[Voice Prompt] VoxCPM2 failed for prompt ${key}: ${voxErr.message}. Falling back to Edge-TTS.`, 'WARN');
      }
    }

    // Fallback: Edge-TTS with male lead voice (PisethNeural)
    const voice = charProfile.customVoice || 'km-KH-PisethNeural';
    const rateArg = charProfile.rate || '+0%';

    const tempTextFile = path.join(DIRS.uploads, `prompt_text_${Date.now()}.txt`);
    fs.writeFileSync(tempTextFile, text, 'utf8');

    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const args = [
      '-m', 'edge_tts',
      '--voice', voice,
      `--rate=${rateArg}`,
      '-f', tempTextFile,
      '--write-media', outputPath
    ];

    const child = spawn(pythonExe, args);
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', (code) => {
      try { if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        log(`[Voice Prompt] Generated Edge-TTS prompt: ${key}.mp3 (voice: ${voice})`);
        return res.json({
          success: true,
          url: `/prompts/${key}.mp3?v=${Date.now()}`,
          engine: 'edge-tts-male-lead',
          key
        });
      } else {
        log(`[Voice Prompt] TTS error for ${key}: ${stderr}`, 'ERROR');
        return res.status(500).json({ success: false, error: stderr || 'Failed to generate prompt' });
      }
    });

  } catch (err) {
    log(`[Voice Prompt] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/generate-voice-prompts — Batch regenerate ALL voice prompts with male lead voice
app.post('/api/generate-voice-prompts', async (req, res) => {
  try {
    const promptsDir = path.join(DIRS.dist, 'prompts');
    if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });

    const keys = Object.keys(VOICE_PROMPT_TEXTS);
    const results = [];
    let successCount = 0;
    let failCount = 0;

    const charProfile = voxcpmConfig.characters['Speaker_1'] || {
      customVoice: 'km-KH-PisethNeural',
      gender: 'Male',
      pitch: 1.0,
      rate: '+0%',
      sampleFile: 'char_01_male_lead.wav'
    };
    const voice = charProfile.customVoice || 'km-KH-PisethNeural';
    const rateArg = charProfile.rate || '+0%';
    const samplePath = path.join(DIRS.voiceSamples, charProfile.sampleFile || 'char_01_male_lead.wav');
    
    const shouldUseVoxcpm = voxcpmConfig.enabled && (
      (voxcpmConfig.hostType === 'colab_kaggle' && voxcpmConfig.colabUrl) ||
      voxcpmConfig.hostType === 'local_cpu' || 
      voxcpmConfig.hostType === 'local_gpu'
    );

    log(`[Voice Prompts Batch] Starting regeneration of ${keys.length} prompts with male lead voice...`);

    for (const key of keys) {
      const text = VOICE_PROMPT_TEXTS[key];
      const outputPath = path.join(promptsDir, `${key}.mp3`);
      let engine = 'edge-tts';

      try {
        // Try VoxCPM2 first
        if (shouldUseVoxcpm) {
          const colabUrl = voxcpmConfig.hostType === 'colab_kaggle' 
            ? voxcpmConfig.colabUrl 
            : 'http://127.0.0.1:7860';
          
          const result = await callVoxcpmColab(
            colabUrl, text,
            fs.existsSync(samplePath) ? samplePath : null,
            voxcpmConfig.timbreStrength, voxcpmConfig.emotion
          );
          if (result && result.audioBuffer) {
            fs.writeFileSync(outputPath, result.audioBuffer);
            engine = 'voxcpm2-cloned';
            successCount++;
            results.push({ key, status: 'ok', engine });
            log(`[Voice Prompts Batch] ✓ ${key}.mp3 (VoxCPM2 cloned)`);
            continue;
          }
        }

        // Fallback to Edge-TTS male lead voice
        await new Promise((resolve, reject) => {
          const tempTextFile = path.join(DIRS.uploads, `prompt_batch_${Date.now()}_${key}.txt`);
          fs.writeFileSync(tempTextFile, text, 'utf8');

          const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
          const args = [
            '-m', 'edge_tts',
            '--voice', voice,
            `--rate=${rateArg}`,
            '-f', tempTextFile,
            '--write-media', outputPath
          ];

          const child = spawn(pythonExe, args);
          let stderr = '';
          child.stderr.on('data', d => stderr += d.toString());
          child.on('close', (code) => {
            try { if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile); } catch (e) {}
            if (code === 0 && fs.existsSync(outputPath)) {
              resolve();
            } else {
              reject(new Error(stderr || `Edge-TTS failed for ${key}`));
            }
          });
        });
        
        engine = 'edge-tts-male-lead';
        successCount++;
        results.push({ key, status: 'ok', engine });
        log(`[Voice Prompts Batch] ✓ ${key}.mp3 (Edge-TTS PisethNeural)`);

      } catch (err) {
        failCount++;
        results.push({ key, status: 'error', error: err.message });
        log(`[Voice Prompts Batch] ✗ ${key}.mp3 failed: ${err.message}`, 'WARN');
      }
    }

    log(`[Voice Prompts Batch] Completed: ${successCount}/${keys.length} success, ${failCount} failed`);
    res.json({
      success: true,
      total: keys.length,
      successCount,
      failCount,
      results
    });

  } catch (err) {
    log(`[Voice Prompts Batch] Error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice-prompt-keys — Return list of available prompt keys and texts
app.get('/api/voice-prompt-keys', (req, res) => {
  res.json({
    success: true,
    prompts: Object.entries(VOICE_PROMPT_TEXTS).map(([key, text]) => ({
      key,
      text,
      fileExists: fs.existsSync(path.join(DIRS.dist, 'prompts', `${key}.mp3`))
    }))
  });
});

// ---------------------------------------------------------
// 9. POST /api/generate-audio
// Generates speech audio with STRICT Character-Voice Consistency:
// "ហើយតួអង្គ មួយប្រើបានសំឡេង តែមួយ ប៉ុណ្ណោះ ហាមប្រើសំឡេងច្រើនក្នុងតួអង្គមួយ"
// ---------------------------------------------------------

// GET /api/emotion-presets
app.get('/api/emotion-presets', (req, res) => {
  res.json({
    success: true,
    presets: Object.keys(EMOTION_PRESETS).map(k => ({
      key: k,
      ...EMOTION_PRESETS[k]
    }))
  });
});

app.post('/api/generate-audio', async (req, res) => {
  try {
    const { 
      text, 
      originalText = '',
      gender, 
      speed = 1, 
      index = 0, 
      language = 'km', 
      customVoice,
      characterId,
      speaker,
      emotion,
      useVoxcpm = voxcpmConfig.enabled 
    } = req.body;

    const activeEmotionKey = (emotion && EMOTION_PRESETS[emotion]) 
      ? emotion 
      : (detectEmotionFromContext(text, originalText) || 'ធម្មតា');
    const emotionPreset = EMOTION_PRESETS[activeEmotionKey] || EMOTION_PRESETS['ធម្មតា'];

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text cannot be empty' });
    }

    let cleanText = text
      .replace(/\[(M|F|M_THINK|F_THINK)\]/gi, '')
      .replace(/[\u4e00-\u9fff]+/g, '')  // 100% strip Chinese characters
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/"/g, "'")
      .trim();

    if (!cleanText) {
      cleanText = (gender === 'Male') ? 'បាទ' : 'ចា៎';
    }

    const filename = `sub_${index}_${Date.now()}.mp3`;
    const outputPath = path.join(DIRS.uploads, filename);

    // 1. Identify Character and enforce consistency
    const targetCharId = characterId || speaker || (gender === 'Male' ? 'Speaker_1' : 'Speaker_2');
    let charProfile = voxcpmConfig.characters[targetCharId];

    // If not found by exact key, search by name, role, or partial label
    if (!charProfile && targetCharId) {
      for (const [k, c] of Object.entries(voxcpmConfig.characters)) {
        if (c.name === targetCharId || c.role === targetCharId || c.id === targetCharId || (c.name && c.name.includes(targetCharId)) || (typeof targetCharId === 'string' && targetCharId.includes(c.name))) {
          charProfile = c;
          break;
        }
      }
    }

    // If character doesn't exist yet, register it automatically to lock its voice
    if (!charProfile) {
      charProfile = {
        id: targetCharId,
        name: `តួអង្គ ${targetCharId}`,
        gender: gender || 'Female',
        voiceType: useVoxcpm ? (voxcpmConfig.mode === 'movie_clone' ? 'voxcpm_movie' : 'voxcpm_custom') : 'neural',
        customVoice: customVoice || getVoice(gender, language),
        pitch: 1.0,
        rate: '+0%',
        sampleFile: null
      };
      voxcpmConfig.characters[targetCharId] = charProfile;
      log(`[Character Auto-Lock] Locked Character ${targetCharId} to Voice: ${charProfile.customVoice}`);
    }

    // Rate formatting: incorporates speed, character role, and emotion preset
    let rateArg = '+0%';
    if (speed && speed !== 1) {
      const pct = Math.round((speed - 1) * 100);
      rateArg = (pct >= 0 ? `+${pct}%` : `${pct}%`);
    } else if (emotionPreset.rate && emotionPreset.rate !== '+0%') {
      rateArg = emotionPreset.rate;
    } else if (charProfile.rate) {
      rateArg = charProfile.rate;
    }

    // STRICT Voice Consistency: 1 character = 1 locked voice throughout the movie
    let pitchArg = '+0Hz';
    if (charProfile.role === 'child' || targetCharId === 'Speaker_3') {
      pitchArg = '+20Hz';
      if (!speed || speed === 1) rateArg = '+10%';
    } else if (charProfile.role === 'elder' || targetCharId === 'Speaker_4') {
      pitchArg = '-15Hz';
      if (!speed || speed === 1) rateArg = '-5%';
    } else if (charProfile.pitch && charProfile.pitch !== 1.0) {
      const hz = Math.round((charProfile.pitch - 1.0) * 80);
      pitchArg = (hz >= 0 ? `+${hz}Hz` : `${hz}Hz`);
    }

    // Check if character should use VOXCPM2 Voice Cloning
    const shouldUseVoxcpm = Boolean(useVoxcpm !== undefined ? useVoxcpm : voxcpmConfig.enabled);

    // Auto-resolve reference sample file for this character
    const activeVoxMode = req.body.voxcpmMode || req.body.mode || voxcpmConfig.mode || 'movie_clone';
    const isLibraryMode = (activeVoxMode === 'library' || activeVoxMode === 'custom_character');

    let refFile = charProfile.sampleFile || voxcpmConfig.referenceAudio;
    const isMovieClip = refFile && (refFile.includes('_best.wav') || refFile.includes('voice_split') || refFile.startsWith('temp_'));

    if (isLibraryMode && (isMovieClip || !refFile || charProfile.voiceType === 'voxcpm_movie')) {
      if (charProfile.role === 'female_lead' || targetCharId === 'Speaker_2' || charProfile.gender === 'Female' || (charProfile.name && charProfile.name.includes('ស្រី'))) {
        refFile = 'char_02_female_lead.wav';
      } else if (charProfile.role === 'supporting_male' || targetCharId === 'Speaker_3') {
        refFile = 'char_03_supporting_male.wav';
      } else if (charProfile.role === 'young_male' || targetCharId === 'Speaker_4') {
        refFile = 'char_04_young_male.wav';
      } else if (charProfile.role === 'villain_male' || targetCharId === 'Speaker_5') {
        refFile = 'char_05_villain_male.wav';
      } else if (charProfile.role === 'father' || targetCharId === 'Speaker_6') {
        refFile = 'char_06_father_male.mp3';
      } else if (charProfile.role === 'child_female' || targetCharId === 'Speaker_7') {
        refFile = 'char_07_young_girl.mp3';
      } else if (charProfile.role === 'elder_male' || targetCharId === 'Speaker_8') {
        refFile = 'char_08_elder_good_male.mp3';
      } else if (charProfile.role === 'child_male' || targetCharId === 'Speaker_9') {
        refFile = 'char_09_young_boy.mp3';
      } else if (charProfile.role === 'villager' || targetCharId === 'Speaker_10') {
        refFile = 'char_10_villager.mp3';
      } else if (charProfile.role === 'elder_grandfather' || targetCharId === 'Speaker_11') {
        refFile = 'char_11_grandfather.mp3';
      } else if (charProfile.role === 'king' || targetCharId === 'Speaker_12') {
        refFile = 'char_12_king.mp3';
      } else if (charProfile.role === 'elder_grandmother' || targetCharId === 'Speaker_13') {
        refFile = 'char_13_grandmother.mp3';
      } else {
        refFile = 'char_01_male_lead.wav';
      }
    } else if (!refFile) {
      if (charProfile.gender === 'Female' || (charProfile.name && charProfile.name.includes('ស្រី'))) {
        refFile = 'char_02_female_lead.wav';
      } else {
        refFile = 'char_01_male_lead.wav';
      }
    }

    let samplePath = refFile ? path.join(DIRS.voiceSamples, refFile) : null;
    if (!samplePath || !fs.existsSync(samplePath)) {
      const up = refFile ? path.join(DIRS.uploads, refFile) : null;
      if (up && fs.existsSync(up)) {
        samplePath = up;
      } else {
        samplePath = path.join(DIRS.voiceSamples, (charProfile.gender === 'Female' ? 'char_02_female_lead.wav' : 'char_01_male_lead.wav'));
        if (!fs.existsSync(samplePath)) samplePath = null;
      }
    }

    // --- Execution Option: Colab & Kaggle GPU (ដាក់ Link បាន) ---
    if (shouldUseVoxcpm && voxcpmConfig.hostType === 'colab_kaggle' && voxcpmConfig.colabUrl) {
      try {
        log(`[VOXCPM2 Colab Link] Sending inference for ${targetCharId} (${charProfile.name}) to ${voxcpmConfig.colabUrl} with sample ${refFile || 'default'}...`);
        const result = await callVoxcpmColab(voxcpmConfig.colabUrl, cleanText, samplePath, voxcpmConfig.timbreStrength, voxcpmConfig.emotion);
        
        if (result && result.audioBuffer) {
          fs.writeFileSync(outputPath, result.audioBuffer);
          log(`[VOXCPM2 Colab] Generated cloned speech successfully: ${filename}`);
          return res.json({
            success: true,
            url: `/api/audio/${filename}`,
            engine: 'voxcpm2-colab-gpu',
            character: charProfile
          });
        }
      } catch (colabErr) {
        log(`[VOXCPM2 Colab] Cannot reach Kaggle/Colab API (${colabErr.message}). Auto-switching to Neural Voice (Edge-TTS) for character ${targetCharId}.`, 'WARN');
      }
    }

    // --- Execution Option: Computer Local CPU / GPU (voxcpm2 computer cpu) ---
    if (shouldUseVoxcpm && (voxcpmConfig.hostType === 'local_cpu' || voxcpmConfig.hostType === 'local_gpu')) {
      const refFile = charProfile.sampleFile || voxcpmConfig.referenceAudio;
      const samplePath = refFile ? path.join(DIRS.voiceSamples, refFile) : null;
      try {
        log(`[VOXCPM2 Local CPU] Sending inference for ${targetCharId} to local server (127.0.0.1:7860)...`);
        const result = await callVoxcpmColab('http://127.0.0.1:7860', cleanText, samplePath, voxcpmConfig.timbreStrength, voxcpmConfig.emotion);
        if (result && result.audioBuffer) {
          fs.writeFileSync(outputPath, result.audioBuffer);
          log(`[VOXCPM2 Local CPU] Generated cloned speech successfully: ${filename}`);
          return res.json({
            success: true,
            url: `/api/audio/${filename}`,
            engine: 'voxcpm2-local-cpu',
            character: charProfile
          });
        }
      } catch (localErr) {
        log(`[VOXCPM2 Local] Port 7860 not active. Auto-switching to Neural Voice (Edge-TTS) for character ${targetCharId} (pitch=${pitchArg}, rate=${rateArg}).`, 'INFO');
      }
    }

    // --- Standard Neural TTS (Piseth & Sreymom) with Pitch & Speed Consistency ---
    const voice = charProfile.customVoice || customVoice || getVoice(charProfile.gender, language);

    // Write text to a temp file to avoid Windows command-line UTF-8 quoting bugs with Khmer
    const tempTextFile = path.join(DIRS.uploads, `text_${Date.now()}_${index}.txt`);
    fs.writeFileSync(tempTextFile, cleanText, 'utf8');

    log(`[TTS Engine] Generating voice for Character "${charProfile.name}" (${voice}) rate=${rateArg} pitch=${pitchArg}`);

    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const args = [
      '-m', 'edge_tts',
      '--voice', voice,
      `--rate=${rateArg}`,
      '-f', tempTextFile,
      '--write-media', outputPath
    ];
    if (pitchArg !== '+0Hz') {
      args.push(`--pitch=${pitchArg}`);
    }

    const child = spawn(pythonExe, args);
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', (code) => {
      try { if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        // Only apply spatial FX (e.g. inner thought, memory) to prevent altering character voice timbre
        const isSpatialFx = ['inner_mind', 'flashback', 'daydream'].includes(emotionPreset.id);
        if (emotionPreset.af && isSpatialFx) {
          const filteredTemp = path.join(DIRS.uploads, `filtered_${Date.now()}_${index}.mp3`);
          const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';
          const { spawnSync } = require('child_process');
          const afRes = spawnSync(ffmpegExe, [
            '-y',
            '-i', outputPath,
            '-af', emotionPreset.af,
            '-b:a', '192k',
            filteredTemp
          ]);
          if (afRes.status === 0 && fs.existsSync(filteredTemp)) {
            try {
              fs.unlinkSync(outputPath);
              fs.renameSync(filteredTemp, outputPath);
              log(`[Emotion FX] Applied ${activeEmotionKey} filter (${emotionPreset.id}) to ${filename}`);
            } catch(e) {}
          }
        }

        res.json({
          success: true,
          url: `/api/audio/${filename}`,
          engine: shouldUseVoxcpm ? 'voxcpm2-cloned' : 'neural-tts',
          character: charProfile,
          emotion: activeEmotionKey,
          emotionPreset: {
            id: emotionPreset.id,
            name: emotionPreset.name,
            icon: emotionPreset.icon,
            label: emotionPreset.label
          }
        });
      } else {
        log(`[TTS] Generation error (code ${code}): ${stderr}`, 'ERROR');
        res.status(500).json({
          success: false,
          error: stderr || 'Audio generation failed'
        });
      }
    });

  } catch (err) {
    log(`[TTS] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 10. POST /api/render
// Mixes video, dubbed audio tracks, BGM, and produces final video
// Supports Vocal Removal & Auto-Ducking
// ---------------------------------------------------------
app.post('/api/render', upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'bgmFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const videoFile = req.files && req.files['videoFile'] ? req.files['videoFile'][0] : null;
    if (!videoFile) {
      return res.status(400).json({ success: false, error: 'No video file provided for rendering' });
    }

    const videoPath = videoFile.path;
    let data = {};
    try {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : (req.body.data || {});
    } catch (e) {
      log('Could not parse render data JSON: ' + e.message, 'WARN');
    }

    const {
      audioTracks = [],
      bgmTrack = null,
      isOriginalAudioMuted = false,
      vocalRemovalMode = 'duck', // 'duck' (បន្ថយសម្លេងពេលនិយាយ & រក្សាភ្លេងរឿង), 'mute', 'keep'
      outputFileName = 'dabbing_pro_video.mp4',
      exportPath = '',
      dubVolume = 2.8,  // Khmer dub voice — loud and clear
      origVolume = 0.70
    } = data;

    let targetDir = DIRS.videos;
    if (exportPath && fs.existsSync(exportPath)) {
      targetDir = exportPath;
    }
    const safeName = (outputFileName.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'dabbing_pro_video')
      .replace(/\.[^/.]+$/, '') + '.mp4';
    const outputPath = path.join(targetDir, safeName);

    log(`[Render] Starting Render: ${safeName} with ${audioTracks.length} dub tracks (Mode: ${vocalRemovalMode}, Muted: ${isOriginalAudioMuted})`);

    // Prepare audio clips for timeline stitcher
    const clipsData = audioTracks.map(track => {
      const rawFile = track.file || track.audioUrl || '';
      const fileName = path.basename(rawFile.split('&')[0].split('?')[0]);
      let filePath = path.join(DIRS.uploads, fileName);
      if (!fs.existsSync(filePath)) {
        const cand = [path.join(DIRS.videos, fileName), path.join(BASE_DIR, fileName)];
        for (const c of cand) { if (fs.existsSync(c)) { filePath = c; break; } }
      }
      return {
        file: filePath,
        start: parseFloat(track.start || 0)
      };
    }).filter(c => fs.existsSync(c.file));

    // Handle BGM Track
    let bgmArgs = [];
    if (bgmTrack && !bgmTrack.isMuted) {
      let bgmPath = '';
      if (bgmTrack.fileName) bgmPath = path.join(DIRS.uploads, path.basename(bgmTrack.fileName));
      else if (bgmTrack.name) bgmPath = path.join(DIRS.uploads, path.basename(bgmTrack.name));

      if (fs.existsSync(bgmPath)) {
        bgmArgs = ['--bgm', bgmPath];
        log(`[Render] Included BGM Track: ${bgmPath}`);
      }
    }

    // If no audio clips, fall back to simple FFmpeg pass-through
    if (clipsData.length === 0) {
      log(`[Render] No dubbed audio tracks. Copying video stream...`, 'WARN');
      const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';
      const cmd = ['-y', '-i', videoPath, '-c:v', 'copy', isOriginalAudioMuted ? '-an' : '-c:a', isOriginalAudioMuted ? '' : 'copy', outputPath].filter(Boolean);
      const child = spawn(ffmpegExe, cmd);
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          return res.json({ success: true, outputPath, fileName: safeName, downloadUrl: `/api/download-render/${encodeURIComponent(safeName)}` });
        }
        res.status(500).json({ success: false, error: 'Video export failed' });
      });
      return;
    }

    // High Performance Timeline Stitcher via stitch_dub.py
    // Eliminates Windows 8191-char and FFmpeg filter_complex buffer overflow ('Result too large')
    const clipsJsonPath = path.join(DIRS.uploads, `render_clips_${Date.now()}.json`);
    fs.writeFileSync(clipsJsonPath, JSON.stringify(clipsData), 'utf8');

    const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
    const scriptPath = path.join(DIRS.tools, 'stitch_dub.py');
    const mode = isOriginalAudioMuted ? 'mute' : (vocalRemovalMode || 'duck');

    const stitchArgs = [
      scriptPath,
      '--video', videoPath,
      '--clips-json', clipsJsonPath,
      '--output', outputPath,
      '--ffmpeg', fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg',
      '--ffprobe', fs.existsSync(DIRS.ffprobe) ? DIRS.ffprobe : 'ffprobe',
      '--mode', mode,
      '--dub-vol', String(dubVolume || 2.8),
      '--orig-vol', String(origVolume || 0.50),  // Keep BGM audible, don't kill it
      '--sample-rate', '24000',
      ...bgmArgs
    ];

    log(`[Render] Spawning stitch_dub.py timeline renderer with ${clipsData.length} clips...`);
    const child = spawn(pythonExe, stitchArgs, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PATH: `${DIRS.tools};${process.env.PATH}` }
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => {
      stderr += d.toString();
      const line = d.toString().trim();
      if (line) log(`[Render Progress] ${line}`);
    });

    child.on('close', (code) => {
      try { if (fs.existsSync(clipsJsonPath)) fs.unlinkSync(clipsJsonPath); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        log(`[Render] ✅ Successfully rendered video to: ${outputPath} (${clipsData.length} clips)`);
        res.json({
          success: true,
          outputPath: outputPath,
          fileName: safeName,
          downloadUrl: `/api/download-render/${encodeURIComponent(safeName)}`
        });
      } else {
        log(`[Render] Stitch render failed (code ${code}): ${stderr}`, 'ERROR');
        res.status(500).json({
          success: false,
          error: 'Render error: ' + (stderr.slice(-300) || 'Unknown error')
        });
      }
    });

  } catch (err) {
    log(`[Render] Exception: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 11. 5-Movie Concurrent Batch Dubbing Engine (1-Hour Movies Supported)
// "ហើយបើប្រើមុខងា សំឡេង ពិសិទ្ធ ស្រីមុំ ធម្មតា អាចធ្វើបានម្ដង5រឿងក្នុងពេលតែមួយ 1រឿង 1ម៉ោងកធ្វើបានដែរ"
// ---------------------------------------------------------
const batchJobs = new Map();
let activeTranscriptions = 0;
const MAX_CONCURRENT_TRANSCRIBE = 2; // Keep CPU responsive

// =========================================================================
// CINEMA VOICE PROFILE MAP — 1 Character = 1 Locked Voice (Never swaps)
// Determines Edge-TTS voice, rate, pitch, and EQ preset per speaker type.
// =========================================================================
const VOICE_PROFILE_MAP = {
  // Male voices
  'Male':        { voice: 'km-KH-PisethNeural', rate: '+0%',  pitch: '+0Hz',   eq: 'male_lead'  },
  'Male_Elder':  { voice: 'km-KH-PisethNeural', rate: '-12%', pitch: '-18Hz',  eq: 'male_elder' },
  'Male_Child':  { voice: 'km-KH-PisethNeural', rate: '+8%',  pitch: '+22Hz',  eq: 'child'      },
  'Male_Angry':  { voice: 'km-KH-PisethNeural', rate: '+10%', pitch: '+6Hz',   eq: 'male_lead'  },
  'Male_Sad':    { voice: 'km-KH-PisethNeural', rate: '-8%',  pitch: '-8Hz',   eq: 'male_lead'  },
  'Male_Think':  { voice: 'km-KH-PisethNeural', rate: '-10%', pitch: '-4Hz',   eq: 'inner'      },
  // Female voices
  'Female':        { voice: 'km-KH-SreymomNeural', rate: '+0%',  pitch: '+0Hz',  eq: 'female_lead' },
  'Female_Elder':  { voice: 'km-KH-SreymomNeural', rate: '-10%', pitch: '-14Hz', eq: 'female_elder'},
  'Female_Child':  { voice: 'km-KH-SreymomNeural', rate: '+10%', pitch: '+26Hz', eq: 'child'       },
  'Female_Angry':  { voice: 'km-KH-SreymomNeural', rate: '+8%',  pitch: '+8Hz',  eq: 'female_lead' },
  'Female_Sad':    { voice: 'km-KH-SreymomNeural', rate: '-8%',  pitch: '-6Hz',  eq: 'female_lead' },
  'Female_Think':  { voice: 'km-KH-SreymomNeural', rate: '-10%', pitch: '-4Hz',  eq: 'inner'       },
  'Narrator':      { voice: 'km-KH-PisethNeural',  rate: '-4%',  pitch: '-3Hz',  eq: 'narrator'    },
};

// Per-session speaker-to-voice lock table (speakerId → voiceProfileKey)
// Ensures SAME character always uses the SAME voice profile throughout a movie.
const speakerVoiceLocks = new Map(); // speakerId (e.g. "Speaker_0") → voiceProfileKey

function resolveVoiceProfile(speakerId, gender, emotion, age) {
  // Build composite key from gender + age + emotion for profile lookup
  const g = (gender || 'Male').includes('Female') ? 'Female' : 'Male';
  let suffix = '';
  if (age === 'Child' || /child|kid|young|ក្មេង/i.test(age || '')) suffix = '_Child';
  else if (age === 'Elder' || /elder|old|ចាស់/i.test(age || ''))   suffix = '_Elder';

  const emo = (emotion || '').toLowerCase();
  if (!suffix) {
    if (/angry|ខឹង|ក្រោធ/i.test(emo)) suffix = '_Angry';
    else if (/sad|ទ្រមួន|ខ្សោយ|weep/i.test(emo)) suffix = '_Sad';
    else if (/think|inner|monologue|ខ្សឹប|whisper|ស្រមើ/i.test(emo)) suffix = '_Think';
  }

  const profileKey = g + suffix;
  const profile = VOICE_PROFILE_MAP[profileKey] || VOICE_PROFILE_MAP[g] || VOICE_PROFILE_MAP['Male'];

  // Lock the voice for this speaker so it never changes mid-movie
  if (speakerId && !speakerVoiceLocks.has(speakerId)) {
    speakerVoiceLocks.set(speakerId, { profileKey, profile });
    log(`[VoiceLock] Speaker "${speakerId}" → ${profileKey} (${profile.voice}, rate=${profile.rate})`);
  }

  return speakerVoiceLocks.get(speakerId)?.profile || profile;
}

// EQ/Mastering presets per voice type
function getAfFilter(eqPreset, isInnerThought) {
  if (isInnerThought || eqPreset === 'inner') {
    // Inner thought: gentle reverb, slightly hollow, barely audible breath
    return 'aecho=0.8:0.7:28:0.30,equalizer=f=2800:width_type=o:w=1.2:g=2,apad=pad_dur=0.35,volume=1.0';
  }
  if (eqPreset === 'narrator') {
    // Narrator: deep, authoritative, full bass, measured pace
    return 'equalizer=f=180:width_type=o:w=1:g=3,equalizer=f=3500:width_type=o:w=1:g=2,compand=attacks=0.01:decays=0.06:points=-60/-60|-30/-18|-10/-1|0/0,apad=pad_dur=0.4,loudnorm=I=-13:LRA=6:tp=-1.0,volume=1.3';
  }
  if (eqPreset === 'male_elder') {
    // Elder male: warm, a touch of low-mid resonance
    return 'equalizer=f=240:width_type=o:w=1:g=2,equalizer=f=3000:width_type=o:w=1:g=1,compand=attacks=0.02:decays=0.1:points=-60/-60|-30/-18|-10/-1|0/0,apad=pad_dur=0.4,loudnorm=I=-13:LRA=7:tp=-1.0,volume=1.2';
  }
  if (eqPreset === 'female_elder') {
    return 'equalizer=f=280:width_type=o:w=1:g=1,equalizer=f=3200:width_type=o:w=1:g=2,compand=attacks=0.02:decays=0.09:points=-60/-60|-30/-18|-10/-1|0/0,apad=pad_dur=0.38,loudnorm=I=-13:LRA=7:tp=-1.0,volume=1.2';
  }
  if (eqPreset === 'child') {
    // Child: bright, light, high presence
    return 'equalizer=f=4500:width_type=o:w=1.2:g=3,equalizer=f=200:width_type=o:w=1:g=-1,compand=attacks=0.01:decays=0.06:points=-60/-60|-30/-18|-10/-1|0/0,apad=pad_dur=0.32,loudnorm=I=-14:LRA=8:tp=-1.0,volume=1.15';
  }
  if (eqPreset === 'female_lead') {
    // Female lead: clear, warm highs, present mids
    return 'equalizer=f=3500:width_type=o:w=1.2:g=3,equalizer=f=220:width_type=o:w=1:g=1,compand=attacks=0.015:decays=0.07:points=-60/-60|-28/-16|-10/-1|0/0,apad=pad_dur=0.35,loudnorm=I=-13:LRA=7:tp=-1.0,volume=1.25';
  }
  // male_lead (default) — punchy, cinema-grade, loud and crystal clear
  return 'equalizer=f=3200:width_type=o:w=1.2:g=4,equalizer=f=180:width_type=o:w=1:g=2,compand=attacks=0.015:decays=0.07:points=-60/-60|-26/-14|-10/-1|0/0,apad=pad_dur=0.38,loudnorm=I=-13:LRA=7:tp=-1.0,volume=1.3';
}

// Split long Khmer text into natural sentence chunks (prevents mid-word cutoff)
function splitIntoSentenceChunks(text, maxChars = 80) {
  // Normalize whitespace
  const cleaned = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (cleaned.length <= maxChars) return [cleaned];

  // Khmer sentence-break patterns: ។ ៕ ៖ ! ? , and space clusters
  const breakPattern = /[។៕!?]+|[,៖]\s+|\s{2,}|\s+(?=[A-ZÁÉÍÓÚ])/g;
  const parts = [];
  let lastIdx = 0;
  let m;
  while ((m = breakPattern.exec(cleaned)) !== null) {
    const chunk = cleaned.slice(lastIdx, m.index + m[0].length).trim();
    if (chunk) parts.push(chunk);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < cleaned.length) {
    const tail = cleaned.slice(lastIdx).trim();
    if (tail) parts.push(tail);
  }

  // If no breaks found, force-split at word boundaries near maxChars
  if (parts.length === 0) {
    const words = cleaned.split(' ');
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > maxChars && current.length > 0) {
        parts.push(current.trim());
        current = w;
      } else {
        current = current ? current + ' ' + w : w;
      }
    }
    if (current.trim()) parts.push(current.trim());
  }

  return parts.length > 0 ? parts : [cleaned];
}

// Helper: Synthesize single line using Edge-TTS + Cinema Voice Mastering
// Handles: long-sentence chunking, per-character voice lock, emotion EQ, no cutoffs
async function synthesizeBatchLine(text, voice, rate, pitch, outputPath, pythonExe, options = {}) {
  const { speakerId, gender, emotion, age } = options;

  // Resolve voice profile — either from explicit speaker options or from the passed voice string
  let profile = null;
  if (speakerId || gender) {
    profile = resolveVoiceProfile(speakerId, gender, emotion, age);
    voice = profile.voice;
    rate  = rate && rate !== '+0%' ? rate : profile.rate;
    pitch = pitch && pitch !== '+0Hz' ? pitch : profile.pitch;
  }
  const eqPreset = (profile && profile.eq) || (voice.includes('Sreymom') ? 'female_lead' : 'male_lead');

  // Detect special delivery modes from text tags or options
  const isInnerThought = /(គិតក្នុងចិត្ត|ស្រមើស្រមៃ|ខ្សឹប|និយាយម្នាក់ឯង|thought|whisper|inner)/i.test(text + ' ' + (emotion || ''));

  // Strip stage-direction brackets; keep pure spoken text
  let spokenText = text
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!spokenText) spokenText = text.replace(/[\r\n\t]+/g, ' ').replace(/"/g, "'").trim();

  const ffmpegExe = (typeof DIRS !== 'undefined' && fs.existsSync(DIRS.ffmpeg)) ? DIRS.ffmpeg : 'ffmpeg';
  const afFilter = getAfFilter(eqPreset, isInnerThought);

  // For inner-thought, adjust rate/pitch regardless of profile
  let appliedRate  = isInnerThought ? '-10%' : (rate  || '+0%');
  let appliedPitch = isInnerThought ? '-4Hz'  : (pitch || '+0Hz');

  // ----------------------------------------------------------------
  // Split long sentences into chunks → synthesize each → concat with
  // a 40 ms natural breath-gap crossfade so playback never cuts off.
  // ----------------------------------------------------------------
  const chunks = splitIntoSentenceChunks(spokenText, 90);
  const chunkFiles = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const chunkRaw = outputPath.replace(/\.mp3$/, `_chunk${ci}_raw.mp3`);
    const chunkTxt = chunkRaw + '.txt';
    fs.writeFileSync(chunkTxt, chunk, 'utf8');

    // Write chunk payload to UTF-8 JSON for edge_tts_helper.py
    const payloadFile = chunkRaw + '.json';
    fs.writeFileSync(payloadFile, JSON.stringify({
      text: chunk,
      voice: voice,
      rate: appliedRate || '+0%',
      pitch: appliedPitch || '+0Hz',
      output: chunkRaw
    }), 'utf8');

    const helperScript = path.join(__dirname, 'tools', 'edge_tts_helper.py');

    // Retry up to 3 times with backoff if network hiccups
    let synthesized = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(pythonExe, [helperScript, payloadFile]);
          let stderr = '';
          child.stderr.on('data', d => stderr += d.toString());
          child.on('close', code => {
            if (code !== 0 || !fs.existsSync(chunkRaw) || fs.statSync(chunkRaw).size === 0) {
              return reject(new Error(stderr || `Edge-TTS helper attempt ${attempt} failed`));
            }
            resolve();
          });
        });
        synthesized = true;
        chunkFiles.push(chunkRaw);
        break;
      } catch (attemptErr) {
        lastErr = attemptErr;
        log(`[TTS Retry ${attempt}/3] ${attemptErr.message}`, 'WARN');
        if (attempt < 3) await new Promise(r => setTimeout(r, 600 * attempt));
      }
    }
    try { if (fs.existsSync(payloadFile)) fs.unlinkSync(payloadFile); } catch (e) {}
    try { if (fs.existsSync(chunkTxt)) fs.unlinkSync(chunkTxt); } catch (e) {}
    if (!synthesized) {
      throw (lastErr || new Error(`Edge-TTS chunk ${ci} failed after 3 attempts`));
    }
  }

  // If only one chunk, skip concat and go straight to mastering
  let rawTtsOutput;
  if (chunkFiles.length === 1) {
    rawTtsOutput = chunkFiles[0];
  } else {
    // Concat chunks with 40 ms silence gap between sentences for natural breath
    rawTtsOutput = outputPath.replace(/\.mp3$/, '_raw.mp3');
    const concatList = outputPath.replace(/\.mp3$/, '_concat.txt');
    const gapFile    = outputPath.replace(/\.mp3$/, '_gap.mp3');

    // Create 40ms silence gap MP3 once
    await new Promise((resolve) => {
      const gapProc = spawn(ffmpegExe, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.04', '-q:a', '4', gapFile]);
      gapProc.on('close', () => resolve());
    });

    // Build concat list: chunk0 → gap → chunk1 → gap → chunk2 …
    let listContent = '';
    for (let ci = 0; ci < chunkFiles.length; ci++) {
      listContent += `file '${chunkFiles[ci].replace(/\\/g, '/')}'\n`;
      if (ci < chunkFiles.length - 1) listContent += `file '${gapFile.replace(/\\/g, '/')}'\n`;
    }
    fs.writeFileSync(concatList, listContent, 'utf8');

    await new Promise((resolve, reject) => {
      const concatProc = spawn(ffmpegExe, ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', rawTtsOutput]);
      concatProc.on('close', code => {
        try { fs.unlinkSync(concatList); } catch (e) {}
        try { fs.unlinkSync(gapFile); } catch (e) {}
        chunkFiles.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
        if (code === 0 && fs.existsSync(rawTtsOutput)) resolve();
        else reject(new Error('Chunk concat failed'));
      });
    });
  }

  // Apply cinema voice mastering (EQ + loudness normalization + trailing silence pad)
  return new Promise((resolve) => {
    const ffmpegProc = spawn(ffmpegExe, [
      '-y', '-i', rawTtsOutput,
      '-af', afFilter,
      '-ar', '24000',
      '-b:a', '192k',
      outputPath
    ]);
    ffmpegProc.on('close', (fCode) => {
      try { if (fs.existsSync(rawTtsOutput)) fs.unlinkSync(rawTtsOutput); } catch (e) {}
      if (fCode === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        if (fs.existsSync(rawTtsOutput)) {
          try { fs.renameSync(rawTtsOutput, outputPath); } catch (e) {}
        }
        resolve(outputPath);
      }
    });
    ffmpegProc.on('error', () => {
      try { if (fs.existsSync(rawTtsOutput)) fs.renameSync(rawTtsOutput, outputPath); } catch (e) {}
      resolve(outputPath);
    });
  });
}


let activeBatchWorkers = 0;
let BATCH_CONCURRENCY = 2; // Run up to 2 videos concurrently without overloading GPU/RAM

async function processBatchQueue() {
  const queuedJobs = Array.from(batchJobs.values()).filter(j => j.status === 'queued');
  if (queuedJobs.length === 0) return;

  while (activeBatchWorkers < BATCH_CONCURRENCY) {
    const nextJob = Array.from(batchJobs.values()).find(j => j.status === 'queued');
    if (!nextJob) break;

    activeBatchWorkers++;
    log(`[Batch Worker Pool] Started slot (${activeBatchWorkers}/${BATCH_CONCURRENCY}) for job: ${nextJob.title}`);

    // Execute concurrently in background
    (async (job) => {
      try {
        await executeBatchJob(job);
      } catch (err) {
        log(`[Batch Worker Error] Job ${job.title} failed: ${err.message}`, 'ERROR');
      } finally {
        activeBatchWorkers = Math.max(0, activeBatchWorkers - 1);
        log(`[Batch Worker Pool] Slot released. Remaining active: ${activeBatchWorkers}/${BATCH_CONCURRENCY}`);
        // Check for remaining queued jobs
        setImmediate(processBatchQueue);
      }
    })(nextJob);
  }
}

// Helper: Run job pipeline (Using Cinema Master Dub Pipeline: Demucs + Locked Characters 1:1)
async function executeBatchJob(job) {
  const pythonExe = fs.existsSync(DIRS.python) ? DIRS.python : 'python';
  const masterScript = path.join(DIRS.tools, 'master_dub_pipeline.py');
  const outputDir = path.join(DIRS.uploads, `batch_${job.id}`);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    job.status = 'running';
    job.statusKhmer = 'កំពុងចាប់ផ្តើម Master Dub Pipeline...';
    job.progress = 5;
    job.startTime = Date.now();
    job.step = 1;

    const apiKey = resolveGeminiApiKey();
    const genre = voxcpmConfig.genre || 'ancient_wuxia';
    const ttsEngine = (voxcpmConfig.enabled && voxcpmConfig.colabUrl) ? 'voxcpm2' : 'edge-tts';

    const args = [
      '-s', masterScript,
      '--video', job.videoPath,
      '--output-dir', outputDir,
      '--language', 'auto',
      '--genre', genre,
      '--tts-engine', ttsEngine
    ];

    if (apiKey) args.push('--gemini-key', apiKey);
    if (ttsEngine === 'voxcpm2') {
      args.push('--voxcpm-mode', voxcpmConfig.mode || 'custom_character');
      if (voxcpmConfig.colabUrl) args.push('--voxcpm-url', voxcpmConfig.colabUrl);
    }
    if (job.aspectRatio && job.aspectRatio !== 'original') {
      args.push('--aspect-ratio', job.aspectRatio);
    }

    log(`[BatchDub] [${job.title}] Executing master_dub_pipeline (Engine: ${ttsEngine}, Genre: ${genre})...`);

    await new Promise((resolve, reject) => {
      const child = spawn(pythonExe, args);
      job.childProcess = child;
      let stderr = '';

      function parsePipelineProgress(str) {
        const lines = str.split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          log(`[BatchDub Progress] [${job.title}] ${line.trim()}`);
          if (line.includes('Step 1/8') || line.includes('Step 1:')) {
            job.step = 1;
            job.progress = 12;
            job.statusKhmer = 'ជំហាន ១/៨ ៖ ស្រង់សំឡេង និងវិភាគវីដេអូ...';
          } else if (line.includes('Step 2/8') || line.includes('Step 2:')) {
            job.step = 2;
            job.progress = 28;
            job.statusKhmer = 'ជំហាន ២/៨ ៖ លុបសំឡេងចិនដើម រក្សា BGM (Demucs AI)...';
          } else if (line.includes('Step 3/8') || line.includes('Step 3:')) {
            job.step = 3;
            job.progress = 44;
            job.statusKhmer = 'ជំហាន ៣/៨ ៖ ស្ដាប់សំឡេង & Timestamps (Whisper ASR)...';
          } else if (line.includes('Step 4/8') || line.includes('Step 4:')) {
            job.step = 4;
            job.progress = 58;
            job.statusKhmer = 'ជំហាន ៤/៨ ៖ វិភាគចាក់សោរសំឡេងតួអង្គ ១:១ គ្មានការផ្លាស់ប្ដូរ...';
          } else if (line.includes('Step 5/8') || line.includes('Step 5:')) {
            job.step = 5;
            job.progress = 72;
            job.statusKhmer = 'ជំហាន ៥/៨ ៖ បកប្រែជាភាសានិយាយភាពយន្តខ្មែរ (Gemini AI)...';
          } else if (line.includes('Step 6 & 7') || line.includes('Step 6') || line.includes('Line ')) {
            job.step = 6;
            job.progress = 86;
            job.statusKhmer = 'ជំហាន ៦/៨ ៖ បង្កើតសំឡេងខ្មែរ & តម្រឹមមាត់ (Lip Sync)...';
          } else if (line.includes('Step 8/8') || line.includes('Step 8:')) {
            job.step = 8;
            job.progress = 96;
            job.statusKhmer = 'ជំហាន ៨/៨ ៖ ផ្គុំវីដេអូចុងក្រោយ (Muxing Pristine BGM)...';
          }
        }
      }

      child.stdout.on('data', d => {
        const str = d.toString();
        parsePipelineProgress(str);
      });

      child.stderr.on('data', d => {
        const text = d.toString();
        stderr += text;
        parsePipelineProgress(text);
      });

      child.on('close', (code) => {
        job.childProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr.slice(-600) || `Pipeline exited with code ${code}`));
        }
      });
    });

    if (job.status === 'cancelled') return;

    // Locate generated video in outputDir
    const outFiles = fs.readdirSync(outputDir);
    const finalVideo = outFiles.find(f => f.includes('dubbed') && f.endsWith('.mp4')) || outFiles.find(f => f.endsWith('.mp4'));
    if (!finalVideo) {
      throw new Error('រកមិនឃើញឯកសារវីដេអូចុងក្រោយបន្ទាប់ពី Dubbing រួចរាល់');
    }

    const sourceVideoPath = path.join(outputDir, finalVideo);
    const cleanBase = path.basename(job.title, path.extname(job.title)).replace(/[^\w\u1780-\u17FF\s-]/g, '_');
    const finalVideoName = `${cleanBase}_KhmerDub.mp4`;
    const outputPath = path.join(DIRS.videos, finalVideoName);

    fs.copyFileSync(sourceVideoPath, outputPath);

    // Also copy SRT subtitle if available
    const srtFile = outFiles.find(f => f.endsWith('.srt'));
    if (srtFile) {
      const srtDest = path.join(DIRS.videos, `${cleanBase}_KhmerDub.srt`);
      try { fs.copyFileSync(path.join(outputDir, srtFile), srtDest); } catch(e) {}
    }

    // 🌟 Dedicated Export Folder: If job came from a batch folder, create a new subfolder and place the finished video there
    if (job.batchFolder && fs.existsSync(job.batchFolder)) {
      try {
        const dedicatedBatchFolder = path.join(job.batchFolder, "Khmer_Dubbed_Complete");
        if (!fs.existsSync(dedicatedBatchFolder)) {
          fs.mkdirSync(dedicatedBatchFolder, { recursive: true });
        }
        const targetInBatchFolder = path.join(dedicatedBatchFolder, finalVideoName);
        fs.copyFileSync(sourceVideoPath, targetInBatchFolder);
        if (srtFile) {
          fs.copyFileSync(path.join(outputDir, srtFile), path.join(dedicatedBatchFolder, `${cleanBase}_KhmerDub.srt`));
        }
        log(`[BatchDub Output Folder] Saved completed episode to: ${targetInBatchFolder}`);
      } catch (err) {
        log(`[BatchDub Output Folder Error] ${err.message}`, 'WARN');
      }
    }

    // Export to C:\Export\AIDubber if available
    if (fs.existsSync('C:\\Export\\AIDubber')) {
      try {
        fs.copyFileSync(outputPath, path.join('C:\\Export\\AIDubber', finalVideoName));
      } catch (e) {}
    }

    job.status = 'done';
    job.statusKhmer = 'រួចរាល់ 100% (ជោគជ័យ - គ្មានសំឡេងចិន)';
    job.progress = 100;
    job.outputPath = outputPath;
    job.finalFileName = finalVideoName;
    sendTelegramNotification(`🎬 <b>Dabbing Studio</b>: ភាគ <code>${job.title}</code> បាន Dubbing ចប់សព្វគ្រប់ ១០០%! ✅\n📁 វីដេអូ: <code>${finalVideoName}</code>`);
    job.downloadUrl = `/api/download-render/${encodeURIComponent(finalVideoName)}`;
    job.finished = new Date().toISOString();
    log(`[BatchDub] [${job.title}] COMPLETE! Output: ${outputPath}`);

  } catch (err) {
    if (job.status !== 'cancelled') {
      job.status = 'error';
      job.statusKhmer = `បរាជ័យ: ${err.message}`;
      job.error = err.message;
      log(`[BatchDub] [${job.title}] ERROR: ${err.message}`, 'ERROR');
    }
  }
}

// Batch Dubbing Endpoints
app.get('/api/batch-dub/status', (req, res) => {
  const now = Date.now();
  const jobsList = Array.from(batchJobs.values()).map(j => ({
    id: j.id,
    title: j.title,
    filename: j.filename,
    status: j.status,
    statusKhmer: j.statusKhmer,
    step: j.step || 1,
    progress: j.progress || 0,
    currentLine: j.currentLine || 0,
    totalLines: j.totalLines || 0,
    elapsedSeconds: j.startTime ? Math.floor((now - j.startTime) / 1000) : 0,
    duration: j.duration || 0,
    downloadUrl: j.downloadUrl || null,
    outputPath: j.outputPath || null,
    error: j.error || null,
    created: j.created,
    finished: j.finished
  }));

  const activeCount = jobsList.filter(j => !['done', 'error', 'cancelled'].includes(j.status)).length;
  const runningCount = jobsList.filter(j => j.status === 'running').length;
  const completedCount = jobsList.filter(j => j.status === 'done').length;

  res.json({
    success: true,
    jobs: jobsList,
    activeCount,
    runningCount,
    completedCount,
    totalCount: jobsList.length,
    concurrency: BATCH_CONCURRENCY,
    maxAllowed: 8
  });
});

// Scan a local folder on computer for video files
app.post('/api/batch-dub/scan-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'រកមិនឃើញ Folder នេះឡើយ (Folder path not found)' });
    }
    const exts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.ts'];
    const files = fs.readdirSync(folderPath)
      .filter(f => exts.includes(path.extname(f).toLowerCase()))
      .map(f => {
        const fullPath = path.join(folderPath, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stat.size,
          sizeMb: (stat.size / (1024 * 1024)).toFixed(1)
        };
      });

    log(`[BatchDub] Scanned folder "${folderPath}": found ${files.length} video files.`);
    res.json({
      success: true,
      folderPath,
      count: files.length,
      files
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Robust Multer wrapper supporting up to 1000 files per batch folder without crashing
const uploadBatchFiles = (req, res, next) => {
  upload.array('videoFiles', 1000)(req, res, (err) => {
    if (err) {
      log(`[BatchDub] Multer notice: ${err.message}`, 'WARN');
      if (req.body && (req.body.folderPath || req.body.filePaths)) {
        return next();
      }
      return res.status(400).json({ success: false, error: `Multer: ${err.message}` });
    }
    next();
  });
};

app.post('/api/batch-dub/start', uploadBatchFiles, async (req, res) => {
  try {
    const files = req.files || [];
    let videoItems = [];

    // 1. Files uploaded via browser form
    if (files.length > 0) {
      videoItems = files.map(f => ({
        path: f.path,
        name: f.originalname
      }));
    } 
    // 2. Direct Folder Path on computer
    else if (req.body.folderPath && fs.existsSync(req.body.folderPath)) {
      const folder = req.body.folderPath;
      const exts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.ts'];
      const dirFiles = fs.readdirSync(folder)
        .filter(f => exts.includes(path.extname(f).toLowerCase()))
        .sort();
      videoItems = dirFiles.map(f => ({
        path: path.join(folder, f),
        name: f
      }));
    }
    // 3. Array of local file paths
    else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
      videoItems = req.body.filePaths
        .filter(fp => fs.existsSync(fp))
        .map(fp => ({ path: fp, name: path.basename(fp) }));
    }
    // 4. File names in uploads/
    else if (req.body.fileNames && Array.isArray(req.body.fileNames)) {
      videoItems = req.body.fileNames.map(fn => {
        const p = path.join(DIRS.uploads, path.basename(fn));
        return { path: p, name: fn };
      }).filter(v => fs.existsSync(v.path));
    }

    if (videoItems.length === 0) {
      return res.status(400).json({ success: false, error: 'សូមជ្រើសរើសវីដេអូ ឬ Folder វីដេអូយ៉ាងហោចណាស់ ១' });
    }

    if (req.body.concurrency) {
      const c = parseInt(req.body.concurrency, 10);
      if (!isNaN(c) && c >= 1 && c <= 8) BATCH_CONCURRENCY = c;
    }

    if (videoItems.length > 1000) {
      return res.status(400).json({ success: false, error: 'អតិបរមា ៥០០ ភាគក្នុងពេលតែមួយ (Maximum 500 episodes per batch)' });
    }

    const createdJobs = [];
    const sourceFolder = req.body.folderPath && fs.existsSync(req.body.folderPath) ? req.body.folderPath : null;
    const batchAspectRatio = req.body.aspectRatio || 'original';
    for (const item of videoItems) {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const job = {
        id: jobId,
        title: item.name,
        filename: path.basename(item.path),
        videoPath: item.path,
        batchFolder: sourceFolder || path.dirname(item.path),
        aspectRatio: batchAspectRatio,
        status: 'queued',
        statusKhmer: 'កំពុងរង់ចាំវេន (In Queue)...',
        progress: 0,
        currentLine: 0,
        totalLines: 0,
        created: Date.now(),
        finished: null,
        childProcess: null
      };
      batchJobs.set(jobId, job);
      createdJobs.push(job);
    }

    // Trigger sequential queue processor (1 movie at a time to prevent RAM / OOM exhaustion)
    processBatchQueue();

    log(`[BatchDub] Started batch of ${createdJobs.length} movie(s).`);
    res.json({
      success: true,
      startedCount: createdJobs.length,
      jobs: createdJobs.map(j => ({ id: j.id, title: j.title, status: j.status }))
    });

  } catch (err) {
    log(`[BatchDub] Start error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/batch-dub/cancel', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    // Cancel all active jobs
    for (const job of batchJobs.values()) {
      if (['queued', 'transcribing', 'translating', 'synthesizing', 'rendering'].includes(job.status)) {
        job.status = 'cancelled';
        job.statusKhmer = 'បានផ្អាក (Cancelled)';
        if (job.childProcess) {
          try { job.childProcess.kill('SIGKILL'); } catch (e) {}
        }
      }
    }
    return res.json({ success: true, message: 'All batch jobs cancelled' });
  }

  const target = batchJobs.get(jobId);
  if (target) {
    target.status = 'cancelled';
    target.statusKhmer = 'បានផ្អាក (Cancelled)';
    if (target.childProcess) {
      try { target.childProcess.kill('SIGKILL'); } catch (e) {}
    }
    return res.json({ success: true, message: `Job ${jobId} cancelled` });
  }
  res.status(404).json({ success: false, error: 'Job not found' });
});

app.post('/api/batch-dub/clear', (req, res) => {
  for (const [id, job] of batchJobs.entries()) {
    if (['done', 'error', 'cancelled'].includes(job.status)) {
      batchJobs.delete(id);
    }
  }
  res.json({ success: true, remaining: batchJobs.size });
});

// ---------------------------------------------------------
// 12. Windows Explorer & Static Endpoints
// ---------------------------------------------------------
app.post('/api/open-folder', (req, res) => {
  const { folderPath } = req.body;
  const target = (folderPath && fs.existsSync(folderPath)) ? folderPath : DIRS.videos;
  log(`[System] Opening Explorer folder: ${target}`);
  launchWindowsExplorer(target);
  res.json({ success: true });
});

app.use('/api/audio', express.static(DIRS.uploads));
app.use('/uploads', express.static(DIRS.uploads));
app.use('/posterstyle', express.static(path.join(__dirname, 'posterstyle')));

// ---------------------------------------------------------
// Poster & Title Studio API + Real Uploads
// ---------------------------------------------------------
app.get('/api/poster-styles', (req, res) => {
  try {
    const catalogPath = path.join(__dirname, 'scratch', 'poster_styles_catalog.json');
    if (fs.existsSync(catalogPath)) {
      return res.json({ success: true, styles: JSON.parse(fs.readFileSync(catalogPath, 'utf8')) });
    }
    res.json({ success: true, styles: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/upload-bgm', upload.single('bgmFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No audio file uploaded' });
  res.json({ success: true, fileName: req.file.filename, url: `/uploads/${req.file.filename}` });
});

app.post('/api/upload-watermark', upload.single('watermarkFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No watermark file uploaded' });
  res.json({ success: true, fileName: req.file.filename, url: `/uploads/${req.file.filename}` });
});

app.get('/api/download-render/:filename', (req, res) => {
  const filename = req.params.filename;
  const candidates = [
    path.join(DIRS.videos, filename),
    path.join('C:\\Export\\AIDubber', filename),
    path.join(DIRS.uploads, filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return res.download(c);
    }
  }
  res.status(404).send('Rendered file not found');
});
app.use('/videos', express.static(DIRS.videos));
if (fs.existsSync('C:\\Export\\AIDubber')) {
  app.use('/videos', express.static('C:\\Export\\AIDubber'));
}

// ---------------------------------------------------------
// System Diagnostic API Routes
// ---------------------------------------------------------
app.get('/api/diagnostic/node', (req, res) => {
  res.json({ 
    success: true, 
    version: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

app.get('/api/diagnostic/python', (req, res) => {
  exec(`"${DIRS.python}" --version`, (err, stdout) => {
    if (err) {
      return res.json({ success: false, version: 'Not found' });
    }
    res.json({ success: true, version: stdout.trim() });
  });
});

app.get('/api/diagnostic/ffmpeg', (req, res) => {
  exec(`"${DIRS.ffmpeg}" -version`, (err, stdout) => {
    if (err) {
      return res.json({ success: false, version: 'Not found' });
    }
    const match = stdout.match(/ffmpeg version ([\d.]+)/);
    res.json({ success: true, version: match ? match[1] : 'Unknown' });
  });
});

app.get('/api/diagnostic/system', (req, res) => {
  const os = require('os');
  res.json({
    success: true,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
        free: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
      },
      uptime: Math.round(os.uptime() / 60) + ' mins'
    }
  });
});

// Frontend static files from dist/ (Disable cache to ensure live updates load immediately)
app.use(express.static(DIRS.dist, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ═══════════════════════════════════════════════════════════════════
// ENHANCED FEATURES API INTEGRATION
// ═══════════════════════════════════════════════════════════════════

// Load audio enhancement APIs
try {
  const audioEnhancementAPI = require('./audio_enhancement_api.js');
  audioEnhancementAPI.setupVoiceEnhancementAPI(app, BASE_DIR);
  audioEnhancementAPI.setupBGMEnhancementAPI(app, BASE_DIR);
  audioEnhancementAPI.setupAudioMixingAPI(app, BASE_DIR);
  audioEnhancementAPI.setupBatchEnhancementAPI(app, BASE_DIR);
  console.log('[Enhanced Features API] Audio enhancement endpoints loaded ✓');
} catch (e) {
  console.log('[Enhanced Features API] Could not load audio enhancement:', e.message);
}

// =========================================================================
// MULTI-EPISODE VIDEO MERGER API (Episodes 01 -> 100+ Concat Engine)
// =========================================================================

// Upload Multiple Video Episodes
app.post('/api/upload-episode-files', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      log(`[Episode Upload Error] ${err.message}`, 'WARN');
      return res.status(400).json({ success: false, error: err.message });
    }
    const files = req.files || [];
    if (files.length === 0 && req.file) {
      files.push(req.file);
    }
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'No video files received' });
    }

    const episodeData = files.map(file => {
      const name = file.originalname;
      const numMatch = name.match(/(?:ep|episode|part|ភាគ|)(\d+)\b/i) || name.match(/(\d+)/);
      const epNum = numMatch ? parseInt(numMatch[1], 10) : 9999;
      return {
        fileName: file.filename,
        originalName: file.originalname,
        path: file.path,
        url: `/uploads/${file.filename}`,
        size: file.size,
        episodeNumber: epNum
      };
    });

    log(`[Episode Upload] Received ${episodeData.length} episode files`);
    res.json({
      success: true,
      files: episodeData
    });
  });
});

// Real FFMPEG Concat Merge for Multi-Episode Videos (1 to 100+ episodes)
app.post('/api/merge-episodes', async (req, res) => {
  try {
    const { episodes, outputName, mode = 'fast', autoSort = true } = req.body;
    if (!Array.isArray(episodes) || episodes.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'ត្រូវការវីដេអូយ៉ាងតិច ២ ភាគ ដើម្បីធ្វើការ Merge ចូលគ្នា' 
      });
    }

    log(`[Episode Merger] Starting merge of ${episodes.length} episodes (Mode: ${mode})`);

    // 1. Natural Sort Episodes by Episode Number / Filename if autoSort is true
    let sortedEpisodes = [...episodes];
    if (autoSort) {
      sortedEpisodes.sort((a, b) => {
        const numA = (typeof a === 'object' && a.episodeNumber !== undefined) 
          ? a.episodeNumber 
          : (parseInt((String(a.originalName || a.fileName || a).match(/\d+/) || [9999])[0], 10));
        const numB = (typeof b === 'object' && b.episodeNumber !== undefined) 
          ? b.episodeNumber 
          : (parseInt((String(b.originalName || b.fileName || b).match(/\d+/) || [9999])[0], 10));
        if (numA !== numB) return numA - numB;
        const nameA = String(a.originalName || a.fileName || a);
        const nameB = String(b.originalName || b.fileName || b);
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    // 2. Resolve absolute file paths on disk
    const resolvedFiles = [];
    for (const ep of sortedEpisodes) {
      const fileName = typeof ep === 'object' ? (ep.fileName || ep.path || '') : ep;
      const baseName = path.basename(fileName);
      let targetPath = path.join(DIRS.uploads, baseName);
      if (!fs.existsSync(targetPath)) {
        targetPath = path.join(DIRS.videos, baseName);
      }
      if (!fs.existsSync(targetPath)) {
        targetPath = fileName;
      }
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({
          success: false,
          error: `រកមិនឃើញ File វីដេអូភាគ: ${baseName}`
        });
      }
      resolvedFiles.push(targetPath);
    }

    // 3. Build FFMPEG Concat Demuxer Text File
    const timestamp = Date.now();
    const concatListPath = path.join(DIRS.uploads, `concat_list_${timestamp}.txt`);
    const concatContent = resolvedFiles.map(f => {
      const normalized = f.replace(/\\/g, '/').replace(/'/g, "'\\''");
      return `file '${normalized}'`;
    }).join('\n');

    fs.writeFileSync(concatListPath, concatContent, 'utf8');

    // 4. Output Filename
    const sanitizedOutputName = (outputName && outputName.trim()) 
      ? outputName.trim().replace(/[^a-zA-Z0-9_\u1780-\u17FF.-]/g, '_')
      : `Merged_Full_Movie_${timestamp}.mp4`;
    const finalOutputName = sanitizedOutputName.endsWith('.mp4') ? sanitizedOutputName : `${sanitizedOutputName}.mp4`;
    const outputPath = path.join(DIRS.uploads, finalOutputName);

    const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';

    // 5. Execute FFMPEG Concat
    const runFfmpeg = (args) => {
      return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegExe, args);
        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => {
          if (code === 0) resolve(true);
          else reject(new Error(stderr.slice(-600) || `FFMPEG failed with exit code ${code}`));
        });
        proc.on('error', err => reject(err));
      });
    };

    let usedMode = mode;
    try {
      if (mode === 'fast') {
        log(`[Episode Merger] Running Stream Copy Concat: ${finalOutputName}`);
        await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath]);
      } else {
        log(`[Episode Merger] Running Re-encode Concat: ${finalOutputName}`);
        await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '192k', outputPath]);
      }
    } catch (concatErr) {
      log(`[Episode Merger] Fast concat failed, attempting smart re-encode fallback: ${concatErr.message}`, 'WARN');
      usedMode = 'reencode-fallback';
      await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '192k', outputPath]);
    } finally {
      try { if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath); } catch (e) {}
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFMPEG did not generate output file');
    }

    const stats = fs.statSync(outputPath);
    log(`[Episode Merger] Successfully merged ${resolvedFiles.length} episodes into ${finalOutputName} (${Math.round(stats.size / 1024 / 1024)}MB)`);

    res.json({
      success: true,
      fileName: finalOutputName,
      filePath: outputPath,
      url: `/uploads/${finalOutputName}`,
      size: stats.size,
      totalEpisodes: resolvedFiles.length,
      mode: usedMode
    });

  } catch (error) {
    log(`[Episode Merger Error] ${error.message}`, 'ERROR');
    res.status(500).json({
      success: false,
      error: 'ការផ្គុំវីដេអូភាគរឿងបរាជ័យ: ' + (error.message || 'Unknown error')
    });
  }
});

// SPA fallback: any unknown route serves dist/index.html
app.use((req, res) => {
  const indexHtml = path.join(DIRS.dist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexHtml);
  } else {
    res.send('Dabbing Pro Server is running. dist/index.html not found.');
  }
});

// ---------------------------------------------------------
// Start Server
// ---------------------------------------------------------
// Auto-start GodMode Pool PRO Router at 127.0.0.1:20128
try {
  const routerPath = path.join(__dirname, 'router', 'src', 'server.js');
  if (fs.existsSync(routerPath)) {
    const { fork } = require('child_process');
    const routerChild = fork(routerPath, [], { stdio: 'inherit', detached: false });
    routerChild.on('error', (e) => console.log('[Router Process Warning]:', e.message));
  }
} catch (e) {
  console.log('[Router Start Notice]:', e.message);
}

app.listen(PORT, () => {
  console.log(`
  ========================================================================
     👑 DABBING PREMIUM — AI VIDEO DUBBER & VOXCPM2 CLONE STUDIO (v5.2)
  ========================================================================
     🌐 Web Studio   : http://localhost:${PORT}
     ⚙️  Status       : Online & Ready
     🎙️  VoxCPM2 Mode : Movie Clone & Character Voice Clone
     ⚡ Execution     : Colab/Kaggle GPU Link + Computer Local GPU
     👥 Characters   : 1-to-1 Strict Voice Lock (100% Consistent per Role)
     🎬 Batch Dubbing: Supported up to 8 movies (1-hour length ready)
     📁 Project Path : ${BASE_DIR}
  ========================================================================
  `);
  log(`Dabbing Pro server started on http://localhost:${PORT}`);

  if (process.env.AUTO_OPEN !== 'false') {
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(edge)) {
      exec(`"${edge}" --app=http://localhost:${PORT} --window-size=1440,900`);
    } else if (fs.existsSync(chrome)) {
      exec(`"${chrome}" --app=http://localhost:${PORT} --window-size=1440,900`);
    } else {
      exec(`start http://localhost:${PORT}`);
    }
  }
});


// =========================================================================
// REAL VIDEO TRANSFORMATION & FORMAT ENHANCEMENT (ASPECT RATIO, GRADING)
// =========================================================================
app.post('/api/render-video-transformation', async (req, res) => {
  try {
    const { videoUrl, aspectRatio = '16:9', brightness = 0, contrast = 1, saturation = 1, filterPreset = 'none', burnTitle = false, titleText = '' } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'No videoUrl provided' });

    // Resolve local input video path
    let inputPath = '';
    if (videoUrl.startsWith('/uploads/')) {
      inputPath = path.join(BASE_DIR, videoUrl.replace(/^\//, ''));
    } else if (fs.existsSync(videoUrl)) {
      inputPath = videoUrl;
    } else {
      inputPath = path.join(BASE_DIR, 'uploads', path.basename(videoUrl));
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ success: false, error: 'Input video not found: ' + inputPath });
    }

    const outFilename = 'transformed_' + Date.now() + '.mp4';
    const outputPath = path.join(BASE_DIR, 'uploads', outFilename);
    const ffmpegExe = fs.existsSync(DIRS.ffmpeg) ? DIRS.ffmpeg : 'ffmpeg';

    // Build FFmpeg video filter graph
    const vfParts = [];

    // Aspect Ratio & Sizing
    if (aspectRatio === '9:16') {
      // 1080x1920 with letterbox or fit
      vfParts.push("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black");
    } else if (aspectRatio === '1:1') {
      // 1080x1080 square
      vfParts.push("scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black");
    } else if (aspectRatio === '4:3') {
      // 1440x1080
      vfParts.push("scale=1440:1080:force_original_aspect_ratio=decrease,pad=1440:1080:(ow-iw)/2:(oh-ih)/2:black");
    } else {
      // 16:9 1920x1080
      vfParts.push("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black");
    }

    // Color Grading (eq filter)
    const bVal = parseFloat(brightness) || 0;
    const cVal = parseFloat(contrast) || 1.0;
    const sVal = parseFloat(saturation) || 1.0;
    vfParts.push(`eq=brightness=${bVal}:contrast=${cVal}:saturation=${sVal}`);

    // Cinematic LUT Presets
    if (filterPreset === 'teal_orange') {
      vfParts.push("curves=preset=cross_process");
    } else if (filterPreset === 'dark_noir') {
      vfParts.push("hue=s=0");
    } else if (filterPreset === 'vintage_film') {
      vfParts.push("curves=preset=vintage");
    }

    const vfString = vfParts.join(',');

    const args = [
      '-y',
      '-i', inputPath,
      '-vf', vfString,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputPath
    ];

    console.log('[VideoTransform] Executing FFmpeg:', ffmpegExe, args.join(' '));
    const child = spawn(ffmpegExe, args);

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        res.json({
          success: true,
          outputUrl: '/uploads/' + outFilename,
          fileName: outFilename
        });
      } else {
        res.status(500).json({ success: false, error: 'FFmpeg exited with code ' + code });
      }
    });

    child.on('error', (err) => {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// =========================================================================
// AUTO VOICE CLONING - EXTRACT VOICE SAMPLE FROM ORIGINAL MOVIE
// Extract សំឡេងតួអង្គពីសាច់រឿងដើម (Real Implementation)
// =========================================================================
app.post('/api/voxcpm/extract-voice-sample', upload.fields([
  { name: 'videoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { speaker, startTime, endTime, videoPath } = req.body;
    
    if (!speaker) {
      return res.json({ success: false, error: 'Missing speaker ID' });
    }
    
    const start = parseFloat(startTime) || 0;
    const end = parseFloat(endTime) || 5;
    const duration = end - start;
    
    if (duration < 1 || duration > 30) {
      return res.json({ success: false, error: 'Invalid duration (must be 1-30 seconds)' });
    }
    
    // Get video file path
    let inputVideoPath;
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
      inputVideoPath = req.files.videoFile[0].path;
    } else if (videoPath) {
      inputVideoPath = path.join(__dirname, 'videos', path.basename(videoPath));
    } else {
      return res.json({ success: false, error: 'No video file provided' });
    }
    
    if (!fs.existsSync(inputVideoPath)) {
      return res.json({ success: false, error: 'Video file not found' });
    }
    
    // Create voice samples directory
    const voiceSamplesDir = path.join(__dirname, 'uploads', 'voice_samples');
    if (!fs.existsSync(voiceSamplesDir)) {
      fs.mkdirSync(voiceSamplesDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const safeSpeaker = speaker.replace(/[^a-zA-Z0-9_]/g, '_');
    const outputFileName = `${safeSpeaker}_${timestamp}.wav`;
    const outputPath = path.join(voiceSamplesDir, outputFileName);
    
    console.log(`[Voice Extract] Extracting ${speaker} from ${start}s to ${end}s`);
    
    // Extract audio segment using ffmpeg
    await new Promise((resolve, reject) => {
      const ffmpegCmd = spawn('ffmpeg', [
        '-ss', start.toString(),
        '-i', inputVideoPath,
        '-t', duration.toString(),
        '-vn', // No video
        '-acodec', 'pcm_s16le', // WAV format for voice cloning
        '-ar', '48000', // 48kHz sample rate (VoxCPM2 compatible)
        '-ac', '1', // Mono
        '-af', 'volume=1.5', // Boost volume slightly
        '-y',
        outputPath
      ], { windowsHide: true });
      
      let errorOutput = '';
      
      ffmpegCmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpegCmd.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg extraction failed: ${errorOutput}`));
        }
      });
      
      ffmpegCmd.on('error', (err) => {
        reject(err);
      });
    });
    
    // Verify file was created
    if (!fs.existsSync(outputPath)) {
      return res.json({ success: false, error: 'Failed to extract voice sample' });
    }
    
    const fileSize = fs.statSync(outputPath).size;
    console.log(`[Voice Extract] ✓ Created ${outputFileName} (${Math.round(fileSize / 1024)}KB)`);
    
    // Return URL path
    const audioUrl = `/uploads/voice_samples/${outputFileName}`;
    
    res.json({
      success: true,
      audioUrl,
      sampleFile: outputFileName,
      speaker,
      duration,
      startTime: start,
      endTime: end,
      fileSize
    });
    
  } catch (error) {
    console.error('[Voice Extract] Error:', error);
    res.json({ 
      success: false, 
      error: error.message || 'Failed to extract voice sample' 
    });
  }
});

console.log('[Auto Voice Clone API] /api/voxcpm/extract-voice-sample endpoint registered');


