export type EmotionKey = 
  | 'neutral' | 'love' | 'anger' | 'fear' | 'joy' 
  | 'sad' | 'surprise' | 'shout' | 'crying' | 'laughter' 
  | 'kid' | 'elder' | 'villain' | 'thought' | 'pleading' 
  | 'bored' | 'sarcastic' | 'excited' | 'cool' | 'royal';

export interface SubtitleLine {
  id: number;
  start: number;
  end: number;
  duration?: number;
  start_time: string;
  end_time: string;
  speaker: string;
  text: string;
  khmer_text: string;
  emotion: EmotionKey;
  audio_url?: string;
  status?: 'pending' | 'translating' | 'translated' | 'synthesized' | 'error';
}

export interface CharacterVoiceAssignment {
  speakerId: string;
  characterName: string;
  mode: 'clone_from_original' | 'clone_from_library';
  sourceFile?: string;
  voiceKey: string;
  gender: 'male' | 'female';
}

export interface AudioMixerSettings {
  preset: 'cinema' | 'podcast' | 'music_focus';
  warmth: number; // 0-100%
  presence: number; // 0-100%
  clarity: number; // 0-100%
  denoise: boolean;
  bgmVolume: number; // 0-100%
  autoDucking: boolean;
  duckingDb: number; // -12dB
  targetLufs: number; // -16 LUFS
  stereoWidth: number; // 50-150%
}

export interface RouterPoolStatus {
  total_keys: number;
  active_keys: number;
  rate_limited: number;
  model: string;
  keys_summary: Array<{
    masked_key: string;
    success: number;
    errors: number;
    is_ready: boolean;
  }>;
}
