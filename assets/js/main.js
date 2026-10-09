/**
 * DEARLY — Main Global JavaScript
 * Handles navigation, mobile menu, FAQ accordions, audio toggle, and ambient effects.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Navigation Toggle
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
      mobileToggle.textContent = isOpen ? '✕' : '☰';
    });

    // Close when clicking nav links inside drawer
    mobileDrawer.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileToggle.textContent = '☰';
      });
    });
  }

  // 2. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (btn) {
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close others
        faqItems.forEach((other) => {
          if (other !== item) other.classList.remove('open');
        });
        item.classList.toggle('open', !isOpen);
      });
    }
  });

  // 3. Audio Control Widget (if present or on story screens)
  const audioBtn = document.getElementById('btn-audio-toggle');
  if (audioBtn && window.dearlyAudio) {
    audioBtn.addEventListener('click', () => {
      const isMuted = window.dearlyAudio.toggleMute();
      audioBtn.textContent = isMuted ? '🔇' : '🎵';
      audioBtn.setAttribute('title', isMuted ? 'Unmute Sound' : 'Mute Sound');
      if (!isMuted) {
        window.dearlyAudio.playHeartPop();
        window.dearlyAudio.startAmbient();
      }
    });
  }

  // 4. Subtle Ambient Floating Hearts on Homepage
  if (document.body.classList.contains('home-page')) {
    spawnHomeFloatingParticles();
  }
});

function spawnHomeFloatingParticles() {
  const container = document.getElementById('home-ambient-container');
  if (!container) return;

  const icons = ['✨', '💕', '💌', '🌸', '💖'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'ambient-particle';
    p.textContent = icons[i % icons.length];
    p.style.left = `${Math.random() * 90 + 5}vw`;
    p.style.fontSize = `${16 + Math.random() * 16}px`;
    p.style.animationDuration = `${10 + Math.random() * 8}s`;
    p.style.animationDelay = `${Math.random() * 5}s`;
    container.appendChild(p);
  }
}
