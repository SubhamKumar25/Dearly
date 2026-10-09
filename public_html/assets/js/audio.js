/**
 * DEARLY — Peaceful Romantic Background Music & Sound Effects (v2.1)
 * 
 * Features:
 * - Peaceful romantic piano soundtrack (Erik Satie: Gymnopédie No. 1, performed by Kevin MacLeod)
 * - Royalty-free Creative Commons (CC-BY 3.0) licensed audio
 * - Low default volume (12-15%) with gentle fade-in (1.8s) and fade-out (0.8s)
 * - Strict adherence to browser autoplay policies: starts only upon user gesture
 * - Continuous, uninterrupted background playback across recipient story screens
 * - Subtle, beautiful pink-and-cream music control widget with animated wave equalizer
 * - Lightweight Web Audio API sound effects for interactive feedback
 */

class DearlyAudio {
  constructor() {
    this.audioElement = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.targetVolume = 0.14; // Default low volume (14%)
    this.fadeTimer = null;
    this.ctx = null;
    this.listeners = [];

    // Ensure audio element is ready on DOM load
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        this.init();
      }
    }
  }

  /**
   * Initialize audio element and bind any controls on the page
   */
  init() {
    this.initAudioElement();
    this.bindControls();
    this.syncUI();
  }

  /**
   * Lazily initialize Web Audio Context for UI sound effects
   */
  initWebAudio() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Create or attach to the persistent HTML5 background audio element
   */
  initAudioElement() {
    if (this.audioElement || typeof document === 'undefined') return;

    let el = document.getElementById('dearly-bg-music');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'dearly-bg-music';
      el.loop = true;
      el.preload = 'none'; // Save bandwidth until user interacts

      // Preferred lightweight OGG first, MP3 fallback
      const sourceOgg = document.createElement('source');
      sourceOgg.src = 'assets/audio/romantic-piano.ogg';
      sourceOgg.type = 'audio/ogg';

      const sourceMp3 = document.createElement('source');
      sourceMp3.src = 'assets/audio/romantic-piano.mp3';
      sourceMp3.type = 'audio/mpeg';

      el.appendChild(sourceOgg);
      el.appendChild(sourceMp3);
      document.body.appendChild(el);
    }

    el.volume = 0.0; // Start at 0 for smooth fade-in

    el.addEventListener('play', () => {
      this.isPlaying = true;
      this.syncUI();
      this.notifyListeners('play');
    });

    el.addEventListener('pause', () => {
      this.isPlaying = false;
      this.syncUI();
      this.notifyListeners('pause');
    });

    el.addEventListener('ended', () => {
      this.isPlaying = false;
      this.syncUI();
      this.notifyListeners('ended');
    });

    el.addEventListener('error', (e) => {
      console.warn('DEARLY audio note: Could not load audio file.', e);
      this.isPlaying = false;
      this.syncUI();
    });

    this.audioElement = el;
  }

  /**
   * Start playback with a gentle, smooth fade-in
   */
  async playWithFadeIn(targetVol = this.targetVolume, durationMs = 1800) {
    this.initAudioElement();
    if (!this.audioElement) return;

    this.isMuted = false;
    this.clearFade();

    try {
      this.initWebAudio();
      
      // If already playing, just fade volume to target if needed
      if (!this.audioElement.paused && this.isPlaying) {
        this.fadeTo(targetVol, durationMs);
        return;
      }

      this.audioElement.volume = 0.0;
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        await playPromise;
      }

      this.fadeTo(targetVol, durationMs);
    } catch (err) {
      // Browser autoplay policy blocked or user did not interact yet
      console.info('DEARLY: Playback deferred until user gesture.', err.message);
      this.isPlaying = false;
      this.syncUI();
    }
  }

  /**
   * Pause playback with a gentle fade-out to silence
   */
  pauseWithFadeOut(durationMs = 800) {
    if (!this.audioElement || this.audioElement.paused) {
      this.isPlaying = false;
      this.syncUI();
      return;
    }

    this.clearFade();
    this.fadeTo(0.0, durationMs, () => {
      if (this.audioElement) {
        this.audioElement.pause();
      }
      this.isPlaying = false;
      this.syncUI();
    });
  }

  /**
   * Toggle between play and pause with gentle volume ramps
   */
  togglePlay() {
    if (this.isPlaying && this.audioElement && !this.audioElement.paused) {
      this.pauseWithFadeOut();
    } else {
      this.playWithFadeIn();
    }
    return this.isPlaying;
  }

  /**
   * Toggle mute status
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseWithFadeOut();
    } else {
      this.playWithFadeIn();
    }
    return this.isMuted;
  }

  /**
   * Smooth volume interpolation helper
   */
  fadeTo(finalVolume, durationMs, onComplete) {
    this.clearFade();
    if (!this.audioElement) return;

    const startVolume = this.audioElement.volume;
    const startTime = performance.now();
    const stepInterval = 40; // ~25 fps volume update

    this.fadeTimer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Smooth ease-out cubic curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVolume + (finalVolume - startVolume) * eased;

      if (this.audioElement) {
        this.audioElement.volume = Math.max(0, Math.min(1, current));
      }

      if (progress >= 1) {
        this.clearFade();
        if (typeof onComplete === 'function') onComplete();
      }
    }, stepInterval);
  }

  clearFade() {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  /**
   * Keep all music buttons & indicators on the page synchronized
   */
  syncUI() {
    const isNowPlaying = this.isPlaying && this.audioElement && !this.audioElement.paused;

    // 1. Sync header / floating toggle buttons
    const toggles = document.querySelectorAll('#btn-audio-toggle, .btn-music-toggle, .music-player-pill');
    toggles.forEach((el) => {
      el.classList.toggle('is-playing', isNowPlaying);
      el.classList.toggle('is-paused', !isNowPlaying);
      el.setAttribute('aria-pressed', isNowPlaying ? 'true' : 'false');

      const label = el.querySelector('.music-label');
      if (label) {
        label.textContent = isNowPlaying ? 'Music Playing ♫' : 'Romantic Music';
      }

      const icon = el.querySelector('.music-icon');
      if (icon) {
        icon.textContent = isNowPlaying ? '🎵' : '🎶';
      }
    });

    // 2. Sync recipient invitation button (on Envelope opening screen)
    const inviteBtn = document.getElementById('btn-story-play-music');
    if (inviteBtn) {
      inviteBtn.classList.toggle('is-playing', isNowPlaying);
      inviteBtn.setAttribute('aria-pressed', isNowPlaying ? 'true' : 'false');
      const label = inviteBtn.querySelector('.invite-label');
      if (label) {
        label.textContent = isNowPlaying ? 'Music Playing ♫ (Tap to Pause)' : 'Play Music';
      }
      const icon = inviteBtn.querySelector('.invite-icon');
      if (icon) {
        icon.textContent = isNowPlaying ? '⏸' : '🎵';
      }
    }
  }

  /**
   * Bind click events to music player elements in DOM
   */
  bindControls() {
    document.querySelectorAll('#btn-audio-toggle, .btn-music-toggle').forEach((btn) => {
      if (!btn.dataset.dearlyBound) {
        btn.dataset.dearlyBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.togglePlay();
        });
      }
    });
  }

  onStateChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners(state) {
    this.listeners.forEach((cb) => {
      try {
        cb(state, this.isPlaying);
      } catch (e) {}
    });
  }

  // --- Sound Effects (Soft UI feedback chimes) ---

  playChime(frequency = 440, type = 'sine', duration = 0.8, volume = 0.05) {
    if (this.isMuted) return;
    try {
      this.initWebAudio();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playHeartPop() {
    this.playChime(523.25, 'sine', 0.35, 0.05);
    setTimeout(() => this.playChime(659.25, 'sine', 0.45, 0.04), 70);
  }

  playSlide() {
    this.playChime(392.00, 'triangle', 0.3, 0.03);
  }

  playCelebration() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playChime(freq, 'sine', 0.6, 0.05), idx * 110);
    });
  }

  // Backwards compatibility aliases
  startAmbient() {
    this.playWithFadeIn();
  }

  stopAmbient() {
    this.pauseWithFadeOut();
  }
}

// Global singleton instance
window.dearlyAudio = new DearlyAudio();
