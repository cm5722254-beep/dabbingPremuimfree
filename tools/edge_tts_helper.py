import sys
import json
import asyncio
import edge_tts

def format_rate(val):
    if val is None:
        return '+0%'
    if isinstance(val, (int, float)):
        diff = int(round((float(val) - 1.0) * 100)) if float(val) > 0.1 and float(val) < 5.0 else int(round(float(val)))
        return f"{diff:+d}%"
    s = str(val).strip()
    if not s:
        return '+0%'
    if s.endswith('%'):
        return s if (s.startswith('+') or s.startswith('-')) else f"+{s}"
    try:
        f = float(s)
        return format_rate(f)
    except:
        return '+0%'

def format_pitch(val):
    if val is None:
        return '+0Hz'
    if isinstance(val, (int, float)):
        hz = int(round((float(val) - 1.0) * 10)) if float(val) > 0.1 and float(val) < 5.0 else int(round(float(val)))
        return f"{hz:+d}Hz"
    s = str(val).strip()
    if not s:
        return '+0Hz'
    if s.endswith('Hz') or s.endswith('hz'):
        return s if (s.startswith('+') or s.startswith('-')) else f"+{s}"
    try:
        f = float(s)
        return format_pitch(f)
    except:
        return '+0Hz'

async def main():
    if len(sys.argv) < 2:
        print("Usage: python edge_tts_helper.py <payload_json_file>")
        sys.exit(1)

    payload_file = sys.argv[1]
    with open(payload_file, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)

    text = data.get('text', '').strip()
    raw_voice = data.get('voice', 'km-KH-PisethNeural')
    # Map friendly voice name to Edge-TTS voice
    if 'sreymom' in raw_voice.lower() or 'female' in raw_voice.lower() or 'ស្រី' in raw_voice:
        voice = 'km-KH-SreymomNeural'
    else:
        voice = 'km-KH-PisethNeural'

    rate = format_rate(data.get('rate'))
    pitch = format_pitch(data.get('pitch'))
    output = data.get('output', '')

    if not text:
        print("Error: Empty text")
        sys.exit(1)

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(output)
    print("SUCCESS")

if __name__ == '__main__':
    asyncio.run(main())
