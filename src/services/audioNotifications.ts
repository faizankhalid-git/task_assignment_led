export type SoundType =
  | 'chime-soft'
  | 'chime-medium'
  | 'chime-loud'
  | 'beep-single'
  | 'beep-double'
  | 'beep-triple'
  | 'tone-ascending'
  | 'tone-descending'
  | 'tone-neutral'
  | 'alert-warning'
  | 'alert-critical'
  | 'alert-informational';

export interface NotificationSettings {
  enabled: boolean;
  soundType: SoundType;
  volume: number;
}

export class AudioNotificationService {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.7;

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext();
    }
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume / 100));
  }

  private async resumeContext() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private createOscillator(
    frequency: number,
    type: OscillatorType = 'sine',
    startTime: number = 0,
    duration: number = 0.1
  ): { oscillator: OscillatorNode; gainNode: GainNode } {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now + startTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume, now + startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + startTime + duration);

    oscillator.start(now + startTime);
    oscillator.stop(now + startTime + duration);

    return { oscillator, gainNode };
  }

  private playChime(intensity: 'soft' | 'medium' | 'loud') {
    if (!this.audioContext) return;

    const frequencies = intensity === 'soft'
      ? [523.25, 659.25, 783.99]
      : intensity === 'medium'
      ? [659.25, 783.99, 987.77]
      : [783.99, 987.77, 1174.66];

    frequencies.forEach((freq, index) => {
      this.createOscillator(freq, 'sine', index * 0.1, 0.3);
    });
  }

  private playBeep(count: number) {
    if (!this.audioContext) return;

    for (let i = 0; i < count; i++) {
      this.createOscillator(800, 'square', i * 0.2, 0.1);
    }
  }

  private playTone(direction: 'ascending' | 'descending' | 'neutral') {
    if (!this.audioContext) return;

    if (direction === 'neutral') {
      this.createOscillator(440, 'sine', 0, 0.3);
      return;
    }

    const startFreq = direction === 'ascending' ? 300 : 800;
    const endFreq = direction === 'ascending' ? 800 : 300;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    oscillator.frequency.setValueAtTime(startFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + 0.5);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  private playAlert(type: 'warning' | 'critical' | 'informational') {
    if (!this.audioContext) return;

    if (type === 'warning') {
      for (let i = 0; i < 2; i++) {
        this.createOscillator(600, 'square', i * 0.15, 0.1);
        this.createOscillator(800, 'square', i * 0.15 + 0.05, 0.1);
      }
    } else if (type === 'critical') {
      for (let i = 0; i < 3; i++) {
        this.createOscillator(1000, 'sawtooth', i * 0.2, 0.15);
      }
    } else {
      this.createOscillator(500, 'sine', 0, 0.2);
      this.createOscillator(600, 'sine', 0.1, 0.2);
    }
  }

  async playSound(soundType: SoundType, volume?: number) {
    if (!this.audioContext) {
      console.error('AudioContext not available');
      throw new Error('AudioContext not available');
    }

    console.log(`Audio Context state: ${this.audioContext.state}`);

    try {
      await this.resumeContext();
      console.log(`After resume - Audio Context state: ${this.audioContext.state}`);

      if (volume !== undefined) {
        const previousVolume = this.masterVolume;
        this.setMasterVolume(volume);

        this.playSoundInternal(soundType);

        setTimeout(() => {
          this.masterVolume = previousVolume;
        }, 1000);
      } else {
        this.playSoundInternal(soundType);
      }

      console.log(`Successfully played sound: ${soundType}`);
    } catch (error) {
      console.error('Error playing sound:', error);
      throw error;
    }
  }

  private playSoundInternal(soundType: SoundType) {
    switch (soundType) {
      case 'chime-soft':
        this.playChime('soft');
        break;
      case 'chime-medium':
        this.playChime('medium');
        break;
      case 'chime-loud':
        this.playChime('loud');
        break;
      case 'beep-single':
        this.playBeep(1);
        break;
      case 'beep-double':
        this.playBeep(2);
        break;
      case 'beep-triple':
        this.playBeep(3);
        break;
      case 'tone-ascending':
        this.playTone('ascending');
        break;
      case 'tone-descending':
        this.playTone('descending');
        break;
      case 'tone-neutral':
        this.playTone('neutral');
        break;
      case 'alert-warning':
        this.playAlert('warning');
        break;
      case 'alert-critical':
        this.playAlert('critical');
        break;
      case 'alert-informational':
        this.playAlert('informational');
        break;
    }
  }

  getSoundDisplayName(soundType: SoundType): string {
    const names: Record<SoundType, string> = {
      'chime-soft': 'Soft Chime',
      'chime-medium': 'Medium Chime',
      'chime-loud': 'Loud Chime',
      'beep-single': 'Single Beep',
      'beep-double': 'Double Beep',
      'beep-triple': 'Triple Beep',
      'tone-ascending': 'Ascending Tone',
      'tone-descending': 'Descending Tone',
      'tone-neutral': 'Neutral Tone',
      'alert-warning': 'Warning Alert',
      'alert-critical': 'Critical Alert',
      'alert-informational': 'Informational Alert'
    };
    return names[soundType];
  }

  getAllSoundTypes(): SoundType[] {
    return [
      'chime-soft',
      'chime-medium',
      'chime-loud',
      'beep-single',
      'beep-double',
      'beep-triple',
      'tone-ascending',
      'tone-descending',
      'tone-neutral',
      'alert-warning',
      'alert-critical',
      'alert-informational'
    ];
  }
}

export const audioService = new AudioNotificationService();
