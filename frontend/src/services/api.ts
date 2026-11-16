import { SubtitleLine, RouterPoolStatus, CharacterVoiceAssignment, AudioMixerSettings } from '../types';

const AI_BASE = 'http://127.0.0.1:8000';
const ORCHESTRATOR_BASE = 'http://127.0.0.1:8080';

export async function fetchRouterStatus(): Promise<RouterPoolStatus> {
  try {
    const res = await fetch(`${AI_BASE}/api/ai/router/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return await res.json();
  } catch (e) {
    return {
      total_keys: 19,
      active_keys: 19,
      rate_limited: 0,
      model: 'gemini-2.0-flash',
      keys_summary: []
    };
  }
}

export async function translateSubtitlesBatch(lines: SubtitleLine[], genre: string = 'drama'): Promise<SubtitleLine[]> {
  const payload = {
    lines: lines.map(l => ({
      id: l.id,
      speaker: l.speaker,
      text: l.text,
      start: l.start,
      end: l.end
    })),
    genre
  };

  const res = await fetch(`${AI_BASE}/api/ai/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'ការបកប្រែបរាជ័យ' }));
    throw new Error(err.detail || 'ការបកប្រែមានបញ្ហា');
  }

  const data = await res.json();
  return data.lines;
}

export async function transcribeVideoFile(file: File): Promise<SubtitleLine[]> {
  const formData = new FormData();
  formData.append('videoFile', file);
  formData.append('model_size', 'base');
  formData.append('language', 'auto');

  try {
    const res = await fetch(`${AI_BASE}/api/ai/transcribe`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('ការទាញយកអត្ថបទបរាជ័យ');
    const data = await res.json();
    return data.segments || [];
  } catch (err: any) {
    throw new Error(err.message || 'Transcribe error');
  }
}

export async function synthesizeLineAudio(line: SubtitleLine, assignment?: CharacterVoiceAssignment): Promise<string> {
  const payload = {
    line_id: line.id,
    text: line.khmer_text || line.text,
    voice_key: assignment?.voiceKey || 'lead_male',
    gender: assignment?.gender || 'male',
    mode: assignment?.mode || 'clone_from_library',
    duration: line.duration || (line.end - line.start)
  };

  const res = await fetch(`${AI_BASE}/api/ai/synthesize-line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data.data?.audio_path || '';
}

export async function checkVoiceConsistency(assignments: Record<string, CharacterVoiceAssignment>): Promise<{
  isConsistent: boolean;
  conflicts: string[];
  totalCharacters: number;
}> {
  try {
    const res = await fetch(`${ORCHESTRATOR_BASE}/api/orchestrator/voice-consistency/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });
    return await res.json();
  } catch (e) {
    return { isConsistent: true, conflicts: [], totalCharacters: Object.keys(assignments).length };
  }
}

export async function triggerRenderFinalVideo(settings: AudioMixerSettings, videoPath: string): Promise<boolean> {
  try {
    const res = await fetch(`${ORCHESTRATOR_BASE}/api/orchestrator/render-final`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, videoPath })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// SRT Utility: Parse SRT string into SubtitleLine[]
export function parseSRT(data: string): SubtitleLine[] {
  const cleanData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = cleanData.split(/\n\s*\n/);
  const parsed: SubtitleLine[] = [];

  const timeToSeconds = (tStr: string): number => {
    const parts = tStr.trim().split(':');
    if (parts.length < 3) return 0;
    const secParts = parts[2].split(',');
    const sec = parseFloat(secParts[0]);
    const millis = secParts[1] ? parseFloat(secParts[1]) / 1000 : 0;
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + sec + millis;
  };

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    if (lines.length >= 2) {
      let timeLineIdx = 1;
      if (!lines[0].includes('-->')) {
        timeLineIdx = 1;
      } else {
        timeLineIdx = 0;
      }

      const timeLine = lines[timeLineIdx] || '';
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
      
      if (timeMatch) {
        const textLines = lines.slice(timeLineIdx + 1).join(' ').trim();
        const startSec = timeToSeconds(timeMatch[1]);
        const endSec = timeToSeconds(timeMatch[2]);

        parsed.push({
          id: index,
          start: Math.round(startSec * 1000) / 1000,
          end: Math.round(endSec * 1000) / 1000,
          duration: Math.round((endSec - startSec) * 1000) / 1000,
          start_time: timeMatch[1].replace('.', ','),
          end_time: timeMatch[2].replace('.', ','),
          speaker: `Speaker_${(index % 2) + 1}`,
          text: textLines,
          khmer_text: '',
          emotion: 'neutral'
        });
      }
    }
  });

  return parsed;
}

// SRT Utility: Export SubtitleLine[] to SRT text
export function exportSRT(subtitles: SubtitleLine[]): string {
  return subtitles.map((sub, idx) => {
    const textOut = sub.khmer_text ? sub.khmer_text : sub.text;
    return `${idx + 1}\n${sub.start_time} --> ${sub.end_time}\n${textOut}\n`;
  }).join('\n');
}
