import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Tuple

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "whisper_models")
FFMPEG_BIN = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "media-engine", "bin", "ffmpeg.exe")

def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def extract_mono_wav(video_or_audio: str, output_wav: str) -> None:
    cmd = [
        FFMPEG_BIN if os.path.exists(FFMPEG_BIN) else "ffmpeg",
        "-y",
        "-i", video_or_audio,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "wav",
        output_wav
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg extraction failed: {res.stderr.decode('utf-8', errors='ignore')[-200:]}")

def transcribe_audio(file_path: str, model_size: str = "base", language: str = "auto") -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Transcribes audio/video using Faster-Whisper with VAD filtering and timestamps.
    """
    from faster_whisper import WhisperModel
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

    wav_tmp = file_path
    cleanup_wav = False
    if not file_path.lower().endswith(".wav"):
        wav_tmp = str(Path(file_path).with_suffix(".temp.16k.wav"))
        extract_mono_wav(file_path, wav_tmp)
        cleanup_wav = True

    try:
        # Check GPU or CPU
        device = "cpu"
        compute_type = "int8"
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"
        except Exception:
            pass

        print(f"[WhisperService] Loading {model_size} on {device} ({compute_type})...")
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root=MODELS_DIR,
            num_workers=2
        )

        lang_param = None if language in ("auto", "", None) else language
        segments, info = model.transcribe(
            wav_tmp,
            language=lang_param,
            beam_size=5,
            vad_filter=True,
            word_timestamps=True,
            vad_parameters=dict(
                threshold=0.45,
                min_speech_duration_ms=180,
                max_speech_duration_s=7,
                min_silence_duration_ms=250,
                speech_pad_ms=150
            ),
            condition_on_previous_text=True
        )

        results = []
        for idx, seg in enumerate(segments):
            txt = (seg.text or "").strip()
            if not txt:
                continue
            results.append({
                "id": idx,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "duration": round(seg.end - seg.start, 3),
                "start_time": format_timestamp(seg.start),
                "end_time": format_timestamp(seg.end),
                "speaker": f"Speaker_{(idx % 2) + 1}",
                "text": txt,
                "khmer_text": "",
                "emotion": "neutral"
            })

        meta = {
            "language": info.language,
            "duration": round(info.duration, 2),
            "language_probability": round(info.language_probability, 3)
        }
        return results, meta
    finally:
        if cleanup_wav and os.path.exists(wav_tmp):
            try:
                os.remove(wav_tmp)
            except Exception:
                pass

