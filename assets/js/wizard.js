/**
 * DEARLY — Reusable Creator Wizard Engine
 * Powering Love, Apology, Birthday, and Proposal creation flows with
 * category configurations, step progression, validation, suggestions,
 * and photo management.
 */

// IndexedDB cross-page storage helper (bypasses 5MB sessionStorage quota for photos)
const DearlyStorage = {
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

  async set(key, value) {
    try {
      const db = await this.openDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
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

// Category Configurations
const WIZARD_CONFIG = {
  love: {
    name: 'Love & Romance',
    badge: 'Love Experience 💕',
    themeColor: '#F43F5E',
    totalSteps: 4,
    steps: [
      {
        step: 1,
        title: "Who is this for?",
        subtitle: "Every love story is unique. Let's start with who you're celebrating.",
        fields: [
          {
            type: 'options',
            id: 'relationship_type',
            label: 'Relationship type',
            required: true,
            options: [
              { value: 'partner', label: 'Partner', icon: '💖' },
              { value: 'friend', label: 'Best Friend', icon: '✨' },
              { value: 'family', label: 'Family Member', icon: '🏡' }
            ]
          }
        ],
        btnNext: 'Next: Their Details →'
      },
      {
        step: 2,
        title: "Tell us a little more about them.",
        subtitle: "The names and little nicknames that make it feel like home.",
        fields: [
          {
            type: 'conditional_options',
            conditionField: 'relationship_type',
            conditionValue: 'partner',
            id: 'relationship_role',
            label: 'They are your...',
            options: [
              { value: 'girlfriend', label: 'Girlfriend', icon: '🌸' },
              { value: 'boyfriend', label: 'Boyfriend', icon: '🌟' },
              { value: 'wife', label: 'Wife', icon: '💍' },
              { value: 'husband', label: 'Husband', icon: '🥂' }
            ]
          },
          {
            type: 'text',
            id: 'recipient_name',
            label: "Their name",
            placeholder: "e.g. Maya, Alex, Rohan",
            required: true
          },
          {
            type: 'text',
            id: 'nickname',
            label: "What do you call them? (Pet name / Nickname)",
            placeholder: "e.g. Bubu, Sunshine, Sweetheart",
            required: false
          },
          {
            type: 'text',
            id: 'sender_name',
            label: "Your name",
            placeholder: "e.g. Kabir, Sam",
            required: true
          }
        ],
        btnNext: 'Write Your Feelings →'
      },
      {
        step: 3,
        title: "Say what you actually mean.",
        subtitle: "Three short little notes and an optional heartfelt letter.",
        fields: [
          {
            type: 'textarea',
            id: 'msg_1',
            label: 'Message 1',
            placeholder: "e.g. I don't say it enough, but you make ordinary days feel magical.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_2',
            label: 'Message 2',
            placeholder: "e.g. One of my favourite things about us is laughing until our stomachs hurt.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_3',
            label: 'Message 3',
            placeholder: "e.g. With you, I never have to pretend to be anyone else.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'letter',
            label: 'Longer Letter or Special Note (Optional)',
            placeholder: "Pour your heart out here. Take all the space you need...",
            maxlength: 2500,
            required: false,
            minHeight: '140px'
          }
        ],
        suggestions: {
          en: [
            "I don't say it enough, but...",
            "You make ordinary days feel special...",
            "One of my favourite things about us is...",
            "I keep finding new reasons to care about you...",
            "Thank you for being my safe place."
          ],
          hinglish: [
            "Tumhare saath har din peaceful lagta hai...",
            "Pata nahi kaise, par tumhare aane se sab better ho gaya...",
            "Bas itna kehna tha ki you mean the world to me...",
            "Life mein sab kuch badal jaye, par humara bond hamesha aisa hi rahe."
          ]
        },
        btnNext: 'Add Special Memories →'
      },
      {
        step: 4,
        title: "Any memories worth including?",
        subtitle: "Add up to 5 photos to make the story come alive (or skip if you prefer text only).",
        fields: [
          {
            type: 'photos',
            id: 'photos',
            maxPhotos: 5
          }
        ],
        btnNext: 'Preview Your Experience ✨'
      }
    ]
  },

  apology: {
    name: 'Apology & Reconciliation',
    badge: 'Apology Experience 🕊️',
    themeColor: '#8B5CF6',
    totalSteps: 4,
    steps: [
      {
        step: 1,
        title: "Who's this apology for?",
        subtitle: "A heartfelt way to reach out and say what needs to be said.",
        fields: [
          {
            type: 'text',
            id: 'recipient_name',
            label: "Their first name",
            placeholder: "e.g. Priya, Daniel, Ananya",
            required: true
          },
          {
            type: 'text',
            id: 'sender_name',
            label: "From you (Your name)",
            placeholder: "e.g. Rahul, Chris",
            required: true
          }
        ],
        btnNext: 'Share What Happened →'
      },
      {
        step: 2,
        title: "What actually happened?",
        subtitle: "Acknowledging it honestly is the first step.",
        fields: [
          {
            type: 'options',
            id: 'reason_type',
            label: 'Select what happened',
            required: true,
            options: [
              { value: 'hurtful_words', label: '😬 I said something hurtful', icon: '😬' },
              { value: 'fight', label: '💔 We had a fight', icon: '💔' },
              { value: 'not_there', label: "⏰ I wasn't there for them", icon: '⏰' },
              { value: 'broken_promise', label: '🤞 I broke a promise', icon: '🤞' },
              { value: 'forgot_special', label: '📅 I forgot something special', icon: '📅' },
              { value: 'something_else', label: '💭 Something else', icon: '💭' }
            ]
          },
          {
            type: 'conditional_text',
            conditionField: 'reason_type',
            conditionValue: 'something_else',
            id: 'custom_reason',
            label: 'Tell us briefly what happened',
            placeholder: 'e.g. I got overwhelmed and reacted poorly...'
          }
        ],
        btnNext: 'Write In Your Words →'
      },
      {
        step: 3,
        title: "Now, in your own words.",
        subtitle: "Speak from the heart. No excuses, just honesty.",
        fields: [
          {
            type: 'textarea',
            id: 'msg_1',
            label: 'Message 1',
            placeholder: "e.g. I've been thinking non-stop about what happened, and I feel truly terrible.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_2',
            label: 'Message 2',
            placeholder: "e.g. You deserved so much better from me in that moment.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_3',
            label: 'Message 3',
            placeholder: "e.g. I value you more than my ego, and I want to make things right.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'letter',
            label: 'Sincere Letter or Reconciliation Note',
            placeholder: "Take your time to write an honest, genuine message...",
            maxlength: 2500,
            required: false,
            minHeight: '140px'
          }
        ],
        suggestions: {
          en: [
            "I've been thinking about what happened...",
            "I wish I had handled things differently...",
            "You deserved better from me...",
            "There's something I really want you to know...",
            "I'm truly sorry for hurting you."
          ],
          hinglish: [
            "Mujhe sach mein bahut bura lag raha hai jo hua...",
            "Mera wo intention bilkul nahi tha, par maine tumhe hurt kiya...",
            "Tum meri life mein kitne important ho, ye main bhool nahi sakta...",
            "Please mujhe ek baar sun lo, I really want to fix this."
          ]
        },
        btnNext: 'Add Meaningful Memories →'
      },
      {
        step: 4,
        title: "Any memory worth including here?",
        subtitle: "Remind them of the bond you share with a photo or two (optional).",
        fields: [
          {
            type: 'photos',
            id: 'photos',
            maxPhotos: 5
          }
        ],
        btnNext: 'Preview Your Apology ✨'
      }
    ]
  },

  birthday: {
    name: 'Birthday Celebration',
    badge: 'Birthday Experience 🎂',
    themeColor: '#F59E0B',
    totalSteps: 3,
    steps: [
      {
        step: 1,
        title: "Whose birthday is it?",
        subtitle: "Let's make their day feel truly celebrated.",
        fields: [
          {
            type: 'text',
            id: 'recipient_name',
            label: "Birthday Person's Name",
            placeholder: "e.g. Aashi, Liam, Tanya",
            required: true
          },
          {
            type: 'text',
            id: 'nickname',
            label: "Nickname or Pet Name",
            placeholder: "e.g. Birthday Queen, Champ",
            required: false
          },
          {
            type: 'text',
            id: 'sender_name',
            label: "From you (Your Name)",
            placeholder: "e.g. Rhea & gang",
            required: true
          },
          {
            type: 'text',
            id: 'relationship',
            label: "Your relationship to them",
            placeholder: "e.g. Best Friend, Partner, Sibling",
            required: false
          }
        ],
        btnNext: 'Write Birthday Notes →'
      },
      {
        step: 2,
        title: "Say Happy Birthday with heart.",
        subtitle: "Add birthday wishes and your favourite memory together.",
        fields: [
          {
            type: 'textarea',
            id: 'msg_1',
            label: 'Birthday Wish 1',
            placeholder: "e.g. Happy Birthday to the one who makes everyone around them smile!",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_2',
            label: 'Favourite Memory Together',
            placeholder: "e.g. Remember that road trip where we got lost and ended up singing all night?",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_3',
            label: 'A Wish For Their Year Ahead',
            placeholder: "e.g. May this year bring you all the peace, laughter, and success you deserve.",
            maxlength: 180,
            required: true
          },
          {
            type: 'textarea',
            id: 'letter',
            label: 'Longer Birthday Letter (Optional)',
            placeholder: "Write a longer note celebrating how much they mean to you...",
            maxlength: 2500,
            required: false,
            minHeight: '130px'
          }
        ],
        suggestions: {
          en: [
            "Another year of you making the world brighter!",
            "I am so lucky to have you in my corner.",
            "Here's to celebrating you today and every day.",
            "May all your quiet wishes come true this year!"
          ],
          hinglish: [
            "Happy Birthday yaara! You are the best thing ever.",
            "Tere jaisa dost milna next level blessing hai.",
            "Ye saal tere liye blockbuster ho bas yahi dua hai!",
            "Aaj ka din sirf tera hai, enjoy full power!"
          ]
        },
        btnNext: 'Add Birthday Photos →'
      },
      {
        step: 3,
        title: "Add celebration photos!",
        subtitle: "Include up to 5 memorable pictures to look back on.",
        fields: [
          {
            type: 'photos',
            id: 'photos',
            maxPhotos: 5
          }
        ],
        btnNext: 'Preview Birthday Experience 🎈'
      }
    ]
  },

  proposal: {
    name: 'Proposal & Commitment',
    badge: 'Proposal Experience 💍',
    themeColor: '#EC4899',
    totalSteps: 4,
    steps: [
      {
        step: 1,
        title: "Who are you asking?",
        subtitle: "The most important question of your lives together.",
        fields: [
          {
            type: 'text',
            id: 'recipient_name',
            label: "Their full name or what you call them",
            placeholder: "e.g. Sophia, Anya, Dev",
            required: true
          },
          {
            type: 'text',
            id: 'sender_name',
            label: "Your name",
            placeholder: "e.g. Lucas, Aarav",
            required: true
          }
        ],
        btnNext: 'The Story of You Two →'
      },
      {
        step: 2,
        title: "How did it all begin?",
        subtitle: "Revisit the moment you realized they were the one.",
        fields: [
          {
            type: 'textarea',
            id: 'msg_1',
            label: 'How you met or when you knew',
            placeholder: "e.g. The first time we sat together for coffee, three hours felt like five minutes.",
            maxlength: 220,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_2',
            label: 'Your favourite memory together',
            placeholder: "e.g. That quiet evening under the stars when everything just clicked.",
            maxlength: 220,
            required: true
          },
          {
            type: 'textarea',
            id: 'msg_3',
            label: 'What you love most about them',
            placeholder: "e.g. Your kindness, your laughter, and the way you make every place feel like home.",
            maxlength: 220,
            required: true
          }
        ],
        suggestions: {
          en: [
            "From the moment I met you, life had more color...",
            "I knew you were the one when...",
            "Loving you is the easiest choice I have ever made.",
            "I want every tomorrow to start with you."
          ],
          hinglish: [
            "Jab se tum mile ho, sab kuch complete lagta hai...",
            "Mujhe har din tumhare saath bitana hai...",
            "Tum meri sabse favourite reality ho."
          ]
        },
        btnNext: 'The Big Question & Letter →'
      },
      {
        step: 3,
        title: "The Big Question & Letter",
        subtitle: "Build towards that unforgettable moment.",
        fields: [
          {
            type: 'text',
            id: 'reason',
            label: 'The Proposal Question',
            placeholder: 'Will you marry me? 💍 (or custom question)',
            defaultValue: 'Will you marry me? 💍',
            required: true
          },
          {
            type: 'textarea',
            id: 'letter',
            label: 'Your Proposal Letter',
            placeholder: "Write the words you want them to remember for the rest of your lives...",
            maxlength: 2500,
            required: true,
            minHeight: '150px'
          }
        ],
        btnNext: 'Add Your Journey Photos →'
      },
      {
        step: 4,
        title: "Your Journey in Pictures",
        subtitle: "Add up to 5 photos of your favourite moments together (optional).",
        fields: [
          {
            type: 'photos',
            id: 'photos',
            maxPhotos: 5
          }
        ],
        btnNext: 'Preview The Proposal ✨'
      }
    ]
  }
};

class DearlyWizard {
  constructor() {
    this.type = 'love';
    this.currentStep = 1;
    this.formData = {};
    this.uploadedPhotos = []; // { file, dataUrl, name, size }
    this.activeInput = null;
    this.activeLang = 'en';
    this.extraMessages = []; // Optional extra personal messages (up to 5)
    this.draftId = null; // Associated draft experience ID if editing an existing draft
    this.maxExtraMessages = 5;
    this.extraMsgMaxChars = 180;
  }

  // Count words helper (max 250 words for letters)
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  async init() {
    // 0. Protect route: strictly require authentication for creating a gift
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
        // Read requested category to preserve it
        const urlParams = new URLSearchParams(window.location.search);
        const requestedType = (urlParams.get('type') || 'love').toLowerCase();
        let targetRedirect = `create.html?type=${encodeURIComponent(requestedType)}`;

        // Preserve draft_id if present
        const draftParam = urlParams.get('draft_id') || urlParams.get('id');
        if (draftParam) {
          targetRedirect += `&draft_id=${encodeURIComponent(draftParam)}`;
        }

        // Preserve from_gift if visitor arrived from a recipient link
        const fromGift = urlParams.get('from_gift') || sessionStorage.getItem('dearly_from_gift_url');
        if (fromGift) {
          targetRedirect += `&from_gift=${encodeURIComponent(fromGift)}`;
        }

        window.location.href = `auth.html?redirect=${encodeURIComponent(targetRedirect)}`;
        return;
      }
    }

    // 1. Read category and optional draft_id from query param
    const urlParams = new URLSearchParams(window.location.search);
    const requestedType = (urlParams.get('type') || '').toLowerCase();
    this.type = WIZARD_CONFIG[requestedType] ? requestedType : 'love';

    const draftParam = urlParams.get('draft_id') || urlParams.get('id');
    if (draftParam) {
      this.draftId = draftParam;
    }

    // 1b. Check if user arrived from a shared recipient gift link
    this.fromGiftUrl = urlParams.get('from_gift') || sessionStorage.getItem('dearly_from_gift_url') || null;
    if (this.fromGiftUrl) {
      sessionStorage.setItem('dearly_from_gift_url', this.fromGiftUrl);
    }

    // 2. Load draft state from database or sessionStorage
    if (this.draftId) {
      await this.loadDraft(this.draftId);
    } else {
      this.loadState();
    }

    // 3. Setup container references
    this.cardEl = document.getElementById('wizard-card-body');
    this.badgeEl = document.getElementById('wizard-category-badge');
    this.stepsIndicatorEl = document.getElementById('wizard-steps-indicator');
    this.progressFillEl = document.getElementById('wizard-progress-fill');
    this.btnBackEl = document.getElementById('btn-wizard-back');
    this.btnNextEl = document.getElementById('btn-wizard-next');

    // 3b. Bind Save Draft buttons
    const btnSaveDraftTop = document.getElementById('btn-save-draft');
    const btnSaveDraftBottom = document.getElementById('btn-wizard-save-draft');
    if (btnSaveDraftTop) {
      btnSaveDraftTop.addEventListener('click', () => this.saveDraft());
    }
    if (btnSaveDraftBottom) {
      btnSaveDraftBottom.addEventListener('click', () => this.saveDraft());
    }

    // 4. Bind events
    if (this.btnBackEl) {
      this.btnBackEl.addEventListener('click', () => this.prevStep());
    }
    if (this.btnNextEl) {
      this.btnNextEl.addEventListener('click', () => this.nextStep());
    }

    // 5. Render initial step
    this.render();
  }

  getConfig() {
    return WIZARD_CONFIG[this.type];
  }

  render() {
    const config = this.getConfig();
    const stepData = config.steps[this.currentStep - 1];

    if (!stepData) return;

    // Update Header Badge & Progress
    if (this.badgeEl) {
      this.badgeEl.textContent = config.badge;
      this.badgeEl.style.backgroundColor = config.themeColor + '18';
      this.badgeEl.style.color = config.themeColor;
    }

    if (this.stepsIndicatorEl) {
      this.stepsIndicatorEl.textContent = `Step ${this.currentStep} of ${config.totalSteps}`;
    }

    if (this.progressFillEl) {
      const pct = (this.currentStep / config.totalSteps) * 100;
      this.progressFillEl.style.width = `${pct}%`;
      this.progressFillEl.style.background = config.themeColor;
    }

    // Toggle Back button visibility on Step 1
    if (this.btnBackEl) {
      this.btnBackEl.style.visibility = this.currentStep === 1 ? 'hidden' : 'visible';
    }

    // Update Next button text
    if (this.btnNextEl) {
      this.btnNextEl.textContent = stepData.btnNext || 'Continue →';
    }

    // Return banner if visitor came from a shared gift
    let returnBannerHtml = '';
    if (this.fromGiftUrl) {
      returnBannerHtml = `
        <div style="margin-bottom: 14px;">
          <a href="${this.escapeHtml(this.fromGiftUrl)}" class="btn-return-gift" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: var(--color-primary); background: var(--color-primary-subtle); border: 1px solid var(--color-love-border); padding: 5px 12px; border-radius: var(--radius-full); text-decoration: none;">
            💌 ← Return to received gift
          </a>
        </div>
      `;
    }

    // Build Step HTML
    let html = `
      <div class="animate-step-enter" id="current-step-container">
        ${returnBannerHtml}
        <h2 style="font-size: clamp(1.5rem, 3.5vw, 2rem); margin-bottom: 6px; letter-spacing: -0.02em;">${stepData.title}</h2>
        <p style="color: var(--text-muted); font-size: 0.98rem; margin-bottom: var(--space-xl);">${stepData.subtitle}</p>
        <div class="step-fields">
    `;

    // Render Fields
    stepData.fields.forEach((field) => {
      html += this.renderField(field);
    });

    // Render Extra Personal Messages if current step has 'letter' field
    if (stepData.fields.some((f) => f.id === 'letter')) {
      html += this.renderExtraMessagesSection();
    }

    // Render Suggestions if available
    if (stepData.suggestions) {
      html += this.renderSuggestions(stepData.suggestions);
    }

    html += `
        </div>
      </div>
    `;

    this.cardEl.innerHTML = html;

    // Post-render bindings
    this.bindFieldEvents(stepData);

    // Scroll to top of card smoothly
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  renderExtraMessagesSection() {
    let listHtml = '';
    const messages = this.extraMessages || [];

    if (messages.length > 0) {
      listHtml = '<div class="extra-messages-list" id="extra-messages-list" style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">';
      messages.forEach((msg, idx) => {
        const chars = (msg || '').length;
        listHtml += `
          <div class="extra-message-card" data-idx="${idx}" style="background: var(--bg-surface-soft, #FFF5F7); border: 1px solid var(--border-light); border-radius: 12px; padding: 14px 16px; position: relative; transition: all 0.2s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.84rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: 6px;">
                💌 Personal Note #${idx + 1}
              </span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button type="button" class="btn-extra-msg-move btn-extra-msg-up" data-idx="${idx}" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.35; cursor:not-allowed; background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:2px 8px;"' : 'style="cursor:pointer; background:#fff; border:1px solid #cbd5e1; border-radius:4px; padding:2px 8px;"'}>
                  ↑
                </button>
                <button type="button" class="btn-extra-msg-move btn-extra-msg-down" data-idx="${idx}" title="Move Down" ${idx === messages.length - 1 ? 'disabled style="opacity:0.35; cursor:not-allowed; background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:2px 8px;"' : 'style="cursor:pointer; background:#fff; border:1px solid #cbd5e1; border-radius:4px; padding:2px 8px;"'}>
                  ↓
                </button>
                <button type="button" class="btn-extra-msg-remove" data-idx="${idx}" title="Remove Note" style="color: #EF4444; background: #fff; border: 1px solid #FCA5A5; font-size: 0.9rem; cursor: pointer; padding: 2px 8px; border-radius: 4px;">
                  ✕
                </button>
              </div>
            </div>
            <textarea class="form-textarea extra-msg-textarea" data-idx="${idx}" maxlength="180" 
                      placeholder="e.g. You make my ordinary days special, or: Remember our first chai together? ☕"
                      style="min-height: 64px; font-size: 0.92rem; padding: 10px 12px; background: #FFFFFF; width: 100%; box-sizing: border-box;">${this.escapeHtml(msg)}</textarea>
            <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
              <span class="char-counter extra-msg-counter" id="extra-counter-${idx}" style="font-size: 0.78rem; color: var(--text-muted);">${chars} / 180 chars</span>
            </div>
          </div>
        `;
      });
      listHtml += '</div>';
    }

    const canAddMore = messages.length < this.maxExtraMessages;

    return `
      <div class="extra-messages-section" style="margin-top: 24px; padding: 18px; background: rgba(244, 63, 94, 0.03); border: 1px dashed rgba(244, 63, 94, 0.28); border-radius: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 4px 0; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
              ✨ Extra Personal Messages <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(Optional • ${messages.length}/${this.maxExtraMessages})</span>
            </h3>
            <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
              Add up to 5 surprise notes or little memories revealed along your story sequence.
            </p>
          </div>
          ${canAddMore ? `
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-extra-msg" style="border-color: var(--color-primary); color: var(--color-primary); font-weight: 600;">
              + Add a Personal Message
            </button>
          ` : ''}
        </div>
        ${listHtml}
      </div>
    `;
  }

  renderField(field) {
    const val = this.formData[field.id] || field.defaultValue || '';

    // Options Grid (Pill / Cards)
    if (field.type === 'options') {
      let optHtml = `
        <div class="form-group">
          <label class="form-label">${field.label} ${field.required ? '<span style="color:var(--color-primary)">*</span>' : ''}</label>
          <div class="options-grid" data-field-id="${field.id}">
      `;
      field.options.forEach((opt) => {
        const isSelected = val === opt.value;
        optHtml += `
          <div class="option-card ${isSelected ? 'selected' : ''}" data-value="${opt.value}" role="button" tabindex="0">
            <span class="option-icon">${opt.icon || '✨'}</span>
            <span class="option-label">${opt.label}</span>
          </div>
        `;
      });
      optHtml += `
          </div>
          <input type="hidden" id="${field.id}" value="${val}">
        </div>
      `;
      return optHtml;
    }

    // Conditional Options
    if (field.type === 'conditional_options') {
      const parentVal = this.formData[field.conditionField];
      const isVisible = parentVal === field.conditionValue;
      let optHtml = `
        <div class="form-group conditional-group" id="grp-${field.id}" style="display: ${isVisible ? 'block' : 'none'};">
          <label class="form-label">${field.label}</label>
          <div class="options-grid" data-field-id="${field.id}">
      `;
      field.options.forEach((opt) => {
        const isSelected = val === opt.value;
        optHtml += `
          <div class="option-card ${isSelected ? 'selected' : ''}" data-value="${opt.value}" role="button" tabindex="0">
            <span class="option-icon">${opt.icon || '✨'}</span>
            <span class="option-label">${opt.label}</span>
          </div>
        `;
      });
      optHtml += `
          </div>
          <input type="hidden" id="${field.id}" value="${val}">
        </div>
      `;
      return optHtml;
    }

    // Conditional Text
    if (field.type === 'conditional_text') {
      const parentVal = this.formData[field.conditionField];
      const isVisible = parentVal === field.conditionValue;
      return `
        <div class="form-group conditional-group" id="grp-${field.id}" style="display: ${isVisible ? 'block' : 'none'};">
          <label class="form-label" for="${field.id}">${field.label}</label>
          <input type="text" id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" value="${val}">
        </div>
      `;
    }

    // Text Input
    if (field.type === 'text') {
      return `
        <div class="form-group">
          <label class="form-label" for="${field.id}">
            <span>${field.label} ${field.required ? '<span style="color:var(--color-primary)">*</span>' : ''}</span>
          </label>
          <input type="text" id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" value="${val}">
        </div>
      `;
    }

    // Textarea with Character or 250-Word Counter
    if (field.type === 'textarea') {
      const isLetter = field.id === 'letter';
      const max = field.maxlength || 200;

      let counterHtml = '';
      if (isLetter) {
        const words = this.countWords(val);
        const isOver = words > 250;
        const isNear = words >= 225 && words <= 250;
        const color = isOver ? '#EF4444' : (isNear ? '#F59E0B' : 'var(--text-muted)');
        const warningNotice = isOver ? '<span style="color:#EF4444; font-size:0.75rem; margin-left:6px; font-weight:600;">⚠️ Limit exceeded (max 250 words)</span>' : (isNear ? '<span style="color:#F59E0B; font-size:0.75rem; margin-left:6px;">⚠️ Approaching 250 words limit</span>' : '');

        counterHtml = `
          <div class="form-label">
            <span>${field.label} ${field.required ? '<span style="color:var(--color-primary)">*</span>' : ''}</span>
            <span class="char-counter word-counter" id="counter-${field.id}" style="color: ${color}; font-weight: 600;">
              ${words} / 250 words ${warningNotice}
            </span>
          </div>
        `;
      } else {
        const currentLen = (val || '').length;
        counterHtml = `
          <div class="form-label">
            <span>${field.label} ${field.required ? '<span style="color:var(--color-primary)">*</span>' : ''}</span>
            <span class="char-counter" id="counter-${field.id}">${currentLen} / ${max}</span>
          </div>
        `;
      }

      return `
        <div class="form-group">
          ${counterHtml}
          <textarea id="${field.id}" class="form-textarea" placeholder="${field.placeholder || ''}" 
                    ${isLetter ? '' : `maxlength="${max}"`} style="min-height: ${field.minHeight || '105px'};">${val}</textarea>
        </div>
      `;
    }

    // Photos Upload Dropzone
    if (field.type === 'photos') {
      return `
        <div class="form-group">
          <div class="dropzone" id="photo-dropzone">
            <div class="dropzone-icon">📷</div>
            <div class="dropzone-title">Tap to choose photos or drag & drop</div>
            <div class="dropzone-subtitle">JPG, PNG, WebP up to 5MB each (Max 5 photos)</div>
            <input type="file" id="photo-file-input" multiple accept="image/jpeg,image/png,image/webp" style="display: none;">
          </div>
          <div class="photos-preview-grid" id="photos-preview-grid">
            <!-- Dynamically populated previews -->
          </div>
        </div>
      `;
    }

    return '';
  }

  renderSuggestions(suggestions) {
    const list = suggestions[this.activeLang] || suggestions['en'] || [];
    let chipsHtml = '';
    list.forEach((sug) => {
      chipsHtml += `<button type="button" class="suggestion-chip" data-suggestion="${encodeURIComponent(sug)}">${sug}</button>`;
    });

    return `
      <div class="suggestions-box">
        <div class="suggestions-header">
          <span class="suggestions-title">💡 Writing Ideas (Tap to insert)</span>
          <div class="lang-toggle">
            <button type="button" class="lang-btn ${this.activeLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
            <button type="button" class="lang-btn ${this.activeLang === 'hinglish' ? 'active' : ''}" data-lang="hinglish">Hinglish</button>
          </div>
        </div>
        <div class="chips-container" id="chips-container">
          ${chipsHtml}
        </div>
      </div>
    `;
  }

  bindFieldEvents(stepData) {
    // 1. Text & Textarea bindings
    const inputs = this.cardEl.querySelectorAll('input.form-input, textarea.form-textarea');
    inputs.forEach((input) => {
      // Remember active input for suggestions
      input.addEventListener('focus', () => {
        this.activeInput = input;
      });

      // Update counters
      if (input.tagName.toLowerCase() === 'textarea') {
        const counter = document.getElementById(`counter-${input.id}`);
        input.addEventListener('input', () => {
          this.formData[input.id] = input.value;
          if (counter) {
            if (input.id === 'letter') {
              const wordCount = this.countWords(input.value);
              const isOver = wordCount > 250;
              const isNear = wordCount >= 225 && wordCount <= 250;
              const color = isOver ? '#EF4444' : (isNear ? '#F59E0B' : 'var(--text-muted)');
              const warningNotice = isOver ? '<span style="color:#EF4444; font-size:0.75rem; margin-left:6px; font-weight:600;">⚠️ Limit exceeded (max 250 words)</span>' : (isNear ? '<span style="color:#F59E0B; font-size:0.75rem; margin-left:6px;">⚠️ Approaching 250 words limit</span>' : '');
              counter.innerHTML = `${wordCount} / 250 words ${warningNotice}`;
              counter.style.color = color;
              if (isOver) {
                input.style.borderColor = '#EF4444';
              } else {
                input.style.borderColor = '';
              }
            } else {
              counter.textContent = `${input.value.length} / ${input.maxLength}`;
            }
          }
        });
      } else {
        input.addEventListener('input', () => {
          this.formData[input.id] = input.value;
        });
      }
    });

    // Default active input to first textarea or text
    if (!this.activeInput && inputs.length > 0) {
      this.activeInput = inputs[0];
    }

    // 2. Options Grid bindings
    const optionCards = this.cardEl.querySelectorAll('.option-card');
    optionCards.forEach((card) => {
      card.addEventListener('click', () => {
        const grid = card.closest('.options-grid');
        const fieldId = grid.getAttribute('data-field-id');
        const val = card.getAttribute('data-value');

        // Deselect siblings
        grid.querySelectorAll('.option-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        // Update hidden field & formData
        const hiddenEl = document.getElementById(fieldId);
        if (hiddenEl) hiddenEl.value = val;
        this.formData[fieldId] = val;

        // Check conditional toggles
        if (fieldId === 'relationship_type') {
          const roleGroup = document.getElementById('grp-relationship_role');
          if (roleGroup) {
            roleGroup.style.display = val === 'partner' ? 'block' : 'none';
          }
        }
        if (fieldId === 'reason_type') {
          const customGrp = document.getElementById('grp-custom_reason');
          if (customGrp) {
            customGrp.style.display = val === 'something_else' ? 'block' : 'none';
          }
        }

        // Sound effect
        if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
      });
    });

    // 3. Language toggle bindings
    const langBtns = this.cardEl.querySelectorAll('.lang-btn');
    langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeLang = btn.getAttribute('data-lang');
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Re-render chips
        if (stepData.suggestions) {
          const chipsContainer = document.getElementById('chips-container');
          if (chipsContainer) {
            const list = stepData.suggestions[this.activeLang] || [];
            chipsContainer.innerHTML = list
              .map((s) => `<button type="button" class="suggestion-chip" data-suggestion="${encodeURIComponent(s)}">${s}</button>`)
              .join('');
            this.bindChipClicks();
          }
        }
      });
    });

    this.bindChipClicks();

    // 4. Photo upload dropzone bindings
    const dropzone = document.getElementById('photo-dropzone');
    const fileInput = document.getElementById('photo-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files) {
          this.handlePhotoFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files) {
          this.handlePhotoFiles(fileInput.files);
        }
      });

      this.renderPhotoPreviews();
    }

    // 5. Extra Personal Messages bindings
    this.bindExtraMessagesEvents();
  }

  bindExtraMessagesEvents() {
    // 1. Add extra message button
    const btnAdd = this.cardEl.querySelector('#btn-add-extra-msg');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        if (this.extraMessages.length < this.maxExtraMessages) {
          // Push a new empty message note
          this.extraMessages.push('');
          this.saveState();
          this.render();
          // Focus the newly created textarea
          const textareas = this.cardEl.querySelectorAll('.extra-msg-textarea');
          if (textareas.length > 0) {
            const last = textareas[textareas.length - 1];
            last.focus();
            this.activeInput = last;
          }
          if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
        }
      });
    }

    // 2. Extra message textarea inputs
    const msgTextareas = this.cardEl.querySelectorAll('.extra-msg-textarea');
    msgTextareas.forEach((ta) => {
      const idx = parseInt(ta.getAttribute('data-idx'), 10);
      const counter = document.getElementById(`extra-counter-${idx}`);

      ta.addEventListener('focus', () => {
        this.activeInput = ta;
      });

      ta.addEventListener('input', () => {
        this.extraMessages[idx] = ta.value;
        if (counter) {
          counter.textContent = `${ta.value.length} / 180 chars`;
        }
      });
    });

    // 3. Move Up
    const upBtns = this.cardEl.querySelectorAll('.btn-extra-msg-up');
    upBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const temp = this.extraMessages[idx];
          this.extraMessages[idx] = this.extraMessages[idx - 1];
          this.extraMessages[idx - 1] = temp;
          this.saveState();
          this.render();
          if (window.dearlyAudio) window.dearlyAudio.playSlide();
        }
      });
    });

    // 4. Move Down
    const downBtns = this.cardEl.querySelectorAll('.btn-extra-msg-down');
    downBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx < this.extraMessages.length - 1) {
          const temp = this.extraMessages[idx];
          this.extraMessages[idx] = this.extraMessages[idx + 1];
          this.extraMessages[idx + 1] = temp;
          this.saveState();
          this.render();
          if (window.dearlyAudio) window.dearlyAudio.playSlide();
        }
      });
    });

    // 5. Remove
    const removeBtns = this.cardEl.querySelectorAll('.btn-extra-msg-remove');
    removeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.extraMessages.splice(idx, 1);
        this.saveState();
        this.render();
      });
    });
  }

  bindChipClicks() {
    const chips = this.cardEl.querySelectorAll('.suggestion-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = decodeURIComponent(chip.getAttribute('data-suggestion'));
        if (this.activeInput) {
          // If empty, insert directly; otherwise append
          if (this.activeInput.value.trim() === '') {
            this.activeInput.value = text;
          } else {
            this.activeInput.value = this.activeInput.value + ' ' + text;
          }
          this.formData[this.activeInput.id] = this.activeInput.value;
          this.activeInput.dispatchEvent(new Event('input'));
          this.activeInput.focus();

          if (window.dearlyAudio) window.dearlyAudio.playHeartPop();
        }
      });
    });
  }

  async handlePhotoFiles(files) {
    const maxPhotos = 5;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 12 * 1024 * 1024; // 12MB

    for (let i = 0; i < files.length; i++) {
      if (this.uploadedPhotos.length >= maxPhotos) {
        this.showToast(`Maximum ${maxPhotos} photos allowed.`);
        break;
      }

      const file = files[i];

      if (!allowedTypes.includes(file.type)) {
        this.showToast(`Invalid file format: ${file.name}. Use JPG, PNG or WebP.`);
        continue;
      }

      if (file.size > maxSize) {
        this.showToast(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 12MB allowed.`);
        continue;
      }

      this.showToast('Optimizing photo for story... 📷');

      try {
        const compressedDataUrl = await this.compressImageFile(file);
        this.uploadedPhotos.push({
          file: file,
          dataUrl: compressedDataUrl,
          name: file.name,
          size: compressedDataUrl.length
        });
        this.renderPhotoPreviews();
        this.saveState();
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadedPhotos.push({
            file: file,
            dataUrl: e.target.result,
            name: file.name,
            size: file.size
          });
          this.renderPhotoPreviews();
          this.saveState();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.compressDataUrl(e.target.result, maxWidth, maxHeight, quality)
          .then(resolve)
          .catch(() => resolve(e.target.result));
      };
      reader.onerror = () => reject(new Error('Failed to read photo file'));
      reader.readAsDataURL(file);
    });
  }

  compressDataUrl(dataUrl, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof dataUrl !== 'string') return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  renderPhotoPreviews() {
    const grid = document.getElementById('photos-preview-grid');
    if (!grid) return;

    grid.innerHTML = '';
    this.uploadedPhotos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.className = 'photo-preview-item';
      item.innerHTML = `
        <img src="${photo.dataUrl}" class="photo-preview-img" alt="Memory Photo ${idx + 1}">
        <button type="button" class="photo-remove-btn" data-index="${idx}" title="Remove photo">✕</button>
      `;
      grid.appendChild(item);
    });

    // Remove buttons
    grid.querySelectorAll('.photo-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'), 10);
        this.uploadedPhotos.splice(index, 1);
        this.renderPhotoPreviews();
        this.saveState();
      });
    });
  }

  validateCurrentStep() {
    const config = this.getConfig();
    const stepData = config.steps[this.currentStep - 1];
    let isValid = true;
    let firstInvalidEl = null;

    stepData.fields.forEach((field) => {
      if (field.required) {
        const el = document.getElementById(field.id);
        const val = (this.formData[field.id] !== undefined && this.formData[field.id] !== '')
          ? this.formData[field.id]
          : (el ? el.value : '');
        if (el && val && this.formData[field.id] === undefined) {
          this.formData[field.id] = val;
        }

        if (!val || String(val).trim() === '') {
          isValid = false;
          if (el) {
            el.classList.add('animate-shake');
            el.style.borderColor = '#EF4444';
            if (!firstInvalidEl) firstInvalidEl = el;
            setTimeout(() => {
              el.classList.remove('animate-shake');
            }, 500);
          }
        } else if (el) {
          el.style.borderColor = '';
        }
      }
    });

    // Check letter 250-word limit if letter field is present
    const letterEl = document.getElementById('letter');
    if (letterEl) {
      const letterVal = letterEl.value || this.formData.letter || '';
      const wordCount = this.countWords(letterVal);
      if (wordCount > 250) {
        isValid = false;
        letterEl.classList.add('animate-shake');
        letterEl.style.borderColor = '#EF4444';
        setTimeout(() => letterEl.classList.remove('animate-shake'), 500);
        this.showToast(`Your letter has ${wordCount} words (max limit: 250 words). Please shorten it to continue 💌`);
        if (!firstInvalidEl) firstInvalidEl = letterEl;
      }
    }

    if (!isValid) {
      if (!letterEl || this.countWords(letterEl.value) <= 250) {
        this.showToast('Please fill in the required fields to continue 💌');
      }
      if (firstInvalidEl) firstInvalidEl.focus();
    }

    return isValid;
  }

  async nextStep() {
    if (!this.validateCurrentStep()) return;

    this.saveState();
    const config = this.getConfig();

    if (window.dearlyAudio) window.dearlyAudio.playSlide();

    if (this.currentStep < config.totalSteps) {
      this.currentStep++;
      this.render();
    } else {
      // Final step complete -> Navigate to Preview
      await this.goToPreview();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.saveState();
      this.currentStep--;
      if (window.dearlyAudio) window.dearlyAudio.playSlide();
      this.render();
    }
  }

  async goToPreview() {
    // Re-check letter word limit
    if (this.formData.letter) {
      const words = this.countWords(this.formData.letter);
      if (words > 250) {
        this.showToast(`Cannot open preview: Letter has ${words} words (max 250 words allowed).`);
        return;
      }
    }

    if (this.btnNextEl) {
      this.btnNextEl.disabled = true;
      this.btnNextEl.textContent = 'Loading Preview... ✨';
    }

    try {
      // Compress any existing large dataUrls if present
      for (let i = 0; i < this.uploadedPhotos.length; i++) {
        if (this.uploadedPhotos[i].dataUrl && this.uploadedPhotos[i].dataUrl.length > 500000) {
          this.uploadedPhotos[i].dataUrl = await this.compressDataUrl(this.uploadedPhotos[i].dataUrl);
        }
      }

      // Sync any active text inputs
      const currentInputs = this.cardEl?.querySelectorAll('input.form-input, textarea.form-textarea');
      if (currentInputs) {
        currentInputs.forEach((inp) => {
          if (inp.id) this.formData[inp.id] = inp.value;
        });
      }

      // Package complete experience data
      const completeData = {
        id: this.draftId || null,
        draft_id: this.draftId || null,
        type: this.type,
        sender_name: this.formData.sender_name || 'Someone who cares',
        recipient_name: this.formData.recipient_name || 'You',
        relationship: this.formData.relationship || this.formData.relationship_role || this.formData.relationship_type || '',
        nickname: this.formData.nickname || '',
        reason: this.formData.reason || this.formData.custom_reason || this.formData.reason_type || '',
        messages: [
          this.formData.msg_1 || '',
          this.formData.msg_2 || '',
          this.formData.msg_3 || ''
        ].filter(Boolean),
        extra_messages: (this.extraMessages || []).map(m => m.trim()).filter(Boolean),
        letter: this.formData.letter || '',
        photos: this.uploadedPhotos.map((p) => ({
          dataUrl: p.dataUrl,
          name: p.name
        }))
      };

      // 1. Save to IndexedDB (virtually unlimited quota for photos)
      if (window.DearlyStorage) {
        await window.DearlyStorage.set('dearly_preview_data', completeData);
      }

      // 2. Save to sessionStorage (with graceful quota protection)
      try {
        sessionStorage.setItem('dearly_preview_data', JSON.stringify(completeData));
      } catch (quotaErr) {
        console.warn('SessionStorage quota exceeded, storing in IndexedDB:', quotaErr);
        try {
          const lightweight = { ...completeData, photos: [] };
          sessionStorage.setItem('dearly_preview_data', JSON.stringify(lightweight));
        } catch (e2) {}
      }

      // 3. Navigate smoothly to preview.html
      window.location.href = `preview.html?type=${encodeURIComponent(this.type)}`;
    } catch (err) {
      console.error('Error opening preview:', err);
      // Ensure navigation still proceeds
      window.location.href = `preview.html?type=${encodeURIComponent(this.type)}`;
    }
  }

  async saveDraft(silent = false) {
    // 1. Check authentication
    const user = window.dearlyAuth?.getUser?.();
    if (!user) {
      if (!silent) {
        const currentUrl = `create.html?type=${this.type}` + (this.draftId ? `&draft_id=${this.draftId}` : '');
        this.showToast('Please sign in or create an account to save drafts 💌');
        setTimeout(() => {
          window.location.href = `auth.html?redirect=${encodeURIComponent(currentUrl)}`;
        }, 1200);
      }
      return false;
    }

    // 2. Read current inputs from DOM into formData
    if (this.cardEl) {
      const inputs = this.cardEl.querySelectorAll('input.form-input, textarea.form-textarea');
      inputs.forEach(inp => {
        if (inp.id) this.formData[inp.id] = inp.value;
      });
      const extraTas = this.cardEl.querySelectorAll('.extra-msg-textarea');
      extraTas.forEach(ta => {
        const idx = parseInt(ta.getAttribute('data-idx'), 10);
        this.extraMessages[idx] = ta.value;
      });
    }

    // Check letter 250-word limit
    if (this.formData.letter) {
      const wordCount = this.countWords(this.formData.letter);
      if (wordCount > 250) {
        this.showToast(`Cannot save draft: Letter has ${wordCount} words (max 250 words allowed).`);
        return false;
      }
    }

    const btnDraftTop = document.getElementById('btn-save-draft');
    const btnDraftBottom = document.getElementById('btn-wizard-save-draft');
    const updateButtons = (text, disabled) => {
      if (btnDraftTop) { btnDraftTop.textContent = text; btnDraftTop.disabled = disabled; }
      if (btnDraftBottom) { btnDraftBottom.textContent = text; btnDraftBottom.disabled = disabled; }
    };

    updateButtons('Saving... ⏳', true);

    try {
      const payload = {
        id: this.draftId || null,
        type: this.type,
        sender_name: this.formData.sender_name || 'Someone who cares',
        recipient_name: this.formData.recipient_name || 'My Dear',
        relationship: this.formData.relationship || this.formData.relationship_role || this.formData.relationship_type || '',
        nickname: this.formData.nickname || '',
        reason: this.formData.reason || this.formData.custom_reason || this.formData.reason_type || '',
        messages: [
          this.formData.msg_1 || '',
          this.formData.msg_2 || '',
          this.formData.msg_3 || ''
        ].filter(Boolean),
        extra_messages: (this.extraMessages || []).map(m => m.trim()).filter(Boolean),
        letter: this.formData.letter || '',
        photos: this.uploadedPhotos.map(p => ({
          dataUrl: p.dataUrl,
          name: p.name
        })),
        status: 'draft'
      };

      const result = await window.dearlyDB.saveExperience(payload);

      if (result && result.success) {
        this.draftId = result.id || this.draftId;
        this.saveState();

        // Update URL to preserve draft ID without page reload
        const newUrl = `create.html?type=${this.type}&draft_id=${this.draftId}`;
        window.history.replaceState(null, '', newUrl);

        updateButtons('✅ Draft Saved', false);
        if (!silent) {
          this.showToast('Draft saved successfully! You can resume editing anytime from your dashboard 💾');
        }
        setTimeout(() => updateButtons('💾 Save Draft', false), 2500);
        return true;
      } else {
        throw new Error(result?.error || 'Could not save draft');
      }
    } catch (err) {
      console.error('Error saving draft:', err);
      updateButtons('⚠️ Save Failed', false);
      this.showToast(`Error saving draft: ${err.message || 'Please check your connection and retry.'}`);
      setTimeout(() => updateButtons('💾 Retry Save', false), 2500);
      return false;
    }
  }

  async loadDraft(draftId) {
    try {
      this.showToast('Loading your saved draft... ⏳');
      const data = await window.dearlyDB.getExperienceById(draftId);
      if (data) {
        this.draftId = data.id || draftId;
        this.type = data.type || this.type;
        const rel = data.relationship || '';
        let relType = 'partner';
        let relRole = '';
        if (['friend', 'family'].includes(rel)) {
          relType = rel;
        } else if (['girlfriend', 'boyfriend', 'wife', 'husband'].includes(rel)) {
          relType = 'partner';
          relRole = rel;
        } else if (rel === 'partner') {
          relType = 'partner';
          relRole = '';
        } else if (rel) {
          relType = 'partner';
          relRole = rel;
        }

        this.formData = {
          recipient_name: data.recipient_name || '',
          sender_name: data.sender_name || '',
          nickname: data.nickname || '',
          relationship: rel,
          relationship_role: relRole,
          relationship_type: relType,
          reason: data.reason || '',
          reason_type: data.reason || '',
          custom_reason: data.reason || '',
          letter: data.letter || '',
          msg_1: data.messages?.[0] || '',
          msg_2: data.messages?.[1] || '',
          msg_3: data.messages?.[2] || ''
        };
        this.extraMessages = Array.isArray(data.extra_messages) ? [...data.extra_messages] : [];
        if (data.photos && Array.isArray(data.photos)) {
          this.uploadedPhotos = data.photos.map((p, idx) => ({
            dataUrl: typeof p === 'string' ? p : (p.dataUrl || p.url || ''),
            name: (typeof p === 'object' && p.name) ? p.name : `Memory ${idx + 1}`
          }));
        }
        this.saveState();
        this.showToast('Draft loaded! Continue where you left off ✨');
      }
    } catch (e) {
      console.warn('Could not load draft from DB, falling back to local state:', e);
      this.loadState();
    }
  }

  saveState() {
    try {
      const state = {
        draftId: this.draftId,
        type: this.type,
        currentStep: this.currentStep,
        formData: this.formData,
        extraMessages: this.extraMessages,
        uploadedPhotos: this.uploadedPhotos.map((p) => ({
          dataUrl: p.dataUrl,
          name: p.name,
          size: p.size
        }))
      };
      sessionStorage.setItem('dearly_wizard_state_' + this.type, JSON.stringify(state));

      // Also persist to IndexedDB
      if (window.DearlyStorage) {
        window.DearlyStorage.set('dearly_wizard_state_' + this.type, state);
      }
    } catch (e) {
      console.warn('Session storage save warning (likely photo size):', e);
      try {
        const lightState = {
          draftId: this.draftId,
          type: this.type,
          currentStep: this.currentStep,
          formData: this.formData,
          extraMessages: this.extraMessages,
          uploadedPhotos: this.uploadedPhotos.map((p) => ({ name: p.name, size: p.size }))
        };
        sessionStorage.setItem('dearly_wizard_state_' + this.type, JSON.stringify(lightState));
      } catch (e2) {}
    }
  }

  loadState() {
    try {
      const saved = sessionStorage.getItem('dearly_wizard_state_' + this.type);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.formData = parsed.formData || {};
        this.extraMessages = Array.isArray(parsed.extraMessages) ? parsed.extraMessages : [];
        this.draftId = parsed.draftId || this.draftId || null;
        this.uploadedPhotos = parsed.uploadedPhotos || [];
        // Keep step at 1 or saved
        this.currentStep = parsed.currentStep || 1;
      }
    } catch (e) {
      console.warn('Error loading wizard state:', e);
    }
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('wizard-card-body')) {
    window.wizardInstance = new DearlyWizard();
    await window.wizardInstance.init();
  }
});
