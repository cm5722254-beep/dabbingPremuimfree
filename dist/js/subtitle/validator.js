/**
 * Subtitle Validator
 * Quality checks and validation for professional subtitles
 */

class SubtitleValidator {
  constructor() {
    this.rules = {
      minDuration: 1000,           // Minimum subtitle duration
      maxDuration: 7000,           // Maximum subtitle duration
      maxLineLength: 42,           // Maximum characters per line
      maxLines: 2,                 // Maximum lines per subtitle
      maxCPS: 20,                  // Maximum characters per second
      optimalCPS: 15,              // Optimal characters per second
      minGap: 100,                 // Minimum gap between subtitles
      maxGap: 5000                 // Maximum gap (flags potential issues)
    };

    this.severityLevels = {
      info: { label: 'Info', icon: 'ℹ️', priority: 1 },
      warning: { label: 'Warning', icon: '⚠️', priority: 2 },
      error: { label: 'Error', icon: '❌', priority: 3 },
      critical: { label: 'Critical', icon: '🚨', priority: 4 }
    };
  }

  /**
   * Validate all subtitles and return comprehensive report
   */
  validate(subtitles) {
    logInfo('Validating subtitles', { count: subtitles.length });

    const issues = [];

    // Run all validation checks
    issues.push(...this.checkTiming(subtitles));
    issues.push(...this.checkReadingSpeed(subtitles));
    issues.push(...this.checkTextFormat(subtitles));
    issues.push(...this.checkOverlaps(subtitles));
    issues.push(...this.checkGaps(subtitles));
    issues.push(...this.checkEncoding(subtitles));

    // Sort by severity and position
    issues.sort((a, b) => {
      const severityDiff = this.severityLevels[b.severity].priority - 
                          this.severityLevels[a.severity].priority;
      if (severityDiff !== 0) return severityDiff;
      return a.index - b.index;
    });

    const summary = this.generateSummary(issues, subtitles.length);

    logInfo('Validation complete', {
      total: subtitles.length,
      issues: issues.length,
      errors: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length
    });

    return {
      valid: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length === 0,
      issues,
      summary,
      totalSubtitles: subtitles.length
    };
  }

  /**
   * Check timing validity
   */
  checkTiming(subtitles) {
    const issues = [];

    subtitles.forEach((sub, idx) => {
      // Check duration bounds
      if (sub.duration < this.rules.minDuration) {
        issues.push({
          type: 'timing',
          severity: 'warning',
          index: idx,
          subtitle: sub,
          message: `Too short: ${sub.duration}ms (min: ${this.rules.minDuration}ms)`,
          fix: 'Extend duration or merge with adjacent subtitle'
        });
      }

      if (sub.duration > this.rules.maxDuration) {
        issues.push({
          type: 'timing',
          severity: 'warning',
          index: idx,
          subtitle: sub,
          message: `Too long: ${sub.duration}ms (max: ${this.rules.maxDuration}ms)`,
          fix: 'Split into multiple subtitles'
        });
      }

      // Check negative or zero duration
      if (sub.duration <= 0) {
        issues.push({
          type: 'timing',
          severity: 'critical',
          index: idx,
          subtitle: sub,
          message: `Invalid duration: ${sub.duration}ms`,
          fix: 'Correct end time to be after start time'
        });
      }

      // Check start time validity
      if (sub.startTime < 0) {
        issues.push({
          type: 'timing',
          severity: 'error',
          index: idx,
          subtitle: sub,
          message: `Negative start time: ${sub.startTime}ms`,
          fix: 'Set start time to 0 or later'
        });
      }
    });

    return issues;
  }

  /**
   * Check reading speed (CPS)
   */
  checkReadingSpeed(subtitles) {
    const issues = [];

    subtitles.forEach((sub, idx) => {
      const textLength = sub.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
      const durationSec = sub.duration / 1000;
      const cps = textLength / durationSec;

      if (cps > this.rules.maxCPS) {
        const severity = cps > this.rules.maxCPS * 1.5 ? 'error' : 'warning';
        
        issues.push({
          type: 'reading_speed',
          severity,
          index: idx,
          subtitle: sub,
          cps: cps.toFixed(2),
          message: `Too fast to read: ${cps.toFixed(2)} CPS (max: ${this.rules.maxCPS})`,
          fix: `Extend duration to at least ${(textLength / this.rules.optimalCPS * 1000).toFixed(0)}ms`
        });
      }

      if (cps < 5 && textLength > 10) {
        issues.push({
          type: 'reading_speed',
          severity: 'info',
          index: idx,
          subtitle: sub,
          cps: cps.toFixed(2),
          message: `Very slow: ${cps.toFixed(2)} CPS (might be too slow)`,
          fix: 'Consider shortening duration'
        });
      }
    });

    return issues;
  }

