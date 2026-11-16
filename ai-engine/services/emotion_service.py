from typing import Dict, Any, List

EMOTION_MAP: Dict[str, Dict[str, Any]] = {
    "neutral": {"label_km": "ធម្មតា", "pitch": "+0Hz", "rate": "+0%", "color": "#94a3b8"},
    "love": {"label_km": "ស្នេហា", "pitch": "-10Hz", "rate": "-5%", "color": "#f43f5e"},
    "anger": {"label_km": "ខឹង", "pitch": "+25Hz", "rate": "+15%", "color": "#ef4444"},
    "fear": {"label_km": "ភ័យ", "pitch": "+30Hz", "rate": "+20%", "color": "#f97316"},
    "joy": {"label_km": "សប្បាយ", "pitch": "+15Hz", "rate": "+10%", "color": "#eab308"},
    "sad": {"label_km": "ក្រៀមក្រំ", "pitch": "-20Hz", "rate": "-15%", "color": "#64748b"},
    "surprise": {"label_km": "ភ្ញាក់ផ្អើល", "pitch": "+35Hz", "rate": "+10%", "color": "#06b6d4"},
    "shout": {"label_km": "ស្រែក", "pitch": "+40Hz", "rate": "+25%", "color": "#dc2626"},
    "crying": {"label_km": "យំ", "pitch": "-15Hz", "rate": "-20%", "color": "#3b82f6"},
    "laughter": {"label_km": "សើច", "pitch": "+20Hz", "rate": "+10%", "color": "#10b981"},
    "kid": {"label_km": "កុមារ", "pitch": "+50Hz", "rate": "+10%", "color": "#a855f7"},
    "elder": {"label_km": "ចាស់", "pitch": "-30Hz", "rate": "-15%", "color": "#78716c"},
    "villain": {"label_km": "មនុស្សអាក្រក់", "pitch": "-35Hz", "rate": "-5%", "color": "#1e293b"},
    "thought": {"label_km": "សំឡេងក្នុងចិត្ត", "pitch": "-10Hz", "rate": "-10%", "color": "#8b5cf6"},
    "pleading": {"label_km": "អង្វរ", "pitch": "-10Hz", "rate": "-10%", "color": "#ec4899"},
    "bored": {"label_km": "ធុញ", "pitch": "-15Hz", "rate": "-10%", "color": "#9ca3af"},
    "sarcastic": {"label_km": "ចំអក", "pitch": "+10Hz", "rate": "-5%", "color": "#d946ef"},
    "excited": {"label_km": "រំភើប", "pitch": "+25Hz", "rate": "+15%", "color": "#f59e0b"},
    "cool": {"label_km": "ឡូយ", "pitch": "-15Hz", "rate": "-5%", "color": "#38bdf8"},
    "royal": {"label_km": "រាជវង្ស", "pitch": "-20Hz", "rate": "-10%", "color": "#e11d48"}
}

def get_emotion_tuning(emotion_key: str) -> Dict[str, Any]:
    key = emotion_key.lower().strip()
    return EMOTION_MAP.get(key, EMOTION_MAP["neutral"])

def get_all_emotions() -> List[Dict[str, Any]]:
    return [
        {"key": k, **v} for k, v in EMOTION_MAP.items()
    ]

