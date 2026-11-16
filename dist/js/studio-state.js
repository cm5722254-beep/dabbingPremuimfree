/**
 * Studio State Manager - Dabbing Pro v6.0
 * Centralized Single Source of Truth for State & Event Handling
 */

(function(window) {
  'use strict';

  const defaultCharacters = [
    { id: 'SPEAKER_00', name: 'តួប្រុសឯក (Hero)', gender: 'male', age: 'young_adult', voice: 'km-KH-PisethNeural', avatar: '👨‍🎤', emotion: 'ធម្មតា' },
    { id: 'SPEAKER_01', name: 'តួស្រីឯក (Heroine)', gender: 'female', age: 'young_adult', voice: 'km-KH-SreymomNeural', avatar: '👩‍🎤', emotion: 'ធម្មតា' },
    { id: 'SPEAKER_02', name: 'តួជំនួយ/ចាស់ទុំ', gender: 'male', age: 'elderly', voice: 'km-KH-PisethNeural', avatar: '👴', emotion: 'ធ្ងន់ធ្ងរ' }
  ];

  const defaultQualityChecks = [
    { id: 'check_missing', title: 'ចំនួនឃ្លាគ្រប់ ១០០%', desc: 'ឃ្លាបកប្រែត្រូវតែស្មើនឹងឃ្លាដើម', status: 'pending' },
    { id: 'check_overlap', title: 'គ្មានសំឡេងគងគ្នា (Overlap)', desc: 'ពិនិត្យចន្លោះ timing ឃ្លានីមួយៗ', status: 'pending' },
    { id: 'check_silence', title: 'ចន្លោះស្ងាត់ធម្មជាតិ', desc: 'រក្សាចន្លោះសម្រាកដង្ហើមសមរម្យ', status: 'pending' },
    { id: 'check_clipping', title: 'គ្មាន Clipping / បែកសំឡេង', desc: 'កម្រិត Peak អូឌីយ៉ូមិនលើស 0dB', status: 'pending' },
    { id: 'check_timing', title: 'Auto-Fit Timestamp ដើម', desc: 'Atempo/Rubberband មិនឱ្យលើស 1.25x', status: 'pending' }
  ];

  class StudioState {
    constructor() {
      this.currentTab = 'project';
      this.currentStep = 1;
      this.theme = localStorage.getItem('dabbing_theme') || 'dark';
      this.isProcessing = false;
      this.progress = 0;
      this.statusText = 'ប្រព័ន្ធរួចរាល់សម្រាប់ការងារ';
      
      this.project = {
        id: null,
        fileName: '',
        filePath: '',
        url: '',
        duration: 0,
        resolution: '',
        sizeFormatted: ''
      };

      this.stems = {
        vocalsPath: '',
        accompanimentPath: ''
      };

      this.characters = [...defaultCharacters];
      this.subtitles = [];
      this.qualityChecks = [...defaultQualityChecks];

      this.settings = {
        sttProvider: 'faster_whisper',
        llmProvider: 'ollama',
        ttsProvider: 'edge_tts',
        vocalProvider: 'demucs',
        ollamaUrl: 'http://127.0.0.1:11434',
        ollamaModel: 'qwen2.5:7b',
        geminiKey: '',
        elevenlabsKey: '',
        groqKey: '',
        openaiKey: ''
      };

      this.listeners = new Map();
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(cb => {
          try { cb(data); } catch (e) { console.error(`Error in listener for ${event}:`, e); }
        });
      }
    }

    setTab(tabName) {
      this.currentTab = tabName;
      this.emit('tab:changed', tabName);
    }

    setStep(stepNum) {
      if (stepNum >= 1 && stepNum <= 8) {
        this.currentStep = stepNum;
        this.emit('step:changed', stepNum);
      }
    }

    setProgress(pct, text = '') {
      this.progress = Math.min(100, Math.max(0, pct));
      if (text) this.statusText = text;
      this.emit('progress:updated', { progress: this.progress, text: this.statusText });
    }

    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('dabbing_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      this.emit('theme:changed', theme);
    }

    setProject(data) {
      this.project = { ...this.project, ...data };
      this.emit('project:updated', this.project);
    }

    setCharacters(chars) {
      this.characters = chars;
      this.emit('characters:updated', this.characters);
    }

    setSubtitles(subs) {
      this.subtitles = subs;
      this.emit('subtitles:updated', this.subtitles);
    }

    updateQualityCheck(checkId, status) {
      const item = this.qualityChecks.find(c => c.id === checkId);
      if (item) {
        item.status = status;
        this.emit('quality:updated', this.qualityChecks);
      }
    }
  }

  window.studioState = new StudioState();
})(window);

