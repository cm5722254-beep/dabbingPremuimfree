/**
 * ═══════════════════════════════════════════════════════════════════
 * AUTOMATIC EMOTION DETECTION & CONTEXT-AWARE TRANSLATION
 * វិភាគអារម្មណ៍ដោយស្វ័យប្រវត្តិ និង បកប្រែតាមបរិបទ
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 1. EMOTION DETECTION FROM VIDEO & AUDIO
  // វិភាគអារម្មណ៍ពីវីដេអូ និង សំឡេង
  // ═══════════════════════════════════════════════════════════════════

  const EMOTION_KEYWORDS = {
    'សើច': ['laugh', 'haha', 'funny', 'joke', 'comedy', '笑', 'ضحك', 'смех'],
    'យំ': ['cry', 'sob', 'tears', 'sad', '哭', 'بكاء', 'плач'],
    'ស្រែក': ['scream', 'shout', 'yell', '叫', 'صراخ', 'крик'],
    'ខឹង': ['angry', 'mad', 'furious', 'rage', '怒', 'غضب', 'злость'],
    'ភ័យ': ['fear', 'scared', 'afraid', 'terror', '怕', 'خوف', 'страх'],
    'ស្នេហា': ['love', 'romance', 'kiss', 'darling', '爱', 'حب', 'любовь'],
    'ភ្ញាក់ផ្អើល': ['surprise', 'shock', 'wow', 'omg', '惊', 'مفاجأة', 'удивление'],
    'សប្បាយ': ['happy', 'joy', 'cheerful', 'excited', '快乐', 'سعادة', 'радость'],
    'ក្រៀមក្រំ': ['suffering', 'pain', 'hurt', 'agony', '痛苦', 'ألم', 'страдание'],
    'អង្វរ': ['beg', 'plead', 'please', 'mercy', '求', 'توسل', 'умолять'],
    'រំភើប': ['excited', 'thrilled', 'enthusiastic', '兴奋', 'متحمس', 'взволнован'],
    'ធុញ': ['bored', 'tired', 'fed up', '无聊', 'ملل', 'скучно'],
    'ចំអក': ['disgusted', 'gross', 'yuck', '恶心', 'اشمئزاز', 'отвращение'],
    'ឡូយ': ['flirty', 'seductive', 'sweet', '撒娇', 'غزل', 'флирт']
  };

  // Emotion indicators in text
  const TEXT_EMOTION_PATTERNS = {
    'សើច': /[ហហហ]+|[笑]+|haha+|lol|funny|joke/i,
    'យំ': /[😢😭💔]|cry|tears|sob|sad/i,
    'ស្រែក': /[!！]{2,}|AHHH|NOOO|HELP/i,
    'ខឹង': /damn|hell|bastard|idiot|angry|mad/i,
    'ភ័យ': /scary|afraid|fear|terror|ghost/i,
    'ស្នេហា': /[❤💕💖]|love|darling|honey|baby/i,
    'ភ្ញាក់ផ្អើល': /[!？]{2,}|what|wow|omg|serious/i,
    'សប្បាយ': /[😊😄🎉]|happy|great|awesome|wonderful/i,
    'អង្វរ': /please|beg|mercy|help me/i,
    'រំភើប': /yes!|amazing|incredible|fantastic/i,
    'ធុញ': /boring|tired|whatever|meh/i
  };

  // Punctuation-based emotion detection
  const PUNCTUATION_EMOTIONS = {
    '!!!': 'ស្រែក',
    '!?': 'ភ្ញាក់ផ្អើល',
    '...': 'ក្រៀមក្រំ',
    '???': 'ភ្ញាក់ផ្អើល',
    '♥': 'ស្នេហា',
    '♡': 'ស្នេហា'
  };

  /**
   * វិភាគអារម្មណ៍ពីអត្ថបទ
   */
  window.detectEmotionFromText = function(text, originalText = '') {
    if (!text && !originalText) return 'ធម្មតា';

    const combinedText = (text + ' ' + originalText).toLowerCase();

    // Check punctuation patterns
    for (const [pattern, emotion] of Object.entries(PUNCTUATION_EMOTIONS)) {
      if (combinedText.includes(pattern)) return emotion;
    }

    // Check text patterns
    for (const [emotion, regex] of Object.entries(TEXT_EMOTION_PATTERNS)) {
      if (regex.test(combinedText)) return emotion;
    }

    // Check keywords
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (combinedText.includes(keyword.toLowerCase())) {
          return emotion;
        }
      }
    }

    // Default
    return 'ធម្មតា';
  };

  /**
   * វិភាគអារម្មណ៍ពីបរិបទ (ឃ្លាមុន និង ក្រោយ)
   */
  window.detectEmotionFromContext = function(currentLine, previousLines = [], nextLines = []) {
    const emotion = window.detectEmotionFromText(currentLine);
    
    // If current line has no clear emotion, check surrounding context
    if (emotion === 'ធម្មតា') {
      // Check previous line
      if (previousLines.length > 0) {
        const prevEmotion = window.detectEmotionFromText(previousLines[previousLines.length - 1]);
        if (prevEmotion !== 'ធម្មតា') {
          // Emotion often continues from previous line
          return prevEmotion;
        }
      }
      
      // Check next line
      if (nextLines.length > 0) {
        const nextEmotion = window.detectEmotionFromText(nextLines[0]);
        if (nextEmotion !== 'ធម្មតា') {
          return nextEmotion;
        }
      }
    }

    return emotion;
  };

  /**
   * វិភាគអារម្មណ៍សម្រាប់ subtitles ទាំងអស់
   */
  window.analyzeEmotionsForAllSubtitles = function(subtitles) {
    if (!Array.isArray(subtitles) || subtitles.length === 0) return subtitles;

    return subtitles.map((sub, idx) => {
      const previousLines = idx > 0 ? [subtitles[idx - 1].text] : [];
      const nextLines = idx < subtitles.length - 1 ? [subtitles[idx + 1].text] : [];
      
      const emotion = window.detectEmotionFromContext(
        sub.text || '',
        previousLines,
        nextLines
      );

      return {
        ...sub,
        emotion: emotion,
        emotionConfidence: emotion !== 'ធម្មតា' ? 'high' : 'low'
      };
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. PRESERVE TRANSLATED TEXT DURING TRANSCRIBE
  // រក្សាឃ្លាដែលបានបកប្រែពេលធ្វើ transcribe
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Save translated subtitles before transcribe
   */
  window.preserveTranslatedSubtitles = function() {
    const subtitles = window.appState?.subtitles || [];
    if (subtitles.length === 0) return null;

    // Check if any subtitle has Khmer text (already translated)
    const hasTranslation = subtitles.some(sub => 
      sub.text && /[\u1780-\u17FF]/.test(sub.text)
    );

    if (hasTranslation) {
      // Save to localStorage as backup
      const backup = {
        timestamp: Date.now(),
        subtitles: subtitles.map(sub => ({
          start: sub.start,
          end: sub.end,
          text: sub.text,
          originalText: sub.originalText || '',
          speaker: sub.speaker || '',
          emotion: sub.emotion || 'ធម្មតា'
        }))
      };

      try {
        localStorage.setItem('subtitle_translation_backup', JSON.stringify(backup));
        console.log('[Preserve Translation] Saved backup:', backup.subtitles.length, 'lines');
        return backup;
      } catch (e) {
        console.error('[Preserve Translation] Failed to save:', e);
      }
    }

    return null;
  };

  /**
   * Restore translated subtitles after transcribe
   */
  window.restoreTranslatedSubtitles = function() {
    try {
      const backupStr = localStorage.getItem('subtitle_translation_backup');
      if (!backupStr) {
        console.log('[Restore Translation] No backup found');
        return false;
      }

      const backup = JSON.parse(backupStr);
      const currentSubtitles = window.appState?.subtitles || [];

      // Match by timing (start/end) and restore translation
      let restoredCount = 0;
      currentSubtitles.forEach(currentSub => {
        const match = backup.subtitles.find(backupSub => {
          const startDiff = Math.abs(parseFloat(currentSub.start) - parseFloat(backupSub.start));
          const endDiff = Math.abs(parseFloat(currentSub.end) - parseFloat(backupSub.end));
          return startDiff < 0.5 && endDiff < 0.5; // Within 0.5 second tolerance
        });

        if (match && match.text && /[\u1780-\u17FF]/.test(match.text)) {
          currentSub.text = match.text;
          currentSub.originalText = match.originalText || currentSub.text;
          currentSub.emotion = match.emotion || 'ធម្មតា';
          if (match.speaker) currentSub.speaker = match.speaker;
          restoredCount++;
        }
      });

      if (restoredCount > 0) {
        console.log('[Restore Translation] Restored', restoredCount, 'translated lines');
        
        // Update UI
        if (typeof window.renderSubtitleTable === 'function') {
          window.renderSubtitleTable();
        }
        
        return true;
      }

    } catch (e) {
      console.error('[Restore Translation] Failed to restore:', e);
    }

    return false;
  };

  /**
   * Hook into transcribe button to preserve translations
   */
  window.enhancedTranscribe = function() {
    // Save current translation
    window.preserveTranslatedSubtitles();

    // Call original transcribe function
    if (typeof window.originalTranscribeFunction === 'function') {
      window.originalTranscribeFunction();
    } else if (typeof window.startTranscribe === 'function') {
      window.startTranscribe();
    } else {
      console.warn('[Enhanced Transcribe] Original transcribe function not found');
    }

    // After transcribe completes (wait 2 seconds for processing)
    setTimeout(() => {
      const restored = window.restoreTranslatedSubtitles();
      if (restored) {
        showToast('✅ បានរក្សា និង ស្តារឃ្លាបកប្រែវិញរួចរាល់!');
      }
    }, 2000);
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. ENHANCED TRANSLATION WITH EMOTION CONTEXT
  // បកប្រែជាមួយបរិបទអារម្មណ៍
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enhanced translate function with automatic emotion detection
   */
  window.enhancedTranslate = async function() {
    const subtitles = window.appState?.subtitles || [];
    if (subtitles.length === 0) {
      alert('មិនមានអត្ថបទដើម្បីបកប្រែទេ! សូមធ្វើ transcribe មុន។');
      return;
    }

    // Step 1: Analyze emotions for all subtitles
    console.log('[Enhanced Translate] Step 1: Analyzing emotions...');
    const subtitlesWithEmotion = window.analyzeEmotionsForAllSubtitles(subtitles);
    
    // Update appState with emotions
    window.appState.subtitles = subtitlesWithEmotion;

    // Show emotion analysis result
    const emotionCounts = {};
    subtitlesWithEmotion.forEach(sub => {
      emotionCounts[sub.emotion] = (emotionCounts[sub.emotion] || 0) + 1;
    });
    console.log('[Enhanced Translate] Emotion analysis:', emotionCounts);

    // Step 2: Call original translate with emotion context
    console.log('[Enhanced Translate] Step 2: Translating with emotion context...');
    
    if (typeof window.startTranslateSubtitles === 'function') {
      await window.startTranslateSubtitles();
    } else {
      console.error('[Enhanced Translate] Translation function not found');
    }

    // Step 3: Update UI to show emotions
    if (typeof window.renderSubtitleTable === 'function') {
      window.renderSubtitleTable();
    }

    console.log('[Enhanced Translate] Translation complete with emotions!');
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. VOICE SELECTION OPTIONS FOR DUBBING
  // ជម្រើសសំឡេងសម្រាប់ dubbing
  // ═══════════════════════════════════════════════════════════════════

  const VOICE_OPTIONS = {
    // Edge-TTS Voices (Built-in)
    edgeTTS: {
      'Piseth': { name: 'ពិសិទ្ធ - Lead Male', voice: 'km-KH-PisethNeural', gender: 'male', type: 'ឯកប្រុស' },
      'Sreymom': { name: 'ស្រីមុំ - Lead Female', voice: 'km-KH-SreymomNeural', gender: 'female', type: 'ឯកស្រី' }
    },
    
    // VoxCPM2 Voices (Custom cloned)
    voxcpm: {
      'movie_clone': { name: 'Clone ពីរឿងដើម', type: 'movie_clone' },
      'custom_character': { name: 'Character Voice ផ្ទាល់ខ្លួន', type: 'custom_character' }
    },
    
    // Voice Library (from voice_split_tool)
    library: []  // Will be populated from API
  };

  /**
   * Load voice options from Voice Library
   */
  window.loadVoiceOptions = async function() {
    try {
      const response = await fetch('/api/voice-library');
      const data = await response.json();
      
      if (data.success && data.voices) {
        VOICE_OPTIONS.library = data.voices.map(voice => ({
          id: voice.id,
          name: voice.name,
          characterType: voice.characterType,
          filename: voice.filename,
          filepath: voice.filepath,
          type: 'library'
        }));
        
        console.log('[Voice Options] Loaded', VOICE_OPTIONS.library.length, 'voices from library');
      }
    } catch (e) {
      console.error('[Voice Options] Failed to load library:', e);
    }
  };

  /**
   * Get all available voice options
   */
  window.getAllVoiceOptions = function() {
    return {
      edgeTTS: Object.values(VOICE_OPTIONS.edgeTTS),
      voxcpm: Object.values(VOICE_OPTIONS.voxcpm),
      library: VOICE_OPTIONS.library
    };
  };

  /**
   * Create voice selector UI
   */
  window.createVoiceSelector = function(characterId, currentVoice = null) {
    const options = window.getAllVoiceOptions();
    
    let html = '<select class="voice-selector" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--soft); color: var(--text);">';
    
    // Edge-TTS Options
    html += '<optgroup label="🎤 Edge-TTS (Built-in)">';
    options.edgeTTS.forEach(voice => {
      const selected = currentVoice === voice.voice ? 'selected' : '';
      html += `<option value="edgetts:${voice.voice}" ${selected}>${voice.name}</option>`;
    });
    html += '</optgroup>';
    
    // VoxCPM2 Options
    html += '<optgroup label="🎙️ VoxCPM2 (AI Clone)">';
    options.voxcpm.forEach(voice => {
      const selected = currentVoice === voice.type ? 'selected' : '';
      html += `<option value="voxcpm:${voice.type}" ${selected}>${voice.name}</option>`;
    });
    html += '</optgroup>';
    
    // Voice Library Options
    if (options.library.length > 0) {
      html += '<optgroup label="📚 Voice Library">';
      options.library.forEach(voice => {
        const selected = currentVoice === voice.id ? 'selected' : '';
        html += `<option value="library:${voice.id}" ${selected}>${voice.characterType} - ${voice.name}</option>`;
      });
      html += '</optgroup>';
    }
    
    html += '</select>';
    return html;
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. INITIALIZE ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════

  function initializeEmotionEnhancements() {
    console.log('[Emotion Enhancement] Initializing...');
    
    // Load voice library options
    window.loadVoiceOptions();
    
    // Hook into transcribe button
    const originalTranscribe = window.startTranscribe || window.transcribeVideo;
    if (originalTranscribe) {
      window.originalTranscribeFunction = originalTranscribe;
      window.startTranscribe = window.enhancedTranscribe;
      console.log('[Emotion Enhancement] Transcribe function hooked');
    }
    
    // Hook into translate button
    const originalTranslate = window.startTranslateSubtitles;
    if (originalTranslate) {
      window.originalTranslateFunction = originalTranslate;
      // Don't replace yet, just add enhanced version as option
      console.log('[Emotion Enhancement] Translate function found');
    }
    
    console.log('[Emotion Enhancement] Ready!');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEmotionEnhancements);
  } else {
    initializeEmotionEnhancements();
  }

  setTimeout(initializeEmotionEnhancements, 1000);

  console.log('[Emotion Enhancement] Script loaded!');
})();

/**
 * ═══════════════════════════════════════════════════════════════════
 * USAGE INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1. ADD THIS SCRIPT TO dist/index.html BEFORE </body>
 * 
 * 2. AUTOMATIC FEATURES:
 *    - Emotion detection from text and context
 *    - Preserve translated text during transcribe
 *    - Voice options from Voice Library
 * 
 * 3. MANUAL TESTING:
 *    // Detect emotion from text
 *    window.detectEmotionFromText("ហាហា មានក្បាច់ណាស់!")  // Returns: "សើច"
 *    
 *    // Analyze all subtitles
 *    window.analyzeEmotionsForAllSubtitles(window.appState.subtitles)
 *    
 *    // Get voice options
 *    window.getAllVoiceOptions()
 * 
 * 4. WORKFLOW:
 *    Upload → Transcribe (auto-preserves if already translated) 
 *    → Translate (auto-detects emotions) → Select voices 
 *    → Dub (with correct emotions)
 * 
 * ═══════════════════════════════════════════════════════════════════
 */
