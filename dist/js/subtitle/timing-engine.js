/**
 * Subtitle Timing Engine
 * Advanced timing adjustment, sync, and optimization
 */

class SubtitleTimingEngine {
  constructor() {
    this.config = {
      minDuration: 1000,        // Minimum subtitle duration (ms)
      maxDuration: 7000,        // Maximum subtitle duration (ms)
      minGap: 100,              // Minimum gap between subtitles (ms)
      maxCPS: 20,               // Maximum characters per second
      optimalCPS: 15,           // Optimal characters per second
      readingSpeedBuffer: 1.2   // Reading speed multiplier
    };
  }

  /**
   * Auto-adjust timing based on text length and reading speed
   */
  autoAdjustTiming(subtitles) {
    logInfo('Auto-adjusting subtitle timing', { count: subtitles.length });

    const adjusted = subtitles.map((sub, idx) => {
      const textLength = sub.text.replace(/<[^>]+>/g, '').length;
      const optimalDuration = this.calculateOptimalDuration(textLength);
      
      let newDuration = sub.duration;

      // Extend too-short subtitles
      if (sub.duration < this.config.minDuration) {
        newDuration = Math.max(this.config.minDuration, optimalDuration);
      }
      
      // Shorten too-long subtitles
      if (sub.duration > this.config.maxDuration) {
        newDuration = Math.min(this.config.maxDuration, optimalDuration);
      }

      // Check if text is too fast to read
      const cps = textLength / (sub.duration / 1000);
      if (cps > this.config.maxCPS) {
        newDuration = (textLength / this.config.optimalCPS) * 1000;
        newDuration = Math.min(newDuration, this.config.maxDuration);
      }

      let newEndTime = sub.startTime + newDuration;

      // Ensure no overlap with next subtitle
      const nextSub = subtitles[idx + 1];
      if (nextSub) {
        const maxEndTime = nextSub.startTime - this.config.minGap;
        if (newEndTime > maxEndTime) {
          newEndTime = maxEndTime;
          newDuration = newEndTime - sub.startTime;
        }
      }

      return {
        ...sub,
        endTime: newEndTime,
        duration: newDuration,
        adjusted: newDuration !== sub.duration
      };
    });

    const adjustedCount = adjusted.filter(s => s.adjusted).length;
    logInfo('Timing adjustment complete', { 
      adjusted: adjustedCount,
      total: subtitles.length 
    });

    return adjusted;
  }

  /**
   * Calculate optimal duration based on text length
   */
  calculateOptimalDuration(textLength) {
    const baseTime = (textLength / this.config.optimalCPS) * 1000;
    const adjusted = baseTime * this.config.readingSpeedBuffer;
    
    return Math.max(
      this.config.minDuration,
      Math.min(adjusted, this.config.maxDuration)
    );
  }

  /**
   * Detect and fix overlapping subtitles
   */
  fixOverlaps(subtitles) {
    logInfo('Fixing subtitle overlaps', { count: subtitles.length });

    const fixed = [];
    let overlapCount = 0;

    for (let i = 0; i < subtitles.length; i++) {
      const current = { ...subtitles[i] };
      const next = subtitles[i + 1];

      if (next && current.endTime > next.startTime) {
        // Overlap detected
        overlapCount++;

        const overlapDuration = current.endTime - next.startTime;
        const splitPoint = next.startTime - this.config.minGap;

        // Adjust current subtitle to end before next
        current.endTime = splitPoint;
        current.duration = current.endTime - current.startTime;
        current.overlappingFixed = true;

        logInfo('Fixed overlap', {
          index: i,
          overlap: overlapDuration,
          adjusted: this.config.minGap
        });
      }

      fixed.push(current);
    }

    logInfo('Overlap fixing complete', { 
      fixed: overlapCount,
      total: subtitles.length 
    });

    return fixed;
  }

  /**
   * Validate reading speed (CPS - Characters Per Second)
   */
  validateReadSpeed(subtitles) {
    const issues = [];

    subtitles.forEach((sub, idx) => {
      const textLength = sub.text.replace(/<[^>]+>/g, '').length;
      const durationSec = sub.duration / 1000;
      const cps = textLength / durationSec;

      if (cps > this.config.maxCPS) {
        issues.push({
          index: idx,
          subtitle: sub,
          cps: cps.toFixed(2),
          severity: cps > this.config.maxCPS * 1.5 ? 'critical' : 'warning',
          message: `Reading speed too fast: ${cps.toFixed(2)} CPS (max: ${this.config.maxCPS})`
        });
      }
    });

    logInfo('Read speed validation', { 
      issues: issues.length,
      total: subtitles.length 
    });

    return {
      valid: issues.length === 0,
      issues,
      passed: subtitles.length - issues.length,
      total: subtitles.length
    };
  }

  /**
   * Analyze gaps between subtitles
   */
  analyzeGaps(subtitles) {
    const gaps = [];
    const longGaps = [];

    for (let i = 0; i < subtitles.length - 1; i++) {
      const current = subtitles[i];
      const next = subtitles[i + 1];
      
      const gap = next.startTime - current.endTime;
      
      gaps.push({
        index: i,
        gap,
        beforeText: current.text.substring(0, 30),
        afterText: next.text.substring(0, 30)
      });

      // Flag unusually long gaps (> 5 seconds)
      if (gap > 5000) {
        longGaps.push({
          index: i,
          gap,
          gapSec: (gap / 1000).toFixed(2),
          beforeText: current.text,
          afterText: next.text
        });
      }
    }

    const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;

    logInfo('Gap analysis', {
      average: avgGap.toFixed(2),
      longGaps: longGaps.length
    });

    return {
      gaps,
      longGaps,
      averageGap: avgGap,
      minGap: Math.min(...gaps.map(g => g.gap)),
      maxGap: Math.max(...gaps.map(g => g.gap))
    };
  }

