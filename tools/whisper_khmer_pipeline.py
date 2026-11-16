#!/usr/bin/env python3
"""
whisper_khmer_pipeline.py
=========================
A complete, production-grade ASR & Khmer Subtitle Translation Pipeline:
  Step 2: Speech-to-Text with Timestamps using Faster-Whisper
  Step 3: Subtitle Translation to Khmer using Local Ollama (Qwen2.5 / DeepSeek) or Fallback Engine

Author: Antigravity AI Engine
"""

import os
import sys
import json
import argparse
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path

def log(msg, level="INFO"):
    print(f"[{level}] [Whisper-Khmer-Pipeline] {msg}", file=sys.stderr, flush=True)

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT millisecond timestamp: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def extract_wav(input_path: str, wav_path: str, ffmpeg_exe: str = "ffmpeg"):
    """Extract 16kHz mono WAV from audio or video file."""
    cmd = [
        ffmpeg_exe, "-y",
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "wav",
        wav_path
    ]
    log(f"Extracting 16kHz WAV from '{os.path.basename(input_path)}'...")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {res.stderr.decode('utf-8', errors='ignore')[-300:]}")

def transcribe_with_whisper(wav_path: str, model_size: str = "base", language: str = "zh", model_dir: str = None):
    """
    Step 2: ASR & Timestamps
    បញ្ជូន Audio ទៅ Faster-Whisper ដើម្បីទទួលបាន Subtitle ដែលមាន Timestamps កម្រិតមីលីវិនាទី
    """
    from faster_whisper import WhisperModel
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

    if model_dir is None:
        model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "whisper_models")
    os.makedirs(model_dir, exist_ok=True)

    log(f"Loading Faster-Whisper ({model_size}) on CPU/int8...")
    model = None
    for candidate in [model_size, 'base', 'small', 'tiny']:
        try:
            model = WhisperModel(
                candidate,
                device="cpu",
                compute_type="int8",
                download_root=model_dir,
                num_workers=2
            )
            log(f"Successfully loaded Faster-Whisper model: {candidate}")
            break
        except Exception as e:
            log(f"Candidate model '{candidate}' failed: {e}. Trying fallback...", "WARN")

    if model is None:
        raise RuntimeError("Failed to load any Faster-Whisper model.")

    log(f"Transcribing audio with language='{language}' & VAD filter...")
    segments, info = model.transcribe(
        wav_path,
        language=language if language and language != "auto" else None,
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
    for seg in segments:
        text = (seg.text or "").strip()
        if not text:
            continue
        results.append({
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "start_time": format_timestamp(seg.start),
            "end_time": format_timestamp(seg.end),
            "text": text
        })

    log(f"Transcribed {len(results)} segments successfully (Detected Lang: {info.language}, Duration: {info.duration:.2f}s).")
    return results, info

def check_ollama_available(ollama_url: str = "http://127.0.0.1:11434"):
    """Check if Ollama service is running and return list of available models."""
    try:
        req = urllib.request.Request(f"{ollama_url}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name", "") for m in data.get("models", [])]
            return True, models
    except Exception:
        return False, []

def translate_batch_with_ollama(texts: list, model_name: str = "qwen2.5", ollama_url: str = "http://127.0.0.1:11434"):
    """
    Step 3: Translate subtitle texts into natural Khmer using Local Ollama (Qwen2.5 / DeepSeek).
    Preserves exact count and order of lines.
    """
    input_items = [{"id": i, "text": t} for i, t in enumerate(texts)]
    
    prompt = f"""You are a professional film dialogue translator and dubbing director specializing in translating movie subtitles into natural spoken Khmer (ភាសានិយាយភាពយន្តបែបខ្មែរ).
Translate each line into fluent, spoken film Khmer.
Rules:
1. Use natural spoken conversational tone suitable for film dubbing (e.g., ណា, ណ៎, ហ្មង, តើ, អញ្ចឹង, វើយ, ចា៎...).
2. Maintain natural pronouns (បង, អូន, ឯង, ខ្ញុំ, លោក, នាង...).
3. Keep the translation concise to fit video subtitle timing.
4. Output STRICTLY a valid JSON array of objects with the exact same count:
[
  {{"id": 0, "khmer": "អត្ថបទបកប្រែជាភាសាខ្មែរ"}}
]

Lines to translate:
{json.dumps(input_items, ensure_ascii=False, indent=2)}"""

    payload = json.dumps({
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{ollama_url}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=90) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        response_text = result.get("response", "")
        parsed = json.loads(response_text)
        
        # Format might be array or dict containing list
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break

        trans_map = {}
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and "id" in item:
                    trans_map[item["id"]] = item.get("khmer", "")

        return [trans_map.get(i, texts[i]) for i in range(len(texts))]

def translate_fallback_google(text: str) -> str:
    """Fallback Google Translation for Khmer when Ollama is offline or unpulled."""
    if not text.strip():
        return ""
    try:
        url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=km&q={urllib.parse.quote(text)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 0:
                item = data[0]
                if isinstance(item, list) and len(item) > 0:
                    return str(item[0])
                elif isinstance(item, str):
                    return item
    except Exception:
        pass
    return text

def translate_segments_to_khmer(segments: list, model_name: str = "qwen2.5", ollama_url: str = "http://127.0.0.1:11434"):
    """
    Step 3: Subtitle Translation to Khmer while strictly keeping Timestamps
    """
    is_available, available_models = check_ollama_available(ollama_url)
    
    use_ollama = False
    chosen_model = model_name

    if is_available and len(available_models) > 0:
        # Match preferred model or pick first available
        matched = [m for m in available_models if model_name in m or "qwen" in m.lower() or "deepseek" in m.lower()]
        chosen_model = matched[0] if matched else available_models[0]
        use_ollama = True
        log(f"Ollama detected with models: {available_models}. Using model: '{chosen_model}'")
    else:
        if is_available:
            log("Ollama is running, but no models found. (Tip: run `ollama pull qwen2.5:3b` or `ollama pull qwen2.5`)", "WARN")
        else:
            log("Ollama is not running. Using high-speed fallback translator.", "WARN")

    translated_segments = []
    BATCH_SIZE = 15

    for i in range(0, len(segments), BATCH_SIZE):
        batch = segments[i:i + BATCH_SIZE]
        texts = [seg["text"] for seg in batch]

        translated_texts = []
        if use_ollama:
            try:
                translated_texts = translate_batch_with_ollama(texts, chosen_model, ollama_url)
            except Exception as e:
                log(f"Ollama batch translation error: {e}. Falling back to Google.", "WARN")
                translated_texts = [translate_fallback_google(t) for t in texts]
        else:
            translated_texts = [translate_fallback_google(t) for t in texts]

        for seg, km_text in zip(batch, translated_texts):
            translated_segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "start_time": seg["start_time"],
                "end_time": seg["end_time"],
                "original_text": seg["text"],
                "khmer_text": km_text
            })

    return translated_segments

