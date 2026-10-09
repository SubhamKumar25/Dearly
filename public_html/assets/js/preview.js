/**
 * DEARLY — Preview Controller & Publishing Service
 * Handles live previewing of recipient experience, publishing to Supabase,
 * and generating the shareable link modal (Copy, WhatsApp, Web Share).
 */

class DearlyPreviewController {
  constructor() {
    this.previewData = null;
    this.player = null;
    this.isPublishing = false;
    this.publicId = null;
    this.shareUrl = '';
  }

  async init() {
    // 0. Protect route: strictly require authentication
    if (window.dearlyAuth) {
      await window.dearlyAuth.init();
      let user = window.dearlyAuth.getUser();

      // If returning from OAuth redirect, allow Supabase session exchange to settle
      if (!user && (
        (window.location.search && (window.location.search.includes('code=') || window.location.search.includes('access_token='))) ||
        (window.location.hash && window.location.hash.includes('access_token='))
      )) {
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 2000);
          window.dearlyAuth.onAuthStateChange((event, session) => {
            if (session?.user) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
        user = window.dearlyAuth.getUser();
      }

      if (!user) {
        const urlParams = new URLSearchParams(window.location.search);
        const type = (urlParams.get('type') || 'love').toLowerCase();
        window.location.href = `auth.html?redirect=${encodeURIComponent('preview.html?type=' + type)}`;
        return;
      }
    }

    // 1. Retrieve preview data from sessionStorage
    const rawData = sessionStorage.getItem('dearly_preview_data');
    if (rawData) {
      try {
        this.previewData = JSON.parse(rawData);
      } catch (e) {
        console.warn('Error parsing preview data:', e);
      }
    }

    // 2. Also check IndexedDB for restored photos or full payload
    if (window.DearlyStorage) {
      try {
        const idbData = await window.DearlyStorage.get('dearly_preview_data');
        if (idbData) {
          if (!this.previewData) {
            this.previewData = idbData;
          } else if ((!this.previewData.photos || this.previewData.photos.length === 0) && (idbData.photos && idbData.photos.length > 0)) {
            this.previewData.photos = idbData.photos;
          }
        }
      } catch (idbErr) {
        console.warn('IndexedDB read error:', idbErr);
      }
    }

    // 3. Fallback to sample data if direct visit to preview.html
    if (!this.previewData) {
      const urlParams = new URLSearchParams(window.location.search);
      const type = urlParams.get('type') || 'love';
      this.previewData = this.getSampleData(type);
    }

    // 4. Initialize Story Player
    const container = document.getElementById('story-container');
    if (container && window.DearlyStoryPlayer) {
      this.player = new window.DearlyStoryPlayer({
        container: container,
        isPreview: true,
        data: this.previewData
      });
      await this.player.init();
    }

    // 4. Bind Preview Buttons (Top and Bottom Docked Actions)
    const backButtons = document.querySelectorAll('#btn-preview-back, #btn-preview-back-top, .btn-preview-back');
    backButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const draftId = this.previewData?.draft_id || this.previewData?.id;
        let returnUrl = `create.html?type=${this.previewData?.type || 'love'}`;
        if (draftId) returnUrl += `&draft_id=${encodeURIComponent(draftId)}`;
        window.location.href = returnUrl;
      });
    });

    const draftButtons = document.querySelectorAll('#btn-preview-save-draft, #btn-preview-save-draft-top');
    draftButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveDraft();
      });
    });

    const publishButtons = document.querySelectorAll('#btn-preview-publish, .btn-preview-publish');
    publishButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.publishExperience();
      });
    });

    // 5. Modal actions
    this.bindModalEvents();
  }

  // Count words helper (centralized in DearlyUtils)
  countWords(text) {
    if (window.DearlyUtils) return window.DearlyUtils.countWords(text);
    if (!text || typeof text !== 'string') return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  async saveDraft() {
    if (window.dearlyAuth) {
      await window.dearlyAuth.init();
      const user = window.dearlyAuth.getUser();
      if (!user) {
        alert('Please log in or create an account to save drafts!');
        const returnUrl = window.location.pathname.split('/').pop() + window.location.search;
        window.location.href = `auth.html?redirect=${encodeURIComponent(returnUrl || 'preview.html')}`;
        return;
      }
    }

    if (this.previewData?.letter) {
      const words = this.countWords(this.previewData.letter);
      if (words > 1500) {
        alert(`Cannot save draft: Letter has ${words} words (max 1,500 words allowed). Please return to edit and shorten it.`);
        return;
      }
    }

    if (Array.isArray(this.previewData?.messages)) {
      for (let i = 0; i < this.previewData.messages.length; i++) {
        const msg = this.previewData.messages[i];
        if (msg) {
          const words = this.countWords(msg);
          if (words > 250) {
            alert(`Cannot save draft: Story message ${i + 1} has ${words} words (max 250 words allowed). Please return to edit and shorten it.`);
            return;
          }
        }
      }
    }

    if (Array.isArray(this.previewData?.extra_messages)) {
      if (this.previewData.extra_messages.some(m => m && m.length > 300)) {
        alert('Cannot save draft: One or more extra personal messages exceed 300 characters.');
        return;
      }
    }

    const draftBtns = document.querySelectorAll('#btn-preview-save-draft, #btn-preview-save-draft-top');
    draftBtns.forEach(b => { b.disabled = true; b.textContent = 'Saving... ⏳'; });

    try {
      const draftPayload = {
        ...this.previewData,
        status: 'draft'
      };
      const result = await window.dearlyDB.saveExperience(draftPayload);
      if (result && result.success) {
        this.previewData.id = result.id || this.previewData.id;
        this.previewData.draft_id = result.id || this.previewData.draft_id;
        sessionStorage.setItem('dearly_preview_data', JSON.stringify(this.previewData));
        if (window.DearlyStorage) {
          await window.DearlyStorage.set('dearly_preview_data', this.previewData);
        }
        draftBtns.forEach(b => { b.disabled = false; b.textContent = '✅ Draft Saved'; });
        alert('Draft saved successfully! You can view it and continue editing in your Dashboard.');
        setTimeout(() => {
          draftBtns.forEach(b => { b.disabled = false; b.textContent = '💾 Save Draft'; });
        }, 2500);
      } else {
        throw new Error(result?.error || 'Could not save draft');
      }
    } catch (err) {
      console.error('Error saving draft:', err);
      draftBtns.forEach(b => { b.disabled = false; b.textContent = '💾 Save Draft'; });
      alert('Error saving draft: ' + (err.message || 'Please try again.'));
    }
  }

  async publishExperience() {
    if (this.isPublishing) return;

    // Check letter 1,500-word limit
    if (this.previewData?.letter) {
      const words = this.countWords(this.previewData.letter);
      if (words > 1500) {
        alert(`Cannot publish gift: Your letter has ${words} words, which exceeds the 1,500-word limit. Please return to edit and shorten your letter.`);
        return;
      }
    }

    // Check short story messages 250-word limit
    if (Array.isArray(this.previewData?.messages)) {
      for (let i = 0; i < this.previewData.messages.length; i++) {
        const msg = this.previewData.messages[i];
        if (msg) {
          const words = this.countWords(msg);
          if (words > 250) {
            alert(`Cannot publish gift: Story message ${i + 1} has ${words} words, which exceeds the 250-word limit. Please return to edit and shorten it.`);
            return;
          }
        }
      }
    }

    // Check extra personal messages limit
    if (Array.isArray(this.previewData?.extra_messages)) {
      if (this.previewData.extra_messages.some(m => m && m.length > 300)) {
        alert('Cannot publish gift: One or more extra personal messages exceed 300 characters.');
        return;
      }
    }

    // Strictly require authentication before publishing
    if (window.dearlyAuth) {
      await window.dearlyAuth.init();
      const user = window.dearlyAuth.getUser();
      if (!user) {
        alert('Please log in or create an account to publish and save your gift!');
        const returnUrl = window.location.pathname.split('/').pop() + window.location.search;
        window.location.href = `auth.html?redirect=${encodeURIComponent(returnUrl || 'preview.html')}`;
        return;
      }
    }

    this.isPublishing = true;

    const publishButtons = document.querySelectorAll('#btn-preview-publish, .btn-preview-publish');
    publishButtons.forEach(btn => {
      btn.disabled = true;
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = 'Creating link... 💌';
    });

    const modal = document.getElementById('share-modal');
    const modalLoading = document.getElementById('modal-step-loading');
    const modalSuccess = document.getElementById('modal-step-success');

    if (modal) {
      modal.classList.add('active');
      if (modalLoading) modalLoading.style.display = 'block';
      if (modalSuccess) modalSuccess.style.display = 'none';
    }

    try {
      // Call Supabase / DB service with published status
      const publishPayload = {
        ...this.previewData,
        status: 'published'
      };
      const result = await window.dearlyDB.saveExperience(publishPayload);

      if (result && result.success) {
        this.publicId = result.public_id || result.id;
        const baseOrigin = window.location.origin;
        const base = baseOrigin.endsWith('/') ? baseOrigin.slice(0, -1) : baseOrigin;
        this.shareUrl = `${base}/surprise.html?id=${this.publicId}`;

        // Populate share UI
        this.renderSuccessModal(result.isDemo, result.warning);
      } else {
        alert('Could not save experience. Please try again.');
        if (modal) modal.classList.remove('active');
      }
    } catch (err) {
      console.error('Publishing failed:', err);
      alert('Error publishing experience: ' + (err.message || 'Unknown error'));
      if (modal) modal.classList.remove('active');
    } finally {
      this.isPublishing = false;
      publishButtons.forEach(btn => {
        btn.disabled = false;
        if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
      });
    }
  }

  renderSuccessModal(isDemo, warning) {
    const modalLoading = document.getElementById('modal-step-loading');
    const modalSuccess = document.getElementById('modal-step-success');
    const inputLink = document.getElementById('share-link-input');
    const demoNotice = document.getElementById('demo-mode-notice');

    if (modalLoading) modalLoading.style.display = 'none';
    if (modalSuccess) modalSuccess.style.display = 'block';

    if (inputLink) {
      inputLink.value = this.shareUrl;
    }

    if (demoNotice) {
      if (isDemo) {
        demoNotice.style.display = 'block';
        if (warning) {
          demoNotice.innerHTML = `⚠️ <strong>Notice:</strong> ${warning}`;
        }
      } else {
        demoNotice.style.display = 'none';
      }
    }

    if (window.dearlyAudio) window.dearlyAudio.playCelebration();
  }

  bindModalEvents() {
    const modal = document.getElementById('share-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCopy = document.getElementById('btn-copy-link');
    const btnWhatsapp = document.getElementById('btn-share-whatsapp');
    const btnNative = document.getElementById('btn-share-native');
    const btnOpenGift = document.getElementById('btn-open-gift');

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        const input = document.getElementById('share-link-input');
        if (input) {
          input.select();
          try {
            await navigator.clipboard.writeText(input.value);
            btnCopy.textContent = 'Copied! 💌';
            btnCopy.classList.add('btn-primary');
            setTimeout(() => {
              btnCopy.textContent = 'Copy Link';
              btnCopy.classList.remove('btn-primary');
            }, 2500);
          } catch (e) {
            document.execCommand('copy');
            btnCopy.textContent = 'Copied! 💌';
          }
        }
      });
    }

    if (btnWhatsapp) {
      btnWhatsapp.addEventListener('click', () => {
        const recipient = this.previewData.nickname || this.previewData.recipient_name || 'you';
        const sender = this.previewData.sender_name || 'Someone';
        const text = encodeURIComponent(
          `Hey ${recipient}! 💕 ${sender} made a little interactive gift for you on DEARLY. Open it here:\n${this.shareUrl}`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
      });
    }

    if (btnNative) {
      if (navigator.share) {
        btnNative.style.display = 'inline-flex';
        btnNative.addEventListener('click', async () => {
          try {
            await navigator.share({
              title: `DEARLY for ${this.previewData.recipient_name || 'you'}`,
              text: `A special interactive digital gift from ${this.previewData.sender_name || 'someone special'}:`,
              url: this.shareUrl
            });
          } catch (err) {
            console.log('Share dismissed');
          }
        });
      } else {
        btnNative.style.display = 'none';
      }
    }

    if (btnOpenGift) {
      btnOpenGift.addEventListener('click', () => {
        window.open(this.shareUrl, '_blank');
      });
    }
  }

  getSampleData(type) {
    if (type === 'apology') {
      return {
        type: 'apology',
        sender_name: 'Alex',
        recipient_name: 'Maya',
        reason: '😬 I said something hurtful',
        messages: [
          "I've been thinking non-stop about what happened, and I feel truly terrible.",
          "You deserved so much better from me in that moment.",
          "I value our bond more than my pride, and I want to make things right."
        ],
        letter: "Maya,\n\nI want to apologize without any excuses. I reacted poorly and let you down. Your kindness and friendship mean the world to me, and I promise to be more patient and thoughtful going forward.\n\nWhenever you're ready, I'd love to talk.",
        photos: []
      };
    } else if (type === 'birthday') {
      return {
        type: 'birthday',
        sender_name: 'Rohan',
        recipient_name: 'Aashi',
        nickname: 'Birthday Queen',
        messages: [
          "Happy Birthday to someone who makes every room brighter just by walking in!",
          "Remember that crazy road trip where we got lost and sang all night?",
          "May this year bring you all the peace, joy, and success you deserve."
        ],
        letter: "Aashi,\n\nHaving you in my life has been one of the greatest joys. Thank you for always being the most genuine, supportive, and hilarious friend. Have the happiest birthday!",
        photos: []
      };
    } else if (type === 'proposal') {
      return {
        type: 'proposal',
        sender_name: 'Kabir',
        recipient_name: 'Ananya',
        reason: 'Will you marry me? 💍',
        messages: [
          "The first time we sat together for coffee, three hours felt like five minutes.",
          "That quiet evening under the stars when everything just clicked.",
          "I love your laugh, your kindness, and how you make anywhere feel like home."
        ],
        letter: "Ananya,\n\nLoving you is the easiest, truest thing I have ever done. I cannot imagine walking through life without your hand in mine. You are my home, my peace, and my greatest adventure.",
        photos: []
      };
    }

    // Default Love
    return {
      type: 'love',
      sender_name: 'Sam',
      recipient_name: 'Leo',
      nickname: 'Bubu',
      messages: [
        "I don't say it enough, but you make ordinary days feel magical.",
        "One of my favourite things about us is laughing until our stomachs hurt.",
        "With you, I never have to pretend to be anyone else."
      ],
      letter: "Leo,\n\nEvery day with you is a gift I don't take for granted. Thank you for your warmth, your silly jokes, and the calm you bring to my noisy world. Here's to us, always.",
      photos: []
    };
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('preview-wrapper')) {
    window.previewController = new DearlyPreviewController();
    window.previewController.init();
  }
});
