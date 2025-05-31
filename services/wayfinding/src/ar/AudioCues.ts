/**
 * AudioCues.ts
 * Handles spatialized audio cues for navigation
 */

import { Vector3 } from 'three';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { Logger } from '../utils/Logger';

interface AudioConfig {
  enabled: boolean;
  volume: number;
  minDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
}

interface AudioCue {
  id: string;
  type: 'turn' | 'destination' | 'warning' | 'info';
  position: Vector3;
  message: string;
  priority: number;
  minInterval: number;
  lastPlayed?: number;
}

export class AudioCues {
  private audioContext: AudioContext;
  private audioBuffers: Map<string, AudioBuffer>;
  private activeCues: Map<string, AudioCue>;
  private listenerPosition: Vector3;
  private listenerOrientation: Vector3;
  private config: AudioConfig;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

  constructor(
    config: AudioConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.config = config;
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;

    this.audioContext = new AudioContext();
    this.audioBuffers = new Map();
    this.activeCues = new Map();
    this.listenerPosition = new Vector3();
    this.listenerOrientation = new Vector3(0, 0, -1);

    this.setupMetrics();
    this.loadAudioAssets();
  }

  /**
   * Add a new audio cue
   */
  public async addCue(cue: AudioCue): Promise<void> {
    const span = this.tracer.startSpan('AudioCues.addCue');

    try {
      if (!this.config.enabled) return;

      // Check if similar cue already exists
      const existing = Array.from(this.activeCues.values())
        .find(c => c.type === cue.type && c.position.distanceTo(cue.position) < 1);

      if (existing) {
        // Update existing cue if needed
        if (cue.priority > existing.priority) {
          this.activeCues.set(cue.id, cue);
        }
        return;
      }

      this.activeCues.set(cue.id, cue);
      this.metrics.increment('audio_cues.added', { type: cue.type });

    } catch (error) {
      this.logger.error('Error adding audio cue', error);
      this.metrics.increment('audio_cues.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Remove an audio cue
   */
  public removeCue(id: string): void {
    const span = this.tracer.startSpan('AudioCues.removeCue');

    try {
      const cue = this.activeCues.get(id);
      if (cue) {
        this.activeCues.delete(id);
        this.metrics.increment('audio_cues.removed', { type: cue.type });
      }

    } catch (error) {
      this.logger.error('Error removing audio cue', error);
      this.metrics.increment('audio_cues.errors');

    } finally {
      span.end();
    }
  }

  /**
   * Update listener position and orientation
   */
  public updateListener(position: Vector3, orientation: Vector3): void {
    const span = this.tracer.startSpan('AudioCues.updateListener');

    try {
      this.listenerPosition.copy(position);
      this.listenerOrientation.copy(orientation);

      // Update Web Audio listener
      const listener = this.audioContext.listener;
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = orientation.x;
      listener.forwardY.value = orientation.y;
      listener.forwardZ.value = orientation.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;

    } catch (error) {
      this.logger.error('Error updating listener', error);
      this.metrics.increment('audio_cues.errors');

    } finally {
      span.end();
    }
  }

  /**
   * Process and play audio cues
   */
  public async processCues(): Promise<void> {
    const span = this.tracer.startSpan('AudioCues.processCues');

    try {
      if (!this.config.enabled) return;

      const now = Date.now();
      const cues = Array.from(this.activeCues.values())
        .sort((a, b) => b.priority - a.priority);

      for (const cue of cues) {
        // Check if enough time has passed since last play
        if (cue.lastPlayed && now - cue.lastPlayed < cue.minInterval) {
          continue;
        }

        // Check if cue is within range
        const distance = this.listenerPosition.distanceTo(cue.position);
        if (distance > this.config.maxDistance) {
          continue;
        }

        // Play the cue
        await this.playCue(cue, distance);
        cue.lastPlayed = now;
      }

    } catch (error) {
      this.logger.error('Error processing audio cues', error);
      this.metrics.increment('audio_cues.errors');

    } finally {
      span.end();
    }
  }

  private async playCue(cue: AudioCue, distance: number): Promise<void> {
    try {
      const buffer = this.audioBuffers.get(cue.type);
      if (!buffer) return;

      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create spatial panner
      const panner = this.audioContext.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance = this.config.minDistance;
      panner.maxDistance = this.config.maxDistance;
      panner.rolloffFactor = this.config.rolloffFactor;
      panner.coneInnerAngle = this.config.coneInnerAngle;
      panner.coneOuterAngle = this.config.coneOuterAngle;
      panner.coneOuterGain = this.config.coneOuterGain;
      panner.positionX.value = cue.position.x;
      panner.positionY.value = cue.position.y;
      panner.positionZ.value = cue.position.z;

      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = this.config.volume * (1 - distance / this.config.maxDistance);

      // Connect nodes
      source.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Play audio
      source.start(0);
      this.metrics.increment('audio_cues.played', { type: cue.type });

      // Clean up when done
      source.onended = () => {
        source.disconnect();
        panner.disconnect();
        gainNode.disconnect();
      };

    } catch (error) {
      this.logger.error('Error playing audio cue', error);
      this.metrics.increment('audio_cues.errors');
    }
  }

  private async loadAudioAssets(): Promise<void> {
    try {
      const audioFiles = {
        turn: '/assets/audio/turn.mp3',
        destination: '/assets/audio/destination.mp3',
        warning: '/assets/audio/warning.mp3',
        info: '/assets/audio/info.mp3'
      };

      for (const [type, path] of Object.entries(audioFiles)) {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.audioBuffers.set(type, audioBuffer);
      }

      this.metrics.increment('audio_cues.assets_loaded');

    } catch (error) {
      this.logger.error('Error loading audio assets', error);
      this.metrics.increment('audio_cues.errors');
    }
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('audio_cues.added', 'Number of audio cues added', ['type']);
    this.metrics.defineCounter('audio_cues.removed', 'Number of audio cues removed', ['type']);
    this.metrics.defineCounter('audio_cues.played', 'Number of audio cues played', ['type']);
    this.metrics.defineCounter('audio_cues.errors', 'Number of audio cue errors');
    this.metrics.defineCounter('audio_cues.assets_loaded', 'Number of audio assets loaded');
    this.metrics.defineGauge('audio_cues.active', 'Number of active audio cues');
  }
} 