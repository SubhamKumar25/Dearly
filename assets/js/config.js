/**
 * DEARLY — Global Configuration
 * 
 * Instructions:
 * 1. Create a free project at https://supabase.com
 * 2. Copy your Project URL and Anon/Public Key from Project Settings -> API
 * 3. Paste them below into SUPABASE_URL and SUPABASE_ANON_KEY
 * 
 * Note: If left with placeholders, DEARLY will automatically run in
 * "Local Demo Mode" using browser storage so you can test all features immediately!
 */

const DEARLY_CONFIG = {
  // Configured Supabase project URL:
  SUPABASE_URL: 'https://fxkuietohwiajllzjakc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3VpZXRvaHdpYWpsbHpqYWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTE4MDYsImV4cCI6MjEwNzA4NzgwNn0.8FkvY8M3D5-aac4xr-wYIwMmgBHKhLeMQl_Z-YQu56M',
  
  // Storage bucket name as defined in supabase-schema.sql
  STORAGE_BUCKET: 'experience-photos',

  // Maximum photo upload size in bytes (5 MB)
  MAX_PHOTO_SIZE_BYTES: 5 * 1024 * 1024,

  // Maximum number of photos allowed per experience
  MAX_PHOTOS_COUNT: 5,

  // Allowed image MIME types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],

  // App domain for sharing (falls back to window.location.origin)
  APP_URL: window.location.origin
};

// Check if valid Supabase configuration is present
function isSupabaseConfigured() {
  return (
    DEARLY_CONFIG.SUPABASE_URL &&
    DEARLY_CONFIG.SUPABASE_ANON_KEY &&
    !DEARLY_CONFIG.SUPABASE_URL.includes('xyzcompany') &&
    !DEARLY_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_YOUR_ANON_KEY') &&
    !DEARLY_CONFIG.SUPABASE_ANON_KEY.includes('dummy_anon_key')
  );
}

window.DEARLY_CONFIG = DEARLY_CONFIG;
window.isSupabaseConfigured = isSupabaseConfigured;

// Global DEARLY Utilities & Validation Limits
const DearlyUtils = {
  LIMITS: {
    STORY_WORD_LIMIT: 250,
    LETTER_WORD_LIMIT: 1500,
    MAX_EXTRA_MESSAGES: 5,
    EXTRA_MSG_CHAR_LIMIT: 300,
    MAX_PHOTOS: 5
  },

  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Shared IndexedDB cross-page storage helper
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

window.DearlyUtils = DearlyUtils;
window.DearlyStorage = DearlyStorage;

