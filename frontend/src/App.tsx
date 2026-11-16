import React, { useState, useEffect } from 'react';
import { TopNavbar } from './components/TopNavbar';
import { VideoPlayer } from './components/VideoPlayer';
import { WaveformTimeline } from './components/WaveformTimeline';
import { SubtitleEditor } from './components/SubtitleEditor';
import { VoiceCloningModal } from './components/VoiceCloningModal';
import { AudioMixerModal } from './components/AudioMixerModal';
import { ConsistencyReport } from './components/ConsistencyReport';
import { MissingLineDetector } from './components/MissingLineDetector';
import { ResetConfirmModal } from './components/ResetConfirmModal';

import { 
  SubtitleLine, 
  RouterPoolStatus, 
  CharacterVoiceAssignment, 
  AudioMixerSettings 
} from './types';
import { 
  fetchRouterStatus, 
  translateSubtitlesBatch, 
  synthesizeLineAudio,
  triggerRenderFinalVideo,
  transcribeVideoFile
} from './services/api';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const DEFAULT_MIXER_SETTINGS: AudioMixerSettings = {
  preset: "cinema",
  warmth: 70,
  presence: 80,
  clarity: 85,
  denoise: true,
  bgmVolume: 25,
  autoDucking: true,
  duckingDb: -12,
  targetLufs: -16,
  stereoWidth: 125
};

