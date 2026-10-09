/**
 * DEARLY — Ambient Audio & Sound Effects
 * Uses Web Audio API for zero-dependency, gentle pastel ambient chimes and feedback.
 * Strictly adheres to autoplay policies: requires user interaction and provides mute/unmute.
 */

class DearlyAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isPlayingAmbient = false;
    this.ambientTimer = null;
    this.scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C4, D4, E4, G4, A4, C5 (Pentatonic, calming)
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAmbient();
    }
    return this.isMuted;
  }

  /**
   * Play a gentle soft chime note
   */
  playChime(frequency = 440, type = 'sine', duration = 0.8, volume = 0.08) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      // Smooth attack & decay
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  /**
   * Cute heart tap chime
   */
  playHeartPop() {
    this.playChime(523.25, 'sine', 0.4, 0.06);
    setTimeout(() => this.playChime(659.25, 'sine', 0.5, 0.05), 80);
  }

  /**
   * Step transition sound
   */
  playSlide() {
    this.playChime(392.00, 'triangle', 0.35, 0.04);
  }

  /**
   * Celebration fanfares
   */
  playCelebration() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playChime(freq, 'sine', 0.7, 0.07), idx * 120);
    });
  }

  /**
   * Ambient gentle music loop (soft melodic chimes)
   */
  startAmbient() {
    if (this.isMuted || this.isPlayingAmbient) return;
    this.isPlayingAmbient = true;

    const playNextRandomNote = () => {
      if (!this.isPlayingAmbient || this.isMuted) return;
      const note = this.scale[Math.floor(Math.random() * this.scale.length)];
      this.playChime(note, 'sine', 1.8, 0.035);
      // Wait between 2.2 to 4.5 seconds for next note
      const nextDelay = 2200 + Math.random() * 2300;
      this.ambientTimer = setTimeout(playNextRandomNote, nextDelay);
    };

    playNextRandomNote();
  }

  stopAmbient() {
    this.isPlayingAmbient = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}

// Global instance
window.dearlyAudio = new DearlyAudio();
