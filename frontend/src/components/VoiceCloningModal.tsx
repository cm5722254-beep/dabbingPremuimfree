import React, { useState } from 'react';
import { X, Mic, Film, BookOpen, Sparkles, Check } from 'lucide-react';
import { CharacterVoiceAssignment } from '../types';

interface VoiceCloningModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Record<string, CharacterVoiceAssignment>;
  onSaveAssignments: (updated: Record<string, CharacterVoiceAssignment>) => void;
}

const VOICE_LIBRARY_ROLES = [
  { key: 'lead_male', name: 'ឯកប្រុស (Hero / Lead Male)', gender: 'male' },
  { key: 'lead_female', name: 'ឯកស្រី (Heroine / Lead Female)', gender: 'female' },
  { key: 'elder_male', name: 'ចាស់ទុំប្រុស (Wise Elder)', gender: 'male' },
  { key: 'villain', name: 'មនុស្សអាក្រក់ (Villain / Boss)', gender: 'male' },
  { key: 'child_boy', name: 'ក្មេងប្រុស (Little Boy)', gender: 'male' },
  { key: 'child_girl', name: 'ក្មេងស្រី (Little Girl)', gender: 'female' },
  { key: 'commander', name: 'មេទ័ព / ឧត្តមសេនីយ៍ (Commander)', gender: 'male' }
];

export const VoiceCloningModal: React.FC<VoiceCloningModalProps> = ({
  isOpen,
  onClose,
  assignments,
  onSaveAssignments
}) => {
  const [localAssignments, setLocalAssignments] = useState<Record<string, CharacterVoiceAssignment>>(assignments);
  const [activeTabMode, setActiveTabMode] = useState<'clone_from_original' | 'clone_from_library'>('clone_from_library');

  if (!isOpen) return null;

  const handleModeChange = (speaker: string, mode: 'clone_from_original' | 'clone_from_library') => {
    setLocalAssignments(prev => ({
      ...prev,
      [speaker]: {
        ...prev[speaker],
        mode
      }
    }));
  };

  const handleVoiceKeyChange = (speaker: string, voiceKey: string) => {
    const role = VOICE_LIBRARY_ROLES.find(r => r.key === voiceKey);
    setLocalAssignments(prev => ({
      ...prev,
      [speaker]: {
        ...prev[speaker],
        voiceKey,
        gender: (role?.gender as 'male' | 'female') || 'male'
      }
    }));
  };

  const handleSave = () => {
    onSaveAssignments(localAssignments);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-khmer">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-modal flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-16 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                VOXCPM2 DUAL MODE CLONING STUDIO
              </h2>
              <p className="text-xs text-slate-500">
                ជ្រើសរើសវិធីសាស្រ្តចម្លងសំឡេងតួអង្គ (48kHz Studio Quality)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Dual Mode Selector Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Mode 1 */}
            <div
              onClick={() => setActiveTabMode('clone_from_original')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                activeTabMode === 'clone_from_original'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Mode 1: Clone ពីរឿងដើម</h3>
                  <span className="text-[10px] text-blue-600 font-semibold">100% ដូចសំឡេងដើម</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                ដកស្រង់សំឡេងតួអង្គនីមួយៗពីវីដេអូដើម រួចបំប្លែងឱ្យនិយាយភាសាខ្មែរដោយរក្សាទឹកដមដើមគ្រប់បែបយ៉ាង។
              </p>
            </div>

            {/* Mode 2 */}
            <div
              onClick={() => setActiveTabMode('clone_from_library')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                activeTabMode === 'clone_from_library'
                  ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Mode 2: Clone ពី Voice Library</h3>
                  <span className="text-[10px] text-purple-600 font-semibold">សំឡេងពីបន្ទប់ស្ទូឌីយោ</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                ជ្រើសរើសសំឡេងតួអង្គជំនាញពីបណ្ណាល័យសំឡេង (ឯកប្រុស, ឯកស្រី, ចាស់ទុំ, មនុស្សអាក្រក់, កុមារ)។
              </p>
            </div>
          </div>

          {/* Character Assignments List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                ការចាត់តាំងសំឡេងតួអង្គ (Character Assignments)
              </h4>
              <button
                onClick={() => {
                  const updated: Record<string, CharacterVoiceAssignment> = {};
                  Object.keys(localAssignments).forEach((speaker, i) => {
                    const role = VOICE_LIBRARY_ROLES[i % VOICE_LIBRARY_ROLES.length];
                    updated[speaker] = {
                      speakerId: speaker,
                      characterName: role.name,
                      mode: activeTabMode,
                      voiceKey: role.key,
                      gender: role.gender as 'male' | 'female'
                    };
                  });
                  setLocalAssignments(updated);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-blue-600 font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Assign ស្វ័យប្រវត្តិ</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/40 overflow-hidden">
              {Object.keys(localAssignments).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  មិនទាន់មានតួអង្គនៅឡើយ។ សូមបញ្ចូល Subtitle ជាមុនសិន។
                </div>
              ) : (
                Object.keys(localAssignments).map((speaker) => {
                  const item = localAssignments[speaker];
                  return (
                    <div key={speaker} className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-mono font-bold text-slate-700 shadow-xs">
                          {speaker.slice(-2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{speaker}</div>
                          <div className="text-[10px] text-slate-500">
                            {item.mode === 'clone_from_original' ? 'រឿងដើម' : 'Voice Library'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={item.mode}
                          onChange={(e) => handleModeChange(speaker, e.target.value as any)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
                        >
                          <option value="clone_from_library">Mode 2: Voice Library</option>
                          <option value="clone_from_original">Mode 1: Clone រឿងដើម</option>
                        </select>

                        <select
                          value={item.voiceKey}
                          onChange={(e) => handleVoiceKeyChange(speaker, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
                        >
                          {VOICE_LIBRARY_ROLES.map(role => (
                            <option key={role.key} value={role.key}>{role.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-16 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            ត្រួតពិនិត្យដោយប្រព័ន្ធ Voice Consistency Enforcer
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              បោះបង់
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>រក្សាទុក និងអនុវត្ត</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
