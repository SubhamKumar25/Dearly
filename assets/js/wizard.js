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
            maxlength: 900,
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
            maxlength: 900,
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
            maxlength: 900,
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
            maxlength: 1000,
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

        // Preserve from_gift if visitor arrived from a recipient link
        const fromGift = urlParams.get('from_gift') || sessionStorage.getItem('dearly_from_gift_url');
        if (fromGift) {
          targetRedirect += `&from_gift=${encodeURIComponent(fromGift)}`;
        }

        window.location.href = `auth.html?redirect=${encodeURIComponent(targetRedirect)}`;
        return;
      }
    }

    // 1. Read category from query param
    const urlParams = new URLSearchParams(window.location.search);
    const requestedType = (urlParams.get('type') || '').toLowerCase();
    this.type = WIZARD_CONFIG[requestedType] ? requestedType : 'love';

    // 1b. Check if user arrived from a shared recipient gift link
    this.fromGiftUrl = urlParams.get('from_gift') || sessionStorage.getItem('dearly_from_gift_url') || null;
    if (this.fromGiftUrl) {
      sessionStorage.setItem('dearly_from_gift_url', this.fromGiftUrl);
    }

    // 2. Load draft state from sessionStorage
    this.loadState();

    // 3. Setup container references
    this.cardEl = document.getElementById('wizard-card-body');
    this.badgeEl = document.getElementById('wizard-category-badge');
    this.stepsIndicatorEl = document.getElementById('wizard-steps-indicator');
    this.progressFillEl = document.getElementById('wizard-progress-fill');
    this.btnBackEl = document.getElementById('btn-wizard-back');
    this.btnNextEl = document.getElementById('btn-wizard-next');

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

    // Textarea with Character Counter
    if (field.type === 'textarea') {
      const max = field.maxlength || 200;
      const currentLen = (val || '').length;
      return `
        <div class="form-group">
          <div class="form-label">
            <span>${field.label} ${field.required ? '<span style="color:var(--color-primary)">*</span>' : ''}</span>
            <span class="char-counter" id="counter-${field.id}">${currentLen} / ${max}</span>
          </div>
          <textarea id="${field.id}" class="form-textarea" placeholder="${field.placeholder || ''}" 
                    maxlength="${max}" style="min-height: ${field.minHeight || '105px'};">${val}</textarea>
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
            counter.textContent = `${input.value.length} / ${input.maxLength}`;
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

    if (!isValid) {
      this.showToast('Please fill in the required fields to continue 💌');
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

      // Package complete experience data
      const completeData = {
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

  saveState() {
    try {
      const state = {
        type: this.type,
        currentStep: this.currentStep,
        formData: this.formData,
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
          type: this.type,
          currentStep: this.currentStep,
          formData: this.formData,
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
