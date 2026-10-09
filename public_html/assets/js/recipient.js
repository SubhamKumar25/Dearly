/**
 * DEARLY — Recipient Interactive Story Engine
 * Powers the multi-screen, emotionally animated recipient story experience
 * for Love, Apology, Birthday, and Proposal gifts.
 */

class DearlyStoryPlayer {
  constructor(options = {}) {
    this.containerEl = options.container || document.getElementById('story-container');
    this.isPreview = options.isPreview || false;
    this.data = options.data || null;
    this.currentScreenIndex = 0;
    this.screens = [];
    this.isMuted = false;
    this.hasBlownCandles = false;
  }

  init(data) {
    if (data) this.data = data;
    if (!this.data) {
      this.renderNotFound();
      return;
    }

    // Set Theme Class on Body
    document.body.className = `story-mode theme-${this.data.type || 'love'}`;

    // Apply ambient particles based on category
    this.spawnAmbientParticles(this.data.type || 'love');

    // Build the dynamic screen sequence
    this.buildScreenSequence();

    // Render the initial opening screen
    this.currentScreenIndex = 0;
    this.renderCurrentScreen();
  }

  buildScreenSequence() {
    this.screens = [];

    // Screen 1: The Envelope / Opening Cover
    this.screens.push({
      type: 'opening',
      render: () => this.renderOpeningScreen()
    });

    // Screen 2+: Message Cards (one by one)
    if (this.data.messages && this.data.messages.length > 0) {
      this.data.messages.forEach((msg, idx) => {
        this.screens.push({
          type: 'message',
          index: idx,
          total: this.data.messages.length,
          content: msg,
          render: () => this.renderMessageScreen(msg, idx, this.data.messages.length)
        });
      });
    }

    // Screen: Memories / Photo Gallery (skipped gracefully if no photos)
    const validPhotos = (this.data.photos || [])
      .map(p => this.getPhotoSrc(p))
      .filter(src => src && src.length > 0);

    if (validPhotos.length > 0) {
      this.screens.push({
        type: 'memories',
        photos: validPhotos,
        render: () => this.renderMemoriesScreen(validPhotos)
      });
    }

    // Screen: Letter (if letter exists)
    if (this.data.letter && this.data.letter.trim().length > 0) {
      this.screens.push({
        type: 'letter',
        content: this.data.letter,
        render: () => this.renderLetterScreen(this.data.letter)
      });
    }

    // Screen: Final Grand Reveal (customized by category)
    this.screens.push({
      type: 'reveal',
      category: this.data.type,
      render: () => this.renderRevealScreen()
    });
  }

  renderCurrentScreen() {
    if (!this.containerEl) return;
    const current = this.screens[this.currentScreenIndex];
    if (!current) return;

    this.containerEl.innerHTML = `
      <div class="story-screen-wrapper story-screen-enter" id="active-story-screen">
        ${this.renderProgressDots()}
        ${current.render()}
      </div>
    `;

    this.bindScreenEvents(current);

    // Play subtle transition chime
    if (this.currentScreenIndex > 0 && window.dearlyAudio) {
      window.dearlyAudio.playSlide();
    }
  }

  renderProgressDots() {
    let dots = '<div class="story-progress-bar">';
    for (let i = 0; i < this.screens.length; i++) {
      const activeClass = i === this.currentScreenIndex ? 'active' : (i < this.currentScreenIndex ? 'completed' : '');
      dots += `<span class="story-progress-pip ${activeClass}"></span>`;
    }
    dots += '</div>';
    return dots;
  }

