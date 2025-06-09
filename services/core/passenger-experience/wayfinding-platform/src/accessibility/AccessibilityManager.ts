/**
 * AccessibilityManager.ts
 * Handles accessibility features and preferences
 */

import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { UserPreferences, AccessibilityPreferences } from '../models/UserPreferences';

interface AccessibilityConfig {
  fontSizes: {
    normal: number;
    large: number;
    xlarge: number;
  };
  colors: {
    normal: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
    };
    highContrast: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
    };
  };
  audio: {
    enabled: boolean;
    volume: number;
    speechRate: number;
  };
  haptic: {
    enabled: boolean;
    intensity: number;
  };
}

export class AccessibilityManager {
  private config: AccessibilityConfig;
  private preferences: UserPreferences;
  private speechSynthesis: SpeechSynthesis;
  private speechQueue: string[];
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

  constructor(
    config: AccessibilityConfig,
    preferences: UserPreferences,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.config = config;
    this.preferences = preferences;
    this.speechSynthesis = window.speechSynthesis;
    this.speechQueue = [];
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;

    this.setupMetrics();
    this.initializeSpeechSynthesis();
  }

  /**
   * Update accessibility preferences
   */
  public updatePreferences(preferences: Partial<UserPreferences>): void {
    const span = this.tracer.startSpan('AccessibilityManager.updatePreferences');

    try {
      Object.assign(this.preferences, preferences);
      this.applyPreferences();
      this.metrics.increment('accessibility.preferences_updated');

    } catch (error) {
      this.logger.error('Error updating preferences', error);
      this.metrics.increment('accessibility.errors');

    } finally {
      span.end();
    }
  }

  /**
   * Get current theme colors based on preferences
   */
  public getThemeColors(): {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  } {
    return this.preferences.accessibility.highContrast
      ? this.config.colors.highContrast
      : this.config.colors.normal;
  }

  /**
   * Get current font size based on preferences
   */
  public getFontSize(): number {
    switch (this.preferences.accessibility.fontSize) {
      case 'xlarge':
        return this.config.fontSizes.xlarge;
      case 'large':
        return this.config.fontSizes.large;
      default:
        return this.config.fontSizes.normal;
    }
  }

  /**
   * Speak a message using text-to-speech
   */
  public speak(message: string, priority = false): void {
    const span = this.tracer.startSpan('AccessibilityManager.speak');

    try {
      if (!this.config.audio.enabled || !this.preferences.accessibility.audioGuides) {
        return;
      }

      if (priority) {
        // Clear existing speech and speak immediately
        this.speechSynthesis.cancel();
        this.speechQueue = [];
        this.speakMessage(message);
      } else {
        // Add to queue
        this.speechQueue.push(message);
        this.processQueue();
      }

      this.metrics.increment('accessibility.messages_spoken');

    } catch (error) {
      this.logger.error('Error speaking message', error);
      this.metrics.increment('accessibility.errors');

    } finally {
      span.end();
    }
  }

  /**
   * Trigger haptic feedback
   */
  public vibrate(pattern: number | number[]): void {
    const span = this.tracer.startSpan('AccessibilityManager.vibrate');

    try {
      if (!this.config.haptic.enabled || !this.preferences.accessibility.hapticFeedback) {
        return;
      }

      if (typeof navigator.vibrate === 'function') {
        const intensity = this.config.haptic.intensity;
        const scaledPattern = Array.isArray(pattern)
          ? pattern.map(t => t * intensity)
          : pattern * intensity;

        navigator.vibrate(scaledPattern);
        this.metrics.increment('accessibility.haptic_triggered');
      }

    } catch (error) {
      this.logger.error('Error triggering haptic feedback', error);
      this.metrics.increment('accessibility.errors');

    } finally {
      span.end();
    }
  }

  /**
   * Apply visual guides based on preferences
   */
  public applyVisualGuides(element: HTMLElement): void {
    const span = this.tracer.startSpan('AccessibilityManager.applyVisualGuides');

    try {
      if (!this.preferences.accessibility.visualGuides) {
        element.classList.remove('visual-guides');
        return;
      }

      element.classList.add('visual-guides');
      const colors = this.getThemeColors();
      const fontSize = this.getFontSize();

      // Apply visual guide styles
      element.style.setProperty('--guide-color', colors.primary);
      element.style.setProperty('--guide-width', '2px');
      element.style.setProperty('--guide-spacing', `${fontSize / 2}px`);

      this.metrics.increment('accessibility.visual_guides_applied');

    } catch (error) {
      this.logger.error('Error applying visual guides', error);
      this.metrics.increment('accessibility.errors');

    } finally {
      span.end();
    }
  }

  private applyPreferences(): void {
    try {
      // Apply font size
      document.documentElement.style.fontSize = `${this.getFontSize()}px`;

      // Apply color scheme
      const colors = this.getThemeColors();
      Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--color-${key}`, value);
      });

      // Update speech synthesis settings
      if (this.preferences.accessibility.audioGuides) {
        // Note: volume property is not standard, but some browsers support it
        if ('volume' in this.speechSynthesis) {
          (this.speechSynthesis as any).volume = this.config.audio.volume;
        }
      }

      // Apply reduced motion if needed
      document.documentElement.style.setProperty(
        '--reduced-motion',
        this.preferences.accessibility.reducedMotion ? 'reduce' : 'no-preference'
      );

    } catch (error) {
      this.logger.error('Error applying preferences', error);
      this.metrics.increment('accessibility.errors');
    }
  }

  private async initializeSpeechSynthesis(): Promise<void> {
    try {
      // Wait for voices to be loaded
      if (speechSynthesis.getVoices().length === 0) {
        await new Promise<void>(resolve => {
          speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true });
        });
      }

      // Select preferred voice (e.g., system default or user preference)
      const voices = speechSynthesis.getVoices();
      const defaultVoice = voices.find(voice => voice.default) || voices[0];
      
      if (defaultVoice) {
        this.metrics.increment('accessibility.speech_initialized');
      } else {
        throw new Error('No speech synthesis voices available');
      }

    } catch (error) {
      this.logger.error('Error initializing speech synthesis', error);
      this.metrics.increment('accessibility.errors');
    }
  }

  private speakMessage(message: string): void {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = this.config.audio.speechRate;
    utterance.volume = this.config.audio.volume;

    utterance.onend = () => {
      this.processQueue();
    };

    utterance.onerror = (event) => {
      this.logger.error('Speech synthesis error', event);
      this.metrics.increment('accessibility.speech_errors');
      this.processQueue();
    };

    this.speechSynthesis.speak(utterance);
  }

  private processQueue(): void {
    if (this.speechQueue.length > 0 && !this.speechSynthesis.speaking) {
      const message = this.speechQueue.shift();
      if (message) {
        this.speakMessage(message);
      }
    }
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('accessibility.preferences_updated', 'Number of accessibility preference updates');
    this.metrics.defineCounter('accessibility.messages_spoken', 'Number of spoken messages');
    this.metrics.defineCounter('accessibility.haptic_triggered', 'Number of haptic feedback triggers');
    this.metrics.defineCounter('accessibility.visual_guides_applied', 'Number of visual guide applications');
    this.metrics.defineCounter('accessibility.speech_initialized', 'Speech synthesis initialization count');
    this.metrics.defineCounter('accessibility.speech_errors', 'Speech synthesis error count');
    this.metrics.defineCounter('accessibility.errors', 'General accessibility error count');
  }
} 
