/**
 * DEARLY — Preview Controller & Publishing Service
 * Handles live previewing of recipient experience, publishing to Supabase,
 * and generating the shareable link modal (Copy, WhatsApp, Web Share).
 */

// IndexedDB cross-page storage helper
const DearlyStorage = window.DearlyStorage || {
  dbName: 'dearly_storage_db',
  storeName: 'cache',

  async openDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async get(key) {
    try {
      const db = await this.openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }
};
window.DearlyStorage = DearlyStorage;

class DearlyPreviewController {
  constructor() {
    this.previewData = null;
    this.player = null;
    this.isPublishing = false;
    this.publicId = null;
    this.shareUrl = '';
  }

  async init() {
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
      this.player.init();
    }

    // 4. Bind Preview Bar Buttons
    const btnBack = document.getElementById('btn-preview-back');
    const btnPublish = document.getElementById('btn-preview-publish');

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.location.href = `create.html?type=${this.previewData.type || 'love'}`;
      });
    }

    if (btnPublish) {
      btnPublish.addEventListener('click', () => {
        this.publishExperience();
      });
    }

    // 5. Modal actions
    this.bindModalEvents();
  }

  async publishExperience() {
    if (this.isPublishing) return;
    this.isPublishing = true;

    const modal = document.getElementById('share-modal');
    const modalLoading = document.getElementById('modal-step-loading');
    const modalSuccess = document.getElementById('modal-step-success');

    if (modal) {
      modal.classList.add('active');
      if (modalLoading) modalLoading.style.display = 'block';
      if (modalSuccess) modalSuccess.style.display = 'none';
    }

    try {
      // Call Supabase / DB service
      const result = await window.dearlyDB.saveExperience(this.previewData);

      if (result && result.success) {
        this.publicId = result.public_id;
        const base = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
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
