import React from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-khmer">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-modal flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">
            តើអ្នកពិតជាចង់រីសិតគម្រោងនេះមែនទេ?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            សកម្មភាពនេះនឹងសម្អាតទិន្នន័យ Subtitle ទាំងអស់ វីដេអូដែលបានបញ្ចូល និង Audio Cache ទាំងអស់ដើម្បីចាប់ផ្តើមគម្រោងថ្មីពីដំបូង។
          </p>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>ទិន្នន័យដែលបានលុបមិនអាចត្រឡប់ក្រោយវិញបានឡើយ។</span>
          </div>
        </div>

        <div className="h-16 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 transition-colors"
          >
            បោះបង់
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm transition-all"
          >
            យល់ព្រម រីសិតទាំងអស់
          </button>
        </div>
      </div>
    </div>
  );
};

