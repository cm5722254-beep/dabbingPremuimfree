import os
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from router.gemini_router import router_instance
from services.translation_service import translate_subtitles_batch
from services.whisper_service import transcribe_audio
from services.voice_cloning_service import voice_service
from services.emotion_service import get_all_emotions, get_emotion_tuning

app = FastAPI(
    title="Cheatz AI Inference Engine",
    description="High-Speed Voice Cloning, STT, and Khmer Film Translation Daemon",
    version="6.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    lines: List[Dict[str, Any]]
    genre: Optional[str] = "drama"

class SynthesizeLineRequest(BaseModel):
    line_id: int
    text: str
    voice_key: Optional[str] = "lead_male"
    gender: Optional[str] = "male"
    mode: Optional[str] = "clone_from_library"
    duration: Optional[float] = None

class ExtractSampleRequest(BaseModel):
    video_path: str
    start_sec: float
    duration_sec: float
    output_filename: Optional[str] = None

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Cheatz AI Daemon v6.0", "port": 8000}

@app.get("/api/ai/router/status")
def get_router_status():
    return router_instance.get_pool_status()

@app.get("/api/ai/emotions")
def get_emotions():
    return {"emotions": get_all_emotions()}

@app.get("/api/ai/voice-library")
def get_voice_library():
    return {"library": voice_service.scan_voice_library()}

@app.post("/api/ai/translate")
def translate_subtitles(req: TranslationRequest):
    try:
        translated = translate_subtitles_batch(req.lines, genre=req.genre)
        return {"success": True, "lines": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/transcribe")
def transcribe_video_or_audio(file_path: str = Form(...), model_size: str = Form("base"), language: str = Form("auto")):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    try:
        segments, meta = transcribe_audio(file_path, model_size=model_size, language=language)
        return {"success": True, "segments": segments, "meta": meta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/synthesize-line")
async def synthesize_line_endpoint(req: SynthesizeLineRequest):
    try:
        res = await voice_service.synthesize_line(
            line_id=req.line_id,
            khmer_text=req.text,
            mode=req.mode,
            voice_key=req.voice_key,
            gender=req.gender,
            target_duration=req.duration
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/extract-voice-sample")
def extract_sample_endpoint(req: ExtractSampleRequest):
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file does not exist")
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "voice_library")
    fname = req.output_filename or f"extracted_sample_{int(req.start_sec)}.wav"
    out_path = os.path.join(out_dir, fname)
    try:
        saved = voice_service.extract_voice_sample_from_video(
            req.video_path, req.start_sec, req.duration_sec, out_path
        )
        return {"success": True, "sample_path": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("[AI-Engine] Starting Daemon on 127.0.0.1:8000...")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)

