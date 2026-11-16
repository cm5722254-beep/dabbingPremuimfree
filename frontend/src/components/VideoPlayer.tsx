import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Upload, Film } from 'lucide-react';
import { SubtitleLine } from '../types';

interface VideoPlayerProps {
  videoSrc: string | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  subtitles: SubtitleLine[];
  onVideoSelected: (file: File) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  currentTime,
  onTimeUpdate,
  subtitles,
  onVideoSelected
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleLine | null>(null);

  // Sync seek with video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync active subtitle
  useEffect(() => {
    const active = subtitles.find(s => currentTime >= s.start && currentTime <= s.end);
    setActiveSubtitle(active || null);
  }, [currentTime, subtitles]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const formatSec = (sec: number) => {
    if (isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onVideoSelected(e.target.files[0]);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-card">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/mkv,video/webm,video/avi"
        className="hidden"
      />

      {/* Video Viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-slate-950 overflow-hidden">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center text-slate-400 font-khmer gap-3 cursor-pointer hover:text-slate-200 transition-colors p-6 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg">
              <Upload className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">ចុចទីនេះដើម្បីបញ្ចូលវីដេអូ</p>
              <p className="text-xs text-slate-500 mt-0.5">គាំទ្រទម្រង់ MP4, MKV, WebM</p>
            </div>
          </div>
        )}

        {/* Real-time Subtitle Overlay */}
        {activeSubtitle && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90%] text-center pointer-events-none transition-all">
            {activeSubtitle.khmer_text && (
              <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl inline-block mb-1">
                <span className="font-khmer font-bold text-base md:text-lg text-yellow-300 drop-shadow-sm">
                  {activeSubtitle.khmer_text}
                </span>
                {activeSubtitle.emotion && activeSubtitle.emotion !== 'neutral' && (
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 font-khmer">
                    {activeSubtitle.emotion}
                  </span>
                )}
              </div>
            )}

            {activeSubtitle.text && (
              <div className="text-slate-300 text-xs font-sans drop-shadow-sm">
                {activeSubtitle.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Control Bar */}
      <div className="h-12 bg-white px-4 flex items-center justify-between border-t border-slate-200 text-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-900 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
            }}
            title="ត្រឡប់ទៅដើម"
            className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-slate-500">
            {formatSec(currentTime)} / {formatSec(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="ផ្លាស់ប្តូរវីដេអូ"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-khmer text-slate-700 transition-colors"
          >
            <Film className="w-3.5 h-3.5 text-slate-500" />
            <span>ជ្រើសរើសវីដេអូ</span>
          </button>

          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.requestFullscreen();
              }
            }}
            className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
