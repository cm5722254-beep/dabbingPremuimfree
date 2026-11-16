import React from 'react';
import { X, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { SubtitleLine } from '../types';

interface MissingLineDetectorProps {
  isOpen: boolean;
  onClose: () => void;
  subtitles: SubtitleLine[];
  onRetryMissingLines: (missing: SubtitleLine[]) => void;
}

export const MissingLineDetector: React.FC<MissingLineDetectorProps> = ({
  isOpen,
  onClose,
  subtitles,
  onRetryMissingLines
}) => {
  if (!isOpen) return null;

  const missing = subtitles.filter(s => !s.khmer_text || !s.khmer_text.trim());
  const total = subtitles.length;
  const completed = total - missing.length;
  const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : '100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-khmer">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-modal flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              ប្រព័ន្ធស្វែងរកឃ្លាខ្វះ (Missing Lines Detector)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Progress Overview Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block mb-1">អត្រាជោគជ័យនៃការបកប្រែ:</span>
              <span className="text-2xl font-bold font-mono text-emerald-600">{rate}%</span>
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-700 font-medium">បានបញ្ចប់: {completed} / {total} ឃ្លា</div>
              <div className="text-amber-700 font-semibold">ខ្វះ: {missing.length} ឃ្លា</div>
            </div>
          </div>

          {missing.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center text-emerald-600 gap-2">
              <CheckCircle className="w-10 h-10" />
              <span className="text-xs font-bold text-slate-800">គ្មានឃ្លាណាខ្វះឡើយ</span>
              <span className="text-[11px] text-slate-500">គ្រប់ឃ្លាទាំងអស់ត្រូវបានបកប្រែពេញលេញ ១០០%។</span>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800">បញ្ជីឃ្លាដែលខ្វះការបកប្រែ:</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/40 max-h-60 overflow-y-auto custom-scrollbar text-xs">
                {missing.map(line => (
                  <div key={line.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 text-[10px]">#{line.id + 1}</span>
                      <span className="font-sans text-slate-700">{line.text}</span>
                    </div>
                    <span className="font-mono text-[10px] text-amber-600 shrink-0">{line.start_time.slice(3, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          {missing.length > 0 && (
            <button
              onClick={() => {
                onRetryMissingLines(missing);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>បកប្រែឃ្លាខ្វះឡើងវិញ (Batch Retry)</span>
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
