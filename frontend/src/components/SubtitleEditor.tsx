import React, { useState, useRef } from 'react';
import { 
  Languages, 
  Volume2, 
  Search, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  CheckCircle,
  FileText
} from 'lucide-react';
import { SubtitleLine, EmotionKey } from '../types';
import { parseSRT, exportSRT } from '../services/api';

interface SubtitleEditorProps {
  subtitles: SubtitleLine[];
  onUpdateLine: (id: number, updated: Partial<SubtitleLine>) => void;
  onAddLine: () => void;
  onDeleteLine: (id: number) => void;
  onImportSRT: (lines: SubtitleLine[]) => void;
  onBatchTranslate: () => void;
  onSynthesizeLine: (line: SubtitleLine) => void;
  onSelectLine: (line: SubtitleLine) => void;
  selectedLineId: number | null;
  isTranslating: boolean;
}

const EMOTIONS_LIST: Array<{ key: EmotionKey; label: string; badgeClass: string }> = [
  { key: 'neutral', label: 'ធម្មតា', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  { key: 'love', label: 'ស្នេហា', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'anger', label: 'ខឹង', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'fear', label: 'ភ័យ', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'joy', label: 'សប្បាយ', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'sad', label: 'ក្រៀមក្រំ', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'surprise', label: 'ភ្ញាក់ផ្អើល', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'shout', label: 'ស្រែក', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'crying', label: 'យំ', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'laughter', label: 'សើច', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  { key: 'kid', label: 'កុមារ', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'elder', label: 'ចាស់', badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' },
  { key: 'villain', label: 'មនុស្សអាក្រក់', badgeClass: 'bg-zinc-800 text-zinc-100 border-zinc-900' },
  { key: 'thought', label: 'ក្នុងចិត្ត', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'pleading', label: 'អង្វរ', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  { key: 'bored', label: 'ធុញ', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'sarcastic', label: 'ចំអក', badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  { key: 'excited', label: 'រំភើប', badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { key: 'cool', label: 'ឡូយ', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'royal', label: 'រាជវង្ស', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300' }
];

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  subtitles,
  onUpdateLine,
  onAddLine,
  onDeleteLine,
  onImportSRT,
  onBatchTranslate,
  onSynthesizeLine,
  onSelectLine,
  selectedLineId,
  isTranslating
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpeaker, setFilterSpeaker] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const speakers = Array.from(new Set(subtitles.map(s => s.speaker)));

  const filtered = subtitles.filter(line => {
    const matchesSearch = 
      line.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      line.khmer_text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpeaker = filterSpeaker === 'all' || line.speaker === filterSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseSRT(text);
          if (parsed.length > 0) {
            onImportSRT(parsed);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadSRT = () => {
    if (subtitles.length === 0) return;
    const content = exportSRT(subtitles);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_khmer_${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-card">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".srt,.vtt,.txt"
        className="hidden"
      />

      {/* Header Toolbar */}
      <div className="h-14 px-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
        {/* Left Title & Counter */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-xs text-slate-800 font-khmer">
            បញ្ជីអត្ថបទបកប្រែ
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-white text-slate-600 border border-slate-200 font-mono">
            {subtitles.length} ឃ្លា
          </span>
        </div>

        {/* Center: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ស្វែងរកអត្ថបទ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-khmer shadow-xs"
            />
          </div>

          <select
            value={filterSpeaker}
            onChange={(e) => setFilterSpeaker(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 font-sans shadow-xs"
          >
            <option value="all">តួអង្គទាំងអស់</option>
            {speakers.map(spk => (
              <option key={spk} value={spk}>{spk}</option>
            ))}
          </select>
        </div>

        {/* Right Actions: Import, Export, Add Line, Translate */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="បញ្ចូលឯកសារ SRT"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownloadSRT}
            title="ទាញយកឯកសារ SRT"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onAddLine}
            title="បន្ថែមឃ្លាថ្មី"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-khmer shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ថែមឃ្លា</span>
          </button>

          <button
            onClick={onBatchTranslate}
            disabled={isTranslating || subtitles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50 transition-all font-khmer"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{isTranslating ? 'កំពុងបកប្រែ...' : 'បកប្រែទាំងអស់'}</span>
          </button>
        </div>
      </div>

      {/* Subtitles Container / Empty State */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
        {subtitles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center font-khmer">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100">
              <FileText className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">មិនទាន់មានអត្ថបទ Subtitle នៅឡើយ</h4>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              អ្នកអាចបញ្ចូលឯកសារ .SRT ផ្ទាល់ ឬចុច "ថែមឃ្លា" ដើម្បីចាប់ផ្តើមបញ្ចូលអត្ថបទបកប្រែ។
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>បញ្ចូលឯកសារ .SRT</span>
              </button>
              <button
                onClick={onAddLine}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>បន្ថែមឃ្លាដោយដៃ</span>
              </button>
            </div>
          </div>
        ) : (
          filtered.map((line) => {
            const isSelected = line.id === selectedLineId;
            const currentEmotion = EMOTIONS_LIST.find(e => e.key === line.emotion) || EMOTIONS_LIST[0];

            return (
              <div
                key={line.id}
                onClick={() => onSelectLine(line)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                {/* Index & Timing */}
                <div className="flex flex-col items-center gap-1 w-16 shrink-0 pt-0.5">
                  <span className="text-[11px] font-mono text-slate-400">#{line.id + 1}</span>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {line.start_time.slice(3, 8)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {((line.end - line.start)).toFixed(1)}s
                  </span>
                </div>

                {/* Speaker & Emotion Badges */}
                <div className="flex flex-col gap-1.5 w-28 shrink-0">
                  <input
                    type="text"
                    value={line.speaker}
                    onChange={(e) => onUpdateLine(line.id, { speaker: e.target.value })}
                    className="text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                  />

                  {/* Emotion Dropdown */}
                  <select
                    value={line.emotion}
                    onChange={(e) => onUpdateLine(line.id, { emotion: e.target.value as EmotionKey })}
                    className={`text-[10px] font-khmer rounded-md px-2 py-0.5 border font-medium focus:outline-none ${currentEmotion.badgeClass}`}
                  >
                    {EMOTIONS_LIST.map(em => (
                      <option key={em.key} value={em.key}>
                        {em.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Text Fields */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) => onUpdateLine(line.id, { text: e.target.value })}
                    placeholder="អត្ថបទដើម..."
                    className="w-full text-xs text-slate-600 bg-transparent border-b border-slate-200/60 focus:border-blue-500 focus:outline-none pb-0.5 font-sans"
                  />

                  <textarea
                    value={line.khmer_text}
                    onChange={(e) => onUpdateLine(line.id, { khmer_text: e.target.value })}
                    placeholder="អត្ថបទបកប្រែជាភាសាខ្មែរនិយាយបែបភាពយន្ត..."
                    rows={2}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-lg p-2 text-xs font-khmer text-slate-900 placeholder-slate-400 focus:outline-none resize-none leading-relaxed transition-colors shadow-xs"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSynthesizeLine(line);
                    }}
                    title="បង្កើតសំឡេងនិយាយ"
                    className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-200 flex items-center justify-center transition-all shadow-xs"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLine(line.id);
                    }}
                    title="លុបឃ្លានេះ"
                    className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 flex items-center justify-center transition-all shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {line.audio_url && (
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
                      <CheckCircle className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
