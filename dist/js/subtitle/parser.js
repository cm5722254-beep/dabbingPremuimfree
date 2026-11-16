/**
 * Multi-Format Subtitle Parser
 * Supports: SRT, VTT, ASS, SSA, SUB
 * Professional cinema-grade subtitle handling
 */

class SubtitleParser {
  constructor() {
    this.supportedFormats = ['srt', 'vtt', 'ass', 'ssa', 'sub'];
  }

  /**
   * Auto-detect and parse subtitle file
   */
  async parse(content, format = 'auto') {
    try {
      // Auto-detect format if needed
      if (format === 'auto') {
        format = this.detectFormat(content);
      }

      format = format.toLowerCase();

      if (!this.supportedFormats.includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }

      logInfo('Parsing subtitles', { format, length: content.length });

      let subtitles = [];

      switch (format) {
        case 'srt':
          subtitles = this.parseSRT(content);
          break;
        case 'vtt':
          subtitles = this.parseVTT(content);
          break;
        case 'ass':
        case 'ssa':
          subtitles = this.parseASS(content);
          break;
        case 'sub':
          subtitles = this.parseSUB(content);
          break;
      }

      // Validate and sort
      subtitles = this.validateAndSort(subtitles);

      logInfo('Subtitles parsed successfully', { 
        count: subtitles.length,
        format 
      });

      return {
        success: true,
        subtitles,
        format,
        count: subtitles.length
      };

    } catch (error) {
      logError('Subtitle parsing failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        subtitles: []
      };
    }
  }

  /**
   * Detect subtitle format from content
   */
  detectFormat(content) {
    const trimmed = content.trim();

    // VTT starts with WEBVTT
    if (trimmed.startsWith('WEBVTT')) {
      return 'vtt';
    }

    // ASS/SSA has [Script Info] section
    if (trimmed.includes('[Script Info]') || trimmed.includes('[V4+ Styles]')) {
      return trimmed.includes('[V4+ Styles]') ? 'ass' : 'ssa';
    }

    // SUB has {numbers}{numbers}text format
    if (/^\{[\d]+\}\{[\d]+\}/m.test(trimmed)) {
      return 'sub';
    }

    // Default to SRT (most common)
    return 'srt';
  }

  /**
   * Parse SRT format (SubRip)
   */
  parseSRT(content) {
    const subtitles = [];
    const blocks = content.trim().split(/\n\s*\n/);

    blocks.forEach((block, idx) => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;

      // Line 0: Index (optional)
      // Line 1: Timing
      // Line 2+: Text

      const timingLine = lines.find(line => line.includes('-->'));
      if (!timingLine) return;

      const timingMatch = timingLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
      if (!timingMatch) return;

      const startTime = this.parseTimestamp(timingMatch[1]);
      const endTime = this.parseTimestamp(timingMatch[2]);

      const timingIndex = lines.indexOf(timingLine);
      const text = lines.slice(timingIndex + 1).join('\n').trim();

      if (text) {
        subtitles.push({
          index: subtitles.length + 1,
          startTime,
          endTime,
          duration: endTime - startTime,
          text,
          format: 'srt'
        });
      }
    });

