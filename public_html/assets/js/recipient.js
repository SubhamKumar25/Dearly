/**
 * DEARLY — Recipient Interactive Story Engine (v2.0)
 * Powers the multi-screen, emotionally animated recipient story experience
 * for Love, Apology, Birthday, and Proposal gifts, including memories gallery
 * and the Two-Way Love Response System.
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
    this.selectedReaction = '';
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

    // Bind header bookmark button
    const btnBookmarkHeader = document.getElementById('btn-bookmark-gift');
    if (btnBookmarkHeader) {
      btnBookmarkHeader.onclick = () => this.toggleSaveGift();
    }

    // Check if gift is already bookmarked / saved by recipient
    this.checkSavedStatus().then(isSaved => {
      this.updateBookmarkButtons(isSaved);
    });
  }

  buildScreenSequence() {
    this.screens = [];

    // Screen 1: The Envelope / Opening Cover
    this.screens.push({
      type: 'opening',
      render: () => this.renderOpeningScreen()
    });

    // Screen 2+: Core Message Cards (one by one)
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

    // Screen 2b: Extra Personal Messages (one by one in exact order)
    if (this.data.extra_messages && Array.isArray(this.data.extra_messages) && this.data.extra_messages.length > 0) {
      const activeExtras = this.data.extra_messages.filter(m => m && String(m).trim().length > 0);
      activeExtras.forEach((extraMsg, idx) => {
        this.screens.push({
          type: 'extra_message',
          index: idx,
          total: activeExtras.length,
          content: extraMsg,
          render: () => this.renderExtraMessageScreen(extraMsg, idx, activeExtras.length)
        });
      });
    }

    // Screen: Memories / Photo Gallery (rendered if photos exist)
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

    // Screen: Final Grand Reveal & Two-Way Response Section
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

        <!-- Gentle Romantic Music Invitation -->
        <div class="story-music-invite" id="story-music-invite-banner">
          <p class="music-invite-text">Make this moment a little more special ♡</p>
          <button type="button" class="btn-music-invite-play" id="btn-story-play-music" aria-label="Play peaceful romantic music">
            <span class="invite-icon">🎵</span>
            <span class="invite-label">Play Music</span>
            <span class="music-equalizer" aria-hidden="true">
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
            </span>
          </button>
        </div>

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
    if (this.data.type === 'proposal') {
      const proposalTitles = [
        'Our Story Begins 💗',
        'A Memory Close to Your Heart ✨',
        'What Makes Them Special ❤️'
      ];
      badgeText = proposalTitles[index] || `Chapter ${index + 1} • Looking Back`;
    }

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

  // --- Screen 2b: Extra Personal Message Screen ---
  renderExtraMessageScreen(messageText, index, total) {
    const badgeText = `A Little Note • ${index + 1} of ${total} 💌`;
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
      const tilt = (idx % 2 === 0 ? -2.2 : 2.2) * (1 + ((idx % 3) * 0.3));
      photoItems += `
        <div class="polaroid-frame" style="--tilt: ${tilt}deg;" data-photo-idx="${idx}">
          <div class="polaroid-img-wrapper">
            <div class="polaroid-spinner" id="spinner-photo-${idx}">⏳</div>
            <img src="${this.escapeHtml(src)}" 
                 class="polaroid-img" 
                 alt="Special memory ${idx + 1}" 
                 loading="eager"
                 onload="const sp=document.getElementById('spinner-photo-${idx}'); if(sp) sp.style.display='none'; this.classList.add('loaded');"
                 onerror="this.onerror=null; const sp=document.getElementById('spinner-photo-${idx}'); if(sp) sp.style.display='none'; this.classList.add('error'); this.parentElement.innerHTML='<div class=\\'polaroid-fallback-card\\'><span style=\\'font-size:2rem;\\'>📸</span><span>Special Moment #${idx + 1}</span></div>';">
          </div>
          <div class="polaroid-caption">Memory #${idx + 1} ✨</div>
        </div>
      `;
    });

    return `
      <div class="story-card story-card-memories text-center">
        <div class="story-badge">📸 Precious Memories</div>
        <h2 style="font-size: 1.6rem; margin-top: 14px; margin-bottom: 8px;">
          Moments I Cherish With You
        </h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 22px;">
          Snapshots of our favourite moments together.
        </p>

        <div class="memories-gallery-scroll">
          ${photoItems}
        </div>

        <div class="story-actions" style="margin-top: 26px;">
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

  // --- Screen 5: Reveal Screen (by category) + Two-Way Love Response System ---
  renderRevealScreen() {
    const sender = this.data.sender_name || 'Someone who cares';
    const recipient = this.data.nickname || this.data.recipient_name || 'You';
    const type = this.data.type || 'love';
    const publicId = this.data.public_id || '';
    const hasAlreadyReplied = publicId && localStorage.getItem(`dearly_replied_${publicId}`);

    let categoryHeaderHtml = '';

    if (type === 'apology') {
      categoryHeaderHtml = `
        <div class="story-badge">🕊️ A Sincere Promise</div>
        <h2 style="font-size: 1.8rem; margin-top: 16px; margin-bottom: 12px;">
          I Hope You Can Forgive Me
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
          You mean too much to me for silence or distance. I promise to listen, learn, and do better.
        </p>
      `;
    } else if (type === 'birthday') {
      categoryHeaderHtml = `
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
      categoryHeaderHtml = `
        <div class="story-badge">💍 Forever & Always</div>
        <h2 style="font-size: clamp(1.8rem, 4vw, 2.4rem); margin-top: 16px; margin-bottom: 14px; color: var(--color-primary);">
          ${this.escapeHtml(question)}
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; margin-bottom: 24px;">
          Every single day with you is my favourite adventure.
        </p>

        <div class="proposal-buttons-container" style="display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 24px; position: relative;">
          <button type="button" class="btn btn-primary btn-lg" id="btn-proposal-yes" style="min-width: 200px; font-size: 1.2rem; box-shadow: 0 8px 24px rgba(244, 63, 94, 0.4);">
            YES! A Million Times YES! 💖
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-proposal-maybe" style="color: var(--text-light); transition: all 0.2s ease;">
            Let me think... 😜
          </button>
        </div>
        <div id="proposal-celebration-banner" style="display: none; padding: 14px; background: #FFF1F2; border-radius: 14px; border: 1px solid #FECDD3; color: var(--color-primary); font-weight: 700; font-size: 1.05rem; margin-bottom: 20px;">
          SHE / HE SAID YES! 🎉🥂💍 Forever starts now!
        </div>
      `;
    } else {
      // Default / Love Reveal
      categoryHeaderHtml = `
        <div class="story-badge">💖 With All My Heart</div>
        <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 12px;">
          You Are My Favorite Person
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
          Thank you for being in my life. Every day feels a little softer, happier, and brighter with you.
        </p>
      `;
    }

    // Reaction chips based on category
    let chipsHtml = '';
    if (type === 'apology') {
      chipsHtml = `
        <button type="button" class="response-chip-btn" data-reaction="❤️ I forgive you" data-type="forgive">❤️ I forgive you</button>
        <button type="button" class="response-chip-btn" data-reaction="💬 Let's talk soon" data-type="forgive">💬 Let's talk</button>
        <button type="button" class="response-chip-btn" data-reaction="🥺 Needed to hear this" data-type="forgive">🥺 Needed this</button>
      `;
    } else if (type === 'birthday') {
      chipsHtml = `
        <button type="button" class="response-chip-btn" data-reaction="🎂 Thank you for making my day!" data-type="wish">🎂 Loved this!</button>
        <button type="button" class="response-chip-btn" data-reaction="✨ Best birthday wish ever" data-type="wish">✨ Best wish!</button>
        <button type="button" class="response-chip-btn" data-reaction="🥰 Hugs and love back" data-type="love_back">🥰 Huge hugs!</button>
      `;
    } else if (type === 'proposal') {
      chipsHtml = `
        <button type="button" class="response-chip-btn active" data-reaction="💍 YES! A Million Times YES! 💖" data-type="yes">💍 YES! A Million Times YES!</button>
        <button type="button" class="response-chip-btn" data-reaction="💖 I love you with all my heart" data-type="yes">💖 Forever Yours</button>
      `;
    } else {
      chipsHtml = `
        <button type="button" class="response-chip-btn active" data-reaction="💕 Sending all my love back to you" data-type="love_back">💕 Love you too!</button>
        <button type="button" class="response-chip-btn" data-reaction="🥺 This made me smile so much" data-type="love_back">🥺 Made me smile!</button>
        <button type="button" class="response-chip-btn" data-reaction="🥰 You are my favorite person too" data-type="love_back">🥰 You're my favorite!</button>
      `;
    }

    // Two-Way Love Response Section
    let responseSectionHtml = '';
    if (hasAlreadyReplied) {
      responseSectionHtml = `
        <div class="love-response-success-card" style="margin-top: 24px; padding: 22px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 16px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">💌</div>
          <h3 style="font-size: 1.15rem; color: #065F46; margin-bottom: 6px;">You already sent your love back!</h3>
          <p style="color: #047857; font-size: 0.92rem; margin: 0;">
            ${this.escapeHtml(sender)} has received your heartfelt reply. Thank you for making this moment two-way! 💕
          </p>
        </div>
      `;
    } else {
      responseSectionHtml = `
        <div class="love-response-card" id="love-response-card">
          <div class="love-response-header">
            <h3 style="font-size: 1.15rem; margin-bottom: 4px; color: var(--text-main);">
              Send Love Back to ${this.escapeHtml(sender)} ❤️
            </h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 14px;">
              Let them know how this made you feel with a direct, private reply.
            </p>
          </div>

          <!-- Quick Reaction Chips -->
          <div class="reaction-chips-wrapper" id="reaction-chips-wrapper">
            ${chipsHtml}
          </div>

          <!-- Optional Reply Message Input -->
          <div class="form-group" style="margin-top: 14px; text-align: left;">
            <label class="form-label" for="recipient-reply-msg" style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted);">
              <span>Personal note back (optional)</span>
              <span id="reply-char-counter" style="float: right; font-weight: normal; font-size: 0.78rem;">0 / 500</span>
            </label>
            <textarea id="recipient-reply-msg" 
                      class="form-textarea" 
                      maxlength="500" 
                      placeholder="Write a sweet message back to ${this.escapeHtml(sender)}..." 
                      style="min-height: 85px; font-size: 0.92rem; padding: 10px 14px;"></textarea>
          </div>

          <!-- Optional Name Input -->
          <div class="form-group" style="margin-top: 10px; text-align: left;">
            <input type="text" 
                   id="recipient-reply-sender-name" 
                   class="form-input" 
                   placeholder="Your name (e.g. ${this.escapeHtml(recipient)})" 
                   value="${this.escapeHtml(this.data.recipient_name || '')}" 
                   style="font-size: 0.9rem; padding: 10px 14px;">
          </div>

          <!-- Submit Button -->
          <div style="margin-top: 16px;">
            <button type="button" class="btn btn-primary btn-lg btn-block" id="btn-submit-love-response" style="width: 100%;">
              Send Love Back ❤️
            </button>
          </div>

          <!-- Status / Error message -->
          <div id="response-submit-feedback" style="display: none; margin-top: 12px; font-size: 0.88rem; font-weight: 600;"></div>
        </div>
      `;
    }

    return `
      <div class="story-card story-card-reveal text-center">
        ${categoryHeaderHtml}
        ${responseSectionHtml}

        <div class="reveal-footer-actions" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-restart-story">
            ↺ Replay Experience
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-bookmark-gift" id="btn-reveal-save-gift" title="Save this gift to your collection">
            🔖 <span>Save Gift</span>
          </button>
          <a href="create.html?type=love" class="btn btn-ghost btn-sm" id="btn-recipient-create-gift" style="font-size: 0.86rem; color: var(--text-muted);">
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

    // 1b. Music Invitation Toggle
    const btnMusicInvite = document.getElementById('btn-story-play-music');
    if (btnMusicInvite && window.dearlyAudio) {
      btnMusicInvite.addEventListener('click', () => {
        window.dearlyAudio.togglePlay();
      });
      // Synchronize initial state
      window.dearlyAudio.syncUI();
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
        this.hasBlownCandles = false;
        this.renderCurrentScreen();
        const env = document.getElementById('story-opening-envelope');
        if (env) env.classList.remove('opened');
      });
    }

    // 3b. Bookmark / Save Gift Button Click Handler
    const bookmarkBtns = document.querySelectorAll('.btn-bookmark-gift, #btn-bookmark-gift, #btn-reveal-save-gift');
    bookmarkBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        this.toggleSaveGift();
      };
    });

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

    // 6. Reveal Screen Navigation (Create)
    const btnRecipientCreate = document.getElementById('btn-recipient-create-gift');
    if (btnRecipientCreate) {
      btnRecipientCreate.addEventListener('click', (e) => {
        e.preventDefault();
        const currentGiftUrl = window.location.href;
        sessionStorage.setItem('dearly_from_gift_url', currentGiftUrl);
        const user = window.dearlyAuth?.getUser?.();
        const targetUrl = `create.html?type=love&from_gift=${encodeURIComponent(currentGiftUrl)}`;
        if (user) {
          window.location.href = targetUrl;
        } else {
          window.location.href = `auth.html?redirect=${encodeURIComponent(targetUrl)}&from_gift=${encodeURIComponent(currentGiftUrl)}`;
        }
      });
    }

    // 7. Two-Way Response Handlers
    this.bindLoveResponseEvents();
  }

  bindLoveResponseEvents() {
    const textarea = document.getElementById('recipient-reply-msg');
    const counter = document.getElementById('reply-char-counter');
    const btnSubmit = document.getElementById('btn-submit-love-response');
    const feedback = document.getElementById('response-submit-feedback');
    const chips = this.containerEl.querySelectorAll('.response-chip-btn');
    const nameInput = document.getElementById('recipient-reply-sender-name');

    // Char counter
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        counter.textContent = `${textarea.value.length} / 500`;
      });
    }

    // Reaction Chips click selection
    let activeType = 'love_back';
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedReaction = chip.getAttribute('data-reaction') || '';
        activeType = chip.getAttribute('data-type') || 'love_back';

        // Auto-fill or append reaction into textarea if empty
        if (textarea && textarea.value.trim() === '') {
          textarea.value = this.selectedReaction;
          if (counter) counter.textContent = `${textarea.value.length} / 500`;
        }
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
      });
    });

    // Default select first chip if present
    if (chips.length > 0 && !this.selectedReaction) {
      const activeChip = this.containerEl.querySelector('.response-chip-btn.active') || chips[0];
      if (activeChip) {
        this.selectedReaction = activeChip.getAttribute('data-reaction') || '';
        activeType = activeChip.getAttribute('data-type') || 'love_back';
      }
    }

    // Submit Love Response
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const publicId = this.data.public_id;
        const replyText = textarea ? textarea.value.trim() : (this.selectedReaction || 'Sent love back ❤️');
        const replySenderName = nameInput ? nameInput.value.trim() : (this.data.recipient_name || 'Someone special');
        const sender = this.data.sender_name || 'your loved one';

        if (!publicId) {
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.color = '#EF4444';
            feedback.textContent = 'Preview Mode: Responses can only be sent from published gifts.';
          }
          return;
        }

        // Disable button & show spinner
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = 'Sending with love... ✨';
        if (feedback) feedback.style.display = 'none';

        try {
          const result = await window.dearlyDB.submitResponse({
            publicId: publicId,
            message: replyText,
            recipientName: replySenderName,
            responseType: activeType
          });

          if (result && result.success) {
            // Mark as replied locally to prevent duplicate accidental sends
            localStorage.setItem(`dearly_replied_${publicId}`, 'true');

            // Audio & visual celebrations
            if (window.dearlyAudio) window.dearlyAudio.playCelebration();
            this.triggerHeartExplosion();

            // Replace response card with beautiful success message
            const card = document.getElementById('love-response-card');
            if (card) {
              card.innerHTML = `
                <div class="love-response-success-card animate-scale-in" style="padding: 24px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 16px;">
                  <div style="font-size: 2.4rem; margin-bottom: 10px;" class="animate-heartbeat">💌</div>
                  <h3 style="font-size: 1.25rem; color: #065F46; margin-bottom: 8px;">
                    Love Delivered! 💕
                  </h3>
                  <p style="color: #047857; font-size: 0.95rem; line-height: 1.6; margin: 0 0 12px 0;">
                    Your warm response has been saved and delivered to <strong>${this.escapeHtml(sender)}</strong>!
                  </p>
                  <p style="color: #065F46; font-size: 0.86rem; font-style: italic;">
                    "${this.escapeHtml(replyText)}"
                  </p>
                </div>
              `;
            }

            // Also show floating toast
            this.showLoveNotification(sender);
          } else {
            throw new Error(result?.error || 'Could not save response');
          }
        } catch (err) {
          console.error('Error submitting response:', err);
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.color = '#EF4444';
            feedback.textContent = `Could not send response: ${err.message || 'Please check your connection.'}`;
          }
        }
      });
    }
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
    if (typeof photo === 'string') {
      if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:image/')) {
        return photo;
      }
      // If relative storage path
      const bucketName = window.DEARLY_CONFIG?.STORAGE_BUCKET || 'experience-photos';
      if (window.dearlyDB?.client) {
        const { data } = window.dearlyDB.client.storage.from(bucketName).getPublicUrl(photo);
        return data?.publicUrl || photo;
      }
      return photo;
    }
    if (typeof photo === 'object') {
      const direct = photo.url || photo.dataUrl || photo.src || photo.publicUrl;
      if (direct) return direct;
      if (photo.path && window.dearlyDB?.client) {
        const bucketName = window.DEARLY_CONFIG?.STORAGE_BUCKET || 'experience-photos';
        const { data } = window.dearlyDB.client.storage.from(bucketName).getPublicUrl(photo.path);
        return data?.publicUrl || '';
      }
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
        <div class="love-notification-desc">Your heartfelt message has been delivered to <strong>${this.escapeHtml(sender)}</strong>!</div>
      </div>
      <button type="button" class="love-notification-close" title="Dismiss" aria-label="Dismiss notification">✕</button>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const closeBtn = toast.querySelector('.love-notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      });
    }

    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }
    }, 5000);
  }

  async checkSavedStatus() {
    if (!this.data || !this.data.public_id) return false;
    try {
      const isSaved = await window.dearlyDB?.isGiftSaved?.(this.data.public_id, this.data.id);
      return Boolean(isSaved);
    } catch (e) {
      return false;
    }
  }

  async toggleSaveGift() {
    if (!this.data || !this.data.public_id) return;
    const user = window.dearlyAuth?.getUser?.();

    if (!user) {
      // Unauthenticated recipient: open bookmark modal
      this.openBookmarkModal();
      return;
    }

    // Authenticated recipient: check status
    const isAlreadySaved = await this.checkSavedStatus();
    if (isAlreadySaved) {
      const confirmed = confirm('Remove this gift from your saved gifts? (The sender\'s original gift will remain intact)');
      if (confirmed) {
        await window.dearlyDB?.removeSavedGift?.(this.data.public_id);
        this.updateBookmarkButtons(false);
        this.showToast('Removed from your saved gifts.');
      }
    } else {
      const res = await window.dearlyDB?.saveRecipientGift?.(this.data.public_id, this.data.id);
      if (res && res.success) {
        this.updateBookmarkButtons(true);
        this.showToast('Gift saved to your account! Find it in your Dashboard 💕');
      } else {
        alert(res?.error || 'Could not save gift.');
      }
    }
  }

  updateBookmarkButtons(isSaved) {
    const btns = document.querySelectorAll('.btn-bookmark-gift, #btn-bookmark-gift, #btn-reveal-save-gift');
    btns.forEach(b => {
      if (isSaved) {
        b.innerHTML = '❤️ <span>Saved</span>';
        b.classList.add('saved');
        b.title = 'Saved to your account (Click to remove)';
      } else {
        b.innerHTML = '🔖 <span>Save Gift</span>';
        b.classList.remove('saved');
        b.title = 'Save this gift to your collection';
      }
    });
  }

  openBookmarkModal() {
    let modal = document.getElementById('bookmark-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bookmark-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 440px; text-align: center; position: relative;">
          <button type="button" class="modal-close-btn" id="btn-close-bookmark-modal" aria-label="Close modal">✕</button>
          <div style="font-size: 2.5rem; margin-bottom: 10px;">🔖</div>
          <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Save This Gift</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 20px;">
            Save this heartfelt surprise to your collection so you can easily reopen it anytime.
          </p>
          <div id="bookmark-auth-options" style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="btn btn-primary" id="btn-bookmark-login">
              Sign In to Save to Account ✨
            </button>
            <button type="button" class="btn btn-secondary" id="btn-bookmark-local">
              Save to this browser only 📱
            </button>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
              Note: Local device bookmarks are saved in this browser. Clearing browser data may remove them.
            </p>
          </div>
          <div id="bookmark-saved-notice" style="display: none; padding: 12px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; color: #065F46; font-size: 0.9rem; font-weight: 600;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.add('active');
    const optionsDiv = document.getElementById('bookmark-auth-options');
    const noticeDiv = document.getElementById('bookmark-saved-notice');
    if (optionsDiv) optionsDiv.style.display = 'flex';
    if (noticeDiv) noticeDiv.style.display = 'none';

    const btnLogin = document.getElementById('btn-bookmark-login');
    const btnLocal = document.getElementById('btn-bookmark-local');
    const btnClose = document.getElementById('btn-close-bookmark-modal');

    if (btnLogin) {
      btnLogin.onclick = () => {
        const currentUrl = window.location.href;
        window.location.href = `auth.html?redirect=${encodeURIComponent(currentUrl)}`;
      };
    }

    if (btnLocal) {
      btnLocal.onclick = async () => {
        await window.dearlyDB?.saveRecipientGift?.(this.data.public_id, this.data.id);
        this.updateBookmarkButtons(true);
        if (optionsDiv) optionsDiv.style.display = 'none';
        if (noticeDiv) {
          noticeDiv.style.display = 'block';
          noticeDiv.textContent = '📱 Saved on this browser! Note: If you clear browser data, it may be removed. Sign in anytime to keep it permanently in your account.';
        }
        setTimeout(() => {
          modal.classList.remove('active');
        }, 2200);
      };
    }

    if (btnClose) {
      btnClose.onclick = () => modal.classList.remove('active');
    }
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };
  }

  showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Global class
window.DearlyStoryPlayer = DearlyStoryPlayer;
