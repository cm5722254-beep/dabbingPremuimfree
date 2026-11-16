import React from 'react';
import { 
  Sliders, 
  Mic, 
  CheckCircle2, 
  AlertTriangle, 
  Film, 
  Play, 
  Download,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RouterPoolStatus } from '../types';

interface TopNavbarProps {
  routerStatus: RouterPoolStatus | null;
  onOpenVoiceModal: () => void;
  onOpenMixerModal: () => void;
  onOpenConsistencyModal: () => void;
  onOpenMissingLinesModal: () => void;
  onResetProject: () => void;
  onStartAutoDub: () => void;
  onExportVideo: () => void;
  isProcessing: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  routerStatus,
  onOpenVoiceModal,
  onOpenMixerModal,
  onOpenConsistencyModal,
  onOpenMissingLinesModal,
  onResetProject,
  onStartAutoDub,
  onExportVideo,
  isProcessing
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-5 flex items-center justify-between z-30 select-none shadow-sm">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-slate-900">
              CHEATZ DUBBING STUDIO
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              PRO v6.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-khmer">
            ប្រព័ន្ធបកប្រែសម្រួលរឿង និងក្លូនសំឡេង AI ស្វ័យប្រវត្តិ
          </p>
        </div>
      </div>

      {/* Center Tool Buttons */}
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
        <button
          onClick={onOpenVoiceModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition-all font-khmer"
        >
          <Mic className="w-3.5 h-3.5 text-purple-600" />
          <span>VoxCPM Dual Mode</span>
        </button>

        <button
          onClick={onOpenMixerModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition-all font-khmer"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>កែសម្រួលសំឡេង DSP</span>
        </button>

        <button
          onClick={onOpenConsistencyModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition-all font-khmer"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>ពិនិត្យសំឡេង</span>
        </button>

        <button
          onClick={onOpenMissingLinesModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition-all font-khmer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>រកឃ្លាខ្វះ</span>
        </button>

        {/* Special Reset Feature */}
        <button
          onClick={onResetProject}
          title="ចាប់ផ្តើមគម្រោងថ្មី / Reset ទាំងអស់"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:shadow-xs transition-all font-khmer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-red-600" />
          <span>រីសិតគម្រោង</span>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Router Pool Status */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-slate-500 text-[11px] font-khmer">Gemini Pool:</span>
          <span className="font-semibold text-emerald-600 text-[11px] font-mono">
            {routerStatus?.active_keys || 19}/{routerStatus?.total_keys || 19} Keys
          </span>
        </div>

        {/* Master Auto Dubbing */}
        <button
          onClick={onStartAutoDub}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all font-khmer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'កំពុងដំណើរការ...' : 'ចាប់ផ្តើម Dub ស្វ័យប្រវត្តិ'}</span>
        </button>

        {/* Render Final Video */}
        <button
          onClick={onExportVideo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all font-khmer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Render វីដេអូ</span>
        </button>
      </div>
    </header>
  );
};
