# Cheatz Dubbing Studio Pro Next (v6.0)

Professional AI-Powered Video Dubbing, Drama Adaptation, and Multitrack Voiceover Studio.

---

## Overview

Cheatz Dubbing Studio Pro Next is a next-generation desktop application designed for automated drama translation, character voice cloning, multitrack audio post-production, and cinema-grade dubbing delivery. Built with an Apple HIG and Obsidian Cinema interface, the platform offers an end-to-end pipeline from raw video transcription to mastered release.

---

## Core System Architecture

The studio operates across four decoupled layers:

```
+--------------------------------------------------------------------------+
|                       1. Desktop Frontend Layer                          |
|    Apple HIG Cinema UI - Multitrack Waveform Canvas - Subtitle Grid      |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|                     2. Core Orchestrator & Backend                       |
|   Node.js Express Gateway - Project State - Gemini Multi-Key Pool        |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|                       3. AI Inference & Voice Layer                      |
| Faster-Whisper STT - Edge-TTS Khmer Neural - VoxCPM 2 Colab Server       |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|                      4. Media DSP & Audio Mastering                      |
| FFmpeg Accelerated Render - Sidechain Ducking - EBU R128 (-16 LUFS)      |
+--------------------------------------------------------------------------+
```

### 1. Presentation Layer (dist/index.html)
- Apple Human Interface Guidelines + Obsidian Cinema dark theme.
- Multitrack interactive canvas timeline supporting Video, Dialogue, BGM, and Master output tracks with 60+ FPS zoom and playhead scrubbing.
- Professional 8-column subtitle data grid with inline timecode editors, speaker assignment, emotion tags, speed sliders, and instant line auditioning.
- Web Audio API Sound Effects (SFX) button feedback engine.
- Zero-emoji design utilizing scalable vector SVG icons.

### 2. Core Orchestrator & API Router (server.js)
- Express REST API handling project state, uploads, transcriptions, and batch dubbing pipelines.
- Multi-Account Gemini API Key Router supporting 1,000+ API keys with intelligent round-robin load distribution and automatic failover.
- Hardware capability benchmark engine detecting CPU cores, memory limits, and GPU encoder acceleration (NVENC / QSV / AMF).

### 3. AI Voice Inference & Speech Processing (tools/)
- Edge-TTS Khmer Neural synthesis engine supporting custom rate, pitch (+0Hz to +50Hz), and character profiles (Piseth, Sreymom).
- Faster-Whisper pipeline with Voice Activity Detection (VAD) and millisecond-precision word timestamps.
- VoxCPM 2 Voice Cloning integration via local and Google Colab GPU backends.
- Automatic Character & Gender Detection engine categorizing speaker profiles into Male, Female, and Child with tailored emotion tagging.

### 4. Media Processing & Audio DSP (media-engine/ & tools/stitch_dub.py)
- Auto-ducking engine with -12dB BGM sidechain compression during dialogue segments.
- High-quality atempo time-stretching ensuring exact subtitle synchronization without audio distortion.
- Cinema standard audio mastering compliant with EBU R128 (-16 LUFS integrated loudness, -1.0 dB True Peak limiter).
- High-speed video muxing with hardburned Khmer Unicode subtitles using custom typography.

---

## Directory Structure

```
Cheatz Dubbing Studio Pro Next/
├── .gitignore                      # Git exclusion rules (large models, binaries, media)
├── LICENSE                         # MIT Open Source License
├── README.md                       # Comprehensive system documentation
├── package.json                    # Project dependencies and operational scripts
├── server.js                       # Primary backend server and API orchestrator
├── start_studio.bat                # One-click desktop launcher
│
├── dist/                           # Production web application & client assets
│   ├── index.html                  # Apple HIG Studio Interface
│   ├── css/                        # Tailored cinema styling sheets
│   └── js/                         # Client modules and state handlers
│
├── tools/                          # AI scripts, inference utilities, and font assets
│   ├── auto_transcribe.py          # Faster-Whisper automated transcription script
│   ├── edge_tts_helper.py          # Neural Edge-TTS Khmer synthesis engine
│   ├── stitch_dub.py               # Multitrack audio-video ducking and stitcher
│   ├── voxcpm2_colab_server.py     # VoxCPM 2 Colab cloud GPU bridge
│   ├── whisper_khmer_pipeline.py   # Specialized Khmer VAD pipeline
│   └── *.ttf                       # Khmer Unicode typography files
│
├── media-engine/                   # Media presets, DSP scripts, and processing profiles
│   ├── presets/                    # Audio profiles (Cinema, Music Focus, Podcast)
│   └── scripts/                    # DSP processors
│
├── router/                         # Multi-Account API Pool routing engines
├── ai-engine/                      # Additional AI inference modules
├── assets/                         # Static icons, vector graphics, and studio branding
└── uploads/                        # Temporary project workspace (ignored by Git)
```

---

## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- Python (v3.10 or higher) with `edge-tts`, `faster-whisper`, `numpy`
- FFmpeg (v5.0 or higher installed and added to system PATH)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/cm5722254-beep/dabbingPremuimfree.git
   cd dabbingPremuimfree
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Configure your API keys in `gemini_config.json`:
   ```json
   {
     "gemini_keys": [
       "YOUR_API_KEY_1",
       "YOUR_API_KEY_2"
     ]
   }
   ```

4. Launch the application:
   ```bash
   npm start
   ```
   Or double-click `start_studio.bat` on Windows.
   Open your browser and navigate to `http://localhost:3001`.

---

## Technical Specifications

| Parameter | Specification |
| :--- | :--- |
| UI Framework | Apple HIG / Obsidian Cinema Dark Mode |
| Frontend Stack | Vanilla ES6+ / HTML5 Canvas Multitrack Engine |
| Backend Server | Node.js Express (Port 3001) |
| Speech Engine | Microsoft Edge-TTS Neural Khmer & VoxCPM 2 |
| ASR Transcription | Faster-Whisper with VAD Filtering |
| Audio Mastering | EBU R128 (-16 LUFS, -1.0 dB True Peak) |
| Supported Formats | MP4, MKV, MOV, TS, WEBM, WAV, MP3, SRT, VTT |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for full details.