  // --- Screen 1: Opening Screen ---
  renderOpeningScreen() {
    const recipient = this.data.nickname || this.data.recipient_name || 'Someone Special';
    const sender = this.data.sender_name || 'Someone who cares';

    let promptText = 'I made something special for you.';
    if (this.data.type === 'apology') promptText = 'There is something I really want to say to you.';
    if (this.data.type === 'birthday') promptText = 'Today is all about celebrating you! 🎈';
    if (this.data.type === 'proposal') promptText = 'A little story about you, me, and our journey.';

    return `
      <div class="story-card story-card-opening text-center">
        <div class="story-badge">💌 A Private Gift For You</div>
        <h1 class="story-title" style="margin-top: 18px; margin-bottom: 8px;">
          Hey <span class="text-gradient">${this.escapeHtml(recipient)}</span> 💕
        </h1>
        <p class="story-subtitle" style="margin-bottom: 28px; color: var(--text-muted);">
          ${promptText}
        </p>

        <!-- Interactive Envelope -->
        <div class="envelope-interactive" id="story-opening-envelope" title="Tap to open">
          <div class="envelope-body">
            <span style="font-size: 2.2rem;">💌</span>
          </div>
          <div class="envelope-flap"></div>
          <div class="envelope-seal">❤️</div>
        </div>

        <p style="font-size: 0.88rem; color: var(--text-light); margin-top: 24px; margin-bottom: 24px;">
          From ${this.escapeHtml(sender)}
        </p>

        <button type="button" class="btn btn-primary btn-lg" id="btn-open-story">
          Open Your Gift ✨
        </button>
      </div>
    `;
  }

  // --- Screen 2: Message Screen ---
  renderMessageScreen(messageText, index, total) {
    let badgeText = `A Note For You • ${index + 1} of ${total}`;
    if (this.data.type === 'apology') badgeText = `From My Heart • ${index + 1} of ${total}`;
    if (this.data.type === 'birthday') badgeText = `Birthday Memory • ${index + 1} of ${total}`;
    if (this.data.type === 'proposal') badgeText = `Chapter ${index + 1} • Looking Back`;

    return `
      <div class="story-card story-card-message text-center">
        <div class="story-badge">${badgeText}</div>

        <div class="story-quote-box">
          <div class="story-quote-mark">“</div>
          <p class="story-quote-text">${this.escapeHtml(messageText)}</p>
          <div class="story-quote-mark end">”</div>
        </div>

        <div class="story-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-story-prev">← Previous</button>
          <button type="button" class="btn btn-primary" id="btn-story-next">Next →</button>
        </div>
      </div>
    `;
  }

  // --- Screen 3: Memories Screen ---
  renderMemoriesScreen(photos) {
    let photoItems = '';
    photos.forEach((photo, idx) => {
      const src = this.getPhotoSrc(photo);
      if (!src) return;
      const tilt = (idx % 2 === 0 ? -2.5 : 2.5) * (1 + (idx * 0.4));
      photoItems += `
        <div class="polaroid-frame" style="--tilt: ${tilt}deg; margin-bottom: 24px;">
          <img src="${src}" class="polaroid-img" alt="Special memory ${idx + 1}" loading="eager" onerror="this.onerror=null; this.src='assets/images/logo.svg';">
          <div class="polaroid-caption">Memory #${idx + 1} ✨</div>
        </div>
      `;
    });

    return `
      <div class="story-card story-card-memories text-center">
        <div class="story-badge">📸 Precious Memories</div>
        <h2 style="font-size: 1.6rem; margin-top: 14px; margin-bottom: 20px;">
          Moments I Cherish With You
        </h2>

        <div class="memories-gallery-scroll">
          ${photoItems}
        </div>

        <div class="story-actions" style="margin-top: 24px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-story-prev">← Previous</button>
          <button type="button" class="btn btn-primary" id="btn-story-next">Continue →</button>
        </div>
      </div>
    `;
  }

  // --- Screen 4: Letter Screen ---
  renderLetterScreen(letterText) {
    const sender = this.data.sender_name || 'Someone who loves you';
    const recipient = this.data.nickname || this.data.recipient_name || 'My Dear';

    return `
      <div class="story-card story-card-letter text-center">
        <div class="story-badge">📜 A Personal Letter</div>
        <h2 style="font-size: 1.5rem; margin-top: 12px; margin-bottom: 18px;">
          Dear ${this.escapeHtml(recipient)},
        </h2>

        <div class="letter-sheet">
          ${this.formatLetterParagraphs(letterText)}
          <div class="letter-signature">
            Always yours,<br>
            ${this.escapeHtml(sender)}
          </div>
        </div>

        <div class="story-actions" style="margin-top: 24px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-story-prev">← Previous</button>
          <button type="button" class="btn btn-primary" id="btn-story-next">One Last Thing →</button>
        </div>
      </div>
    `;
  }