def write_srt_file(segments: list, out_path: str, text_key: str = "text"):
    """Save segments to standard SRT subtitle file."""
    with open(out_path, "w", encoding="utf-8") as f:
        for idx, seg in enumerate(segments, start=1):
            f.write(f"{idx}\n")
            f.write(f"{seg['start_time']} --> {seg['end_time']}\n")
            f.write(f"{seg.get(text_key, '')}\n\n")
    log(f"SRT saved: {out_path}")

def main():
    parser = argparse.ArgumentParser(description="Whisper & Khmer Translation Subtitle Pipeline")
    parser.add_argument("--input", required=True, help="Input video or audio file path")
    parser.add_argument("--output-dir", default=None, help="Directory to save output files (defaults to input dir)")
    parser.add_argument("--language", default="zh", help="Source language for Whisper (e.g. 'zh' for Chinese, 'auto')")
    parser.add_argument("--whisper-model", default="base", help="Whisper model size (tiny, base, small, medium)")
    parser.add_argument("--ollama-model", default="qwen2.5", help="Ollama model for Khmer translation (e.g. qwen2.5, deepseek-r1)")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434", help="Ollama API base URL")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="Path to ffmpeg executable")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    if not os.path.exists(input_path):
        log(f"Error: Input file '{input_path}' not found!", "ERROR")
        sys.exit(1)

    out_dir = os.path.abspath(args.output_dir) if args.output_dir else os.path.dirname(input_path)
    os.makedirs(out_dir, exist_ok=True)
    base_name = Path(input_path).stem

    temp_wav = os.path.join(out_dir, f"temp_{base_name}_{os.getpid()}.wav")
    orig_srt_path = os.path.join(out_dir, f"{base_name}_original.srt")
    khmer_srt_path = os.path.join(out_dir, f"{base_name}_khmer.srt")
    json_path = os.path.join(out_dir, f"{base_name}_subtitles.json")

    try:
        # 1. Extract WAV
        extract_wav(input_path, temp_wav, args.ffmpeg)

        # 2. Faster-Whisper ASR & Timestamps
        log("=== STEP 2: Faster-Whisper ASR & Timestamps ===")
        raw_segments, info = transcribe_with_whisper(
            temp_wav,
            model_size=args.whisper_model,
            language=args.language
        )

        if not raw_segments:
            log("No speech segments detected.", "WARN")
            return

        # Write Original SRT
        write_srt_file(raw_segments, orig_srt_path, text_key="text")

        # 3. Khmer Translation with Ollama / Fallback
        log("=== STEP 3: Subtitle Translation to Khmer ===")
        translated_segments = translate_segments_to_khmer(
            raw_segments,
            model_name=args.ollama_model,
            ollama_url=args.ollama_url
        )

        # Write Khmer SRT
        write_srt_file(translated_segments, khmer_srt_path, text_key="khmer_text")

        # Write complete JSON
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({
                "source_file": input_path,
                "detected_language": info.language,
                "duration": round(info.duration, 2),
                "subtitles": translated_segments
            }, f, ensure_ascii=False, indent=2)
        log(f"JSON saved: {json_path}")

        print(json.dumps({
            "success": True,
            "segments_count": len(translated_segments),
            "original_srt": orig_srt_path,
            "khmer_srt": khmer_srt_path,
            "json_file": json_path
        }))

    finally:
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass

if __name__ == "__main__":
    main()
