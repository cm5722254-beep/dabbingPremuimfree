import json
import re
from typing import List, Dict, Any
from router.gemini_router import router_instance

KHMER_DRAMA_SYSTEM_PROMPT = """You are an elite Hollywood & Asian Drama Dubbing Director and Screenplay Translator specializing in adapting film dialogues into natural spoken Khmer (ភាសានិយាយភាពយន្តបែបខ្មែរ).

Core Rules for Film Dubbing Translation:
1. Natural Spoken Tone (ភាសានិយាយធម្មជាតិ):
   - Translate into fluent, modern spoken conversational Khmer (e.g. ប្រើពាក្យ៖ "ណា", "ណ៎", "ហ្មង", "តើ", "អញ្ចឹង", "វើយ", "ចា៎", "បាទ", "អ្ហេ").
   - Do NOT use stiff textbook/robotic phrasing.
2. Character Pronouns & Hierarchy:
   - Match character tone based on context (បង, អូន, ឯង, ខ្ញុំ, លោក, នាង, ក្មួយ, លោកពូ, ម៉ែ, ឪ...).
3. Lip-Sync & Timing Conciseness:
   - Keep dialogue rhythm concise so the dubber can deliver within original subtitle duration.
4. Emotion Tagging:
   - Analyze each line's emotional delivery and assign one of the 20 emotional tags:
     [neutral (ធម្មតា), love (ស្នេហា), anger (ខឹង), fear (ភ័យ), joy (សប្បាយ), sad (ក្រៀមក្រំ), surprise (ភ្ញាក់ផ្អើល), shout (ស្រែក), crying (យំ), laughter (សើច), kid (កុមារ), elder (ចាស់), villain (មនុស្សអាក្រក់), thought (សំឡេងក្នុងចិត្ត), pleading (អង្វរ), bored (ធុញ), sarcastic (ចំអក), excited (រំភើប), cool (ឡូយ), royal (រាជវង្ស)].
5. Strict Structure:
   - Output MUST be valid JSON array of objects with fields: "id", "khmer", "emotion", "speaker_hint".
   - Keep line IDs and count 100% matched to the input.
"""

def clean_json_text(text: str) -> str:
    """Strip markdown code blocks ```json ... ```"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()

def translate_subtitles_batch(lines: List[Dict[str, Any]], genre: str = "drama") -> List[Dict[str, Any]]:
    """
    Batch translate subtitle lines using Gemini API Key Pool.
    """
    if not lines:
        return []

    input_data = [
        {
            "id": line.get("id", idx),
            "speaker": line.get("speaker", f"Speaker_{idx % 2 + 1}"),
            "text": line.get("text", line.get("original_text", ""))
        }
        for idx, line in enumerate(lines)
    ]

    prompt = f"""Genre of the movie: {genre}
Translate the following subtitle lines into natural Khmer drama spoken dialogue:

{json.dumps(input_data, ensure_ascii=False, indent=2)}

Return strictly a JSON array formatted as:
[
  {{"id": 0, "khmer": "អត្ថបទបកប្រែជាភាសាខ្មែរ", "emotion": "neutral", "speaker_hint": "ឯកប្រុស"}}
]
"""

    raw_response = router_instance.generate_content(
        prompt=prompt,
        system_instruction=KHMER_DRAMA_SYSTEM_PROMPT
    )

    cleaned = clean_json_text(raw_response)
    try:
        parsed = json.loads(cleaned)
    except Exception as e:
        print(f"[TranslationService] JSON parse error: {e}, attempting recovery...")
        # Fallback regex extraction
        pattern = re.findall(r'\{\s*"id"\s*:\s*(\d+)\s*,\s*"khmer"\s*:\s*"(.*?)"', cleaned, re.DOTALL)
        parsed = [{"id": int(item[0]), "khmer": item[1], "emotion": "neutral"} for item in pattern]

    # Map back to lines
    lookup = {item["id"]: item for item in parsed if isinstance(item, dict) and "id" in item}
    results = []
    for line in lines:
        line_id = line.get("id")
        t_data = lookup.get(line_id, {})
        merged = dict(line)
        merged["khmer_text"] = t_data.get("khmer", line.get("text", ""))
        merged["emotion"] = t_data.get("emotion", "neutral")
        merged["speaker_hint"] = t_data.get("speaker_hint", "")
        results.append(merged)

    return results

