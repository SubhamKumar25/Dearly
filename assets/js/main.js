/**
 * DEARLY — Main Global JavaScript
 * Handles navigation, mobile menu, FAQ accordions, audio toggle, and ambient effects.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Navigation Toggle & Drawer Controller
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const mobileBackdrop = document.getElementById('mobile-nav-backdrop');
  const mobileClose = document.getElementById('mobile-drawer-close');

  const openDrawer = () => {
    if (mobileDrawer) mobileDrawer.classList.add('open');
    if (mobileBackdrop) mobileBackdrop.classList.add('show');
    if (mobileToggle) {
      mobileToggle.setAttribute('aria-expanded', 'true');
      mobileToggle.textContent = '✕';
    }
    document.body.classList.add('nav-open');
  };

  const closeDrawer = () => {
    if (mobileDrawer) mobileDrawer.classList.remove('open');
    if (mobileBackdrop) mobileBackdrop.classList.remove('show');
    if (mobileToggle) {
      mobileToggle.setAttribute('aria-expanded', 'false');
      mobileToggle.textContent = '☰';
    }
    document.body.classList.remove('nav-open');
  };

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileDrawer.classList.contains('open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (mobileClose) {
      mobileClose.addEventListener('click', closeDrawer);
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', closeDrawer);
    }

    // Close when clicking nav links inside drawer
    mobileDrawer.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        closeDrawer();
      }
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
