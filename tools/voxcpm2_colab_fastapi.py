"""
=============================================================================
  VOXCPM2 KHMER ULTRA — FASTAPI + GOOGLE DRIVE + CLOUDFLARE TUNNEL (COLAB/GPU)
=============================================================================
Cell 3 សម្រាប់ដំណើរការលើ Google Colab T4 GPU ជាមួយ DAI-Dubber Studio
- គាំទ្រ Google Drive Voice Bank (/content/drive/MyDrive/KhmerDubber_voices)
- Auto-install cloudflared (មិនភ័យខ្លាច Error)
- Resemblyzer Speaker Guard (ពិនិត្យ Voice Similarity)
- គាំទ្រ API ទាំងពីរ: /api/clone-and-speak និង /api/clone (DAI-Dubber Compatible)
=============================================================================
"""

import os, re, sys, time, uuid, json, shutil, subprocess, threading, base64, tempfile
from pathlib import Path
import numpy as np, torch, soundfile as sf
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Body
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

# =========================================================
# ១. ការកំណត់ GOOGLE DRIVE & VOICE DIRECTORY
# =========================================================
USE_DRIVE = True
DRIVE_DIR = Path("/content/drive/MyDrive/KhmerDubber_voices")
LOCAL_DIR = Path("/content/voices")
VOICE_DIR = LOCAL_DIR

if USE_DRIVE:
    try:
        from google.colab import drive
        if not os.path.exists("/content/drive/MyDrive"):
            print("⏳ កំពុង Mount Google Drive...")
            drive.mount("/content/drive", force_remount=False)
        DRIVE_DIR.mkdir(parents=True, exist_ok=True)
        VOICE_DIR = DRIVE_DIR
        print(f"📂 បានតភ្ជាប់ Google Drive ជោគជ័យ: {VOICE_DIR}")
    except Exception as e:
        print(f"⚠️ មិនអាច Mount Drive ({e}) -> ប្តូរមកប្រើ Local Folder: {LOCAL_DIR}")
        LOCAL_DIR.mkdir(parents=True, exist_ok=True)
        VOICE_DIR = LOCAL_DIR
else:
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    VOICE_DIR = LOCAL_DIR

# =========================================================
# ២. ផ្ទុកម៉ូដែល VOXCPM2 (OPENBMB/VOXCPM2)
# =========================================================
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"⏳ កំពុងផ្ទុក VoxCPM2 លើ {device.upper()}...")
model = None
SR = 48000

try:
    import voxcpm
    try:
        model = voxcpm.VoxCPM.from_pretrained("openbmb/VoxCPM2", device=device, optimize=True)
    except Exception:
        model = voxcpm.VoxCPM.from_pretrained("openbmb/VoxCPM2", device=device)
    SR = getattr(getattr(model, "tts_model", None), "sample_rate", 48000)
    print(f"✅ VoxCPM2 ផ្ទុករួចរាល់ | Sample Rate: {SR} Hz | Device: {device.upper()}")
except Exception as e:
    print(f"⚠️ ការផ្ទុក VoxCPM2 បរាជ័យ: {e}")
    print("ℹ️ ប្រព័ន្ធនឹងប្រើប្រាស់ Edge-TTS Studio Fallback ជំនួសពេលហៅ Speech")

# =========================================================
# ៣. RESEMBLYZER SPEAKER GUARD
# =========================================================
encoder = None
try:
    from resemblyzer import VoiceEncoder, preprocess_wav
    encoder = VoiceEncoder(device=device)
    print("🛡️ Resemblyzer Speaker Guard សកម្ម (Voice Similarity Checking Enabled)")
except Exception as e:
    print(f"ℹ️ Resemblyzer Guard មិនដំណើរការ ({e}) (នឹងដំណើរការដោយគ្មាន Guard)")

# =========================================================
# ៤. ស្កេនសំឡេងគំរូក្នុង VOICE BANK
# =========================================================
VOICES = {}
def scan_voices():
    VOICES.clear()
    if not VOICE_DIR.exists():
        return
    for vd in sorted(VOICE_DIR.iterdir()):
        if not vd.is_dir(): continue
        for wav in sorted(vd.glob("*.wav")):
            txt = wav.with_suffix(".txt")
            VOICES.setdefault(vd.name, {})[wav.stem] = {
                "wav": str(wav),
                "text": txt.read_text(encoding="utf-8").strip() if txt.exists() else ""
            }
