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

  // Maximum photo upload size in bytes (2 MB strict limit)
  MAX_PHOTO_SIZE_BYTES: 2 * 1024 * 1024,

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

// Advanced Browser-Side Image Compressor (Strictly <= 2 MB)
const DearlyImageCompressor = {
  MAX_BYTES: 2 * 1024 * 1024, // 2,097,152 bytes (2 MB)
  TARGET_BYTES: 1.85 * 1024 * 1024, // 1.85 MB target threshold for safety margin

  /**
   * Compress an image file, blob, or dataUrl to strictly <= 2 MB.
   * Preserves EXIF orientation via createImageBitmap or canvas.
   * Progressively scales quality and dimensions if file exceeds 2 MB.
   */
  async compress(input, options = {}) {
    if (!input) return null;

    const initialMaxDim = options.maxDimension || 1920;
    const initialQuality = options.quality !== undefined ? options.quality : 0.84;
    const outputType = options.type || 'image/jpeg';
    const originalName = (typeof input === 'object' && input.name) ? input.name : 'photo.jpg';

    // 1. Convert input to a Blob if needed
    let sourceBlob = null;
    let tempObjectUrl = null;

    if (input instanceof Blob || (typeof File !== 'undefined' && input instanceof File)) {
      sourceBlob = input;
    } else if (typeof input === 'string') {
      if (input.startsWith('data:image/')) {
        sourceBlob = this.dataUrlToBlob(input);
      } else {
        // External URL: return as-is
        return { url: input, name: originalName, size: 0, isExternal: true };
      }
    } else if (typeof input === 'object' && input.dataUrl) {
      sourceBlob = this.dataUrlToBlob(input.dataUrl);
    }

    if (!sourceBlob) {
      throw new Error('Unsupported image input format');
    }

    // 2. Decode image using createImageBitmap (with EXIF orientation support) or Image fallback
    let sourceWidth = 0;
    let sourceHeight = 0;
    let imageSource = null;
    let usedBitmap = false;

    try {
      if (typeof createImageBitmap === 'function') {
        // createImageBitmap with imageOrientation respects EXIF orientation in modern browsers
        imageSource = await createImageBitmap(sourceBlob, { imageOrientation: 'from-image' });
        sourceWidth = imageSource.width;
        sourceHeight = imageSource.height;
        usedBitmap = true;
      }
    } catch (bitmapErr) {
      // Fall back to Image element
      usedBitmap = false;
    }

    if (!usedBitmap || !imageSource) {
      tempObjectUrl = URL.createObjectURL(sourceBlob);
      imageSource = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image in browser'));
        img.src = tempObjectUrl;
      });
      sourceWidth = imageSource.naturalWidth || imageSource.width;
      sourceHeight = imageSource.naturalHeight || imageSource.height;
    }

    try {
      // 3. Iterative Compression Loop
      let currentMaxDim = initialMaxDim;
      let currentQuality = initialQuality;
      let resultBlob = null;
      let iterations = 0;
      const maxIterations = 6;

      while (iterations < maxIterations) {
        iterations++;

        // Calculate target dimensions
        let w = sourceWidth;
        let h = sourceHeight;
        if (w > currentMaxDim || h > currentMaxDim) {
          if (w > h) {
            h = Math.round((h * currentMaxDim) / w);
            w = currentMaxDim;
          } else {
            w = Math.round((w * currentMaxDim) / h);
            h = currentMaxDim;
          }
        }

        // Draw onto canvas
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
        }

        // Export to Blob
        resultBlob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), outputType, currentQuality);
        });

        // Check size: strictly <= 2 MB
        if (resultBlob && resultBlob.size <= this.MAX_BYTES) {
          // Success! Result is within 2 MB limit
          break;
        }

        // Exceeded 2 MB: step down quality and dimensions
        if (currentQuality > 0.6) {
          currentQuality -= 0.12;
        } else if (currentMaxDim > 1200) {
          currentMaxDim = Math.round(currentMaxDim * 0.8);
          currentQuality = 0.72;
        } else {
          currentQuality = Math.max(0.4, currentQuality - 0.1);
          currentMaxDim = Math.round(currentMaxDim * 0.75);
        }
      }

      // Final safety guarantee
      if (!resultBlob || resultBlob.size > this.MAX_BYTES) {
        // Last-resort compact fallback
        const smallCanvas = document.createElement('canvas');
        const factor = Math.min(1000 / sourceWidth, 1000 / sourceHeight, 0.5);
        smallCanvas.width = Math.max(1, Math.round(sourceWidth * factor));
        smallCanvas.height = Math.max(1, Math.round(sourceHeight * factor));
        const sCtx = smallCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(imageSource, 0, 0, smallCanvas.width, smallCanvas.height);
        }
        resultBlob = await new Promise((resolve) => {
          smallCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.6);
        });
      }

      // Convert result to dataUrl for immediate previews
      const resultDataUrl = await this.blobToDataUrl(resultBlob);

      // Clean name with .jpg extension
      let safeName = originalName.replace(/\.[^/.]+$/, '') + '.jpg';

      return {
        blob: resultBlob,
        dataUrl: resultDataUrl,
        name: safeName,
        size: resultBlob.size,
        type: 'image/jpeg'
      };
    } finally {
      // Clean up resources
      if (tempObjectUrl) {
        try { URL.revokeObjectURL(tempObjectUrl); } catch (e) {}
      }
      if (usedBitmap && imageSource && typeof imageSource.close === 'function') {
        try { imageSource.close(); } catch (e) {}
      }
    }
  },

  dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(',');
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }
};

window.DearlyImageCompressor = DearlyImageCompressor;

// Global DEARLY Utilities & Validation Limits
const DearlyUtils = {
  LIMITS: {
    STORY_WORD_LIMIT: 250,
    LETTER_WORD_LIMIT: 1500,
    MAX_EXTRA_MESSAGES: 5,
    EXTRA_MSG_CHAR_LIMIT: 300,
    MAX_PHOTOS: 5,
    MAX_PHOTO_SIZE_BYTES: 2 * 1024 * 1024 // 2 MB
  },

  compressImage: (input, options) => DearlyImageCompressor.compress(input, options),

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