  // --- Screen 5: Reveal Screen (by category) ---
  renderRevealScreen() {
    const sender = this.data.sender_name || 'Someone who cares';
    const recipient = this.data.nickname || this.data.recipient_name || 'You';
    const type = this.data.type || 'love';

    let contentHtml = '';

    if (type === 'apology') {
      contentHtml = `
        <div class="story-badge">🕊️ A Sincere Promise</div>
        <h2 style="font-size: 1.8rem; margin-top: 16px; margin-bottom: 12px;">
          I Hope You Can Forgive Me
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
          You mean too much to me for silence or distance. I promise to listen, learn, and do better.
        </p>

        <div class="reveal-response-box" style="margin-bottom: 28px;">
          <p style="font-weight: 600; font-size: 0.92rem; color: var(--text-muted); margin-bottom: 12px;">Send a quick feeling back to ${this.escapeHtml(sender)}:</p>
          <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm response-chip-btn" data-reaction="❤️ I forgive you">❤️ I forgive you</button>
            <button type="button" class="btn btn-secondary btn-sm response-chip-btn" data-reaction="💬 Let's talk">💬 Let's talk</button>
            <button type="button" class="btn btn-secondary btn-sm response-chip-btn" data-reaction="🥺 Needed to hear this">🥺 Needed this</button>
          </div>
          <div id="reaction-feedback" style="margin-top: 12px; font-weight: 600; color: var(--color-primary); display: none;"></div>
        </div>
      `;
    } else if (type === 'birthday') {
      contentHtml = `
        <div class="story-badge">🎂 Make A Wish!</div>
        <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 8px;">
          Happy Birthday, <span class="text-gradient">${this.escapeHtml(recipient)}</span>! 🎉
        </h2>
        <p style="color: var(--text-muted); font-size: 1.02rem; margin-bottom: 20px;">
          Tap the birthday candle to blow it out and make your secret wish!
        </p>

        <!-- Interactive Birthday Candle -->
        <div class="birthday-cake-interactive" id="birthday-cake-widget" style="margin: 0 auto 24px; cursor: pointer; text-align: center;">
          <div class="candle-wrapper" style="font-size: 3.5rem; line-height: 1; user-select: none;">
            <span id="candle-flame" style="display: inline-block; animation: flameFlicker 1.4s infinite; transition: all 0.4s ease;">🔥</span><br>
            <span style="font-size: 4rem;">🎂</span>
          </div>
          <p id="candle-prompt" style="font-size: 0.88rem; font-weight: 700; color: var(--color-birthday); margin-top: 8px;">
            Tap the cake to blow out candle! 💨
          </p>
        </div>
      `;
    } else if (type === 'proposal') {
      const question = this.data.reason || 'Will you marry me? 💍';
      contentHtml = `
        <div class="story-badge">💍 Forever & Always</div>
        <h2 style="font-size: clamp(1.8rem, 4vw, 2.4rem); margin-top: 16px; margin-bottom: 14px; color: var(--color-primary);">
          ${this.escapeHtml(question)}
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; margin-bottom: 28px;">
          Every single day with you is my favourite adventure.
        </p>

        <div class="proposal-buttons-container" style="display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 28px; position: relative;">
          <button type="button" class="btn btn-primary btn-lg" id="btn-proposal-yes" style="min-width: 200px; font-size: 1.2rem; box-shadow: 0 8px 24px rgba(244, 63, 94, 0.4);">
            YES! A Million Times YES! 💖
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-proposal-maybe" style="color: var(--text-light); transition: all 0.2s ease;">
            Let me think... 😜
          </button>
        </div>
        <div id="proposal-celebration-banner" style="display: none; padding: 16px; background: #FFF1F2; border-radius: 16px; border: 1px solid #FECDD3; color: var(--color-primary); font-weight: 700; font-size: 1.1rem; margin-bottom: 20px;">
          SHE / HE SAID YES! 🎉🥂💍 Forever starts now!
        </div>
      `;
    } else {
      // Default / Love Reveal
      contentHtml = `
        <div class="story-badge">💖 With All My Heart</div>
        <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 12px;">
          You Are My Favorite Person
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
          Thank you for being in my life. Every day feels a little softer, happier, and brighter with you.
        </p>

        <div style="margin-bottom: 24px;">
          <button type="button" class="btn btn-primary btn-lg animate-heartbeat" id="btn-send-love-back">
            Send Love Back 💕
          </button>
        </div>
        <div id="love-sent-banner" style="display: none; color: var(--color-primary); font-weight: 700; margin-bottom: 18px;">
          Love sent to ${this.escapeHtml(sender)}! 🥰✨
        </div>
      `;
    }

    return `
      <div class="story-card story-card-reveal text-center">
        ${contentHtml}

        <div class="reveal-footer-actions" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-restart-story">
            ↺ Replay Experience
          </button>
          <a href="index.html" class="btn btn-ghost btn-sm" style="font-size: 0.86rem; color: var(--text-muted);">
            Create a DEARLY for someone 💌
          </a>
        </div>
      </div>
    `;
  }

