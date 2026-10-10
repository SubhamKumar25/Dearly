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
    this.memoryCarouselIndex = 0;
    this.screens = [];
    this.isMuted = false;
    this.hasBlownCandles = false;
    this.selectedReaction = '';
  }

  async init(data) {
    if (data) this.data = data;
    if (!this.data) {
      this.renderNotFound();
      return;
    }

    // Ensure photo URLs (including Supabase Storage paths & private URLs) are resolved
    if (this.data.photos && Array.isArray(this.data.photos) && window.dearlyDB?.resolvePhotoUrls) {
      try {
        this.data.photos = await window.dearlyDB.resolvePhotoUrls(this.data.photos);
      } catch (err) {
        console.warn('Photo resolution note in player:', err);
      }
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
    const rawPhotos = this.data.photos || [];
    const memoriesData = this.data.memories || [];
    const validPhotos = [];

    for (let i = 0; i < rawPhotos.length; i++) {
      const p = rawPhotos[i];
      const src = this.getPhotoSrc(p);
      if (!src) continue;

      let caption = '';
      if (typeof p === 'object' && p !== null) {
        caption = p.caption || p.title || p.desc || '';
      }
      if (!caption && memoriesData[i]) {
        if (typeof memoriesData[i] === 'string') caption = memoriesData[i];
        else if (typeof memoriesData[i] === 'object') caption = memoriesData[i].caption || memoriesData[i].title || '';
      }

      validPhotos.push({
        src,
        caption: caption || `Memory #${validPhotos.length + 1} ✨`,
        index: validPhotos.length
      });
    }

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

  // --- Screen 3: Memories Slideshow Screen ---
  renderMemoriesScreen(photos) {
    if (!photos || photos.length === 0) return '';
    const total = photos.length;
    const currentIndex = Math.min(Math.max(0, this.memoryCarouselIndex || 0), total - 1);
    this.memoryCarouselIndex = currentIndex;

    let slidesHtml = '';
    photos.forEach((item, idx) => {
      const isActive = idx === currentIndex;
      const tilt = (idx % 2 === 0 ? -1.8 : 1.8);
      slidesHtml += `
        <div class="mem-carousel-slide ${isActive ? 'active' : ''}" data-slide-index="${idx}" style="--tilt: ${tilt}deg;">
          <div class="polaroid-frame mem-polaroid-frame">
            <div class="polaroid-img-wrapper">
              <div class="polaroid-spinner" id="spinner-mem-${idx}">⏳</div>
              <img src="${this.escapeHtml(item.src)}" 
                   class="polaroid-img" 
                   alt="${this.escapeHtml(item.caption || `Memory ${idx + 1}`)}" 
                   loading="eager"
                   onload="const sp=document.getElementById('spinner-mem-${idx}'); if(sp) sp.style.display='none'; this.classList.add('loaded');"
                   onerror="this.onerror=null; const sp=document.getElementById('spinner-mem-${idx}'); if(sp) sp.style.display='none'; this.classList.add('error'); this.parentElement.innerHTML='<div class=\\'polaroid-fallback-card\\'><span style=\\'font-size:2.2rem;\\'>📸</span><span style=\\'font-weight:600; font-size:0.95rem;\\'>Special Memory #${idx + 1}</span></div>';">
            </div>
            <div class="mem-polaroid-inner-label">#${idx + 1}</div>
          </div>
        </div>
      `;
    });

    let dotsHtml = '';
    if (total > 1) {
      dotsHtml = '<div class="mem-carousel-dots" id="mem-carousel-dots">';
      for (let i = 0; i < total; i++) {
        dotsHtml += `<button type="button" class="mem-dot-btn ${i === currentIndex ? 'active' : ''}" data-dot-index="${i}" aria-label="Go to memory ${i + 1} of ${total}"></button>`;
      }
      dotsHtml += '</div>';
    }

    const currentCaption = photos[currentIndex]?.caption || `Memory #${currentIndex + 1} ✨`;

    return `
      <div class="story-card story-card-memories text-center">
        <div class="story-badge">📸 Precious Memories</div>
        <h2 style="font-size: 1.6rem; margin-top: 14px; margin-bottom: 6px;">
          Moments I Cherish With You
        </h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 18px;">
          Snapshots of our favourite moments together.
        </p>

        <!-- Centered Memories Slideshow Stage -->
        <div class="mem-carousel-stage" id="mem-carousel-stage">
          <div class="mem-carousel-viewport">
            ${slidesHtml}
          </div>

          ${total > 1 ? `
            <button type="button" class="mem-arrow-btn mem-arrow-prev" id="btn-mem-carousel-prev" aria-label="Previous memory photo">‹</button>
            <button type="button" class="mem-arrow-btn mem-arrow-next" id="btn-mem-carousel-next" aria-label="Next memory photo">›</button>
          ` : ''}
        </div>

        <!-- Synchronized Memory Counter & Caption -->
        <div class="mem-meta-container">
          <div class="mem-counter-badge" id="mem-counter-badge">
            Memory <span id="mem-current-num">${currentIndex + 1}</span> of ${total}
          </div>
          <div class="mem-active-caption-box" id="mem-active-caption-box">
            <p class="mem-active-caption-text" id="mem-active-caption">
              ${this.escapeHtml(currentCaption)}
            </p>
          </div>
        </div>

        <!-- Dot Indicators (if > 1 photo) -->
        ${dotsHtml}

        <!-- Bottom Story Actions -->
        <div class="story-actions" style="margin-top: 24px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-story-prev">← Previous</button>
          <button type="button" class="btn btn-primary" id="btn-story-next">Continue →</button>
        </div>
      </div>
    `;
  }

  setMemorySlide(targetIdx, photos) {
    if (!photos || photos.length === 0) return;
    const total = photos.length;
    const newIdx = (targetIdx + total) % total;
    this.memoryCarouselIndex = newIdx;

    const stage = document.getElementById('mem-carousel-stage');
    if (stage) {
      const slides = stage.querySelectorAll('.mem-carousel-slide');
      slides.forEach((sl, idx) => {
        sl.classList.toggle('active', idx === newIdx);
      });
    }

    const numEl = document.getElementById('mem-current-num');
    if (numEl) numEl.textContent = String(newIdx + 1);

    const captionEl = document.getElementById('mem-active-caption');
    if (captionEl) {
      captionEl.textContent = photos[newIdx]?.caption || `Memory #${newIdx + 1} ✨`;
    }

    const dots = document.querySelectorAll('.mem-dot-btn');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === newIdx);
    });

    if (window.dearlyAudio) window.dearlyAudio.playSlide();
  }

  bindMemoriesCarouselEvents(photos) {
    if (!photos || photos.length === 0) return;
    const prevBtn = document.getElementById('btn-mem-carousel-prev');
    const nextBtn = document.getElementById('btn-mem-carousel-next');
    const dots = document.querySelectorAll('.mem-dot-btn');
    const stage = document.getElementById('mem-carousel-stage');

    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        this.setMemorySlide(this.memoryCarouselIndex - 1, photos);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        this.setMemorySlide(this.memoryCarouselIndex + 1, photos);
      };
    }
    dots.forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        const targetIdx = parseInt(dot.getAttribute('data-dot-index'), 10);
        if (!isNaN(targetIdx)) {
          this.setMemorySlide(targetIdx, photos);
        }
      };
    });

    // Touch swipe support on carousel stage
    if (stage) {
      let touchStartX = 0;
      let touchStartY = 0;
      stage.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      stage.addEventListener('touchend', (e) => {
        if (e.changedTouches.length > 0) {
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < 0) {
              this.setMemorySlide(this.memoryCarouselIndex + 1, photos);
            } else {
              this.setMemorySlide(this.memoryCarouselIndex - 1, photos);
            }
          }
        }
      }, { passive: true });
    }
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

  // --- Screen 5: Reveal Screen (by category) + Redesigned Reply Back System ---
  renderRevealScreen() {
    const sender = this.data.sender_name || 'Someone who cares';
    const recipient = this.data.nickname || this.data.recipient_name || 'You';
    const type = this.data.type || 'love';
    const relationship = (this.data.relationship || '').toLowerCase();
    const publicId = this.data.public_id || '';

    // Check if recipient has already submitted a reply
    let savedReply = null;
    if (publicId) {
      const stored = localStorage.getItem(`dearly_replied_${publicId}`);
      if (stored) {
        try {
          savedReply = JSON.parse(stored);
        } catch (e) {
          savedReply = { reaction: 'Sent love back ❤️', type: 'love_back' };
        }
      }
    }

    let categoryHeaderHtml = '';

    if (type === 'apology') {
      categoryHeaderHtml = `
        <div class="story-badge">🕊️ A Sincere Promise</div>
        <h2 style="font-size: 1.85rem; margin-top: 16px; margin-bottom: 12px; line-height: 1.3;">
          I Hope You Can Forgive Me
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
          You mean too much to me for silence or distance. I promise to listen, learn, and do better.
        </p>
      `;
    } else if (type === 'birthday') {
      categoryHeaderHtml = `
        <div class="story-badge">🎂 Make A Wish!</div>
        <h2 style="font-size: 1.95rem; margin-top: 16px; margin-bottom: 8px;">
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
      // PRESERVE ORIGINAL PROPOSAL QUESTION FROM SAVED REASON FIELD
      const question = this.data.reason || 'Will you marry me? 💍';
      categoryHeaderHtml = `
        <div class="story-badge">💍 Forever & Always</div>
        <h2 style="font-size: clamp(1.85rem, 4.5vw, 2.4rem); margin-top: 16px; margin-bottom: 14px; color: var(--color-primary); line-height: 1.3;">
          ${this.escapeHtml(question)}
        </h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; margin-bottom: 24px;">
          Every single day with you is my favourite adventure.
        </p>

        <!-- Proposal Celebration Buttons: ONLY FOR PROPOSAL GIFTS -->
        <div class="proposal-buttons-container" id="proposal-buttons-container" style="display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 24px; position: relative;">
          <button type="button" class="btn btn-primary btn-lg" id="btn-proposal-yes" style="min-width: 220px; font-size: 1.2rem; box-shadow: 0 8px 24px rgba(244, 63, 94, 0.4);">
            YES! A Million Times YES! 💖
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-proposal-maybe" style="color: var(--text-light); transition: all 0.2s ease;">
            Let me think... 😜
          </button>
        </div>
        <div id="proposal-celebration-banner" style="display: none; padding: 14px 18px; background: #FFF1F2; border-radius: 14px; border: 1px solid #FECDD3; color: var(--color-primary); font-weight: 700; font-size: 1.05rem; margin-bottom: 24px;">
          SHE / HE SAID YES! 🎉🥂💍 Forever starts now!
        </div>
      `;
    } else {
      // Love & Romance Category (with friendship / family adaptivity)
      if (relationship.includes('friend')) {
        categoryHeaderHtml = `
          <div class="story-badge">✨ Grateful For You</div>
          <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 12px; line-height: 1.3;">
            To The Best Friend Anyone Could Ask For
          </h2>
          <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
            Thank you for being in my corner. Life is so much brighter, louder, and happier with you as my friend.
          </p>
        `;
      } else if (relationship.includes('family')) {
        categoryHeaderHtml = `
          <div class="story-badge">🏡 Home & Heart</div>
          <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 12px; line-height: 1.3;">
            So Grateful For Our Family Bond
          </h2>
          <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
            No matter how fast life moves, family is home. Thank you for all your love and warmth.
          </p>
        `;
      } else {
        categoryHeaderHtml = `
          <div class="story-badge">💖 With All My Heart</div>
          <h2 style="font-size: 1.9rem; margin-top: 16px; margin-bottom: 12px; line-height: 1.3;">
            You Are My Favorite Person
          </h2>
          <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; margin-bottom: 24px;">
            Thank you for being in my life. Every day feels a little softer, happier, and brighter with you.
          </p>
        `;
      }
    }

    // Category-specific Reply Card configurations
    let replyBadge = '💕 Send Love Back';
    let replyTitle = `Send Love Back to ${this.escapeHtml(sender)} 💕`;
    let replySubtitle = 'Let them know how this made you feel with a direct, private reply.';
    let replyPlaceholder = `Write a sweet message back to ${this.escapeHtml(sender)} (optional)...`;
    let submitBtnText = 'Send Love Back ❤️';
    let chipsData = [];

    if (type === 'proposal') {
      replyBadge = '💍 Proposal Answer';
      replyTitle = `Your Answer & Reply to ${this.escapeHtml(sender)} 💍`;
      replySubtitle = 'Send your heartfelt reply and seal this unforgettable moment.';
      replyPlaceholder = `Write a loving note back to ${this.escapeHtml(sender)} (optional)...`;
      submitBtnText = 'Send Your Answer 💍';
      chipsData = [
        { label: '💍 YES! A Million Times YES! 💖', type: 'yes', active: true },
        { label: '💖 I love you with all my heart', type: 'yes' },
        { label: '🥂 To our forever together!', type: 'yes' }
      ];
    } else if (type === 'apology') {
      replyBadge = '🕊️ Reconciliation Reply';
      replyTitle = `Reply to ${this.escapeHtml(sender)} 🕊️`;
      replySubtitle = "Share your thoughts or let them know if you're ready to talk.";
      replyPlaceholder = `Write what you'd like ${this.escapeHtml(sender)} to know (optional)...`;
      submitBtnText = 'Send Reply 🕊️';
      chipsData = [
        { label: '❤️ I forgive you', type: 'forgive', active: true },
        { label: "💬 Let's talk soon", type: 'forgive' },
        { label: '🥺 Needed to hear this', type: 'forgive' },
        { label: '🌱 Thank you for being honest', type: 'forgive' }
      ];
    } else if (type === 'birthday') {
      replyBadge = '🎂 Birthday Thanks';
      replyTitle = `Send Birthday Thanks to ${this.escapeHtml(sender)} 🎂`;
      replySubtitle = 'Let them know how much their celebration surprise meant to you.';
      replyPlaceholder = `Write a birthday thank-you note to ${this.escapeHtml(sender)} (optional)...`;
      submitBtnText = 'Send Birthday Thanks 🎂';
      chipsData = [
        { label: '🎂 Thank you for making my day!', type: 'wish', active: true },
        { label: '✨ Best birthday wish ever!', type: 'wish' },
        { label: '🥰 Huge hugs & love back!', type: 'love_back' },
        { label: '🎉 Feeling so celebrated!', type: 'wish' }
      ];
    } else {
      // Love & Romance (tailored if friend or family)
      if (relationship.includes('friend')) {
        replyBadge = '✨ Warm Wishes';
        replyTitle = `Send Warm Wishes to ${this.escapeHtml(sender)} ✨`;
        replySubtitle = 'Let them know how much you value their friendship.';
        replyPlaceholder = `Write a warm note back to ${this.escapeHtml(sender)} (optional)...`;
        submitBtnText = 'Send Warm Wishes ✨';
        chipsData = [
          { label: "✨ You're the best friend ever!", type: 'love_back', active: true },
          { label: '🥰 So lucky to have you in my corner!', type: 'love_back' },
          { label: '🥂 To many more memories together!', type: 'love_back' },
          { label: '💕 Huge hugs back!', type: 'love_back' }
        ];
      } else if (relationship.includes('family')) {
        replyBadge = '🏡 Family Love';
        replyTitle = `Send Love Back to ${this.escapeHtml(sender)} 🏡`;
        replySubtitle = 'Send a warm message back to your family.';
        replyPlaceholder = `Write a loving note back to ${this.escapeHtml(sender)} (optional)...`;
        submitBtnText = 'Send Love Back 🏡';
        chipsData = [
          { label: '🏡 Love you so much!', type: 'love_back', active: true },
          { label: '❤️ So grateful for our family bond!', type: 'love_back' },
          { label: '✨ Huge hugs back to you!', type: 'love_back' }
        ];
      } else {
        chipsData = [
          { label: '💕 Love you too!', type: 'love_back', active: true },
          { label: '🥺 This made me smile so much', type: 'love_back' },
          { label: "🥰 You're my favorite person too", type: 'love_back' },
          { label: '❤️ Forever grateful for you', type: 'love_back' }
        ];
      }
    }

    let chipsHtml = '';
    chipsData.forEach(c => {
      chipsHtml += `
        <button type="button" 
                class="reply-chip-btn ${c.active ? 'active' : ''}" 
                data-reaction="${this.escapeHtml(c.label)}" 
                data-type="${c.type}">
          ${this.escapeHtml(c.label)}
        </button>
      `;
    });

    // Two-Way Response Section
    let responseSectionHtml = '';
    if (savedReply) {
      // Render clean, reassuring read-only card for existing submitted response
      const savedReactionText = savedReply.reaction || 'Response sent';
      const savedMsgText = (savedReply.message && savedReply.message !== savedReactionText) ? savedReply.message : '';
      responseSectionHtml = `
        <div class="reply-back-card reply-back-completed-card" id="reply-back-card">
          <div class="reply-completed-badge-icon">💌</div>
          <div class="reply-card-badge" style="margin-bottom: 8px;">Response Delivered ✨</div>
          <h3 class="reply-card-title" style="margin-bottom: 6px;">Your Reply Was Sent to ${this.escapeHtml(sender)}</h3>
          <p class="reply-card-subtitle" style="margin-bottom: 16px;">
            Thank you for making this moment two-way! Your response is safely delivered.
          </p>
          <div class="reply-completed-quote-box">
            <div class="reply-completed-reaction-tag">${this.escapeHtml(savedReactionText)}</div>
            ${savedMsgText ? `<p class="reply-completed-msg-text">"${this.escapeHtml(savedMsgText)}"</p>` : ''}
            <div class="reply-completed-meta-note">Delivered • Private & Secure</div>
          </div>
        </div>
      `;
    } else {
      // Interactive card
      responseSectionHtml = `
        <div class="reply-back-card" id="reply-back-card">
          <div class="reply-card-header">
            <div class="reply-card-badge">${replyBadge}</div>
            <h3 class="reply-card-title">${replyTitle}</h3>
            <p class="reply-card-subtitle">${replySubtitle}</p>
          </div>

          <!-- Quick Reaction Chips -->
          <div class="reply-chips-group" id="reply-chips-group" role="radiogroup" aria-label="Select a response">
            ${chipsHtml}
          </div>

          <!-- Optional Reply Message Input (EMPTY BY DEFAULT) -->
          <div class="reply-form-group">
            <div class="reply-label-row">
              <label class="reply-label" for="recipient-reply-msg">
                Personal message back <span class="reply-optional-tag">(optional)</span>
              </label>
              <span class="reply-char-counter" id="reply-char-counter">0 / 500</span>
            </div>
            <textarea id="recipient-reply-msg" 
                      class="reply-textarea" 
                      maxlength="500" 
                      placeholder="${this.escapeHtml(replyPlaceholder)}"></textarea>
          </div>

          <!-- Optional Name Input -->
          <div class="reply-form-group">
            <label class="reply-label" for="recipient-reply-sender-name">
              Your name
            </label>
            <input type="text" 
                   id="recipient-reply-sender-name" 
                   class="reply-input" 
                   placeholder="Your name (e.g. ${this.escapeHtml(recipient)})" 
                   value="${this.escapeHtml(this.data.recipient_name || '')}" 
                   maxlength="100">
          </div>

          <!-- Submit Button -->
          <div class="reply-submit-row">
            <button type="button" class="btn btn-primary btn-submit-reply" id="btn-submit-love-response">
              ${submitBtnText}
            </button>
          </div>

          <!-- Status / Error message -->
          <div id="response-submit-feedback" class="reply-feedback-alert" style="display: none;" role="alert"></div>
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
    // 0. Bind Memories Carousel if on memories screen
    if (current.type === 'memories' && current.photos) {
      this.bindMemoriesCarouselEvents(current.photos);
    }

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
        this.memoryCarouselIndex = 0;
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

        // Also pre-select YES reaction chip in the reply form if present
        const yesChip = this.containerEl.querySelector('.reply-chip-btn[data-type="yes"]');
        if (yesChip) {
          const allChips = this.containerEl.querySelectorAll('.reply-chip-btn');
          allChips.forEach(c => c.classList.remove('active'));
          yesChip.classList.add('active');
          this.selectedReaction = yesChip.getAttribute('data-reaction') || '';
        }
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
    const chips = this.containerEl.querySelectorAll('.reply-chip-btn');
    const nameInput = document.getElementById('recipient-reply-sender-name');

    // Live character counter
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / 500`;
        if (len >= 490) {
          counter.style.color = '#EF4444';
        } else {
          counter.style.color = 'var(--text-muted)';
        }
      });
    }

    // Reaction Chips click selection (DOES NOT pollute textarea!)
    let activeType = 'love_back';
    chips.forEach(chip => {
      if (chip.classList.contains('active')) {
        this.selectedReaction = chip.getAttribute('data-reaction') || '';
        activeType = chip.getAttribute('data-type') || 'love_back';
      }

      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedReaction = chip.getAttribute('data-reaction') || '';
        activeType = chip.getAttribute('data-type') || 'love_back';

        // NOTE: Keep textarea clean and unpolluted!
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
      });
    });

    // Default select first chip if none active
    if (chips.length > 0 && !this.selectedReaction) {
      const activeChip = this.containerEl.querySelector('.reply-chip-btn.active') || chips[0];
      if (activeChip) {
        activeChip.classList.add('active');
        this.selectedReaction = activeChip.getAttribute('data-reaction') || '';
        activeType = activeChip.getAttribute('data-type') || 'love_back';
      }
    }

    // Submit Love / Response handler
    if (btnSubmit) {
      let isSubmitting = false;

      btnSubmit.addEventListener('click', async () => {
        if (isSubmitting) return;

        const publicId = this.data.public_id;
        const replyText = textarea ? textarea.value.trim() : '';
        const replySenderName = nameInput ? nameInput.value.trim() : (this.data.recipient_name || 'Someone special');
        const sender = this.data.sender_name || 'your loved one';

        if (!publicId) {
          if (feedback) {
            feedback.style.display = 'block';
            feedback.className = 'reply-feedback-alert reply-feedback-error';
            feedback.textContent = 'Preview Mode: Responses can only be sent from published gifts.';
          }
          return;
        }

        // Validate character limit (max 500)
        if (replyText.length > 500) {
          if (feedback) {
            feedback.style.display = 'block';
            feedback.className = 'reply-feedback-alert reply-feedback-error';
            feedback.textContent = 'Your message exceeds the 500-character limit. Please shorten it slightly.';
          }
          return;
        }

        // Lock button & show spinner
        isSubmitting = true;
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = 'Sending with love... ✨';
        if (feedback) feedback.style.display = 'none';

        try {
          const result = await window.dearlyDB.submitResponse({
            publicId: publicId,
            message: replyText || this.selectedReaction || 'Sent response with love ❤️',
            recipientName: replySenderName,
            responseType: activeType
          });

          if (result && result.success) {
            // Mark as replied locally with structured data
            const replyRecord = {
              message: replyText,
              reaction: this.selectedReaction || 'Sent response with love ❤️',
              recipientName: replySenderName,
              responseType: activeType,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem(`dearly_replied_${publicId}`, JSON.stringify(replyRecord));

            // Audio & visual celebrations
            if (window.dearlyAudio) window.dearlyAudio.playCelebration();
            this.triggerHeartExplosion();

            // Replace response card with beautiful completed read-only view
            const card = document.getElementById('reply-back-card');
            if (card) {
              const savedReactionText = replyRecord.reaction;
              const savedMsgText = replyRecord.message && replyRecord.message !== savedReactionText ? replyRecord.message : '';
              card.outerHTML = `
                <div class="reply-back-card reply-back-completed-card animate-scale-in" id="reply-back-card">
                  <div class="reply-completed-badge-icon" class="animate-heartbeat">💌</div>
                  <div class="reply-card-badge" style="margin-bottom: 8px;">Response Delivered ✨</div>
                  <h3 class="reply-card-title" style="margin-bottom: 6px;">Your Reply Was Sent to ${this.escapeHtml(sender)}</h3>
                  <p class="reply-card-subtitle" style="margin-bottom: 16px;">
                    Thank you for making this moment two-way! Your response is safely delivered.
                  </p>
                  <div class="reply-completed-quote-box">
                    <div class="reply-completed-reaction-tag">${this.escapeHtml(savedReactionText)}</div>
                    ${savedMsgText ? `<p class="reply-completed-msg-text">"${this.escapeHtml(savedMsgText)}"</p>` : ''}
                    <div class="reply-completed-meta-note">Delivered • Private & Secure</div>
                  </div>
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
          isSubmitting = false;
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          if (feedback) {
            feedback.style.display = 'block';
            feedback.className = 'reply-feedback-alert reply-feedback-error';
            feedback.textContent = `Could not send response: ${err.message || 'Please check your connection and try again.'}`;
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
    if (window.DearlyUtils) return window.DearlyUtils.escapeHtml(str);
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
      const direct = photo.signedUrl || photo.signedURL || photo.url || photo.dataUrl || photo.src || photo.publicUrl;
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
