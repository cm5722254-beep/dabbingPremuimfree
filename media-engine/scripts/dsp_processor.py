#!/usr/bin/env python3
"""
DSP Media Engine: FFmpeg CLI Wrapper with NVENC/CUDA hardware acceleration
- Segment cutting
- Time-stretching (atempo)
- Auto-ducking BGM
- Cinema Master Loudness (-16 LUFS)
- NVENC Video Encoding
"""

import os
import sys
import json
import subprocess
from pathlib import Path

FFMPEG_BIN = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin", "ffmpeg.exe")
if not os.path.exists(FFMPEG_BIN):
    FFMPEG_BIN = "ffmpeg"

def test_nvenc_available() -> bool:
    try:
        res = subprocess.run([FFMPEG_BIN, "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return b"h264_nvenc" in res.stdout
    except Exception:
        return False

def render_dubbed_video(video_path: str, speech_audio_path: str, bgm_audio_path: str, output_path: str, preset_name: str = "cinema"):
    presets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "presets")
    preset_file = os.path.join(presets_dir, f"{preset_name}.json")
    preset = {
        "target_lufs": -16.0,
        "true_peak": -1.0,
        "ducking_db": -12.0,
        "bgm_volume": 0.25
    }
    if os.path.exists(preset_file):
        with open(preset_file, "r", encoding="utf-8") as f:
            preset = json.load(f)

    use_nvenc = test_nvenc_available()
    vcodec = "h264_nvenc" if use_nvenc else "libx264"
    print(f"[MediaEngine] Video Encoder: {vcodec} (Hardware Accel: {use_nvenc})")

    # FFmpeg command mixing dialogue, ducking BGM, and combining with video
    cmd = [
        FFMPEG_BIN, "-y",
        "-i", video_path,
        "-i", speech_audio_path,
    ]
    if bgm_audio_path and os.path.exists(bgm_audio_path):
        cmd.extend(["-i", bgm_audio_path])
        filter_complex = (
            f"[2:a]volume={preset.get('bgm_volume', 0.25)}[bgm];"
            f"[bgm][1:a]sidechaincompress=threshold=0.08:ratio=4:attack=50:release=300[ducked];"
            f"[ducked][1:a]amix=inputs=2:duration=longest[mixed];"
            f"[mixed]loudnorm=I={preset.get('target_lufs', -16)}:TP={preset.get('true_peak', -1)}:LRA=11[aout]"
        )
        cmd.extend(["-filter_complex", filter_complex, "-map", "0:v", "-map", "[aout]"])
    else:
        cmd.extend([
            "-filter_complex", f"[1:a]loudnorm=I={preset.get('target_lufs', -16)}:TP={preset.get('true_peak', -1)}:LRA=11[aout]",
            "-map", "0:v", "-map", "[aout]"
        ])

    cmd.extend([
        "-c:v", vcodec,
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "256k",
        "-shortest",
        output_path
    ])

    print(f"[MediaEngine] Executing: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    print(f"[MediaEngine] Rendering successfully completed -> {output_path}")

if __name__ == "__main__":
    print(f"[MediaEngine] Initialized with binary: {FFMPEG_BIN}")
    print(f"[MediaEngine] NVENC Hardware Acceleration: {test_nvenc_available()}")