  bindScreenEvents(current) {
    // 1. Opening Screen Events
    const btnOpen = document.getElementById('btn-open-story');
    const envelope = document.getElementById('story-opening-envelope');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        if (envelope) envelope.classList.add('opened');
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
        setTimeout(() => this.nextScreen(), 500);
      });
    }
    if (envelope) {
      envelope.addEventListener('click', () => {
        envelope.classList.add('opened');
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
        setTimeout(() => this.nextScreen(), 500);
      });
    }

    // 2. Next / Prev navigation
    const btnNext = document.getElementById('btn-story-next');
    const btnPrev = document.getElementById('btn-story-prev');
    if (btnNext) {
      btnNext.addEventListener('click', () => this.nextScreen());
    }
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.prevScreen());
    }

    // 3. Restart Experience
    const btnRestart = document.getElementById('btn-restart-story');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.currentScreenIndex = 0;
        this.renderCurrentScreen();
      });
    }

    // 4. Birthday Candle Blowing
    const cakeWidget = document.getElementById('birthday-cake-widget');
    if (cakeWidget) {
      cakeWidget.addEventListener('click', () => {
        const flame = document.getElementById('candle-flame');
        const prompt = document.getElementById('candle-prompt');
        if (flame && !this.hasBlownCandles) {
          this.hasBlownCandles = true;
          flame.style.animation = 'blowOutSmoke 0.6s forwards';
          prompt.textContent = '✨ Wish made! Happy Birthday! ✨';
          prompt.style.color = '#10B981';
          if (window.dearlyAudio) window.dearlyAudio.playCelebration();
          this.triggerConfettiBurst();
        }
      });
    }

    // 5. Proposal "Yes" / "Maybe" playful interaction
    const btnYes = document.getElementById('btn-proposal-yes');
    const btnMaybe = document.getElementById('btn-proposal-maybe');
    const banner = document.getElementById('proposal-celebration-banner');
    if (btnYes) {
      btnYes.addEventListener('click', () => {
        if (banner) banner.style.display = 'block';
        if (window.dearlyAudio) window.dearlyAudio.playCelebration();
        this.triggerHeartExplosion();
      });
    }
    if (btnMaybe) {
      btnMaybe.addEventListener('mouseover', () => {
        // Playful evasive button
        const randomX = (Math.random() - 0.5) * 120;
        const randomY = (Math.random() - 0.5) * 60;
        btnMaybe.style.transform = `translate(${randomX}px, ${randomY}px)`;
      });
      btnMaybe.addEventListener('click', () => {
        btnMaybe.textContent = 'Just kidding, YES! 💕';
        btnMaybe.classList.add('btn-primary');
        if (btnYes) btnYes.click();
      });
    }

    // 6. Love send back
    const btnLove = document.getElementById('btn-send-love-back');
    const loveBanner = document.getElementById('love-sent-banner');
    if (btnLove) {
      btnLove.addEventListener('click', () => {
        const sender = this.data.sender_name || 'your loved one';
        
        // Audio & celebration fireworks
        if (window.dearlyAudio) window.dearlyAudio.playCelebration();
        this.triggerHeartExplosion();

        // Update button visual state
        btnLove.textContent = 'Love Sent Back! 🥰✨';
        btnLove.classList.remove('animate-heartbeat');
        btnLove.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
        btnLove.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.35)';
        btnLove.style.pointerEvents = 'none';

        // Trigger floating website notification toast
        this.showLoveNotification(sender);

        // Update banner text
        if (loveBanner) {
          loveBanner.style.display = 'block';
          loveBanner.innerHTML = `💌 Love delivered to <strong>${this.escapeHtml(sender)}</strong>! 💕`;
        }
      });
    }

    // 7. Apology Response Chips
    const chips = this.containerEl.querySelectorAll('.response-chip-btn');
    const feedback = document.getElementById('reaction-feedback');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const reaction = chip.getAttribute('data-reaction');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.textContent = `Response sent: "${reaction}" 💌`;
        }
        chips.forEach((c) => (c.disabled = true));
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
      });
    });
  }

  nextScreen() {
    if (this.currentScreenIndex < this.screens.length - 1) {
      this.currentScreenIndex++;
      this.renderCurrentScreen();
    }
  }

  prevScreen() {
    if (this.currentScreenIndex > 0) {
      this.currentScreenIndex--;
      this.renderCurrentScreen();
    }
  }

  triggerConfettiBurst() {
    const symbols = ['🎉', '✨', '🎈', '🎂', '⭐', '🎊'];
    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div');
      p.className = 'ambient-particle';
      p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      p.style.left = `${Math.random() * 95}vw`;
      p.style.fontSize = `${16 + Math.random() * 24}px`;
      p.style.animationDuration = `${2.5 + Math.random() * 3}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5500);
    }
  }

  triggerHeartExplosion() {
    const hearts = ['💖', '💕', '❤️', '🌸', '✨'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'ambient-particle';
      p.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      p.style.left = `${Math.random() * 95}vw`;
      p.style.fontSize = `${18 + Math.random() * 28}px`;
      p.style.animationDuration = `${2 + Math.random() * 3}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5500);
    }
  }

  spawnAmbientParticles(category) {
    let container = document.getElementById('ambient-particles');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ambient-particles';
      container.className = 'ambient-particles-container';
      document.body.appendChild(container);
    }

    const itemsMap = {
      love: ['💕', '💖', '✨', '🌸', '🤍'],
      apology: ['🕊️', '💜', '✨', '💌', '🌸'],
      birthday: ['🎈', '✨', '🎉', '⭐', '🎂'],
      proposal: ['💍', '💖', '✨', '🌹', '✨']
    };
    const items = itemsMap[category] || itemsMap['love'];

    // Spawn 12 gentle floating ambient particles
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'ambient-particle';
      p.textContent = items[i % items.length];
      p.style.left = `${Math.random() * 90 + 5}vw`;
      p.style.fontSize = `${14 + Math.random() * 18}px`;
      p.style.animationDuration = `${8 + Math.random() * 8}s`;
      p.style.animationDelay = `${Math.random() * 6}s`;
      container.appendChild(p);
    }
  }

  renderNotFound() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = `
      <div class="story-card text-center" style="max-width: 460px; margin: 40px auto; padding: 40px 24px;">
        <span style="font-size: 3rem;">💌</span>
        <h2 style="font-size: 1.6rem; margin-top: 16px; margin-bottom: 10px;">Gift Not Found</h2>
        <p style="color: var(--text-muted); font-size: 0.98rem; margin-bottom: 24px;">
          This link may have expired or been mistyped. Check with the person who sent it to you!
        </p>
        <a href="index.html" class="btn btn-primary">Go to DEARLY Homepage</a>
      </div>
    `;
  }

  formatLetterParagraphs(text) {
    return text
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${this.escapeHtml(p)}</p>`)
      .join('');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getPhotoSrc(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    if (typeof photo === 'object') {
      return photo.dataUrl || photo.url || photo.src || '';
    }
    return '';
  }

  showLoveNotification(sender) {
    let existing = document.getElementById('love-notification-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'love-notification-toast';
    toast.className = 'love-notification-toast';
    toast.innerHTML = `
      <div class="love-notification-icon">💌</div>
      <div class="love-notification-content">
        <div class="love-notification-title">Notification: Love Sent Back! 💕</div>
        <div class="love-notification-desc">You sent a warm hug and heartfelt love back to <strong>${this.escapeHtml(sender)}</strong>!</div>
      </div>
      <button type="button" class="love-notification-close" title="Dismiss" aria-label="Dismiss notification">✕</button>
    `;

    document.body.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Dismiss button
    const closeBtn = toast.querySelector('.love-notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      });
    }

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }
    }, 5000);

    // Also trigger native browser notification if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("DEARLY 💌 Love Sent!", {
          body: `Love sent back to ${sender}! 💕`,
          icon: "assets/images/logo.svg"
        });
      } catch (e) {}
    }
  }
}

// Global class
window.DearlyStoryPlayer = DearlyStoryPlayer;