  /**
   * Shift all subtitles by offset
   */
  shiftTiming(subtitles, offsetMs) {
    logInfo('Shifting subtitle timing', { offset: offsetMs });

    return subtitles.map(sub => ({
      ...sub,
      startTime: Math.max(0, sub.startTime + offsetMs),
      endTime: Math.max(sub.duration, sub.endTime + offsetMs)
    }));
  }

  /**
   * Scale timing (speed up or slow down)
   */
  scaleTiming(subtitles, factor) {
    logInfo('Scaling subtitle timing', { factor });

    return subtitles.map(sub => {
      const newStartTime = sub.startTime * factor;
      const newDuration = sub.duration * factor;
      const newEndTime = newStartTime + newDuration;

      return {
        ...sub,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: newDuration
      };
    });
  }

  /**
   * Sync subtitles to reference timestamps
   */
  syncToTimestamps(subtitles, referencePoints) {
    // referencePoints: [{ subtitleIndex, actualTime }]
    if (referencePoints.length < 2) {
      logWarning('Need at least 2 reference points for sync');
      return subtitles;
    }

    logInfo('Syncing subtitles to timestamps', { 
      points: referencePoints.length 
    });

    // Sort reference points
    referencePoints.sort((a, b) => a.subtitleIndex - b.subtitleIndex);

    const synced = subtitles.map((sub, idx) => {
      // Find surrounding reference points
      let beforePoint = null;
      let afterPoint = null;

      for (let i = 0; i < referencePoints.length; i++) {
        const point = referencePoints[i];
        if (point.subtitleIndex <= idx) {
          beforePoint = point;
        }
        if (point.subtitleIndex >= idx && !afterPoint) {
          afterPoint = point;
        }
      }

      if (!beforePoint || !afterPoint) {
        return sub;
      }

      // Linear interpolation
      const beforeSub = subtitles[beforePoint.subtitleIndex];
      const afterSub = subtitles[afterPoint.subtitleIndex];

      const progress = (sub.startTime - beforeSub.startTime) / 
                      (afterSub.startTime - beforeSub.startTime);

      const targetStart = beforePoint.actualTime + 
                         (afterPoint.actualTime - beforePoint.actualTime) * progress;

      const offset = targetStart - sub.startTime;

      return {
        ...sub,
        startTime: sub.startTime + offset,
        endTime: sub.endTime + offset,
        synced: true
      };
    });

    logInfo('Sync complete');
    return synced;
  }

  /**
   * Split long subtitle into multiple parts
   */
  splitLongSubtitle(subtitle, maxDuration = 5000) {
    if (subtitle.duration <= maxDuration) {
      return [subtitle];
    }

    const parts = [];
    const words = subtitle.text.split(' ');
    const wordsPerPart = Math.ceil(words.length / Math.ceil(subtitle.duration / maxDuration));

    let currentPart = [];
    let partIndex = 0;

    for (let i = 0; i < words.length; i++) {
      currentPart.push(words[i]);

      if (currentPart.length >= wordsPerPart || i === words.length - 1) {
        const text = currentPart.join(' ');
        const partDuration = (text.length / subtitle.text.length) * subtitle.duration;
        const startTime = subtitle.startTime + (partIndex * maxDuration);
        const endTime = Math.min(startTime + partDuration, subtitle.endTime);

        parts.push({
          ...subtitle,
          index: subtitle.index + partIndex / 100,
          text,
          startTime,
          endTime,
          duration: endTime - startTime,
          split: true,
          originalIndex: subtitle.index
        });

        currentPart = [];
        partIndex++;
      }
    }

    return parts;
  }

  /**
   * Merge short consecutive subtitles
   */
  mergeShortSubtitles(subtitles, minDuration = 1000) {
    const merged = [];
    let buffer = null;

    subtitles.forEach((sub, idx) => {
      if (sub.duration < minDuration) {
        if (!buffer) {
          buffer = { ...sub };
        } else {
          // Merge with buffer
          buffer.text += ' ' + sub.text;
          buffer.endTime = sub.endTime;
          buffer.duration = buffer.endTime - buffer.startTime;
          buffer.merged = true;
        }

        // Check if next subtitle is also short
        const next = subtitles[idx + 1];
        if (!next || next.duration >= minDuration) {
          merged.push(buffer);
          buffer = null;
        }
      } else {
        if (buffer) {
          merged.push(buffer);
          buffer = null;
        }
        merged.push(sub);
      }
    });

    if (buffer) {
      merged.push(buffer);
    }

    return merged;
  }

  /**
   * Get timing statistics
   */
  getStatistics(subtitles) {
    const durations = subtitles.map(s => s.duration);
    const cpsValues = subtitles.map(s => {
      const textLength = s.text.replace(/<[^>]+>/g, '').length;
      return textLength / (s.duration / 1000);
    });

    const gaps = [];
    for (let i = 0; i < subtitles.length - 1; i++) {
      gaps.push(subtitles[i + 1].startTime - subtitles[i].endTime);
    }

    return {
      totalSubtitles: subtitles.length,
      totalDuration: subtitles[subtitles.length - 1]?.endTime - subtitles[0]?.startTime || 0,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      averageCPS: cpsValues.reduce((a, b) => a + b, 0) / cpsValues.length,
      maxCPS: Math.max(...cpsValues),
      averageGap: gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
      minGap: gaps.length > 0 ? Math.min(...gaps) : 0,
      maxGap: gaps.length > 0 ? Math.max(...gaps) : 0
    };
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubtitleTimingEngine;
}