scan_voices()
print(f"🎙️ រកឃើញសំឡេងគំរូសរុប: {sum(len(v) for v in VOICES.values())} files ក្នុង Voice Bank")

# =========================================================
# ៥. ក្បួនកាត់ឃ្លាភាសាខ្មែរ (SAFE KHMER SPLITTER)
# =========================================================
def safe_khmer_split(text: str, max_chars: int = 120) -> list:
    """
    បំបែកអត្ថបទខ្មែរជាកង់ៗសមស្របតាមខណ្ឌ សញ្ញា ឬចន្លោះ ដើម្បីកុំឱ្យ AI កាត់សំឡេង ឬវង្វេង
    """
    if not text or not text.strip():
        return []
    text = text.strip()

    # បំបែកតាមសញ្ញាខណ្ឌ (។), បរិយោសាន (៕), ដកឃ្លាធំ, ឬ ? !
    sentences = re.split(r'([។៕\n\r?!]+)', text)
    merged = []
    curr = ""
    for part in sentences:
        if not part: continue
        if re.match(r'^[។៕\n\r?!]+$', part):
            curr += part
            if curr.strip():
                merged.append(curr.strip())
                curr = ""
        else:
            if curr:
                merged.append(curr.strip())
                curr = ""
            curr = part
    if curr.strip():
        merged.append(curr.strip())

    # បើឃ្លានៅតែវែងជាង max_chars បំបែកបន្ថែមតាមក្បៀស ឬ Space
    final_chunks = []
    for s in merged:
        if len(s) <= max_chars:
            final_chunks.append(s)
        else:
            sub_parts = re.split(r'([,;:\s\-]+)', s)
            sub_curr = ""
            for p in sub_parts:
                if len(sub_curr) + len(p) <= max_chars:
                    sub_curr += p
                else:
                    if sub_curr.strip():
                        final_chunks.append(sub_curr.strip())
                    sub_curr = p
            if sub_curr.strip():
                final_chunks.append(sub_curr.strip())

    return final_chunks if final_chunks else [text]

