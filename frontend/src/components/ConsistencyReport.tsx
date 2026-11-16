import React from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Wrench } from 'lucide-react';
import { CharacterVoiceAssignment } from '../types';

interface ConsistencyReportProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Record<string, CharacterVoiceAssignment>;
  onAutoFix: () => void;
}

export const ConsistencyReport: React.FC<ConsistencyReportProps> = ({
  isOpen,
  onClose,
  assignments,
  onAutoFix
}) => {
  if (!isOpen) return null;

  const voiceUsage: Record<string, string[]> = {};
  Object.entries(assignments).forEach(([speaker, assign]) => {
    const key = assign.voiceKey || 'unassigned';
    if (!voiceUsage[key]) voiceUsage[key] = [];
    voiceUsage[key].push(speaker);
  });

  const conflicts = Object.entries(voiceUsage).filter(([_, speakers]) => speakers.length > 1);
  const isHealthy = conflicts.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-khmer">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-modal flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              របាយការណ៍ពិនិត្យសំឡេង (Voice Consistency Enforcer)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            isHealthy 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {isHealthy ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <div className="font-bold text-xs">
                {isHealthy ? 'សំឡេងទាំងអស់ត្រូវគ្នាល្អឥតខ្ចោះ (100% Consistent)' : 'រកឃើញទំនាស់សំឡេង (Voice Conflicts)'}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {isHealthy 
                  ? 'តួអង្គនីមួយៗមានសំឡេងរៀងៗខ្លួនត្រឹមត្រូវ គ្មានការជាន់សំឡេងគ្នាឡើយ។' 
                  : `មានតួអង្គ ${conflicts.length} គូ កំពុងប្រើប្រាស់សំឡេងដូចគ្នា។`}
              </div>
            </div>
          </div>

          {!isHealthy && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800">បញ្ជីទំនាស់សំឡេង:</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden text-xs">
                {conflicts.map(([voiceKey, speakers]) => (
                  <div key={voiceKey} className="p-3 flex justify-between items-center">
                    <span className="font-mono text-blue-600 font-semibold">{voiceKey}</span>
                    <span className="text-amber-700 font-medium">{speakers.join(' & ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          {!isHealthy && (
            <button
              onClick={() => {
                onAutoFix();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>កែសម្រួលស្វ័យប្រវត្តិ (Auto-Fix)</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            បិទ
          </button>
        </div>
      </div>
    </div>
  );
};
