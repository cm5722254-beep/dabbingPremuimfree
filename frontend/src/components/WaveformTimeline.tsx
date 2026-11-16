import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Mic, Music, Layers } from 'lucide-react';
import { SubtitleLine } from '../types';

interface WaveformTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  subtitles: SubtitleLine[];
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  duration = 60,
  currentTime,
  onSeek,
  subtitles
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  const [isDragging, setIsDragging] = useState(false);

  const totalWidth = Math.max(900, duration * pixelsPerSecond);

  // 60 FPS Canvas rendering loop for light theme
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = totalWidth;
    const height = 150;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Canvas Background: Pure White / Slate 50
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Track 1: Time Ruler (Height: 24px)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, 24);
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(width, 24);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Inter, sans-serif';

    const stepSec = pixelsPerSecond > 60 ? 1 : pixelsPerSecond > 30 ? 2 : 5;
    for (let sec = 0; sec <= duration; sec += stepSec) {
      const x = sec * pixelsPerSecond;
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(x, 14, 1, 10);
      ctx.fillStyle = '#64748B';
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      ctx.fillText(`${min}:${s.toString().padStart(2, '0')}`, x + 4, 17);
    }

    // Track 2: Dialogue Subtitles (Y: 26 to 68)
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 26, width, 40);

    subtitles.forEach((sub) => {
      const x = sub.start * pixelsPerSecond;
      const w = Math.max(16, (sub.end - sub.start) * pixelsPerSecond);

      // Subtitle Box
      ctx.fillStyle = '#EEF2FF';
      ctx.beginPath();
      ctx.roundRect(x, 28, w, 36, 6);
      ctx.fill();

      ctx.strokeStyle = '#C7D2FE';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Mini Waveform representation inside subtitle block
      ctx.fillStyle = '#6366F1';
      const bars = Math.floor(w / 4);
      for (let i = 0; i < bars; i++) {
        const barH = 4 + Math.sin(i * 0.8) * 10 + ((i % 3) * 3);
        ctx.fillRect(x + i * 4 + 2, 46 - barH / 2, 2, barH);
      }

      // Subtitle Text Khmer
      ctx.fillStyle = '#1E1B4B';
      ctx.font = '10px "Kantumruy Pro", sans-serif';
      const textPreview = sub.khmer_text || sub.text;
      ctx.fillText(textPreview.slice(0, 18), x + 5, 40);
    });

    // Track 3: BGM Track with visual Auto-Ducking dips (Y: 68 to 106)
    ctx.fillStyle = '#F0FDF4';
    ctx.fillRect(0, 68, width, 38);
    ctx.fillStyle = '#10B981';
    for (let x = 0; x < width; x += 4) {
      const timeAtX = x / pixelsPerSecond;
      const isDialogueSpeaking = subtitles.some(s => timeAtX >= s.start && timeAtX <= s.end);
      // Auto-ducking visual dip
      const amplitude = isDialogueSpeaking ? 3 : 12;
      const barH = amplitude + (Math.sin(x * 0.2) * 3);
      ctx.fillRect(x, 87 - barH / 2, 2, barH);
    }

    // Track 4: Master Output Track (Y: 108 to 148)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 108, width, 40);
    ctx.fillStyle = '#0284C7';
    for (let x = 0; x < width; x += 3) {
      const h = 6 + Math.abs(Math.sin(x * 0.15)) * 12;
      ctx.fillRect(x, 128 - h / 2, 1.5, h);
    }

    // Playhead Scrubber (Red Line)
    const playheadX = currentTime * pixelsPerSecond;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(playheadX - 1, 0, 2, height);
    ctx.beginPath();
    ctx.arc(playheadX, 5, 5, 0, Math.PI * 2);
    ctx.fill();

  }, [duration, currentTime, pixelsPerSecond, subtitles, totalWidth]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleSeekFromEvent(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      handleSeekFromEvent(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSeekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, x / pixelsPerSecond));
    onSeek(newTime);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-card select-none">
      {/* Controls & Track Labels */}
      <div className="flex items-center justify-between text-xs px-2 text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
            <Mic className="w-3.5 h-3.5" />
            <span>Dialogue Track</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <Music className="w-3.5 h-3.5" />
            <span>BGM (Auto-Ducking)</span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-700 font-medium">
            <Layers className="w-3.5 h-3.5" />
            <span>Cinema Master</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPixelsPerSecond(p => Math.max(15, p - 10))}
            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500">{pixelsPerSecond}px/s</span>
          <button
            onClick={() => setPixelsPerSecond(p => Math.min(120, p + 10))}
            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Waveform Canvas */}
      <div 
        ref={containerRef} 
        className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white custom-scrollbar"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-pointer block"
          style={{ width: `${totalWidth}px`, height: '150px' }}
        />
      </div>
    </div>
  );
};
