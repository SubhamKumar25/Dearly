/**
 * DEARLY — Supabase Client & Database Services
 * Handles anonymous authentication, database inserts/queries,
 * storage photo uploads, and seamless Local Demo Mode fallback.
 */

class DearlyDatabaseService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.currentUser = null;
    this.demoStorageKey = 'dearly_local_experiences';
    this.init();
  }

  async init() {
    if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
      try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
          this.client = window.supabase.createClient(
            window.DEARLY_CONFIG.SUPABASE_URL,
            window.DEARLY_CONFIG.SUPABASE_ANON_KEY
          );

          // Attempt Supabase Anonymous Auth for creator ownership
          try {
            const { data: sessionData } = await this.client.auth.getSession();
            if (!sessionData?.session) {
              const { data: authData, error: authError } = await this.client.auth.signInAnonymously();
              if (!authError && authData?.user) {
                this.currentUser = authData.user;
              }
            } else {
              this.currentUser = sessionData.session.user;
            }
          } catch (authErr) {
            console.warn('Anonymous auth note (proceeding with anon key):', authErr.message);
          }

          this.isReady = true;
          console.log('✅ Supabase initialized successfully.');
          return;
        }
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    }

    console.info('ℹ️ Running DEARLY in Local Demo Mode (Browser Storage). Real Supabase keys can be set in assets/js/config.js');
    this.isReady = false;
  }

  /**
   * Upload an array of File objects or base64 data to Supabase Storage
   * Returns array of public photo URLs or data URLs
   */
  async uploadPhotos(photoItems, experienceId) {
    if (!photoItems || photoItems.length === 0) return [];

    const uploadedUrls = [];

    for (let i = 0; i < photoItems.length; i++) {
      const item = photoItems[i];

      // If it's already a URL (e.g. from editing or demo), keep it
      if (typeof item === 'string') {
        uploadedUrls.push(item);
        continue;
      }

      // If we have an active Supabase client and storage configured
      if (this.isReady && this.client) {
        try {
          const file = item.file || item;
          const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
          const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt.toLowerCase()) ? fileExt : 'jpg';
          const fileName = `photos/${experienceId}_${Date.now()}_${i}.${safeExt}`;

          const { data, error } = await this.client.storage
            .from(window.DEARLY_CONFIG.STORAGE_BUCKET)
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true,
              contentType: file.type || 'image/jpeg'
            });

          if (error) {
            console.warn(`Storage upload error for photo ${i}, falling back to data URL:`, error.message);
            // Fallback to data URL if upload failed
            uploadedUrls.push(item.dataUrl || await this.fileToDataUrl(file));
          } else {
            const { data: publicUrlData } = this.client.storage
              .from(window.DEARLY_CONFIG.STORAGE_BUCKET)
              .getPublicUrl(fileName);

            uploadedUrls.push(publicUrlData.publicUrl);
          }
        } catch (uploadErr) {
          console.error('Error during photo upload:', uploadErr);
          uploadedUrls.push(item.dataUrl || '');
        }
      } else {
        // Local Demo Mode: store data URL directly
        uploadedUrls.push(item.dataUrl || (item.file ? await this.fileToDataUrl(item.file) : ''));
      }
    }

    return uploadedUrls.filter(Boolean);
  }

  /**
   * Save experience into database
   */
  async saveExperience(experienceData) {
    const publicId = crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUuid();
    const experienceId = crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUuid();

    // 1. Process and upload photos
    let finalPhotoUrls = [];
    if (experienceData.photos && experienceData.photos.length > 0) {
      finalPhotoUrls = await this.uploadPhotos(experienceData.photos, publicId);
    }

    // 2. Prepare payload matching schema
    const payload = {
      id: experienceId,
      public_id: publicId,
      creator_id: this.currentUser ? this.currentUser.id : null,
      type: experienceData.type,
      sender_name: experienceData.sender_name || 'Someone who cares',
      recipient_name: experienceData.recipient_name || 'You',
      relationship: experienceData.relationship || '',
      nickname: experienceData.nickname || '',
      reason: experienceData.reason || '',
      messages: experienceData.messages || [],
      letter: experienceData.letter || '',
      memories: experienceData.memories || [],
      photos: finalPhotoUrls,
      theme: experienceData.theme || experienceData.type || 'default',
      status: 'published'
    };

    // 3. Save to Supabase if ready
    if (this.isReady && this.client) {
      try {
        const { data, error } = await this.client
          .from('experiences')
          .insert([payload])
          .select('public_id')
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(error.message || 'Failed to save experience to database');
        }

        return {
          success: true,
          public_id: data ? data.public_id : publicId,
          isDemo: false
        };
      } catch (dbErr) {
        console.warn('Saving to cloud failed, using local storage backup:', dbErr.message);
        // Fallback to local storage if network or permissions fail
        this.saveToLocalDemo(publicId, payload);
        return {
          success: true,
          public_id: publicId,
          isDemo: true,
          warning: 'Saved locally. Supabase connection had an issue: ' + dbErr.message
        };
      }
    }

    // 4. Fallback: Save to Local Storage Demo Mode
    this.saveToLocalDemo(publicId, payload);
    return {
      success: true,
      public_id: publicId,
      isDemo: true
    };
  }

  /**
   * Fetch experience by public_id
   */
  async getExperienceByPublicId(publicId) {
    if (!publicId) return null;

    // 1. If Supabase is active, query DB
    if (this.isReady && this.client) {
      try {
        const { data, error } = await this.client
          .from('experiences')
          .select('public_id, type, sender_name, recipient_name, relationship, nickname, reason, messages, letter, memories, photos, theme, created_at')
          .eq('public_id', publicId)
          .eq('status', 'published')
          .maybeSingle();

        if (error) {
          console.warn('Supabase query error:', error.message);
        } else if (data) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, checking local demo store:', err);
      }
    }

    // 2. Check local demo storage
    const localData = this.getFromLocalDemo(publicId);
    if (localData) {
      return localData;
    }

    return null;
  }

  // --- Local Demo Mode Storage Helpers ---

  saveToLocalDemo(publicId, payload) {
    try {
      const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
      store[publicId] = payload;
      localStorage.setItem(this.demoStorageKey, JSON.stringify(store));
    } catch (e) {
      console.warn('Local storage error:', e);
    }
  }

  getFromLocalDemo(publicId) {
    try {
      const store = JSON.parse(localStorage.getItem(this.demoStorageKey) || '{}');
      return store[publicId] || null;
    } catch (e) {
      return null;
    }
  }

  fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  generateFallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Global instance
window.dearlyDB = new DearlyDatabaseService();