    return subtitles;
  }

  /**
   * Parse VTT format (WebVTT)
   */
  parseVTT(content) {
    const subtitles = [];
    
    // Remove WEBVTT header
    content = content.replace(/^WEBVTT.*?\n\n/s, '');
    
    const blocks = content.trim().split(/\n\s*\n/);

    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length < 2) return;

      // Find timing line
      const timingLine = lines.find(line => line.includes('-->'));
      if (!timingLine) return;

      const timingMatch = timingLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
      if (!timingMatch) return;

      const startTime = this.parseTimestamp(timingMatch[1]);
      const endTime = this.parseTimestamp(timingMatch[2]);

      const timingIndex = lines.indexOf(timingLine);
      const text = lines.slice(timingIndex + 1).join('\n').trim();

      if (text) {
        subtitles.push({
          index: subtitles.length + 1,
          startTime,
          endTime,
          duration: endTime - startTime,
          text: this.stripVTTTags(text),
          format: 'vtt'
        });
      }
    });

    return subtitles;
  }

  /**
   * Parse ASS/SSA format (Advanced SubStation Alpha)
   */
  parseASS(content) {
    const subtitles = [];
    const lines = content.split('\n');

    // Find Events section
    let inEvents = false;
    let formatLine = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '[Events]') {
        inEvents = true;
        continue;
      }

      if (inEvents && trimmed.startsWith('Format:')) {
        formatLine = trimmed.substring(7).trim();
        continue;
      }

      if (inEvents && trimmed.startsWith('Dialogue:')) {
        if (!formatLine) continue;

        const dialogue = trimmed.substring(9).trim();
        const fields = formatLine.split(',').map(f => f.trim());
        const values = this.parseCSVLine(dialogue);

        const startIdx = fields.indexOf('Start');
        const endIdx = fields.indexOf('End');
        const textIdx = fields.indexOf('Text');

        if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

        const startTime = this.parseASSTimestamp(values[startIdx]);
        const endTime = this.parseASSTimestamp(values[endIdx]);
        const text = values[textIdx];

        if (text) {
          subtitles.push({
            index: subtitles.length + 1,
            startTime,
            endTime,
            duration: endTime - startTime,
            text: this.stripASSTags(text),
            format: 'ass',
            raw: line
          });
        }
      }

      // Stop at next section
      if (inEvents && trimmed.startsWith('[') && !trimmed.startsWith('[Events]')) {
        break;
      }
    }

    return subtitles;
  }

  /**
   * Parse SUB format (MicroDVD)
   */
  parseSUB(content) {
    const subtitles = [];
    const lines = content.trim().split('\n');
    const fps = 25; // Default FPS (can be detected from first line)

    lines.forEach(line => {
      const match = line.match(/^\{([\d]+)\}\{([\d]+)\}(.*)$/);
      if (!match) return;

      const startFrame = parseInt(match[1]);
      const endFrame = parseInt(match[2]);
      const text = match[3].trim();

      if (text) {
        const startTime = (startFrame / fps) * 1000;
        const endTime = (endFrame / fps) * 1000;

        subtitles.push({
          index: subtitles.length + 1,
          startTime,
          endTime,
          duration: endTime - startTime,
          text,
          format: 'sub'
        });
      }
    });

    return subtitles;
  }

  /**
   * Parse timestamp to milliseconds
   */
  parseTimestamp(timestamp) {
    // Support both comma and dot as decimal separator
    timestamp = timestamp.replace(',', '.');

    const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (!match) return 0;

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const milliseconds = parseInt(match[4]);

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
  }

  /**
   * Parse ASS timestamp (h:mm:ss.cc)
   */
  parseASSTimestamp(timestamp) {
    const match = timestamp.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) return 0;

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const centiseconds = parseInt(match[4]);

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
  }

  /**
   * Parse CSV line (for ASS format)
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Strip VTT formatting tags
   */
  stripVTTTags(text) {
    return text
      .replace(/<[^>]+>/g, '') // Remove HTML-like tags
      .replace(/\{[^}]+\}/g, '') // Remove cue settings
      .trim();
  }

  /**
   * Strip ASS formatting tags
   */
  stripASSTags(text) {
    return text
      .replace(/\\N/g, '\n') // Line breaks
      .replace(/\\n/g, '\n')
      .replace(/\{[^}]+\}/g, '') // Remove override tags
      .trim();
  }

  /**
   * Validate and sort subtitles
   */
  validateAndSort(subtitles) {
    // Remove invalid entries
    subtitles = subtitles.filter(sub => 
      sub.startTime >= 0 && 
      sub.endTime > sub.startTime &&
      sub.text && sub.text.trim().length > 0
    );

    // Sort by start time
    subtitles.sort((a, b) => a.startTime - b.startTime);

    // Reindex
    subtitles.forEach((sub, idx) => {
      sub.index = idx + 1;
    });

    return subtitles;
  }

  /**
   * Get subtitle at specific time
   */
  getSubtitleAtTime(subtitles, timeMs) {
    return subtitles.find(sub => 
      timeMs >= sub.startTime && timeMs <= sub.endTime
    );
  }

  /**
   * Get subtitles in time range
   */
  getSubtitlesInRange(subtitles, startMs, endMs) {
    return subtitles.filter(sub =>
      (sub.startTime >= startMs && sub.startTime <= endMs) ||
      (sub.endTime >= startMs && sub.endTime <= endMs) ||
      (sub.startTime <= startMs && sub.endTime >= endMs)
    );
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubtitleParser;
}