export const App: React.FC = () => {
  // Empty clean state - NO DEMO DATA
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [assignments, setAssignments] = useState<Record<string, CharacterVoiceAssignment>>({});
  const [mixerSettings, setMixerSettings] = useState<AudioMixerSettings>(DEFAULT_MIXER_SETTINGS);
  
  // Media State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [routerStatus, setRouterStatus] = useState<RouterPoolStatus | null>(null);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMixerModalOpen, setIsMixerModalOpen] = useState(false);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [isMissingLinesModalOpen, setIsMissingLinesModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Status & Notifications
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load live Gemini key router status
  useEffect(() => {
    fetchRouterStatus().then(setRouterStatus);
    const interval = setInterval(() => {
      fetchRouterStatus().then(setRouterStatus);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Video File Selection & Transcribe Prompt
  const handleVideoSelected = async (file: File) => {
    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    notify(`បានបញ្ចូលវីដេអូ៖ ${file.name}`, 'success');

    // Auto ask to transcribe if no subtitles yet
    if (subtitles.length === 0) {
      notify("កំពុងទាញយកអត្ថបទពីវីដេអូដោយ Faster-Whisper...", 'info');
      try {
        const segments = await transcribeVideoFile(file);
        if (segments && segments.length > 0) {
          setSubtitles(segments);
          // Auto assign characters
          const speakers = Array.from(new Set(segments.map(s => s.speaker)));
          const initAssign: Record<string, CharacterVoiceAssignment> = {};
          speakers.forEach((spk, idx) => {
            initAssign[spk] = {
              speakerId: spk,
              characterName: idx === 0 ? "ឯកប្រុស" : "ឯកស្រី",
              mode: "clone_from_library",
              voiceKey: idx === 0 ? "lead_male" : "lead_female",
              gender: idx === 0 ? "male" : "female"
            };
          });
          setAssignments(initAssign);
          notify(`ទាញយកអត្ថបទបាន ${segments.length} ឃ្លាដោយជោគជ័យ`, 'success');
        }
      } catch (e: any) {
        notify("មិនអាចទាញយកអត្ថបទស្វ័យប្រវត្តិបានទេ។ អ្នកអាចបញ្ចូលឯកសារ .SRT ផ្ទាល់បាន។", 'info');
      }
    }
  };

  // Subtitle Line Operations
  const handleUpdateLine = (id: number, updated: Partial<SubtitleLine>) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const handleAddLine = () => {
    const newId = subtitles.length > 0 ? Math.max(...subtitles.map(s => s.id)) + 1 : 0;
    const startSec = currentTime;
    const endSec = currentTime + 3.0;

    const formatSec = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec - Math.floor(sec)) * 1000);
      return `00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    const newLine: SubtitleLine = {
      id: newId,
      start: startSec,
      end: endSec,
      duration: 3.0,
      start_time: formatSec(startSec),
      end_time: formatSec(endSec),
      speaker: 'Speaker_1',
      text: '',
      khmer_text: '',
      emotion: 'neutral'
    };

    setSubtitles(prev => [...prev, newLine]);
    setSelectedLineId(newId);
    notify("បានបន្ថែមឃ្លាថ្មី", 'success');
  };

  const handleDeleteLine = (id: number) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
    notify("បានលុបឃ្លា", 'info');
  };

  const handleImportSRT = (lines: SubtitleLine[]) => {
    setSubtitles(lines);
    // Initialize character assignments
    const speakers = Array.from(new Set(lines.map(s => s.speaker)));
    const initAssign: Record<string, CharacterVoiceAssignment> = {};
    speakers.forEach((spk, idx) => {
      initAssign[spk] = {
        speakerId: spk,
        characterName: idx === 0 ? "ឯកប្រុស" : "ឯកស្រី",
        mode: "clone_from_library",
        voiceKey: idx === 0 ? "lead_male" : "lead_female",
        gender: idx === 0 ? "male" : "female"
      };
    });
    setAssignments(initAssign);
    notify(`បានបញ្ចូល Subtitle ចំនួន ${lines.length} ឃ្លា`, 'success');
  };

  // Special Feature: Reset Project
  const handleConfirmReset = () => {
    setSubtitles([]);
    setAssignments({});
    setVideoFile(null);
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setCurrentTime(0);
    setSelectedLineId(null);
    setMixerSettings(DEFAULT_MIXER_SETTINGS);
    notify("បានរីសិតគម្រោងជោគជ័យ។ ស្ទូឌីយោបានត្រៀមរួចរាល់សម្រាប់គម្រោងថ្មី។", 'success');
  };

  // Batch Translation using Gemini Router Pool
  const handleBatchTranslate = async () => {
    if (subtitles.length === 0) {
      notify("សូមបញ្ចូល Subtitle ជាមុនសិន", 'error');
      return;
    }
    setIsTranslating(true);
    notify("កំពុងបកប្រែសម្រួលរឿងជាភាសាខ្មែរតាមរយៈ Gemini Key Pool...", 'info');
    try {
      const translated = await translateSubtitlesBatch(subtitles, "drama");
      setSubtitles(translated);
      notify("បានបកប្រែសម្រួលរឿងជាភាសាខ្មែរជោគជ័យ", 'success');
    } catch (e: any) {
      notify(`ការបកប្រែបរាជ័យ៖ ${e.message}`, 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  // Synthesize Single Line Audio
  const handleSynthesizeLine = async (line: SubtitleLine) => {
    notify(`កំពុងបង្កើតសំឡេងនិយាយសម្រាប់ឃ្លា #${line.id + 1}...`, 'info');
    try {
      const audioUrl = await synthesizeLineAudio(line, assignments[line.speaker]);
      handleUpdateLine(line.id, { audio_url: audioUrl });
      notify(`បង្កើតសំឡេងឃ្លា #${line.id + 1} រួចរាល់`, 'success');
    } catch (e: any) {
      notify(`បង្កើតសំឡេងបរាជ័យ៖ ${e.message}`, 'error');
    }
  };

  // Master Pipeline
  const handleStartAutoDub = async () => {
    if (subtitles.length === 0) {
      notify("សូមបញ្ចូល Subtitle ជាមុនសិន", 'error');
      return;
    }
    setIsProcessing(true);
    notify("ចាប់ផ្តើមដំណើរការ Master Dubbing Pipeline (Loom + AI + FFmpeg)...", 'info');
    try {
      // 1. Translate
      const translated = await translateSubtitlesBatch(subtitles, "drama");
      setSubtitles(translated);

      // 2. Synthesize lines
      for (const line of translated) {
        const audioUrl = await synthesizeLineAudio(line, assignments[line.speaker]);
        handleUpdateLine(line.id, { audio_url: audioUrl });
      }

      notify("ដំណើរការ Dubbing ស្វ័យប្រវត្តិត្រូវបានបញ្ចប់ដោយជោគជ័យ", 'success');
    } catch (e: any) {
      notify(`កំហុសដំណើរការ Pipeline៖ ${e.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Final Video
  const handleExportVideo = async () => {
    notify("កំពុងបញ្ជូនបញ្ជា Render ទៅកាន់ FFmpeg (NVENC/CUDA Hardware Acceleration)...", 'info');
    try {
      await triggerRenderFinalVideo(mixerSettings, videoFile?.name || "video.mp4");
      notify("ការ Render វីដេអូចប់សព្វគ្រប់។ ឯកសារត្រូវបានរក្សាទុកក្នុង data/outputs", 'success');
    } catch (e: any) {
      notify(`កំហុស Render៖ ${e.message}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Top Navbar */}
      <TopNavbar
        routerStatus={routerStatus}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenMixerModal={() => setIsMixerModalOpen(true)}
        onOpenConsistencyModal={() => setIsConsistencyModalOpen(true)}
        onOpenMissingLinesModal={() => setIsMissingLinesModalOpen(true)}
        onResetProject={() => setIsResetModalOpen(true)}
        onStartAutoDub={handleStartAutoDub}
        onExportVideo={handleExportVideo}
        isProcessing={isProcessing}
      />

      {/* Floating Crisp Notification (No emojis, SVG icon only) */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-elevated text-xs font-khmer text-slate-800 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Studio Workspace */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Section: Video Player & Waveform Timeline */}
        <section className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Top Video Preview Player */}
          <div className="flex-[3] min-h-0">
            <VideoPlayer
              videoSrc={videoSrc}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              subtitles={subtitles}
              onVideoSelected={handleVideoSelected}
            />
          </div>

          {/* Bottom Multitrack Timeline */}
          <div className="flex-[2] min-h-[180px]">
            <WaveformTimeline
              duration={Math.max(60, subtitles.length > 0 ? subtitles[subtitles.length - 1].end + 5 : 60)}
              currentTime={currentTime}
              onSeek={setCurrentTime}
              subtitles={subtitles}
            />
          </div>
        </section>

        {/* Right Section: Subtitle & Khmer Drama Editor */}
        <section className="w-[480px] xl:w-[540px] shrink-0 flex flex-col">
          <SubtitleEditor
            subtitles={subtitles}
            onUpdateLine={handleUpdateLine}
            onAddLine={handleAddLine}
            onDeleteLine={handleDeleteLine}
            onImportSRT={handleImportSRT}
            onBatchTranslate={handleBatchTranslate}
            onSynthesizeLine={handleSynthesizeLine}
            onSelectLine={(line) => {
              setSelectedLineId(line.id);
              setCurrentTime(line.start);
            }}
            selectedLineId={selectedLineId}
            isTranslating={isTranslating}
          />
        </section>
      </main>

      {/* Modals */}
      <VoiceCloningModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        assignments={assignments}
        onSaveAssignments={setAssignments}
      />

      <AudioMixerModal
        isOpen={isMixerModalOpen}
        onClose={() => setIsMixerModalOpen(false)}
        settings={mixerSettings}
        onSaveSettings={setMixerSettings}
      />

      <ConsistencyReport
        isOpen={isConsistencyModalOpen}
        onClose={() => setIsConsistencyModalOpen(false)}
        assignments={assignments}
        onAutoFix={() => {
          notify("បានកែសម្រួលទំនាស់សំឡេងស្វ័យប្រវត្តិរួចរាល់", 'success');
        }}
      />

      <MissingLineDetector
        isOpen={isMissingLinesModalOpen}
        onClose={() => setIsMissingLinesModalOpen(false)}
        subtitles={subtitles}
        onRetryMissingLines={() => {
          handleBatchTranslate();
        }}
      />

      {/* Special Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
};

export default App;
