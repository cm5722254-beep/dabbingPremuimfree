import React, { useState } from 'react';
import { X, Sliders, Check, Music, Volume2, Layers } from 'lucide-react';
import { AudioMixerSettings } from '../types';

interface AudioMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioMixerSettings;
  onSaveSettings: (settings: AudioMixerSettings) => void;
}

export const AudioMixerModal: React.FC<AudioMixerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings
}) => {
  const [local, setLocal] = useState<AudioMixerSettings>(settings);

  if (!isOpen) return null;

  const applyPreset = (preset: 'cinema' | 'podcast' | 'music_focus') => {
    if (preset === 'cinema') {
      setLocal({
        preset: 'cinema',
        warmth: 70,
        presence: 80,
        clarity: 85,
        denoise: true,
        bgmVolume: 25,
        autoDucking: true,
        duckingDb: -12,
        targetLufs: -16,
        stereoWidth: 125
      });
    } else if (preset === 'podcast') {
      setLocal({
        preset: 'podcast',
        warmth: 60,
        presence: 90,
        clarity: 95,
        denoise: true,
        bgmVolume: 15,
        autoDucking: true,
        duckingDb: -16,
        targetLufs: -18,
        stereoWidth: 100
      });
    } else {
      setLocal({
        preset: 'music_focus',
        warmth: 50,
        presence: 70,
        clarity: 75,
        denoise: false,
        bgmVolume: 40,
        autoDucking: true,
        duckingDb: -8,
        targetLufs: -14,
        stereoWidth: 140
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-khmer">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-modal flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-16 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                PROFESSIONAL AUDIO ENHANCEMENT (DSP)
              </h2>
              <p className="text-xs text-slate-500">
                ការកែលម្អគុណភាពសំឡេង និង Master Output កម្រិតរោងភាពយន្ត
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Quick Presets */}
          <div>
            <span className="text-xs font-bold text-slate-800 block mb-2">
              Preset ឆាប់រហ័ស (Quick Presets)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => applyPreset('cinema')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  local.preset === 'cinema'
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs text-slate-900 mb-1">Cinema Master</div>
                <div className="text-[10px] text-slate-500">តុល្យភាពសំឡេង & BGM កម្រិតរោងកុន</div>
              </button>

              <button
                onClick={() => applyPreset('podcast')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  local.preset === 'podcast'
                    ? 'border-purple-600 bg-purple-50/60 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs text-slate-900 mb-1">Podcast / Story</div>
                <div className="text-[10px] text-slate-500">សំឡេងនិយាយច្បាស់ ផ្តោតលើការនិទាន</div>
              </button>

              <button
                onClick={() => applyPreset('music_focus')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  local.preset === 'music_focus'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs text-slate-900 mb-1">Music Focus</div>
                <div className="text-[10px] text-slate-500">រក្សាសាច់ភ្លេងខ្លាំង ឈុតរំភើប</div>
              </button>
            </div>
          </div>

          {/* Dialogue Controls */}
          <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/30">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span>Voice Enhancement (សំឡេងនិយាយ)</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>កម្រិតភាពកក់ក្តៅ (Warmth):</span>
                  <span className="font-mono font-semibold text-blue-600">{local.warmth}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={local.warmth}
                  onChange={(e) => setLocal({ ...local, warmth: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>ភាពច្បាស់ (Clarity & Presence):</span>
                  <span className="font-mono font-semibold text-blue-600">{local.presence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={local.presence}
                  onChange={(e) => setLocal({ ...local, presence: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">កាត់បន្ថយសំឡេងរំខាន (AI Denoise):</span>
                <input
                  type="checkbox"
                  checked={local.denoise}
                  onChange={(e) => setLocal({ ...local, denoise: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* BGM Controls */}
          <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/30">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Music className="w-4 h-4 text-emerald-600" />
              <span>BGM & Auto-Ducking (ភ្លេងផ្ទៃខាងក្រោយ)</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>កម្រិតសំឡេង BGM (Volume):</span>
                  <span className="font-mono font-semibold text-emerald-600">{local.bgmVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={local.bgmVolume}
                  onChange={(e) => setLocal({ ...local, bgmVolume: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-800 font-medium">Auto-Ducking ស្វ័យប្រវត្តិ</div>
                  <div className="text-[10px] text-slate-500">បន្ថយសំឡេង BGM -12dB នៅពេលតួអង្គកំពុងនិយាយ</div>
                </div>
                <input
                  type="checkbox"
                  checked={local.autoDucking}
                  onChange={(e) => setLocal({ ...local, autoDucking: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Master Output */}
          <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-purple-600" />
              <div>
                <span className="font-bold text-slate-800 block">Cinema Loudness Standard</span>
                <span className="text-[10px] text-slate-500">ស្តង់ដារ -16 LUFS | True Peak Limiter: -1.0 dB</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold text-xs">
              -16 LUFS
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
            បោះបង់
          </button>
          <button
            onClick={() => {
              onSaveSettings(local);
              onClose();
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Check className="w-4 h-4" />
            <span>អនុវត្តការកំណត់</span>
          </button>
        </div>
      </div>
    </div>
  );
};