  /**
   * Check text formatting
   */
  checkTextFormat(subtitles) {
    const issues = [];

    subtitles.forEach((sub, idx) => {
      const lines = sub.text.split('\n');

      // Check number of lines
      if (lines.length > this.rules.maxLines) {
        issues.push({
          type: 'format',
          severity: 'warning',
          index: idx,
          subtitle: sub,
          message: `Too many lines: ${lines.length} (max: ${this.rules.maxLines})`,
          fix: 'Split into multiple subtitles or reduce text'
        });
      }

      // Check line length
      lines.forEach((line, lineIdx) => {
        const lineLength = line.trim().length;
        if (lineLength > this.rules.maxLineLength) {
          issues.push({
            type: 'format',
            severity: 'info',
            index: idx,
            subtitle: sub,
            line: lineIdx + 1,
            message: `Line ${lineIdx + 1} too long: ${lineLength} chars (max: ${this.rules.maxLineLength})`,
            fix: 'Break into shorter lines'
          });
        }
      });

      // Check for empty text
      if (!sub.text || sub.text.trim().length === 0) {
        issues.push({
          type: 'format',
          severity: 'error',
          index: idx,
          subtitle: sub,
          message: 'Empty subtitle text',
          fix: 'Remove empty subtitle or add text'
        });
      }

      // Check for leading/trailing whitespace
      if (sub.text !== sub.text.trim()) {
        issues.push({
          type: 'format',
          severity: 'info',
          index: idx,
          subtitle: sub,
          message: 'Leading or trailing whitespace',
          fix: 'Trim whitespace'
        });
      }

      // Check for multiple spaces
      if (/\s{2,}/.test(sub.text)) {
        issues.push({
          type: 'format',
          severity: 'info',
          index: idx,
          subtitle: sub,
          message: 'Multiple consecutive spaces',
          fix: 'Replace with single space'
        });
      }
    });

    return issues;
  }

  /**
   * Check for overlapping subtitles
   */
  checkOverlaps(subtitles) {
    const issues = [];

    for (let i = 0; i < subtitles.length - 1; i++) {
      const current = subtitles[i];
      const next = subtitles[i + 1];

      if (current.endTime > next.startTime) {
        const overlap = current.endTime - next.startTime;
        
        issues.push({
          type: 'overlap',
          severity: 'error',
          index: i,
          subtitle: current,
          nextSubtitle: next,
          overlap,
          message: `Overlaps with next subtitle by ${overlap}ms`,
          fix: `Adjust end time to ${next.startTime - this.rules.minGap}ms or adjust next start time`
        });
      }
    }

    return issues;
  }

  /**
   * Check gaps between subtitles
   */
  checkGaps(subtitles) {
    const issues = [];

    for (let i = 0; i < subtitles.length - 1; i++) {
      const current = subtitles[i];
      const next = subtitles[i + 1];

      const gap = next.startTime - current.endTime;

      // Too small gap
      if (gap < this.rules.minGap && gap >= 0) {
        issues.push({
          type: 'gap',
          severity: 'warning',
          index: i,
          subtitle: current,
          gap,
          message: `Gap too small: ${gap}ms (min: ${this.rules.minGap}ms)`,
          fix: 'Increase gap or merge subtitles'
        });
      }

      // Unusually large gap
      if (gap > this.rules.maxGap) {
        issues.push({
          type: 'gap',
          severity: 'info',
          index: i,
          subtitle: current,
          gap,
          message: `Large gap: ${(gap / 1000).toFixed(2)}s (might indicate scene change)`,
          fix: 'Verify if intentional'
        });
      }
    }

    return issues;
  }

  /**
   * Check for encoding issues
   */
  checkEncoding(subtitles) {
    const issues = [];

    subtitles.forEach((sub, idx) => {
      // Check for common encoding issues
      const problematicChars = /[������]/g;
      if (problematicChars.test(sub.text)) {
        issues.push({
          type: 'encoding',
          severity: 'warning',
          index: idx,
          subtitle: sub,
          message: 'Possible encoding issue (� characters detected)',
          fix: 'Re-encode file as UTF-8'
        });
      }

      // Check for mixed RTL/LTR (if needed for your use case)
      const hasRTL = /[\u0590-\u08FF]/.test(sub.text);
      const hasLTR = /[A-Za-z]/.test(sub.text);
      
      if (hasRTL && hasLTR) {
        issues.push({
          type: 'encoding',
          severity: 'info',
          index: idx,
          subtitle: sub,
          message: 'Mixed RTL/LTR text detected',
          fix: 'Verify text direction is correct'
        });
      }
    });

    return issues;
  }

  /**
   * Generate validation summary
   */
  generateSummary(issues, totalSubtitles) {
    const byType = {};
    const bySeverity = {};

    issues.forEach(issue => {
      // Count by type
      byType[issue.type] = (byType[issue.type] || 0) + 1;
      
      // Count by severity
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    });

    const critical = bySeverity.critical || 0;
    const errors = bySeverity.error || 0;
    const warnings = bySeverity.warning || 0;
    const info = bySeverity.info || 0;

    return {
      total: totalSubtitles,
      issues: issues.length,
      byType,
      bySeverity: {
        critical,
        error: errors,
        warning: warnings,
        info
      },
      qualityScore: this.calculateQualityScore(critical, errors, warnings, totalSubtitles),
      readyForProduction: critical === 0 && errors === 0
    };
  }

  /**
   * Calculate quality score (0-100)
   */
  calculateQualityScore(critical, errors, warnings, total) {
    if (total === 0) return 0;

    const criticalPenalty = critical * 25;
    const errorPenalty = errors * 10;
    const warningPenalty = warnings * 2;

    const totalPenalty = criticalPenalty + errorPenalty + warningPenalty;
    const normalizedPenalty = Math.min((totalPenalty / total) * 100, 100);

    return Math.max(0, Math.round(100 - normalizedPenalty));
  }

  /**
   * Quick validation (basic checks only)
   */
  quickValidate(subtitles) {
    const hasOverlaps = subtitles.some((sub, idx) => {
      const next = subtitles[idx + 1];
      return next && sub.endTime > next.startTime;
    });

    const hasInvalidDurations = subtitles.some(sub => sub.duration <= 0);
    const hasEmptyText = subtitles.some(sub => !sub.text || sub.text.trim().length === 0);

    return {
      valid: !hasOverlaps && !hasInvalidDurations && !hasEmptyText,
      hasOverlaps,
      hasInvalidDurations,
      hasEmptyText
    };
  }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubtitleValidator;
}