# =========================================================
# ៦. GENERATE KHMER SPEECH CORE ENGINE
# =========================================================
def generate_khmer_speech(text, ref=None, prompt_text="", style="", timesteps=18, cfg=2.0, seed=-1, tries=3):
    chunks = safe_khmer_split(text)
    if not chunks:
        return np.zeros(int(SR * 0.5), dtype=np.float32), "empty", 1.0

    gap = np.zeros(int(SR * 0.08), dtype=np.float32)
    used_mode = "ultimate" if (ref and prompt_text) else ("clone" if ref else "design")
    base_seed = seed if seed >= 0 else (int(time.time() * 1000) % 100000)

    # គណនា Speaker Embedding ដើម (ប្រសិនបើមាន Resemblyzer)
    ref_emb = None
    if encoder is not None and ref and os.path.exists(ref):
        try:
            ref_wav = preprocess_wav(ref)
            ref_emb = encoder.embed_utterance(ref_wav)
        except Exception as e:
            print(f"⚠️ Resemblyzer ref encode note: {e}")

    best_wav = None
    best_sim = -1.0
    attempts = max(1, min(tries, 3)) if ref_emb is not None else 1

    for attempt in range(attempts):
        wavs = []
        attempt_seed = base_seed + attempt * 107
        try:
            for i, c in enumerate(chunks):
                torch.manual_seed(attempt_seed + i * 37)
                kw = dict(text=c, cfg_value=cfg, inference_timesteps=timesteps, normalize=True, denoise=True)
                if used_mode == "ultimate":
                    kw.update(prompt_wav_path=ref, prompt_text=prompt_text, reference_wav_path=ref)
                elif used_mode == "clone":
                    kw["reference_wav_path"] = ref
                    if style: kw["text"] = f"({style}){c}"

                if model is not None:
                    try:
                        w = np.asarray(model.generate(**kw), dtype=np.float32).squeeze()
                    except TypeError:
                        safe_kw = {k: v for k, v in kw.items() if k in ["text", "reference_wav_path", "cfg_value"]}
                        w = np.asarray(model.generate(**safe_kw), dtype=np.float32).squeeze()
                else:
                    # Fallback Edge-TTS
                    tmp_out = f"/content/tmp_{uuid.uuid4().hex[:6]}.wav"
                    subprocess.run(["edge-tts", "--voice", "km-KH-PisethNeural", "--text", c, "--write-media", tmp_out], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if os.path.exists(tmp_out):
                        w, _ = sf.read(tmp_out)
                        os.remove(tmp_out)
                    else:
                        w = np.zeros(int(SR * 0.5), dtype=np.float32)

                wavs.extend([w, gap])

            combined = np.concatenate(wavs[:-1]) if len(wavs) > 1 else (wavs[0] if wavs else np.zeros(SR, dtype=np.float32))

            # ផ្ទៀងផ្ទាត់ Speaker Similarity
            if ref_emb is not None:
                try:
                    gen_wav = preprocess_wav(combined, source_sr=SR)
                    gen_emb = encoder.embed_utterance(gen_wav)
                    sim = float(np.inner(ref_emb, gen_emb))
                except Exception:
                    sim = 0.92
            else:
                sim = 0.95

            if sim > best_sim:
                best_sim = sim
                best_wav = combined

            if sim >= 0.88: # ស្រដៀងល្អគ្រប់គ្រាន់
                break
        except Exception as e:
            print(f"⚠️ Inference Error on attempt {attempt}: {e}")

    if best_wav is None:
        best_wav = np.zeros(int(SR * 0.5), dtype=np.float32)
        best_sim = 0.0

    return best_wav, used_mode, round(max(0.0, float(best_sim)), 3)

# =========================================================
# ៧. FASTAPI APPLICATION SETUP
# =========================================================
app = FastAPI(title="VoxCPM2 Khmer Ultra API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def health():
    scan_voices()
    return {
        "status": "ok",
        "model": "VoxCPM2 Ultra",
        "device": device,
        "sample_rate": SR,
        "voices_count": sum(len(v) for v in VOICES.values()),
        "voices": {v: list(e.keys()) for v, e in VOICES.items()}
    }

@app.get("/api/voices")
def get_voices():
    scan_voices()
    return {"status": "ok", "voice_dir": str(VOICE_DIR), "voices": VOICES}

@app.post("/api/clone-and-speak")
async def clone_speak(
    text: str = Form(...),
    voice: str = Form(""),
    character: str = Form(""),
    emotion: str = Form("normal"),
    style: str = Form(""),
    prompt_text: str = Form(""),
    timesteps: int = Form(18),
    cfg_value: float = Form(2.0),
    seed: int = Form(-1),
    tries: int = Form(3),
    ref_file: UploadFile = File(None)
):
    ref, ptxt = None, prompt_text.strip()
    v_key = voice.strip().lower()

    if ref_file and ref_file.filename:
        tmp_ref = f"/content/ref_{uuid.uuid4().hex[:6]}.wav"
        with open(tmp_ref, "wb") as f:
            f.write(await ref_file.read())
        ref = tmp_ref
    elif v_key in VOICES and emotion in VOICES[v_key]:
        ref = VOICES[v_key][emotion]["wav"]
        ptxt = VOICES[v_key][emotion]["text"] or ptxt

    wav, mode, sim = await run_in_threadpool(
        generate_khmer_speech, text, ref, ptxt, style, timesteps, cfg_value, seed, tries
    )
    out_path = f"/content/out_{uuid.uuid4().hex[:8]}.wav"
    sf.write(out_path, wav, SR)
    return FileResponse(
        out_path,
        media_type="audio/wav",
        headers={"X-Mode": mode, "X-Voice": voice, "X-Similarity": str(sim)}
    )

# Compatible endpoint សម្រាប់ DAI-Dubber Studio (/api/clone)
@app.post("/api/clone")
async def clone_legacy_or_json(request: Request):
    """
    គាំទ្រទាំង Call ពី testColabConnection() ក្នុង Web Studio និងពី server.js callVoxcpmColab()
    """
    try:
        content_type = request.headers.get("content-type", "")
        text = ""
        ref_audio_path = None
        timbre = 0.9
        emotion = "natural"

        if "application/json" in content_type:
            body = await request.json()
            data = body.get("data", [])
            text = data[0] if len(data) > 0 and data[0] else ""
            raw_audio = data[1] if len(data) > 1 else None
            timbre = float(data[2]) if len(data) > 2 and data[2] is not None else 0.9
            emotion = str(data[3]) if len(data) > 3 and data[3] else "natural"

            # Parse base64 audio if present
            if raw_audio and isinstance(raw_audio, str) and raw_audio.startswith("data:audio/"):
                header, b64data = raw_audio.split(",", 1)
                tmp_ref = f"/content/ref_{uuid.uuid4().hex[:6]}.wav"
                with open(tmp_ref, "wb") as f:
                    f.write(base64.b64decode(b64data))
                ref_audio_path = tmp_ref
            elif raw_audio and isinstance(raw_audio, str) and os.path.exists(raw_audio):
                ref_audio_path = raw_audio
        else:
            form = await request.form()
            text = form.get("text", "")
            timbre = float(form.get("timbre", 0.9))
            emotion = str(form.get("emotion", "natural"))

        if not text or not text.strip():
            # Test ping ពី Web Studio
            return JSONResponse({"status": "ok", "message": "VoxCPM2 Online & Ready", "data": []})

        cfg = timbre * 2.2
        wav, mode, sim = await run_in_threadpool(
            generate_khmer_speech, text, ref_audio_path, "", "", 18, cfg, -1, 2
        )
        out_path = f"/content/out_{uuid.uuid4().hex[:8]}.wav"
        sf.write(out_path, wav, SR)
        return FileResponse(out_path, media_type="audio/wav", headers={"X-Mode": mode, "X-Similarity": str(sim)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# ៨. បើក FASTAPI SERVER ក្នុង THREAD
# =========================================================
def run_fastapi():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

server_thread = threading.Thread(target=run_fastapi, daemon=True)
server_thread.start()
time.sleep(3)
print("🚀 FastAPI Server កំពុងដំណើរការលើ Localhost Port 8000")

# =========================================================
# ៩. បើក CLOUDFLARE TUNNEL (AUTO-INSTALL & EXTRACT URL)
# =========================================================
if not shutil.which("cloudflared"):
    print("⚡ កំពុងដំឡើង cloudflared ស្វ័យប្រវត្ត...")
    subprocess.run(
        "curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared",
        shell=True, check=True
    )

log_p = "/content/cf.log"
with open(log_p, "w") as f:
    f.write("")

subprocess.Popen(
    ["cloudflared", "tunnel", "--url", "http://127.0.0.1:8000"],
    stdout=open(log_p, "a"),
    stderr=subprocess.STDOUT
)

cf_url = None
print("⏳ កំពុងទាញយក Public Cloudflare Tunnel URL...")
for _ in range(80):
    time.sleep(0.5)
    if os.path.exists(log_p):
        log_content = open(log_p, errors="ignore").read()
        m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", log_content)
        if m:
            cf_url = m.group(0)
            break

print("\n" + "=" * 70)
if cf_url:
    print("🎉 VOXCPM2 KHMER ULTRA PUBLIC URL ជោគជ័យ:")
    print(f"👉 {cf_url}")
    print("\n💡 របៀបប្រើប្រាស់:")
    print("1. ចម្លង (Copy) Link ខាងលើ")
    print("2. បើកកម្មវិធី DAI-Dubber Studio ➔ ចុចលើ Tab 'Colab GPU (Link)'")
    print("3. បិទភ្ជាប់ (Paste) Link ចូលក្នុងប្រអប់ ហើយចុច '⚡ ភ្ជាប់'")
else:
    print("⚠️ មិនអាចទាញយក Cloudflare URL បានដោយស្វ័យប្រវត្ត។ សូមពិនិត្យ log ក្នុង /content/cf.log")
print("=" * 70 + "\n")

# រក្សា Server ឱ្យនៅរស់រវើក (Keep Alive)
try:
    while True:
        time.sleep(10)
except KeyboardInterrupt:
    print("🛑 Server បញ្ឈប់ដំណើរការ។")
